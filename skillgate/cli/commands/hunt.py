"""Hunt command — query historical scan data via CLI DSL."""

from __future__ import annotations

import json
import os
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

from skillgate.config.license import get_api_key
from skillgate.core.entitlement import Capability, check_capability, resolve_runtime_entitlement
from skillgate.core.errors import EntitlementError
from skillgate.core.hunt.engine import execute_hunt
from skillgate.core.hunt.models import HuntMatch
from skillgate.core.hunt.parser import parse_hunt_dsl

console = Console(stderr=True)
stdout = Console()


def hunt_command(
    query: str = typer.Argument(
        ...,
        help=(
            "Hunt DSL query string. Example: 'rule:SG-SHELL-001 severity:critical after:2024-01-01'"
        ),
    ),
    data_dir: Path = typer.Option(  # noqa: B008
        None,
        "--data-dir",
        "-d",
        help="Directory containing JSON scan report files to search",
    ),
    data_file: Path = typer.Option(  # noqa: B008
        None,
        "--data-file",
        "-f",
        help="Single JSON file containing a list of scan reports",
    ),
    output_format: str = typer.Option(
        "table",
        "--format",
        help="Output format: table, json",
    ),
    quiet: bool = typer.Option(False, "--quiet", "-q", help="Suppress non-data output"),
) -> None:
    """Search historical scan reports for findings matching a query.

    Reads scan report JSON files from --data-dir or --data-file and
    filters them using the hunt DSL.
    """
    in_test_mode = os.environ.get("SKILLGATE_TEST_MODE", "").lower() in {"1", "true"}
    if not in_test_mode:
        try:
            entitlement = resolve_runtime_entitlement(get_api_key())
            check_capability(entitlement, Capability.HUNT)
        except EntitlementError as exc:
            if not quiet:
                console.print(f"[red]Error:[/red] {exc}")
            raise typer.Exit(code=1) from exc

    # Parse query
    try:
        hunt_query = parse_hunt_dsl(query)
    except ValueError as exc:
        if not quiet:
            console.print(f"[red]Invalid query:[/red] {exc}")
        raise typer.Exit(code=3) from exc

    # Load scan data
    scan_reports = _load_scan_reports(data_dir, data_file, quiet)
    if scan_reports is None:
        raise typer.Exit(code=3)

    # Execute
    result = execute_hunt(hunt_query, scan_reports)

    # Output
    if output_format == "json":
        stdout.print(result.model_dump_json(indent=2))
    else:
        _print_table(result.matches, result.total, result.offset, quiet)

    if result.total == 0 and not quiet:
        console.print("[dim]No matches found.[/dim]")


def _load_scan_reports(
    data_dir: Path | None,
    data_file: Path | None,
    quiet: bool,
) -> list[dict[str, object]] | None:
    """Load scan reports from directory or file."""
    if data_dir is None and data_file is None:
        if not quiet:
            console.print("[red]Specify --data-dir or --data-file[/red]")
        return None

    reports: list[dict[str, object]] = []

    if data_file is not None:
        if not data_file.exists():
            if not quiet:
                console.print(f"[red]File not found:[/red] {data_file}")
            return None
        try:
            data = json.loads(data_file.read_text(encoding="utf-8"))
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        reports.append(item)
            elif isinstance(data, dict):
                reports.append(data)
        except (json.JSONDecodeError, OSError) as exc:
            if not quiet:
                console.print(f"[red]Failed to read {data_file}:[/red] {exc}")
            return None

    if data_dir is not None:
        if not data_dir.is_dir():
            if not quiet:
                console.print(f"[red]Not a directory:[/red] {data_dir}")
            return None
        for json_file in sorted(data_dir.glob("*.json")):
            try:
                data = json.loads(json_file.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    reports.append(data)
                elif isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict):
                            reports.append(item)
            except (json.JSONDecodeError, OSError):
                if not quiet:
                    console.print(f"[yellow]Skipping:[/yellow] {json_file}")
                continue

    if not quiet:
        console.print(f"[dim]Loaded {len(reports)} scan report(s)[/dim]")
    return reports


def _print_table(
    matches: list[HuntMatch],
    total: int,
    offset: int,
    quiet: bool,
) -> None:
    """Print hunt results as a Rich table."""
    if not matches:
        return

    showing = f"{offset + 1}-{offset + len(matches)}"
    table = Table(title=f"Hunt Results ({total} total, showing {showing})")
    table.add_column("Rule ID", style="cyan")
    table.add_column("Severity", style="bold")
    table.add_column("Category")
    table.add_column("File")
    table.add_column("Bundle")
    table.add_column("Confidence")
    table.add_column("Score", justify="right")

    severity_styles = {
        "critical": "bold red",
        "high": "red",
        "medium": "yellow",
        "low": "dim",
    }

    for m in matches:
        sev_style = severity_styles.get(m.severity, "")
        conf_str = f"{m.confidence:.2f}" if m.confidence is not None else "-"
        table.add_row(
            m.rule_id,
            f"[{sev_style}]{m.severity}[/{sev_style}]",
            m.category,
            f"{m.file}:{m.line}" if m.file else "-",
            m.bundle_name or "-",
            conf_str,
            str(m.score),
        )

    stdout.print(table)
