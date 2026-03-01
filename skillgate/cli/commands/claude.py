"""Claude Code ecosystem governance CLI commands."""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Literal

import typer

from skillgate.ecosystem import (
    BehaviorBaselineStore,
    ClaudeEcosystemScanner,
    ClaudePluginRegistry,
    ClaudePolicyPack,
    ClaudeScopeResolver,
    GovernanceIdentity,
    HookAttestationStore,
    HookAuditLog,
    LineageStore,
    TamperEvidentLedger,
    correlate_findings,
    detect_protected_changes,
    format_scan_summary_sarif,
    get_policy_pack,
    list_policy_packs,
    protected_changes_to_dict,
    resolve_governance_identity,
    verify_protected_change_approval,
    write_policy_pack,
    write_protected_baseline,
)
from skillgate.ecosystem.plugins import RegistryPolicy


def claude_scan_command(
    directory: str = typer.Argument(..., help="Claude project root to scan."),
    output: Literal["json", "sarif"] = typer.Option("json", "--output", "-o"),
    capabilities: str = typer.Option(
        "fs.read",
        "--capabilities",
        help="Comma-delimited allowed capabilities for scope validation.",
    ),
    memory_policy: Literal["strict", "warn"] = typer.Option(
        "strict",
        "--memory-policy",
        help="Memory governance mode.",
    ),
    plugin_registry_policy: Literal["strict", "community", "off"] = typer.Option(
        "strict",
        "--plugin-registry-policy",
        help="Plugin registry policy mode.",
    ),
    policy_pack: str = typer.Option(
        "custom",
        "--policy-pack",
        help="Policy pack name or custom.",
    ),
    scope: Literal["repo", "user", "org"] = typer.Option(
        "repo",
        "--scope",
        help="Default write scope for baseline artifacts when missing.",
    ),
    surface: str = typer.Option(
        "all",
        "--surface",
        help=(
            "Comma-delimited surfaces: all,hooks,instruction-files,slash-commands,"
            "memory,settings,plugins,plugin-package,behavior."
        ),
    ),
    approve_line: str | None = typer.Option(
        None,
        "--approve-line",
        help="Record an inline exception in format <file>:<line>.",
    ),
    ci: bool = typer.Option(False, "--ci", help="Enable fail-closed CI checks."),
) -> None:
    """Scan all Claude Code ecosystem surfaces and emit a unified report."""
    project_root = Path(directory).resolve()
    resolver, identity = _resolver(project_root)
    if approve_line is not None:
        file_path, line = _parse_approve_line_arg(approve_line)
        record = _record_line_approval(
            resolver.path_for("claude-line-approvals.json", "repo"),
            file_path=file_path,
            line=line,
            actor=identity.actor_id,
        )
        typer.echo(json.dumps(record, sort_keys=True, separators=(",", ":")))
        return

    configured_pack = _load_policy_pack(resolver)
    if policy_pack != "custom":
        try:
            configured_pack = get_policy_pack(policy_pack)
        except ValueError as exc:
            raise typer.BadParameter(str(exc)) from exc
    if configured_pack is not None:
        default_caps = tuple(
            sorted({item.strip() for item in capabilities.split(",") if item.strip()})
        )
        allowed_capabilities = (
            configured_pack.allowed_capabilities if default_caps == ("fs.read",) else default_caps
        )
        memory_policy = (
            configured_pack.memory_policy if memory_policy == "strict" else memory_policy
        )
        plugin_registry_policy = (
            configured_pack.plugin_registry_policy
            if plugin_registry_policy == "strict"
            else plugin_registry_policy
        )
        ci = ci or configured_pack.ci_mode
    else:
        allowed_capabilities = tuple(
            sorted({item.strip() for item in capabilities.split(",") if item.strip()})
        )

    scanner = ClaudeEcosystemScanner(
        allowed_capabilities=allowed_capabilities,
        memory_policy=memory_policy,
        project_root=project_root,
        hook_attestation_path=resolver.path_for("hooks-attestation.json", "repo"),
        hook_audit_path=resolver.path_for("claude-hooks-audit.jsonl", "repo"),
        plugin_registry_path=resolver.path_for("claude-plugin-registry.json", "repo"),
        plugin_registry_policy=_as_registry_policy(plugin_registry_policy),
        settings_baseline_path=resolver.effective_path(
            "settings-baseline.json",
            fallback_scope=scope,
        )[0],
        behavior_baseline_path=resolver.effective_path(
            "claude-behavior-baseline.json",
            fallback_scope=scope,
        )[0],
        actor=identity.actor_id,
        ci_mode=ci,
    )
    selected_surfaces = tuple(
        sorted({item.strip() for item in surface.split(",") if item.strip()})
    ) or ("all",)
    summary = scanner.scan(surfaces=selected_surfaces)

    if output == "sarif":
        typer.echo(format_scan_summary_sarif(summary))
    else:
        typer.echo(json.dumps(summary.to_dict(), sort_keys=True, separators=(",", ":")))
    TamperEvidentLedger(resolver.path_for("claude-audit-ledger.jsonl", "repo")).append(
        event_type="claude.scan",
        payload={
            "blocked": summary.blocked,
            "findings_count": len(summary.findings),
            "surfaces": list(selected_surfaces),
            "policy_pack": configured_pack.name if configured_pack is not None else None,
            "identity": identity.to_dict(),
            "scope_resolution": _resolution_payload(
                resolver,
                file_name="claude-policy-pack.json",
                fallback_scope=scope,
            ),
        },
    )

    if summary.blocked:
        raise typer.Exit(code=1)


def claude_hooks_list_command(
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
) -> None:
    """List discovered hooks with attestation status."""
    root = Path(directory).resolve()
    resolver, _ = _resolver(root)
    store = HookAttestationStore(resolver.path_for("hooks-attestation.json", "repo"))
    results = [asdict(item) for item in store.list_statuses(root)]
    typer.echo(json.dumps(results, sort_keys=True, separators=(",", ":")))


def claude_hooks_approve_command(
    file_path: str = typer.Argument(..., help="Hook file path relative to project root."),
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
    key_dir: str = typer.Option(
        str(Path.home() / ".skillgate" / "keys"),
        "--key-dir",
        help="Signing key directory.",
    ),
) -> None:
    """Approve and attest one Claude hook file."""
    root = Path(directory).resolve()
    resolver, _ = _resolver(root)
    hook_file = (root / file_path).resolve()
    relative = hook_file.relative_to(root)
    payload = HookAttestationStore(resolver.path_for("hooks-attestation.json", "repo")).approve(
        relative,
        Path(key_dir),
    )
    typer.echo(json.dumps(payload, sort_keys=True, separators=(",", ":")))


def claude_hooks_deny_command(
    file_path: str = typer.Argument(..., help="Hook file path relative to project root."),
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
) -> None:
    """Remove hook approval entry."""
    root = Path(directory).resolve()
    resolver, _ = _resolver(root)
    removed = HookAttestationStore(resolver.path_for("hooks-attestation.json", "repo")).deny(
        Path(file_path)
    )
    typer.echo(json.dumps({"removed": removed}, sort_keys=True))
    if not removed:
        raise typer.Exit(code=1)


def claude_hooks_audit_command(
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
    limit: int = typer.Option(50, "--limit", help="Max records to output."),
) -> None:
    """Show recent hook audit records."""
    root = Path(directory).resolve()
    resolver, _ = _resolver(root)
    rows = HookAuditLog(resolver.path_for("claude-hooks-audit.jsonl", "repo")).tail(limit=limit)
    typer.echo(json.dumps(rows, sort_keys=True, separators=(",", ":")))


def claude_hooks_diff_command(
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
) -> None:
    """Show modified hooks vs approved attestation baseline."""
    root = Path(directory).resolve()
    resolver, _ = _resolver(root)
    changed = [
        asdict(item)
        for item in HookAttestationStore(
            resolver.path_for("hooks-attestation.json", "repo")
        ).diff_changed(root)
    ]
    typer.echo(json.dumps(changed, sort_keys=True, separators=(",", ":")))
    if changed:
        raise typer.Exit(code=1)


def claude_plugins_list_command(
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
    policy: Literal["strict", "community", "off"] = typer.Option(
        "strict",
        "--policy",
        help="Plugin registry policy.",
    ),
) -> None:
    """List plugin decisions for the current project."""
    root = Path(directory).resolve()
    resolver, _ = _resolver(root)
    registry = ClaudePluginRegistry(
        resolver.path_for("claude-plugin-registry.json", "repo"), policy=policy
    )
    rows = [asdict(item) for item in registry.decisions_for_project(root)]
    typer.echo(json.dumps(rows, sort_keys=True, separators=(",", ":")))
    if any(not item["allowed"] for item in rows):
        raise typer.Exit(code=1)


def claude_plugins_attest_command(
    plugin_id: str = typer.Argument(..., help="Plugin identifier."),
    checksum: str = typer.Option(..., "--checksum", help="Plugin checksum."),
    publisher: str = typer.Option(..., "--publisher", help="Plugin publisher."),
    trust_level: Literal["community", "verified", "official"] = typer.Option(
        "verified",
        "--trust-level",
        help="Plugin trust level.",
    ),
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
) -> None:
    """Attest plugin metadata into local registry."""
    root = Path(directory).resolve()
    resolver, _ = _resolver(root)
    registry = ClaudePluginRegistry(
        resolver.path_for("claude-plugin-registry.json", "repo"), policy="strict"
    )
    registry.attest(
        plugin_id=plugin_id,
        checksum=checksum,
        publisher=publisher,
        trust_level=trust_level,
    )
    typer.echo(json.dumps({"plugin": plugin_id, "status": "attested"}, sort_keys=True))


def claude_plugins_block_command(
    plugin_id: str = typer.Argument(..., help="Plugin identifier."),
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
) -> None:
    """Block plugin in local registry."""
    root = Path(directory).resolve()
    resolver, _ = _resolver(root)
    blocked = ClaudePluginRegistry(
        resolver.path_for("claude-plugin-registry.json", "repo"),
        policy="strict",
    ).block(plugin_id)
    typer.echo(json.dumps({"plugin": plugin_id, "blocked": blocked}, sort_keys=True))
    if not blocked:
        raise typer.Exit(code=1)


def claude_plugins_trust_key_command(
    key_id: str = typer.Argument(..., help="Snapshot signing key identifier."),
    public_key: str = typer.Option(..., "--public-key", help="Ed25519 public key hex."),
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
) -> None:
    """Register trusted key used to verify signed plugin snapshots."""
    root = Path(directory).resolve()
    resolver, _ = _resolver(root)
    registry = ClaudePluginRegistry(
        resolver.path_for("claude-plugin-registry.json", "repo"),
        policy="strict",
    )
    registry.trust_key(key_id=key_id, public_key=public_key)
    typer.echo(json.dumps({"key_id": key_id, "trusted": True}, sort_keys=True))


def claude_plugins_sync_command(
    snapshot: str = typer.Argument(..., help="Path to signed plugin snapshot JSON."),
    max_age_hours: int = typer.Option(72, "--max-age-hours", help="Maximum snapshot age."),
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
) -> None:
    """Verify and sync signed plugin registry snapshot."""
    root = Path(directory).resolve()
    resolver, _ = _resolver(root)
    registry = ClaudePluginRegistry(
        resolver.path_for("claude-plugin-registry.json", "repo"),
        policy="strict",
    )
    result = registry.sync_signed_snapshot(
        snapshot_path=Path(snapshot),
        max_age_hours=max_age_hours,
    )
    typer.echo(
        json.dumps(
            {
                "synced": result.synced,
                "decision_code": result.decision_code,
                "reason": result.reason,
                "plugin_count": result.plugin_count,
                "key_id": result.key_id,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
    )
    if not result.synced:
        raise typer.Exit(code=1)


def claude_settings_drift_command(
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
    ci: bool = typer.Option(False, "--ci", help="Enable CI strict mode."),
) -> None:
    """Check Claude settings drift against approved baseline."""
    root = Path(directory).resolve()
    resolver, _ = _resolver(root)
    baseline_path, _ = resolver.effective_path("settings-baseline.json", fallback_scope="repo")
    from skillgate.cli.commands.mcp import mcp_settings_check_command

    mcp_settings_check_command(
        project_settings=str(root / ".claude" / "settings.json"),
        global_settings=str(Path.home() / ".claude" / "settings.json"),
        baseline=str(baseline_path),
        ci=ci,
    )


def claude_agents_lineage_command(
    invocation_id: str = typer.Argument(..., help="Invocation ID root."),
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
) -> None:
    """Show sub-agent lineage tree rooted at invocation id."""
    root = Path(directory).resolve()
    resolver, _ = _resolver(root)
    tree = LineageStore(resolver.path_for("claude-lineage.json", "repo")).lineage_tree(
        invocation_id
    )
    typer.echo(json.dumps(tree, sort_keys=True, separators=(",", ":")))


def claude_agents_risk_command(
    invocation_id: str = typer.Argument(..., help="Invocation ID root."),
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
) -> None:
    """Compute deterministic blast-radius and escalation risk for lineage subtree."""
    root = Path(directory).resolve()
    resolver, _ = _resolver(root)
    summary = LineageStore(resolver.path_for("claude-lineage.json", "repo")).risk_summary(
        invocation_id
    )
    typer.echo(json.dumps(summary.to_dict(), sort_keys=True, separators=(",", ":")))
    if summary.tier in {"high", "critical"}:
        raise typer.Exit(code=1)


def claude_approvals_baseline_command(
    scope: Literal["repo", "user", "org"] = typer.Option(
        "repo",
        "--scope",
        help="Storage scope for baseline file.",
    ),
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
) -> None:
    """Create or refresh baseline snapshot for protected Claude config files."""
    root = Path(directory).resolve()
    resolver, identity = _resolver(root)
    baseline_path = resolver.path_for("claude-protected-baseline.json", scope)
    result = write_protected_baseline(root, baseline_path)
    typer.echo(json.dumps(protected_changes_to_dict(result), sort_keys=True, separators=(",", ":")))
    TamperEvidentLedger(resolver.path_for("claude-audit-ledger.jsonl", "repo")).append(
        event_type="claude.approvals.baseline",
        payload={
            "baseline_hash": result.baseline_hash,
            "changed_files": [],
            "scope": scope,
            "identity": identity.to_dict(),
        },
    )


def claude_approvals_check_command(
    approval_file: str = typer.Option(
        ".skillgate/approvals/claude-config-approval.json",
        "--approval-file",
        help="Signed approval file path.",
    ),
    required_reviewers: int = typer.Option(2, "--required-reviewers", help="Reviewer quorum."),
    env: str = typer.Option("prod", "--env", help="Expected approval environment."),
    scope: Literal["repo", "user", "org"] = typer.Option(
        "repo",
        "--scope",
        help="Fallback scope when no baseline exists in precedence chain.",
    ),
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
) -> None:
    """Require signed approval when protected Claude config files changed."""
    root = Path(directory).resolve()
    resolver, identity = _resolver(root)
    baseline_path, resolved_scope = resolver.effective_path(
        "claude-protected-baseline.json",
        fallback_scope=scope,
    )
    changes = detect_protected_changes(root, baseline_path)
    decision = verify_protected_change_approval(
        project_root=root,
        baseline_path=baseline_path,
        approval_file=Path(approval_file),
        required_reviewers=required_reviewers,
        environment=env,
    )
    typer.echo(
        json.dumps(
            {
                "changes": protected_changes_to_dict(changes),
                "allowed": decision.allowed,
                "code": decision.code,
                "reason": decision.reason,
                "reviewer_count": decision.reviewer_count,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
    )
    TamperEvidentLedger(resolver.path_for("claude-audit-ledger.jsonl", "repo")).append(
        event_type="claude.approvals.check",
        payload={
            "allowed": decision.allowed,
            "code": decision.code,
            "changed_files": list(changes.changed_files),
            "scope": resolved_scope,
            "identity": identity.to_dict(),
        },
    )
    if not decision.allowed:
        raise typer.Exit(code=1)


def claude_behavior_baseline_command(
    scope: Literal["repo", "user", "org"] = typer.Option(
        "user",
        "--scope",
        help="Storage scope for behavior baseline profile.",
    ),
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
) -> None:
    """Train behavioral baseline from current hooks/commands/memory state."""
    root = Path(directory).resolve()
    resolver, identity = _resolver(root)
    store = BehaviorBaselineStore(resolver.path_for("claude-behavior-baseline.json", scope))
    profile_count = store.train(project_root=root, actor=identity.actor_id)
    payload = {"profile_count": profile_count, "actor": identity.actor_id, "scope": scope}
    typer.echo(json.dumps(payload, sort_keys=True, separators=(",", ":")))
    TamperEvidentLedger(resolver.path_for("claude-audit-ledger.jsonl", "repo")).append(
        event_type="claude.behavior.baseline",
        payload={**payload, "identity": identity.to_dict()},
    )


def claude_behavior_drift_command(
    scope: Literal["repo", "user", "org"] = typer.Option(
        "user",
        "--scope",
        help="Fallback scope when no behavior baseline exists in precedence chain.",
    ),
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
) -> None:
    """Check behavior drift alerts for tracked Claude mutation surfaces."""
    root = Path(directory).resolve()
    resolver, identity = _resolver(root)
    baseline_path, resolved_scope = resolver.effective_path(
        "claude-behavior-baseline.json",
        fallback_scope=scope,
    )
    store = BehaviorBaselineStore(baseline_path)
    alerts = store.detect_drift(project_root=root, actor=identity.actor_id)
    payload = {
        "alert_count": len(alerts),
        "alerts": [item.to_dict() for item in alerts],
    }
    typer.echo(json.dumps(payload, sort_keys=True, separators=(",", ":")))
    TamperEvidentLedger(resolver.path_for("claude-audit-ledger.jsonl", "repo")).append(
        event_type="claude.behavior.drift",
        payload={
            "alert_count": len(alerts),
            "actor": identity.actor_id,
            "scope": resolved_scope,
            "identity": identity.to_dict(),
        },
    )
    if any(item.decision_code.startswith("SG_DENY") for item in alerts):
        raise typer.Exit(code=1)


def claude_policy_packs_list_command() -> None:
    """List built-in Claude policy packs."""
    payload = [pack.to_dict() for pack in list_policy_packs()]
    typer.echo(json.dumps(payload, sort_keys=True, separators=(",", ":")))


def claude_policy_packs_show_command(
    name: str = typer.Argument(..., help="Policy pack name."),
) -> None:
    """Show one Claude policy pack definition."""
    try:
        pack = get_policy_pack(name)
    except ValueError as exc:
        raise typer.BadParameter(str(exc)) from exc
    typer.echo(json.dumps(pack.to_dict(), sort_keys=True, separators=(",", ":")))


def claude_policy_packs_apply_command(
    name: str = typer.Argument(..., help="Policy pack name."),
    scope: Literal["repo", "user", "org"] = typer.Option(
        "repo",
        "--scope",
        help="Storage scope for policy-pack file.",
    ),
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
) -> None:
    """Persist a Claude policy pack into project governance config."""
    root = Path(directory).resolve()
    resolver, identity = _resolver(root)
    try:
        pack = write_policy_pack(root, name) if scope == "repo" else get_policy_pack(name)
    except ValueError as exc:
        raise typer.BadParameter(str(exc)) from exc
    if scope != "repo":
        path = resolver.path_for("claude-policy-pack.json", scope)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(pack.to_dict(), sort_keys=True, separators=(",", ":")), encoding="utf-8"
        )
    typer.echo(json.dumps(pack.to_dict(), sort_keys=True, separators=(",", ":")))
    TamperEvidentLedger(resolver.path_for("claude-audit-ledger.jsonl", "repo")).append(
        event_type="claude.policy-pack.apply",
        payload={"name": pack.name, "scope": scope, "identity": identity.to_dict()},
    )


def claude_ledger_verify_command(
    scope: Literal["repo", "user", "org"] = typer.Option(
        "repo",
        "--scope",
        help="Fallback scope when no ledger exists in precedence chain.",
    ),
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
) -> None:
    """Verify hash chain/signatures for local Claude audit ledger."""
    root = Path(directory).resolve()
    resolver, _ = _resolver(root)
    ledger_path, _ = resolver.effective_path("claude-audit-ledger.jsonl", fallback_scope=scope)
    result = TamperEvidentLedger(ledger_path).verify()
    typer.echo(json.dumps(result.to_dict(), sort_keys=True, separators=(",", ":")))
    if not result.valid:
        raise typer.Exit(code=1)


def claude_ledger_tail_command(
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
    limit: int = typer.Option(50, "--limit", help="Max events to output."),
    scope: Literal["repo", "user", "org"] = typer.Option(
        "repo",
        "--scope",
        help="Fallback scope when no ledger exists in precedence chain.",
    ),
) -> None:
    """Show recent local Claude audit ledger events."""
    root = Path(directory).resolve()
    resolver, _ = _resolver(root)
    ledger_path, _ = resolver.effective_path("claude-audit-ledger.jsonl", fallback_scope=scope)
    rows = TamperEvidentLedger(ledger_path).tail(limit=limit)
    typer.echo(json.dumps(list(rows), sort_keys=True, separators=(",", ":")))


def claude_incidents_command(
    directory: str = typer.Option(".", "--directory", help="Project root directory."),
    surface: str = typer.Option(
        "all",
        "--surface",
        help="Optional surface filter for scan correlation input.",
    ),
    capabilities: str = typer.Option(
        "fs.read",
        "--capabilities",
        help="Comma-delimited allowed capabilities for scan scope.",
    ),
    memory_policy: Literal["strict", "warn"] = typer.Option(
        "strict",
        "--memory-policy",
        help="Memory governance mode.",
    ),
    scope: Literal["repo", "user", "org"] = typer.Option(
        "repo",
        "--scope",
        help="Fallback scope for baseline artifacts when missing.",
    ),
) -> None:
    """Run scan correlation and emit multi-signal incident alerts."""
    root = Path(directory).resolve()
    resolver, identity = _resolver(root)
    allowed_capabilities = tuple(
        sorted({item.strip() for item in capabilities.split(",") if item.strip()})
    )
    selected_surfaces = tuple(
        sorted({item.strip() for item in surface.split(",") if item.strip()})
    ) or ("all",)
    scanner = ClaudeEcosystemScanner(
        allowed_capabilities=allowed_capabilities,
        memory_policy=memory_policy,
        project_root=root,
        hook_attestation_path=resolver.path_for("hooks-attestation.json", "repo"),
        hook_audit_path=resolver.path_for("claude-hooks-audit.jsonl", "repo"),
        plugin_registry_path=resolver.path_for("claude-plugin-registry.json", "repo"),
        plugin_registry_policy="strict",
        settings_baseline_path=resolver.effective_path(
            "settings-baseline.json", fallback_scope=scope
        )[0],
        behavior_baseline_path=resolver.effective_path(
            "claude-behavior-baseline.json",
            fallback_scope=scope,
        )[0],
        actor=identity.actor_id,
        ci_mode=False,
    )
    summary = scanner.scan(surfaces=selected_surfaces)
    incidents = correlate_findings(summary.findings)
    typer.echo(
        json.dumps(
            {
                "incident_count": len(incidents),
                "incidents": [item.to_dict() for item in incidents],
            },
            sort_keys=True,
            separators=(",", ":"),
        )
    )
    TamperEvidentLedger(resolver.path_for("claude-audit-ledger.jsonl", "repo")).append(
        event_type="claude.incidents",
        payload={
            "incident_count": len(incidents),
            "surfaces": list(selected_surfaces),
            "identity": identity.to_dict(),
            "scope_resolution": _resolution_payload(
                resolver,
                file_name="claude-behavior-baseline.json",
                fallback_scope=scope,
            ),
        },
    )
    if incidents:
        raise typer.Exit(code=1)


def _parse_approve_line_arg(raw: str) -> tuple[str, int]:
    if ":" not in raw:
        msg = "approve-line must be <file>:<line>"
        raise typer.BadParameter(msg)
    file_path, line_raw = raw.rsplit(":", 1)
    normalized = file_path.strip()
    if not normalized:
        msg = "approve-line file path cannot be empty"
        raise typer.BadParameter(msg)
    try:
        line = int(line_raw.strip())
    except ValueError as exc:
        msg = "approve-line line must be an integer"
        raise typer.BadParameter(msg) from exc
    if line <= 0:
        msg = "approve-line line must be >= 1"
        raise typer.BadParameter(msg)
    return normalized, line


def _record_line_approval(
    path: Path,
    *,
    file_path: str,
    line: int,
    actor: str,
) -> dict[str, object]:
    path.parent.mkdir(parents=True, exist_ok=True)
    approvals: list[dict[str, object]] = []
    if path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
        raw = payload.get("approvals", []) if isinstance(payload, dict) else []
        if isinstance(raw, list):
            approvals = [item for item in raw if isinstance(item, dict)]

    entry = {"file": file_path, "line": line, "actor": actor}
    if entry not in approvals:
        approvals.append(entry)
    path.write_text(
        json.dumps({"approvals": approvals}, sort_keys=True, separators=(",", ":")),
        encoding="utf-8",
    )
    return {"approved": True, **entry}


def _as_registry_policy(value: str) -> RegistryPolicy:
    if value == "strict":
        return "strict"
    if value == "community":
        return "community"
    return "off"


def _resolver(project_root: Path) -> tuple[ClaudeScopeResolver, GovernanceIdentity]:
    identity = resolve_governance_identity()
    return ClaudeScopeResolver(project_root=project_root, identity=identity), identity


def _load_policy_pack(resolver: ClaudeScopeResolver) -> ClaudePolicyPack | None:
    for scope in ("repo", "user", "org"):
        path = resolver.path_for("claude-policy-pack.json", scope)
        if not path.exists():
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if not isinstance(payload, dict):
            continue
        raw_name = payload.get("name")
        if isinstance(raw_name, str):
            try:
                return get_policy_pack(raw_name)
            except ValueError:
                continue
    return None


def _resolution_payload(
    resolver: ClaudeScopeResolver,
    *,
    file_name: str,
    fallback_scope: Literal["repo", "user", "org"],
) -> dict[str, str]:
    path, scope = resolver.effective_path(file_name, fallback_scope=fallback_scope)
    return {"file": file_name, "scope": scope, "path": str(path)}
