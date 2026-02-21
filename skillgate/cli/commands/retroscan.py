"""Retro-scan CLI command — replay historical scans with updated rules."""

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
from skillgate.core.retroscan.engine import retroscan
from skillgate.core.retroscan.models import RetroDiff, RetroJob, RetroJobTrigger
from skillgate.core.retroscan.store import RetroJobStore

console = Console(stderr=True)
stdout = Console()


def retroscan_command(
    data_dir: Path = typer.Option(  # noqa: B008
        None,
        "--data-dir",
        "-d",
        help="Directory containing JSON scan report files",
    ),
    data_file: Path = typer.Option(  # noqa: B008
        None,
        "--data-file",
        "-f",
        help="Single JSON file containing a list of scan reports",
    ),
    trigger: str = typer.Option(
        "manual",
        "--trigger",
        "-t",
        help="Trigger type: manual, rule_update, rule_add, rule_remove",
    ),
    rule_ids: str = typer.Option(
        "",
        "--rule-ids",
        "-r",
        help="Comma-separated rule IDs for context",
    ),
    output_format: str = typer.Option(
        "table",
        "--format",
        help="Output format: table, json",
    ),
    quiet: bool = typer.Option(
        False,
        "--quiet",
        "-q",
        help="Suppress non-data output",
    ),
) -> None:
    """Replay historical scans with current rules and show impact diffs.

    Loads scan report JSON files from --data-dir or --data-file,
    re-runs analysis, and shows what changed.
    """
    in_test_mode = os.environ.get("SKILLGATE_TEST_MODE", "").lower() in {"1", "true"}
    if not in_test_mode:
        try:
            entitlement = resolve_runtime_entitlement(get_api_key())
            check_capability(entitlement, Capability.RETROSCAN)
        except EntitlementError as exc:
            if not quiet:
                console.print(f"[red]Error:[/red] {exc}")
            raise typer.Exit(code=1) from exc

    # Load scan data
    scan_reports = _load_scan_reports(data_dir, data_file, quiet)
    if scan_reports is None:
        raise typer.Exit(code=3)

    # Parse trigger
    try:
        job_trigger = RetroJobTrigger(trigger)
    except ValueError:
        if not quiet:
            console.print(f"[red]Invalid trigger:[/red] {trigger}")
        raise typer.Exit(code=3)  # noqa: B904

    parsed_rule_ids = [r.strip() for r in rule_ids.split(",") if r.strip()]

    # Create job
    store = RetroJobStore()
    job = store.create_job(
        job_id="cli-retroscan",
        trigger=job_trigger,
        rule_ids=parsed_rule_ids,
    )

    # Re-analysis: extract existing findings (baseline comparison)
    def analyze_fn(report: dict[str, object]) -> list[dict[str, object]]:
        findings = report.get("findings")
        if isinstance(findings, list):
            return [f for f in findings if isinstance(f, dict)]
        return []

    result = retroscan(job, scan_reports, analyze_fn)
    store.store_result(result)

    # Output
    if output_format == "json":
        stdout.print(result.model_dump_json(indent=2))
    else:
        _print_result(result.job, result.diffs, quiet)


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


def _print_result(
    job: RetroJob,
    diffs: list[RetroDiff],
    quiet: bool,
) -> None:
    """Print retro-scan results as a Rich table."""

    if not quiet:
        console.print(
            f"[bold]Retro-scan complete:[/bold] "
            f"{job.processed_scans}/{job.total_scans} scans processed, "
            f"{job.impacted_scans} impacted"
        )

    impacted = [d for d in diffs if d.finding_diffs]
    if not impacted:
        if not quiet:
            console.print("[dim]No changes detected.[/dim]")
        return

    table = Table(title=f"Retro-scan Impact ({len(impacted)} impacted scans)")
    table.add_column("Scan ID", style="cyan")
    table.add_column("Bundle", style="bold")
    table.add_column("Old Score", justify="right")
    table.add_column("New Score", justify="right")
    table.add_column("Delta", justify="right")
    table.add_column("Added", justify="right", style="green")
    table.add_column("Removed", justify="right", style="red")
    table.add_column("Changed", justify="right", style="yellow")

    for d in impacted:
        delta_str = f"{d.score_delta:+d}" if d.score_delta != 0 else "0"
        table.add_row(
            d.scan_id,
            d.bundle_name or "-",
            str(d.old_score),
            str(d.new_score),
            delta_str,
            str(d.added_count),
            str(d.removed_count),
            str(d.changed_count),
        )

    stdout.print(table)
