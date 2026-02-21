"""Installation/auth/environment diagnostics command."""

from __future__ import annotations

import json
import os
import platform
import shutil
import sys
from pathlib import Path
from typing import Any

import typer
from rich.console import Console

from skillgate import __version__
from skillgate.cli.commands.auth import CREDENTIALS_FILE
from skillgate.core.signer.keys import DEFAULT_KEY_DIR, PRIVATE_KEY_FILE, PUBLIC_KEY_FILE

console = Console()

_SUPPORTED_OUTPUTS = {"human", "json"}


def _infer_install_type(command_path: str | None) -> str:
    if not command_path:
        return "unknown"
    normalized = command_path.lower()
    if "pipx" in normalized and "venvs" in normalized:
        return "pipx"
    if "cellar" in normalized or "homebrew" in normalized:
        return "homebrew"
    if "winget" in normalized or "windowsapps" in normalized:
        return "winget"
    if "site-packages" in normalized:
        return "pypi"
    return "unknown"


def _policy_path_hint() -> str | None:
    for candidate in ["skillgate.yml", ".skillgate.yml"]:
        if Path(candidate).exists():
            return str(Path(candidate).resolve())
    return None


def collect_diagnostics() -> dict[str, Any]:
    """Collect deterministic install/auth/environment diagnostics."""
    cli_path = shutil.which("skillgate")
    private_key_path = DEFAULT_KEY_DIR / PRIVATE_KEY_FILE
    public_key_path = DEFAULT_KEY_DIR / PUBLIC_KEY_FILE

    env_flags = {
        "skillgate_api_key_set": bool(os.environ.get("SKILLGATE_API_KEY")),
        "skillgate_api_url_set": bool(os.environ.get("SKILLGATE_API_URL")),
        "skillgate_ci_mode_set": bool(os.environ.get("SKILLGATE_CI_MODE")),
        "skillgate_no_logo_set": bool(os.environ.get("SKILLGATE_NO_LOGO")),
    }

    return {
        "version": __version__,
        "python": {
            "version": platform.python_version(),
            "executable": sys.executable,
            "platform": platform.platform(),
        },
        "installation": {
            "command_path": cli_path,
            "install_type": _infer_install_type(cli_path),
            "cwd": str(Path.cwd()),
            "policy_file": _policy_path_hint(),
        },
        "auth": {
            "env_api_key": env_flags["skillgate_api_key_set"],
            "stored_credentials": CREDENTIALS_FILE.exists(),
            "credentials_path": str(CREDENTIALS_FILE),
        },
        "signing": {
            "key_dir": str(DEFAULT_KEY_DIR),
            "private_key_present": private_key_path.exists(),
            "public_key_present": public_key_path.exists(),
        },
        "environment": env_flags,
    }


def _render_human(diagnostics: dict[str, Any]) -> None:
    installation = diagnostics["installation"]
    auth = diagnostics["auth"]
    signing = diagnostics["signing"]
    environment = diagnostics["environment"]
    python_info = diagnostics["python"]

    console.print(f"[bold]SkillGate Doctor[/] v{diagnostics['version']}")
    console.print("")
    console.print("[bold]Installation[/]")
    console.print(f"- Install type: {installation['install_type']}")
    console.print(f"- Command path: {installation['command_path'] or 'not found on PATH'}")
    console.print(f"- Current working dir: {installation['cwd']}")
    console.print(f"- Policy file: {installation['policy_file'] or 'not found'}")

    console.print("")
    console.print("[bold]Auth[/]")
    console.print(f"- API key in environment: {'yes' if auth['env_api_key'] else 'no'}")
    console.print(f"- Stored credentials file: {'yes' if auth['stored_credentials'] else 'no'}")
    console.print(f"- Credentials path: {auth['credentials_path']}")

    console.print("")
    console.print("[bold]Signing[/]")
    console.print(f"- Key directory: {signing['key_dir']}")
    console.print(f"- Private key present: {'yes' if signing['private_key_present'] else 'no'}")
    console.print(f"- Public key present: {'yes' if signing['public_key_present'] else 'no'}")

    console.print("")
    console.print("[bold]Runtime[/]")
    console.print(f"- Python: {python_info['version']}")
    console.print(f"- Python executable: {python_info['executable']}")
    console.print(f"- Platform: {python_info['platform']}")
    console.print(
        "- Env flags: "
        f"api_url={'yes' if environment['skillgate_api_url_set'] else 'no'}, "
        f"ci_mode={'yes' if environment['skillgate_ci_mode_set'] else 'no'}, "
        f"no_logo={'yes' if environment['skillgate_no_logo_set'] else 'no'}"
    )


def doctor_command(
    output: str = typer.Option(
        "human",
        "--output",
        "-o",
        help="Output format: human, json",
    ),
) -> None:
    """Diagnose installation/auth/environment status for troubleshooting."""
    output_value = output.strip().lower()
    if output_value not in _SUPPORTED_OUTPUTS:
        console.print(f"[red]Error:[/red] Unsupported output '{output}'. Use human or json.")
        raise typer.Exit(code=3)

    diagnostics = collect_diagnostics()
    if output_value == "json":
        typer.echo(json.dumps(diagnostics, indent=2, sort_keys=True))
        return

    _render_human(diagnostics)
