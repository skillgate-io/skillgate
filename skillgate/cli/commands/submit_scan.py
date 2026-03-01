"""Submit an existing scan report JSON to SkillGate API storage."""

from __future__ import annotations

import json
from pathlib import Path

import typer
from rich.console import Console

from skillgate.cli.scan_submit import submit_scan_report
from skillgate.core.errors import SkillGateError

console = Console(stderr=True)


def submit_scan_command(
    report_file: str = typer.Argument(help="Path to JSON report file produced by skillgate scan"),
    quiet: bool = typer.Option(False, "--quiet", "-q", help="Suppress non-error output"),
) -> None:
    """Submit a JSON scan report to API /api/v1/scans."""
    path = Path(report_file)
    if not path.exists() or not path.is_file():
        if not quiet:
            console.print(f"[red]Error:[/red] Report file not found: {report_file}")
        raise typer.Exit(code=3)

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("report JSON must be an object")
    except Exception as exc:
        if not quiet:
            console.print(f"[red]Error:[/red] Invalid report JSON: {exc}")
        raise typer.Exit(code=3) from exc

    try:
        scan_id = submit_scan_report(report=payload)
    except SkillGateError as exc:
        if not quiet:
            console.print(f"[red]Error:[/red] {exc}")
        raise typer.Exit(code=2) from exc
    except Exception as exc:
        if not quiet:
            console.print(f"[red]Internal error:[/red] {exc}")
        raise typer.Exit(code=2) from exc

    if not quiet:
        console.print(f"[green]Submitted scan:[/] {scan_id}")
