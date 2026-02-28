"""SkillGate CLI application entry point."""

from __future__ import annotations

import os
import sys

import typer

from skillgate import __version__
from skillgate.cli.branding import print_skillgate_brand
from skillgate.cli.commands.approval import (
    approval_request_command,
    approval_sign_command,
    approval_verify_command,
)
from skillgate.cli.commands.auth import auth_app
from skillgate.cli.commands.bom import bom_import_command, bom_validate_command
from skillgate.cli.commands.claude import (
    claude_agents_lineage_command,
    claude_agents_risk_command,
    claude_approvals_baseline_command,
    claude_approvals_check_command,
    claude_behavior_baseline_command,
    claude_behavior_drift_command,
    claude_hooks_approve_command,
    claude_hooks_audit_command,
    claude_hooks_deny_command,
    claude_hooks_diff_command,
    claude_hooks_list_command,
    claude_incidents_command,
    claude_ledger_tail_command,
    claude_ledger_verify_command,
    claude_plugins_attest_command,
    claude_plugins_block_command,
    claude_plugins_list_command,
    claude_plugins_sync_command,
    claude_plugins_trust_key_command,
    claude_policy_packs_apply_command,
    claude_policy_packs_list_command,
    claude_policy_packs_show_command,
    claude_scan_command,
    claude_settings_drift_command,
)
from skillgate.cli.commands.codex import (
    codex_bridge_command,
)
from skillgate.cli.commands.dag import dag_risk_command, dag_show_command, dag_verify_command
from skillgate.cli.commands.doctor import doctor_command
from skillgate.cli.commands.drift import drift_baseline_command, drift_check_command
from skillgate.cli.commands.export import export_command
from skillgate.cli.commands.gateway import (
    gateway_check_command,
    gateway_scan_output_command,
)
from skillgate.cli.commands.hooks import install_command, uninstall_command
from skillgate.cli.commands.hunt import hunt_command
from skillgate.cli.commands.init import init_command
from skillgate.cli.commands.integrate import integrate_command
from skillgate.cli.commands.keys import keys_generate_command
from skillgate.cli.commands.mcp import (
    mcp_allow_command,
    mcp_attest_command,
    mcp_audit_command,
    mcp_deny_command,
    mcp_inspect_command,
    mcp_list_command,
    mcp_settings_check_command,
    mcp_verify_command,
)
from skillgate.cli.commands.report import governance_report_command
from skillgate.cli.commands.reputation import (
    reputation_check_command,
    reputation_submit_command,
    reputation_verify_command,
)
from skillgate.cli.commands.retroscan import retroscan_command
from skillgate.cli.commands.rules_cmd import rules_command
from skillgate.cli.commands.run import run_command
from skillgate.cli.commands.scan import scan_command
from skillgate.cli.commands.simulate import simulate_command
from skillgate.cli.commands.submit_scan import submit_scan_command
from skillgate.cli.commands.verify import verify_command

app = typer.Typer(
    name="skillgate",
    help="SkillGate — Scan agent skills for security risks and enforce policy.",
    no_args_is_help=False,
    add_completion=False,
)

keys_app = typer.Typer(help="Key management commands")
keys_app.command("generate", help="Generate a new Ed25519 signing keypair")(keys_generate_command)
app.add_typer(keys_app, name="keys")

hooks_app = typer.Typer(help="Git hooks management")
hooks_app.command("install", help="Install SkillGate pre-commit hook")(install_command)
hooks_app.command("uninstall", help="Remove SkillGate pre-commit hook")(uninstall_command)
app.add_typer(hooks_app, name="hooks")

app.add_typer(auth_app, name="auth")

approval_app = typer.Typer(help="Approval workflow commands")
approval_app.command("sign", help="Create signed approval file")(approval_sign_command)
approval_app.command("verify", help="Verify signed approval file")(approval_verify_command)
approval_app.command("request", help="Create local approval request artifact")(
    approval_request_command
)
app.add_typer(approval_app, name="approval")

gateway_app = typer.Typer(help="Native agent gateway integration commands")
gateway_app.command(
    "check",
    help="Pre-execution runtime checks for native hooks",
)(gateway_check_command)
gateway_app.command(
    "scan-output",
    help="Tool output poisoning scan for native hooks",
)(gateway_scan_output_command)
app.add_typer(gateway_app, name="gateway")

bom_app = typer.Typer(help="AI-BOM commands for runtime gateway enforcement")
bom_app.command("import", help="Import CycloneDX BOM into SkillGate BOM store")(bom_import_command)
bom_app.command("validate", help="Validate skill invocation against AI-BOM")(bom_validate_command)
app.add_typer(bom_app, name="bom")

dag_app = typer.Typer(help="Session lineage DAG artifact commands")
dag_app.command("show", help="Show session DAG artifact")(dag_show_command)
dag_app.command("verify", help="Verify session DAG artifact signature")(dag_verify_command)
dag_app.command(
    "risk",
    help="Compute transitive privilege/risk metrics from DAG artifact",
)(dag_risk_command)
app.add_typer(dag_app, name="dag")

drift_app = typer.Typer(help="Skill drift baseline and comparison commands")
drift_app.command("baseline", help="Create drift baseline snapshot")(drift_baseline_command)
drift_app.command("check", help="Check drift against baseline snapshot")(drift_check_command)
app.add_typer(drift_app, name="drift")

reputation_app = typer.Typer(help="Signed reputation graph commands")
reputation_app.command(
    "verify",
    help="Verify signed reputation graph payload",
)(reputation_verify_command)
reputation_app.command(
    "check",
    help="Evaluate bundle hash against reputation graph",
)(reputation_check_command)
reputation_app.command(
    "submit",
    help="Create signed local reputation submission event",
)(reputation_submit_command)
app.add_typer(reputation_app, name="reputation")

mcp_app = typer.Typer(help="MCP gateway governance commands")
mcp_app.command("list", help="List approved MCP servers")(mcp_list_command)
mcp_app.command("allow", help="Approve MCP server in registry")(mcp_allow_command)
mcp_app.command("deny", help="Deny MCP server in registry")(mcp_deny_command)
mcp_app.command("inspect", help="Inspect MCP server AI-BOM metadata")(mcp_inspect_command)
mcp_app.command("audit", help="Show MCP decision audit records")(mcp_audit_command)
mcp_app.command("attest", help="Sign plugin attestation for MCP policy")(mcp_attest_command)
mcp_app.command("verify", help="Verify plugin attestation policy")(mcp_verify_command)
mcp_app.command(
    "settings-check",
    help="Detect Claude settings drift against approved baseline",
)(mcp_settings_check_command)
app.add_typer(mcp_app, name="mcp")

claude_app = typer.Typer(
    help="Claude Code governance commands: hooks, instructions, slash, memory, plugins, sub-agents."
)
claude_app.command(
    "scan",
    help=(
        "Scan Claude project surfaces "
        "(hooks, instructions, slash commands, memory, settings, plugins)."
    ),
)(claude_scan_command)
claude_app.command(
    "incidents",
    help="Correlate multi-signal scan findings into high-confidence incidents.",
)(claude_incidents_command)

claude_hooks_app = typer.Typer(help="Claude hook governance lifecycle commands.")
claude_hooks_app.command("list", help="List hooks with approval status")(claude_hooks_list_command)
claude_hooks_app.command("approve", help="Approve and sign one hook")(claude_hooks_approve_command)
claude_hooks_app.command("deny", help="Deny one hook and remove approval")(
    claude_hooks_deny_command
)
claude_hooks_app.command("audit", help="Show recent hook audit records")(claude_hooks_audit_command)
claude_hooks_app.command("diff", help="Show changed hooks vs attested baseline")(
    claude_hooks_diff_command
)
claude_app.add_typer(claude_hooks_app, name="hooks")

claude_plugins_app = typer.Typer(help="Claude plugin registry governance commands.")
claude_plugins_app.command("list", help="List plugin registry decisions")(
    claude_plugins_list_command
)
claude_plugins_app.command("attest", help="Attest plugin metadata in local registry")(
    claude_plugins_attest_command
)
claude_plugins_app.command("block", help="Block plugin in local registry")(
    claude_plugins_block_command
)
claude_plugins_app.command("trust-key", help="Trust snapshot signing key for plugin feed")(
    claude_plugins_trust_key_command
)
claude_plugins_app.command("sync", help="Verify and import signed plugin snapshot")(
    claude_plugins_sync_command
)
claude_app.add_typer(claude_plugins_app, name="plugins")

claude_settings_app = typer.Typer(help="Claude settings governance commands.")
claude_settings_app.command("drift", help="Detect Claude settings permission drift")(
    claude_settings_drift_command
)
claude_app.add_typer(claude_settings_app, name="settings")

claude_agents_app = typer.Typer(help="Claude sub-agent lineage governance commands.")
claude_agents_app.command("lineage", help="Show sub-agent lineage by invocation id")(
    claude_agents_lineage_command
)
claude_agents_app.command("risk", help="Compute lineage blast radius and escalation risk")(
    claude_agents_risk_command
)
claude_app.add_typer(claude_agents_app, name="agents")

claude_approvals_app = typer.Typer(help="Claude protected-file approval workflow commands.")
claude_approvals_app.command("baseline", help="Create protected-file baseline snapshot")(
    claude_approvals_baseline_command
)
claude_approvals_app.command("check", help="Require signed approval for protected-file changes")(
    claude_approvals_check_command
)
claude_app.add_typer(claude_approvals_app, name="approvals")

claude_behavior_app = typer.Typer(help="Claude behavioral baseline and drift commands.")
claude_behavior_app.command("baseline", help="Train baseline behavior profile")(
    claude_behavior_baseline_command
)
claude_behavior_app.command("drift", help="Detect behavior drift alerts")(
    claude_behavior_drift_command
)
claude_app.add_typer(claude_behavior_app, name="behavior")

claude_policy_packs_app = typer.Typer(help="Claude opinionated policy pack commands.")
claude_policy_packs_app.command("list", help="List available policy packs")(
    claude_policy_packs_list_command
)
claude_policy_packs_app.command("show", help="Show one policy pack definition")(
    claude_policy_packs_show_command
)
claude_policy_packs_app.command("apply", help="Apply one policy pack to project")(
    claude_policy_packs_apply_command
)
claude_app.add_typer(claude_policy_packs_app, name="policy-packs")

claude_ledger_app = typer.Typer(help="Claude tamper-evident local audit ledger commands.")
claude_ledger_app.command("verify", help="Verify local ledger hash chain/signatures")(
    claude_ledger_verify_command
)
claude_ledger_app.command("tail", help="Show recent local ledger events")(
    claude_ledger_tail_command
)
claude_app.add_typer(claude_ledger_app, name="ledger")
app.add_typer(claude_app, name="claude")

app.command(
    "codex",
    help="Codex CLI bridge wrapper with governance preflight checks.",
    context_settings={"allow_extra_args": True, "ignore_unknown_options": True},
)(codex_bridge_command)

app.command("scan", help="Scan a skill bundle for security risks")(scan_command)
app.command("submit-scan", help="Submit a scan report JSON to API storage")(submit_scan_command)
app.command("simulate", help="Dry-run policy impact across one or more bundles")(simulate_command)
app.command(
    "run",
    help="Run an agent CLI through SkillGate runtime gateway.",
    context_settings={"allow_extra_args": True, "ignore_unknown_options": True},
)(run_command)
app.command("hunt", help="Search historical scan reports")(hunt_command)
app.command("retroscan", help="Replay historical scans with updated rules")(retroscan_command)
app.command("rules", help="List available detection rules")(rules_command)
app.command("init", help="Initialize a policy configuration file")(init_command)
app.command("verify", help="Verify a signed scan report")(verify_command)
app.command("doctor", help="Diagnose installation/auth/environment status")(doctor_command)
app.command(
    "integrate",
    help=(
        "Generate framework-specific SkillGate SDK integration code "
        "(PydanticAI, LangChain, CrewAI)."
    ),
)(integrate_command)
app.command(
    "export",
    help="Export enforcement decision records to CSV, JSON, or SARIF format.",
)(export_command)

report_app = typer.Typer(help="Compliance and governance reporting commands.")
report_app.command(
    "governance",
    help="Generate Agent Capability Governance Report for one workspace.",
)(governance_report_command)
app.add_typer(report_app, name="report")


@app.callback(invoke_without_command=True)
def root_callback(
    ctx: typer.Context,
    no_logo: bool = typer.Option(
        False,
        "--no-logo",
        help="Disable ANSI logo output.",
    ),
) -> None:
    """Global CLI callback."""
    no_logo_env = os.environ.get("SKILLGATE_NO_LOGO", "").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }

    if no_logo or no_logo_env:
        return

    # Show animated logo ONLY when no subcommand is invoked
    if ctx.invoked_subcommand is None and "--help" not in sys.argv and "-h" not in sys.argv:
        print_skillgate_brand(version=__version__)
        typer.echo(ctx.get_help())
        raise typer.Exit(0)


@app.command("version")
def version_command() -> None:
    """Show version information."""
    typer.echo(f"skillgate {__version__}")


def main() -> None:
    """CLI entry point."""
    app()
