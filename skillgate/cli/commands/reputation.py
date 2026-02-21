"""Signed reputation graph commands."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import typer
from rich.console import Console

from skillgate.core.gateway import RuntimeEnvironment
from skillgate.core.reputation import evaluate_runtime_reputation
from skillgate.core.reputation.models import (
    ReputationEntry,
    ReputationVerdict,
    SignedReputationData,
)
from skillgate.core.reputation.verifier import sign_reputation_data, verify_reputation_data
from skillgate.core.signer.keys import load_signing_key

console = Console(stderr=True)


def reputation_verify_command(
    store: str = typer.Argument(help="Path to signed reputation JSON."),
) -> None:
    """Verify signed reputation graph payload integrity."""
    path = Path(store)
    if not path.exists():
        raise typer.BadParameter(f"Reputation store not found: {store}")
    data = SignedReputationData(**json.loads(path.read_text(encoding="utf-8")))
    verify_reputation_data(data)
    typer.echo('{"verified":true}')


def reputation_check_command(
    bundle_hash: str = typer.Option(..., "--bundle-hash", help="Bundle hash to evaluate."),
    env: str = typer.Option("prod", "--env", help="Environment: dev|ci|prod|strict"),
    store: str = typer.Option(
        ".skillgate/reputation/reputation.json",
        "--store",
        help="Path to signed reputation JSON.",
    ),
) -> None:
    """Evaluate one bundle hash against signed reputation graph policy."""
    environment = RuntimeEnvironment(env.lower())
    decision = evaluate_runtime_reputation(
        bundle_hash=bundle_hash,
        environment=environment,
        store_path=Path(store),
    )
    payload: dict[str, Any] = {
        "allowed": decision.allowed,
        "code": decision.code,
        "reason": decision.reason,
        "verdict": decision.verdict.value,
        "confidence": decision.confidence,
        "bundle_hash": decision.redacted_bundle_hash,
    }
    typer.echo(json.dumps(payload, sort_keys=True, separators=(",", ":")))
    raise typer.Exit(code=0 if decision.allowed else 1)


def reputation_submit_command(
    bundle_hash: str = typer.Option(..., "--bundle-hash", help="SHA-256 bundle hash."),
    verdict: str = typer.Option(
        ...,
        "--verdict",
        help="Verdict: known_safe | suspicious | known_malicious",
    ),
    confidence: float = typer.Option(0.8, "--confidence", help="Confidence score (0.0-1.0)."),
    reason: str = typer.Option("", "--reason", help="Short reasoning for verdict."),
    bundle_name: str = typer.Option(
        "anonymous-skill",
        "--bundle-name",
        help="Bundle display name. Ignored when --anonymized is enabled.",
    ),
    anonymized: bool = typer.Option(
        True,
        "--anonymized/--full",
        help="Submit anonymized record (no identifying bundle name/source).",
    ),
    outbox: str = typer.Option(
        ".skillgate/reputation/submissions.ndjson",
        "--outbox",
        help="Path to local submission outbox file.",
    ),
    key_dir: str | None = typer.Option(
        None,
        "--key-dir",
        help="Optional signing key directory. Defaults to ~/.skillgate/keys.",
    ),
) -> None:
    """Create a signed anonymized reputation submission event in local outbox."""
    try:
        verdict_value = ReputationVerdict(verdict.strip().lower())
    except ValueError as exc:
        raise typer.BadParameter(
            "Verdict must be one of: known_safe, suspicious, known_malicious"
        ) from exc
    if not (0.0 <= confidence <= 1.0):
        raise typer.BadParameter("Confidence must be between 0.0 and 1.0")

    now = datetime.now(timezone.utc).date().isoformat()
    entry = ReputationEntry(
        bundle_hash=bundle_hash,
        bundle_name="anonymous-skill" if anonymized else bundle_name,
        verdict=verdict_value,
        confidence=confidence,
        reason=reason,
        source="anonymous-submission" if anonymized else "organization-submission",
        first_seen=now,
        last_seen=now,
    )
    signed = sign_reputation_data(
        SignedReputationData(entries=[entry]),
        bytes(load_signing_key(Path(key_dir) if key_dir else None)),
    )
    event = {
        "anonymized": anonymized,
        "schema_version": "1",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "signed_payload": signed.model_dump(mode="json"),
    }

    outbox_path = Path(outbox)
    outbox_path.parent.mkdir(parents=True, exist_ok=True)
    with outbox_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, sort_keys=True, separators=(",", ":")))
        handle.write("\n")

    typer.echo(
        json.dumps(
            {
                "ok": True,
                "outbox": str(outbox_path),
                "anonymized": anonymized,
                "bundle_hash": f"{bundle_hash[:6]}...{bundle_hash[-6:]}",
                "verdict": verdict_value.value,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
    )
