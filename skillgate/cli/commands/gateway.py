"""Native gateway commands for agent hook integrations."""

from __future__ import annotations

import json
import os
from pathlib import Path

import typer
from nacl.signing import VerifyKey
from rich.console import Console

from skillgate.core.gateway import (
    BomGate,
    RuntimeEnvironment,
    ToolOutputGuard,
    append_lineage_edge,
    append_signed_decision,
    create_scope_token,
    finalize_session,
    init_session,
    run_runtime_prechecks,
    verify_approval_file,
    verify_scope_token,
)
from skillgate.core.reputation import evaluate_runtime_reputation

console = Console(stderr=True)


def gateway_check_command(
    command: str = typer.Option(..., "--command", help="Planned tool command string."),
    env: str = typer.Option("dev", "--env", help="Runtime environment: dev|ci|prod|strict"),
    skill_id: str | None = typer.Option(
        None,
        "--skill-id",
        help="Optional skill identifier used for AI-BOM runtime validation.",
    ),
    skill_hash: str | None = typer.Option(
        None,
        "--skill-hash",
        help="Optional skill content hash used for AI-BOM runtime validation.",
    ),
    scan_attestation: str | None = typer.Option(
        None,
        "--scan-attestation",
        help="Optional SkillGate scan attestation marker for AI-BOM gate.",
    ),
    bom_store: str = typer.Option(
        ".skillgate/bom/approved.json",
        "--bom-store",
        help="Path to approved AI-BOM store JSON.",
    ),
    artifact: str | None = typer.Option(
        None,
        "--artifact",
        help="Write signed gateway check artifact to this path.",
    ),
    reputation_store: str = typer.Option(
        ".skillgate/reputation/reputation.json",
        "--reputation-store",
        help="Path to signed reputation graph JSON.",
    ),
    org_id: str | None = typer.Option(
        None,
        "--org-id",
        help="Optional organization identifier for scoped capability budgets.",
    ),
    approval_file: str | None = typer.Option(
        None,
        "--approval-file",
        help="Signed approval file path for reviewer quorum enforcement.",
    ),
    required_reviewers: int = typer.Option(
        0,
        "--required-reviewers",
        help="Minimum unique reviewers required in approval file for hardened environments.",
    ),
) -> None:
    """Run pre-execution checks for native agent hook integrations."""
    env_value = _parse_environment(env)
    actor = os.environ.get("USER", "unknown")
    parent_session_id = _resolve_parent_session()
    session, signing_key = init_session(
        environment=env_value.value,
        command=[command],
        actor=actor,
        parent_session_id=parent_session_id,
    )
    artifact_path = (
        Path(artifact) if artifact else _default_artifact_path(session.session_id, "check")
    )

    precheck = run_runtime_prechecks(
        command=[command],
        environment=env_value,
        api_key=os.environ.get("SKILLGATE_API_KEY"),
        session_id=session.session_id,
        org_id=org_id or os.environ.get("SKILLGATE_ORG_ID"),
    )
    append_signed_decision(
        session,
        signing_key,
        phase="precheck",
        outcome="allow" if precheck.allowed else "block",
        code=precheck.code,
        severity=precheck.severity.value,
        reason=precheck.reason,
        metadata={"command": command, "command_classes": list(precheck.command_classes)},
    )

    allowed = precheck.allowed
    decision_code = precheck.code
    decision_reason = precheck.reason

    requires_provenance = env_value in {
        RuntimeEnvironment.CI,
        RuntimeEnvironment.PROD,
        RuntimeEnvironment.STRICT,
    }
    if allowed and requires_provenance and (not skill_id or not skill_hash or not scan_attestation):
        append_signed_decision(
            session,
            signing_key,
            phase="provenance",
            outcome="block",
            code="SG-RT-PROV-001",
            severity="high",
            reason=(
                "Missing required runtime provenance fields. "
                "Provide --skill-id, --skill-hash, and --scan-attestation."
            ),
        )
        allowed = False
        decision_code = "SG-RT-PROV-001"
        decision_reason = (
            "Missing required runtime provenance fields "
            "(--skill-id, --skill-hash, --scan-attestation)."
        )

    if allowed and skill_id:
        gate = BomGate.from_store(Path(bom_store), mode=env_value.value)
        bom_decision = gate.check(skill_id, skill_hash, scan_attestation)
        append_signed_decision(
            session,
            signing_key,
            phase="bom_gate",
            outcome="allow" if bom_decision.allowed else "block",
            code=bom_decision.code,
            severity="critical" if not bom_decision.allowed else "low",
            reason=bom_decision.reason,
            metadata={"skill_id": skill_id, "warning": bom_decision.warning},
        )
        allowed = bom_decision.allowed
        decision_code = bom_decision.code
        decision_reason = bom_decision.reason

    reviewers_required = max(
        required_reviewers,
        _parse_nonnegative_int_env("SKILLGATE_APPROVAL_REQUIRED_REVIEWERS"),
    )
    if allowed and requires_provenance and reviewers_required > 0:
        if not approval_file:
            append_signed_decision(
                session,
                signing_key,
                phase="approval",
                outcome="block",
                code="SG-RT-APPROVAL-001",
                severity="high",
                reason="Approval file required but missing.",
            )
            allowed = False
            decision_code = "SG-RT-APPROVAL-001"
            decision_reason = "Approval file required but missing."
        else:
            approval = verify_approval_file(
                path=Path(approval_file),
                required_reviewers=reviewers_required,
                skill_id=skill_id or "",
                skill_hash=skill_hash or "",
                environment=env_value.value,
            )
            append_signed_decision(
                session,
                signing_key,
                phase="approval",
                outcome="allow" if approval.allowed else "block",
                code=approval.code,
                severity="low" if approval.allowed else "high",
                reason=approval.reason,
                metadata={"reviewer_count": approval.reviewer_count},
            )
            allowed = approval.allowed
            decision_code = approval.code
            decision_reason = approval.reason

    if allowed:
        reputation = evaluate_runtime_reputation(
            bundle_hash=skill_hash,
            environment=env_value,
            store_path=Path(reputation_store),
        )
        append_signed_decision(
            session,
            signing_key,
            phase="reputation",
            outcome="allow" if reputation.allowed else "block",
            code=reputation.code,
            severity="high" if not reputation.allowed else "low",
            reason=reputation.reason,
            metadata={
                "verdict": reputation.verdict.value,
                "confidence": reputation.confidence,
                "bundle_hash": reputation.redacted_bundle_hash,
            },
        )
        allowed = reputation.allowed
        decision_code = reputation.code
        decision_reason = reputation.reason

    scope_token = None
    if allowed:
        scope_token = create_scope_token(
            parent_session=session.session_id,
            max_entitlement_tier=os.environ.get("SKILLGATE_TIER", "team"),
            allowed_tool_classes=precheck.command_classes,
            signing_key=signing_key,
        )
        if parent_session_id:
            append_lineage_edge(
                session,
                parent_session_id=parent_session_id,
                child_session_id=session.session_id,
                tool=command.split(" ", 1)[0],
                decision="allow",
            )
        append_signed_decision(
            session,
            signing_key,
            phase="scope_token",
            outcome="allow",
            code="SG-TRUST-TOKEN-ISSUED",
            severity="low",
            reason="Issued scope token for native hook caller.",
        )

    finalize_session(session, signing_key, artifact_path)
    typer.echo(
        json.dumps(
            {
                "allowed": allowed,
                "code": decision_code,
                "reason": decision_reason,
                "session_id": session.session_id,
                "artifact_path": str(artifact_path),
                "scope_token": scope_token,
                "scope_public_key": signing_key.verify_key.encode().hex(),
            },
            sort_keys=True,
            separators=(",", ":"),
        )
    )
    raise typer.Exit(code=0 if allowed else 1)


def gateway_scan_output_command(
    env: str = typer.Option("dev", "--env", help="Runtime environment: dev|ci|prod|strict"),
    output_text: str | None = typer.Option(
        None,
        "--output-text",
        help="Output text to scan before LLM re-injection.",
    ),
    output_file: str | None = typer.Option(
        None,
        "--output-file",
        help="Path to file containing output text to scan.",
    ),
    top_outcome: str | None = typer.Option(
        None,
        "--top-outcome",
        help="Override TOP outcome: annotate | sanitize | block.",
    ),
    artifact: str | None = typer.Option(
        None,
        "--artifact",
        help="Write signed output-scan artifact to this path.",
    ),
) -> None:
    """Scan tool output for TOP risk in native hook workflows."""
    env_value = _parse_environment(env)
    text = _resolve_output_text(output_text, output_file)

    session, signing_key = init_session(
        environment=env_value.value,
        command=["<native-output-scan>"],
        actor=os.environ.get("USER", "unknown"),
    )
    artifact_path = (
        Path(artifact) if artifact else _default_artifact_path(session.session_id, "output-scan")
    )

    guard = ToolOutputGuard(environment=env_value, outcome_override=top_outcome)
    result = guard.scan(text)
    append_signed_decision(
        session,
        signing_key,
        phase="tool_output",
        outcome=result.outcome.lower(),
        code=result.rule_id or "SG-TOP-PASS",
        severity=result.severity.value if result.severity else "low",
        reason="Native output scan decision.",
        metadata={"matched_patterns": list(result.matched_patterns)},
    )
    finalize_session(session, signing_key, artifact_path)

    typer.echo(
        json.dumps(
            {
                "outcome": result.outcome,
                "rule_id": result.rule_id,
                "artifact_path": str(artifact_path),
                "matched_patterns": list(result.matched_patterns),
            },
            sort_keys=True,
            separators=(",", ":"),
        )
    )
    raise typer.Exit(code=1 if result.outcome == "BLOCK" else 0)


def _resolve_output_text(output_text: str | None, output_file: str | None) -> str:
    if output_text is not None:
        return output_text
    if output_file is not None:
        file_path = Path(output_file)
        if not file_path.exists():
            raise typer.BadParameter(f"Output file not found: {output_file}")
        return file_path.read_text(encoding="utf-8")
    raise typer.BadParameter("Provide one of --output-text or --output-file.")


def _default_artifact_path(session_id: str, suffix: str) -> Path:
    return Path(".skillgate/runtime") / f"{session_id}-{suffix}.json"


def _parse_environment(value: str) -> RuntimeEnvironment:
    norm = value.lower().strip()
    try:
        return RuntimeEnvironment(norm)
    except ValueError as exc:
        raise typer.BadParameter("Environment must be one of: dev, ci, prod, strict.") from exc


def _resolve_parent_session() -> str | None:
    token = os.environ.get("SKILLGATE_SCOPE_TOKEN")
    if not token:
        return None

    parent_key = os.environ.get("SKILLGATE_SCOPE_PUBLIC_KEY")
    if not parent_key:
        console.print("[red]SG-TRUST-001[/red]: scope token provided without verification key.")
        raise typer.Exit(code=1)
    try:
        verify_key = VerifyKey(bytes.fromhex(parent_key))
        payload = verify_scope_token(token, verify_key)
    except Exception as exc:  # noqa: BLE001
        console.print(f"[red]SG-TRUST-001[/red]: {exc}")
        raise typer.Exit(code=1) from exc
    return payload.parent_session


def _parse_nonnegative_int_env(name: str) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return 0
    try:
        value = int(raw)
    except ValueError:
        return 0
    return value if value > 0 else 0
