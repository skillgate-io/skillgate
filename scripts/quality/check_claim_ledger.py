#!/usr/bin/env python3
"""Validate YAML claim ledger against active pricing catalog claims."""

from __future__ import annotations

import importlib.util
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

import yaml

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
LEDGER_PATH = ROOT / "docs" / "CLAIM-LEDGER.yaml"
LEGACY_LEDGER_JSON_PATH = ROOT / "docs" / "CLAIM-LEDGER.json"
TIER_ORDER = ["free", "pro", "team", "enterprise"]

_CAPABILITY_KEY = re.compile(r"^Capability\.([A-Z_]+)@([a-z_]+)$")
_LIMIT_KEY = re.compile(r"^Limit\.([a-z_]+)=([0-9]+)@([a-z_]+)$")
_MODE_KEY = re.compile(r"^Mode\.([a-z_|]+)@([a-z_]+)$")


def _load_pricing_catalog() -> Any:
    catalog_path = ROOT / "skillgate" / "api" / "pricing_catalog.py"
    spec = importlib.util.spec_from_file_location("claim_pricing_catalog", catalog_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load pricing catalog module: {catalog_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    types_namespace = {
        "datetime": datetime,
        "timezone": timezone,
        "Literal": Literal,
        "TierId": module.TierId,
        "ControlStackLayerId": module.ControlStackLayerId,
        "PlanAvailability": module.PlanAvailability,
        "PricingTier": module.PricingTier,
        "ControlStackLayer": module.ControlStackLayer,
        "ComparisonRow": module.ComparisonRow,
        "PricingCatalog": module.PricingCatalog,
    }
    module.PricingTier.model_rebuild(_types_namespace=types_namespace)
    module.ControlStackLayer.model_rebuild(_types_namespace=types_namespace)
    module.ComparisonRow.model_rebuild(_types_namespace=types_namespace)
    module.PricingCatalog.model_rebuild(_types_namespace=types_namespace)
    return module.pricing_catalog_payload()


def _load_entitlement_contract() -> tuple[dict[str, set[str]], dict[str, dict[str, int]]]:
    models_path = ROOT / "skillgate" / "core" / "entitlement" / "models.py"
    spec = importlib.util.spec_from_file_location("claim_entitlement_models", models_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load entitlement models module: {models_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    types_namespace = {
        "Capability": module.Capability,
        "Entitlement": module.Entitlement,
        "EntitlementLimits": module.EntitlementLimits,
        "EntitlementSource": module.EntitlementSource,
        "Tier": module.Tier,
        "datetime": datetime,
    }
    module.EntitlementLimits.model_rebuild(_types_namespace=types_namespace)
    module.Entitlement.model_rebuild(_types_namespace=types_namespace)

    tier_capabilities: dict[str, set[str]] = {}
    tier_limits: dict[str, dict[str, int]] = {}
    for tier in module.Tier:
        entitlement = module.TIER_ENTITLEMENTS[tier]()
        tier_name = str(tier.value).lower()
        tier_capabilities[tier_name] = {cap.value for cap in entitlement.capabilities}
        tier_limits[tier_name] = {
            "scans_per_day": entitlement.limits.scans_per_day,
            "max_findings_returned": entitlement.limits.max_findings_returned,
            "max_seats": entitlement.limits.max_seats,
        }
    return tier_capabilities, tier_limits


def _active_claim_contract() -> tuple[set[str], list[str], set[str]]:
    catalog = _load_pricing_catalog()
    ids: set[str] = set()
    duplicates: list[str] = []
    claim_sentences: set[str] = set()

    for tier in catalog.tiers:
        claim_sentences.update(tier.features)
        claim_sentences.update(tier.limits)
        for claim_id in tier.claim_ids:
            if claim_id in ids:
                duplicates.append(claim_id)
            ids.add(claim_id)
    for row in catalog.comparison_rows:
        claim_sentences.add(row.capability)
        if row.claim_id in ids:
            duplicates.append(row.claim_id)
        ids.add(row.claim_id)
    return ids, duplicates, claim_sentences


def _load_ledger() -> dict[str, Any]:
    loaded = yaml.safe_load(LEDGER_PATH.read_text(encoding="utf-8"))
    if not isinstance(loaded, dict):
        raise ValueError("CLAIM-LEDGER.yaml must deserialize to an object.")
    return loaded


def _validate_capability_boundary(
    *,
    claim_id: str,
    minimum_tier: str,
    capability: str,
    tier_capabilities: dict[str, set[str]],
) -> list[str]:
    errors: list[str] = []
    min_index = TIER_ORDER.index(minimum_tier)
    for idx, tier in enumerate(TIER_ORDER):
        has_capability = capability in tier_capabilities.get(tier, set())
        if idx < min_index and has_capability:
            errors.append(
                f"{claim_id}: capability '{capability}' unexpectedly enabled for lower tier "
                f"'{tier}'."
            )
        if idx >= min_index and not has_capability:
            errors.append(
                f"{claim_id}: capability '{capability}' missing for required tier '{tier}'."
            )
    return errors


def _validate_entitlement_key(
    *,
    claim_id: str,
    claim: dict[str, Any],
    proof_text: str,
    tier_capabilities: dict[str, set[str]],
    tier_limits: dict[str, dict[str, int]],
) -> list[str]:
    errors: list[str] = []
    entitlement_key = str(claim.get("entitlement_key", "")).strip()
    minimum_tier = str(claim.get("minimum_tier", "")).strip().lower()
    capability = str(claim.get("capability", "")).strip().lower()
    limit_key = str(claim.get("limit_key", "")).strip()
    limit_value = claim.get("limit_value")

    if minimum_tier and minimum_tier not in TIER_ORDER:
        errors.append(f"{claim_id}: invalid minimum_tier '{minimum_tier}'.")

    match = _CAPABILITY_KEY.match(entitlement_key)
    if match:
        capability_key = match.group(1)
        tier_from_key = match.group(2)
        resolved_capability = capability_key.lower()

        if tier_from_key != minimum_tier:
            errors.append(
                f"{claim_id}: entitlement_key tier '{tier_from_key}' must match minimum_tier "
                f"'{minimum_tier}'."
            )
        if capability and capability != resolved_capability:
            errors.append(
                f"{claim_id}: capability field '{capability}' must match entitlement_key "
                f"'{resolved_capability}'."
            )
        if resolved_capability not in tier_capabilities.get(tier_from_key, set()):
            errors.append(
                f"{claim_id}: entitlement capability '{resolved_capability}' is not enabled "
                f"for tier '{tier_from_key}'."
            )
        errors.extend(
            _validate_capability_boundary(
                claim_id=claim_id,
                minimum_tier=tier_from_key,
                capability=resolved_capability,
                tier_capabilities=tier_capabilities,
            )
        )
        if f"Capability.{capability_key}" not in proof_text:
            errors.append(
                f"{claim_id}: proof_surface does not reference 'Capability.{capability_key}'."
            )
        return errors

    match = _LIMIT_KEY.match(entitlement_key)
    if match:
        parsed_limit_key = match.group(1)
        parsed_limit_value = int(match.group(2))
        tier_from_key = match.group(3)

        if tier_from_key != minimum_tier:
            errors.append(
                f"{claim_id}: entitlement_key tier '{tier_from_key}' must match minimum_tier "
                f"'{minimum_tier}'."
            )
        if limit_key and parsed_limit_key != limit_key:
            errors.append(
                f"{claim_id}: limit_key '{limit_key}' must match entitlement_key "
                f"'{parsed_limit_key}'."
            )
        if limit_value is not None and parsed_limit_value != limit_value:
            errors.append(
                f"{claim_id}: limit_value '{limit_value}' must match entitlement_key "
                f"'{parsed_limit_value}'."
            )

        actual_limit = tier_limits.get(tier_from_key, {}).get(parsed_limit_key)
        if actual_limit != parsed_limit_value:
            errors.append(
                f"{claim_id}: limit mismatch for '{parsed_limit_key}' "
                f"(ledger={parsed_limit_value}, entitlement={actual_limit})."
            )
        if parsed_limit_key not in proof_text:
            errors.append(
                f"{claim_id}: proof_surface does not reference limit key '{parsed_limit_key}'."
            )
        return errors

    match = _MODE_KEY.match(entitlement_key)
    if match:
        modes = [mode for mode in match.group(1).split("|") if mode]
        tier_from_key = match.group(2)

        if tier_from_key != minimum_tier:
            errors.append(
                f"{claim_id}: entitlement_key tier '{tier_from_key}' must match minimum_tier "
                f"'{minimum_tier}'."
            )
        for mode in modes:
            if mode not in proof_text:
                errors.append(
                    f"{claim_id}: proof_surface does not reference entitlement mode '{mode}'."
                )
        return errors

    errors.append(
        f"{claim_id}: entitlement_key format unsupported. "
        "Use Capability.<NAME>@<tier>, Limit.<key>=<value>@<tier>, or Mode.<modes>@<tier>."
    )
    return errors


def validate_claim_ledger() -> list[str]:
    errors: list[str] = []
    if not LEDGER_PATH.exists():
        return [f"Missing claim ledger: {LEDGER_PATH}"]
    if LEGACY_LEDGER_JSON_PATH.exists():
        try:
            legacy_path = str(LEGACY_LEDGER_JSON_PATH.relative_to(ROOT))
        except ValueError:
            legacy_path = str(LEGACY_LEDGER_JSON_PATH)
        errors.append(f"Legacy claim ledger file detected. Use YAML only: {legacy_path}")

    payload = _load_ledger()
    claims_raw = payload.get("claims", [])
    if not isinstance(claims_raw, list) or not claims_raw:
        return ["CLAIM-LEDGER.yaml must contain non-empty 'claims' list."]

    tier_capabilities, tier_limits = _load_entitlement_contract()
    active_ids, duplicate_active_ids, active_sentences = _active_claim_contract()

    if duplicate_active_ids:
        deduped = ", ".join(sorted(set(duplicate_active_ids)))
        errors.append(f"Duplicate active claim IDs in pricing catalog: {deduped}")

    claims_by_id: dict[str, dict[str, Any]] = {}
    for claim in claims_raw:
        if not isinstance(claim, dict):
            errors.append("Claim row must be an object.")
            continue
        claim_id = str(claim.get("claim_id", "")).strip()
        if not claim_id:
            errors.append("Claim row missing claim_id.")
            continue
        if claim_id in claims_by_id:
            errors.append(f"Duplicate claim_id in ledger: {claim_id}")
            continue
        claims_by_id[claim_id] = claim

    missing = sorted(active_ids - claims_by_id.keys())
    if missing:
        errors.append(f"Active pricing claims missing from ledger: {', '.join(missing)}")

    orphaned = sorted(claims_by_id.keys() - active_ids)
    for claim_id in orphaned:
        if str(claims_by_id[claim_id].get("status", "")).strip() == "safe":
            errors.append(
                f"{claim_id}: safe claim is not referenced by active pricing catalog claim IDs."
            )

    for claim_id in sorted(active_ids):
        claim = claims_by_id.get(claim_id)
        if claim is None:
            continue

        status = str(claim.get("status", "")).strip()
        if status != "safe":
            errors.append(
                f"{claim_id}: status must be 'safe' for active pricing claims (got '{status}')."
            )

        for field in ("sentence", "proof_surface", "test_reference", "entitlement_key"):
            value = str(claim.get(field, "")).strip()
            if not value:
                errors.append(f"{claim_id}: missing required field '{field}'.")

        sentence = str(claim.get("sentence", "")).strip()
        if sentence and sentence not in active_sentences:
            errors.append(
                f"{claim_id}: sentence must exist in active backend pricing catalog copy."
            )

        proof_surface = str(claim.get("proof_surface", "")).strip()
        proof_path = ROOT / proof_surface if proof_surface else None
        if proof_path is None or not proof_path.exists():
            errors.append(f"{claim_id}: proof_surface path not found: {proof_surface}")
            proof_text = ""
        else:
            proof_text = proof_path.read_text(encoding="utf-8")

        test_reference = str(claim.get("test_reference", "")).strip()
        test_path = ROOT / test_reference if test_reference else None
        if test_path is None or not test_path.exists():
            errors.append(f"{claim_id}: test_reference path not found: {test_reference}")

        errors.extend(
            _validate_entitlement_key(
                claim_id=claim_id,
                claim=claim,
                proof_text=proof_text,
                tier_capabilities=tier_capabilities,
                tier_limits=tier_limits,
            )
        )

    return errors


def main() -> int:
    try:
        errors = validate_claim_ledger()
    except Exception as exc:  # pragma: no cover - CLI guardrail
        print("Claim ledger validation failed with exception:")
        print(f"- {exc}")
        return 1
    if errors:
        print("Claim ledger validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Claim ledger validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
