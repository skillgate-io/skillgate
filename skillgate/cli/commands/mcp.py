"""MCP gateway registry and governance commands."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

import typer

from skillgate.mcp_gateway import (
    AIBomEntry,
    MCPRegistry,
    MCPServerConfig,
    PluginAttestationVerifier,
    SettingsGovernance,
    attest_plugin,
)


def mcp_list_command(
    registry: str = typer.Option(
        ".skillgate/mcp/registry.json",
        "--registry",
        help="Path to MCP registry store.",
    ),
) -> None:
    """List all MCP servers in the local registry."""
    store = MCPRegistry(Path(registry))
    typer.echo(json.dumps(store.list_servers(), sort_keys=True, separators=(",", ":")))


def mcp_allow_command(
    server: str = typer.Argument(..., help="Server identifier."),
    endpoint: str = typer.Option(..., "--endpoint", help="Server endpoint URI."),
    transport: Literal["http", "stdio"] = typer.Option(
        "http",
        "--transport",
        help="Transport: http|stdio.",
    ),
    trust_level: Literal["unverified", "community", "verified", "official"] = typer.Option(
        "verified",
        "--trust-level",
        help="Trust level: unverified|community|verified|official.",
    ),
    permissions: str = typer.Option(
        "",
        "--permissions",
        help="Comma-delimited permissions/capabilities.",
    ),
    checksum: str = typer.Option(..., "--checksum", help="Server checksum."),
    version: str = typer.Option("1.0.0", "--version", help="Server version."),
    publisher: str = typer.Option("unknown", "--publisher", help="Server publisher."),
    registry: str = typer.Option(
        ".skillgate/mcp/registry.json",
        "--registry",
        help="Path to MCP registry store.",
    ),
) -> None:
    """Allow an MCP server and persist AI-BOM metadata."""
    config = MCPServerConfig(
        server_id=server,
        endpoint=endpoint,
        transport=transport,
        trust_level=trust_level,
    )
    perms = tuple(sorted({item.strip() for item in permissions.split(",") if item.strip()}))
    entry = AIBomEntry(
        name=server,
        version=version,
        publisher=publisher,
        checksum=checksum,
        permissions_requested=perms,
        trust_level=trust_level,
    )
    MCPRegistry(Path(registry)).allow_server(config, entry)
    typer.echo(json.dumps({"server": server, "status": "allowed"}, sort_keys=True))


def mcp_deny_command(
    server: str = typer.Argument(..., help="Server identifier."),
    registry: str = typer.Option(
        ".skillgate/mcp/registry.json",
        "--registry",
        help="Path to MCP registry store.",
    ),
) -> None:
    """Deny one MCP server."""
    denied = MCPRegistry(Path(registry)).deny_server(server)
    if not denied:
        raise typer.Exit(code=1)
    typer.echo(json.dumps({"server": server, "status": "denied"}, sort_keys=True))


def mcp_inspect_command(
    server: str = typer.Argument(..., help="Server identifier."),
    registry: str = typer.Option(
        ".skillgate/mcp/registry.json",
        "--registry",
        help="Path to MCP registry store.",
    ),
) -> None:
    """Inspect one MCP server's AI-BOM record."""
    record = MCPRegistry(Path(registry)).inspect_server(server)
    if record is None:
        raise typer.Exit(code=1)
    typer.echo(json.dumps(record, sort_keys=True, separators=(",", ":")))


def mcp_audit_command(
    audit_log: str = typer.Option(
        ".skillgate/mcp/audit.jsonl",
        "--audit-log",
        help="Path to MCP audit log file.",
    ),
) -> None:
    """Show recent MCP gateway decision records."""
    path = Path(audit_log)
    if not path.exists():
        typer.echo("[]")
        return

    rows: list[dict[str, object]] = []
    for line in path.read_text(encoding="utf-8").splitlines()[-50:]:
        line = line.strip()
        if not line:
            continue
        payload = json.loads(line)
        if isinstance(payload, dict):
            rows.append(payload)
    typer.echo(json.dumps(rows, sort_keys=True, separators=(",", ":")))


def mcp_attest_command(
    plugin: str = typer.Argument(..., help="Plugin file path."),
    key_dir: str = typer.Option(
        str(Path.home() / ".skillgate" / "keys"),
        "--key-dir",
        help="Directory containing signing keypair.",
    ),
    output: str | None = typer.Option(
        None,
        "--output",
        help="Optional explicit attestation output path.",
    ),
) -> None:
    """Create a SkillGate attestation for a plugin."""
    destination = attest_plugin(
        plugin_path=Path(plugin),
        key_dir=Path(key_dir),
        output_path=Path(output) if output else None,
    )
    typer.echo(json.dumps({"attestation": str(destination)}, sort_keys=True))


def mcp_verify_command(
    plugin: str = typer.Argument(..., help="Plugin file path."),
    policy: Literal["strict", "warn", "off"] = typer.Option(
        "strict",
        "--policy",
        help="strict|warn|off",
    ),
    ci: bool = typer.Option(False, "--ci", help="Force CI strict behavior."),
    attestation: str | None = typer.Option(
        None,
        "--attestation",
        help="Attestation path override.",
    ),
) -> None:
    """Verify plugin attestation under configured policy mode."""
    result = PluginAttestationVerifier(policy=policy, ci_mode=ci).verify(
        plugin_path=Path(plugin),
        attestation_path=Path(attestation) if attestation else None,
    )
    typer.echo(result.model_dump_json())
    if not result.allowed:
        raise typer.Exit(code=1)


def mcp_settings_check_command(
    project_settings: str = typer.Option(
        ".claude/settings.json",
        "--project-settings",
        help="Project Claude settings path.",
    ),
    global_settings: str = typer.Option(
        str(Path.home() / ".claude" / "settings.json"),
        "--global-settings",
        help="Global Claude settings path.",
    ),
    baseline: str = typer.Option(
        ".skillgate/settings-baseline.json",
        "--baseline",
        help="SkillGate baseline settings file.",
    ),
    ci: bool = typer.Option(False, "--ci", help="CI fail-closed mode."),
) -> None:
    """Check Claude settings drift against the approved baseline."""
    result = SettingsGovernance(Path(baseline), ci_mode=ci).check(
        Path(project_settings),
        Path(global_settings),
    )
    typer.echo(result.model_dump_json())
    if not result.allowed:
        raise typer.Exit(code=1)
