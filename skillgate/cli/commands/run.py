"""Runtime gateway wrapper command: `skillgate run -- <agent-cli ...>`."""

from __future__ import annotations

import os
import subprocess
import sys
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
    resolve_sandbox_backend,
    run_runtime_prechecks,
    verify_approval_file,
    verify_scope_token,
)
from skillgate.core.gateway.executor import build_sandboxed_command
from skillgate.core.reputation import evaluate_runtime_reputation

console = Console(stderr=True)


def run_command(
    ctx: typer.Context,
    env: str = typer.Option(
        "dev",
        "--env",
        help="Runtime environment: dev | ci | prod | strict",
    ),
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
    enable_top_guard: bool = typer.Option(
        True,
        "--enable-top-guard/--disable-top-guard",
        help="Enable Tool Output Poisoning guard on command output.",
    ),
    top_outcome: str | None = typer.Option(
        None,
        "--top-outcome",
        help="Override TOP outcome when detection fires: annotate | sanitize | block.",
    ),
    artifact: str | None = typer.Option(
        None,
        "--artifact",
        help="Write signed runtime session artifact to this path.",
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
    """Wrap an agent CLI command with runtime gateway policy enforcement."""
    env_value = _parse_environment(env)
    wrapped_command = _extract_wrapped_command(ctx.args)
    if not wrapped_command:
        console.print(
            "[red]Error:[/red] Missing wrapped command. Example: skillgate run -- codex ..."
        )
        raise typer.Exit(code=3)

    actor = os.environ.get("USER", "unknown")
    parent_session_id = _resolve_parent_session()
    session, signing_key = init_session(
        environment=env_value.value,
        command=wrapped_command,
        actor=actor,
        parent_session_id=parent_session_id,
    )
    artifact_path = Path(artifact) if artifact else _default_artifact_path(session.session_id)

    precheck = run_runtime_prechecks(
        command=wrapped_command,
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
        metadata={"command": wrapped_command, "command_classes": list(precheck.command_classes)},
    )
    if not precheck.allowed:
        finalize_session(session, signing_key, artifact_path)
        console.print(f"[red]{precheck.code}[/red]: {precheck.reason}")
        raise typer.Exit(code=1)

    requires_provenance = env_value in {
        RuntimeEnvironment.CI,
        RuntimeEnvironment.PROD,
        RuntimeEnvironment.STRICT,
    }
    if requires_provenance and (not skill_id or not skill_hash or not scan_attestation):
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
        finalize_session(session, signing_key, artifact_path)
        console.print(
            "[red]SG-RT-PROV-001[/red]: missing required "
            "--skill-id/--skill-hash/--scan-attestation."
        )
        raise typer.Exit(code=1)

    if skill_id:
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
        if not bom_decision.allowed:
            finalize_session(session, signing_key, artifact_path)
            console.print(f"[red]{bom_decision.code}[/red]: {bom_decision.reason}")
            raise typer.Exit(code=1)

    reviewers_required = max(
        required_reviewers,
        _parse_nonnegative_int_env("SKILLGATE_APPROVAL_REQUIRED_REVIEWERS"),
    )
    if requires_provenance and reviewers_required > 0:
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
            finalize_session(session, signing_key, artifact_path)
            console.print("[red]SG-RT-APPROVAL-001[/red]: missing --approval-file.")
            raise typer.Exit(code=1)
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
        if not approval.allowed:
            finalize_session(session, signing_key, artifact_path)
            console.print(f"[red]{approval.code}[/red]: {approval.reason}")
            raise typer.Exit(code=1)

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
    if not reputation.allowed:
        finalize_session(session, signing_key, artifact_path)
        console.print(f"[red]{reputation.code}[/red]: {reputation.reason}")
        raise typer.Exit(code=1)

    scope_token = create_scope_token(
        parent_session=session.session_id,
        max_entitlement_tier=os.environ.get("SKILLGATE_TIER", "team"),
        allowed_tool_classes=precheck.command_classes,
        signing_key=signing_key,
    )
    run_env = os.environ.copy()
    run_env["SKILLGATE_SCOPE_TOKEN"] = scope_token
    run_env["SKILLGATE_SCOPE_PUBLIC_KEY"] = signing_key.verify_key.encode().hex()
    if parent_session_id:
        append_lineage_edge(
            session,
            parent_session_id=parent_session_id,
            child_session_id=session.session_id,
            tool=wrapped_command[0],
            decision="allow",
        )

    timeout_seconds = int(os.environ.get("SKILLGATE_RUNTIME_TIMEOUT_SECONDS", "120"))
    sandbox_backend = resolve_sandbox_backend()
    exec_command = build_sandboxed_command(
        backend=sandbox_backend,
        command=wrapped_command,
        timeout_seconds=timeout_seconds,
    )
    append_signed_decision(
        session,
        signing_key,
        phase="execute_start",
        outcome="allow",
        code="SG-RT-SBX-EXEC",
        severity="low",
        reason=f"Executing with sandbox backend '{sandbox_backend.value}'.",
        metadata={
            "backend": sandbox_backend.value,
            "command": exec_command,
        },
    )

    try:
        completed = subprocess.run(
            exec_command,
            capture_output=True,
            text=True,
            env=run_env,
            check=False,
            timeout=max(1, timeout_seconds),
        )
    except subprocess.TimeoutExpired as exc:
        append_signed_decision(
            session,
            signing_key,
            phase="execute",
            outcome="block",
            code="SG-RT-TIMEOUT",
            severity="high",
            reason=f"Wrapped command timed out after {exc.timeout}s",
        )
        finalize_session(session, signing_key, artifact_path)
        console.print("[red]SG-RT-TIMEOUT[/red]: wrapped command exceeded runtime timeout.")
        raise typer.Exit(code=1) from exc
    except OSError as exc:
        append_signed_decision(
            session,
            signing_key,
            phase="execute",
            outcome="block",
            code="SG-RT-EXEC-001",
            severity="critical",
            reason=f"Wrapped command execution failed: {exc}",
        )
        finalize_session(session, signing_key, artifact_path)
        console.print(f"[red]SG-RT-EXEC-001[/red]: {exc}")
        raise typer.Exit(code=2) from exc

    output_stdout = completed.stdout
    output_stderr = completed.stderr
    if enable_top_guard:
        guard = ToolOutputGuard(environment=env_value, outcome_override=top_outcome)
        scan_result = guard.scan(output_stdout + "\n" + output_stderr)
        append_signed_decision(
            session,
            signing_key,
            phase="tool_output",
            outcome=scan_result.outcome.lower(),
            code=scan_result.rule_id or "SG-TOP-PASS",
            severity=scan_result.severity.value if scan_result.severity else "low",
            reason="TOP guard decision on wrapped command output.",
            metadata={"matched_patterns": list(scan_result.matched_patterns)},
        )
        if scan_result.outcome == "BLOCK":
            finalize_session(session, signing_key, artifact_path)
            console.print(
                "[red]SG-TOP-001[/red]: output quarantined by Tool Output Poisoning guard."
            )
            raise typer.Exit(code=1)
        if scan_result.outcome == "SANITIZE" and scan_result.sanitized_text is not None:
            output_stdout = scan_result.sanitized_text
            output_stderr = ""
        elif scan_result.outcome == "ANNOTATE":
            console.print(
                "[yellow]TOP_DETECTED[/yellow]: "
                "suspicious tool output passed through in annotate mode."
            )

    append_signed_decision(
        session,
        signing_key,
        phase="complete",
        outcome="allow" if completed.returncode == 0 else "warn",
        code="SG-RT-PROC-EXIT",
        severity="low" if completed.returncode == 0 else "medium",
        reason=f"Wrapped process exited with code {completed.returncode}.",
    )
    finalize_session(session, signing_key, artifact_path)

    if output_stdout:
        sys.stdout.write(output_stdout)
    if output_stderr:
        sys.stderr.write(output_stderr)
    raise typer.Exit(code=completed.returncode)


def _extract_wrapped_command(args: list[str]) -> list[str]:
    if not args:
        return []
    if args[0] == "--":
        return args[1:]
    return args


def _default_artifact_path(session_id: str) -> Path:
    return Path(".skillgate/runtime") / f"{session_id}.json"


def _parse_environment(value: str) -> RuntimeEnvironment:
    norm = value.lower().strip()
    try:
        return RuntimeEnvironment(norm)
    except ValueError as exc:
        msg = "Environment must be one of: dev, ci, prod, strict."
        raise typer.BadParameter(msg) from exc


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
