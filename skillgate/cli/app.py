"""SkillGate CLI application entry point."""

from __future__ import annotations

import os
import sys

import typer

from skillgate import __version__
from skillgate.cli.branding import print_skillgate_brand
from skillgate.cli.commands.approval import approval_sign_command, approval_verify_command
from skillgate.cli.commands.auth import auth_app
from skillgate.cli.commands.bom import bom_import_command, bom_validate_command
from skillgate.cli.commands.dag import dag_risk_command, dag_show_command, dag_verify_command
from skillgate.cli.commands.doctor import doctor_command
from skillgate.cli.commands.drift import drift_baseline_command, drift_check_command
from skillgate.cli.commands.gateway import (
    gateway_check_command,
    gateway_scan_output_command,
)
from skillgate.cli.commands.hooks import install_command, uninstall_command
from skillgate.cli.commands.hunt import hunt_command
from skillgate.cli.commands.init import init_command
from skillgate.cli.commands.keys import (
    keys_export_command,
    keys_generate_command,
    keys_list_command,
)
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
from skillgate.cli.commands.verify import verify_command

app = typer.Typer(
    name="skillgate",
    help="SkillGate — Scan agent skills for security risks and enforce policy.",
    no_args_is_help=False,
    add_completion=False,
)

keys_app = typer.Typer(help="Key management commands")
keys_app.command("generate", help="Generate a new Ed25519 signing keypair")(keys_generate_command)
keys_app.command("list", help="List available signing key material")(keys_list_command)
keys_app.command("export", help="Export key material (public by default)")(keys_export_command)
app.add_typer(keys_app, name="keys")

hooks_app = typer.Typer(help="Git hooks management")
hooks_app.command("install", help="Install SkillGate pre-commit hook")(install_command)
hooks_app.command("uninstall", help="Remove SkillGate pre-commit hook")(uninstall_command)
app.add_typer(hooks_app, name="hooks")

app.add_typer(auth_app, name="auth")

approval_app = typer.Typer(help="Approval workflow commands")
approval_app.command("sign", help="Create signed approval file")(approval_sign_command)
approval_app.command("verify", help="Verify signed approval file")(approval_verify_command)
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

app.command("scan", help="Scan a skill bundle for security risks")(scan_command)
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
