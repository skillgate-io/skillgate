"""`skillgate report` commands."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console

from skillgate.compliance.governance_report import generate_governance_report

_console = Console(stderr=True)
_DEFAULT_LOG_DIR = Path.home() / ".skillgate" / "audit-logs"


def governance_report_command(
    workspace: Annotated[str, typer.Option("--workspace", help="Workspace ID")],
    period: Annotated[int, typer.Option("--period", help="Period in days")] = 30,
    log_dir: Annotated[
        Path, typer.Option("--log-dir", help="Audit log directory")
    ] = _DEFAULT_LOG_DIR,
    out: Annotated[Path | None, typer.Option("--out", help="Write markdown report to file")] = None,
) -> None:
    """Generate Agent Capability Governance Report (Markdown)."""
    report = generate_governance_report(
        log_dir=log_dir,
        workspace_id=workspace,
        period_days=period,
    )
    if out is not None:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(report.markdown, encoding="utf-8")
        _console.print(f"[green]Governance report written:[/green] {out}")
        return
    typer.echo(report.markdown)
