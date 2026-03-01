"""``skillgate export`` — export decision records in CSV, JSON, or SARIF format (Task 34.4)."""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any

import typer
from rich.console import Console

from skillgate.enterprise.audit_export import (
    build_manifest,
    iter_audit_records,
    stream_export_lines,
)

_console = Console(stderr=True)

# Default audit log directory.
_DEFAULT_LOG_DIR = Path.home() / ".skillgate" / "audit-logs"

# SARIF 2.1.0 schema URI.
_SARIF_SCHEMA = "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0-rtm.5.json"

# CSV output headers.
_CSV_HEADERS = [
    "timestamp",
    "invocation_id",
    "workspace_id",
    "agent_id",
    "tool_name",
    "decision",
    "decision_code",
    "reason_codes",
    "degraded",
]


def _parse_date(date_str: str) -> datetime:
    """Parse ISO-8601 date string with timezone fallback to UTC."""
    try:
        dt = datetime.fromisoformat(date_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError as exc:
        msg = f"Invalid date format '{date_str}'. Use YYYY-MM-DD or ISO-8601."
        raise ValueError(msg) from exc


def load_records(
    log_dir: Path,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    workspace: str | None = None,
) -> list[dict[str, Any]]:
    """Load audit log NDJSON records filtered by date range and workspace.

    Args:
        log_dir: Root audit log directory.
        from_dt: Inclusive start timestamp filter.
        to_dt: Inclusive end timestamp filter.
        workspace: Optional workspace ID filter.

    Returns:
        List of matching NDJSON log entry dicts.
    """
    records: list[dict[str, Any]] = []
    search_root = log_dir / workspace if workspace else log_dir

    for log_file in sorted(search_root.rglob("audit-log-*.ndjson")):
        try:
            with log_file.open("r", encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if not isinstance(entry, dict):
                        continue

                    # Filter by workspace.
                    if workspace and str(entry.get("workspace_id", "")) != workspace:
                        continue

                    # Filter by date range.
                    ts_str = str(entry.get("timestamp", ""))
                    if ts_str and (from_dt is not None or to_dt is not None):
                        try:
                            ts = datetime.fromisoformat(ts_str)
                            if ts.tzinfo is None:
                                ts = ts.replace(tzinfo=timezone.utc)
                            if from_dt is not None and ts < from_dt:
                                continue
                            if to_dt is not None and ts > to_dt:
                                continue
                        except ValueError:
                            pass

                    records.append(entry)
        except OSError:
            continue

    return records


def format_csv(records: list[dict[str, Any]]) -> str:
    """Render records as CSV with standard headers.

    Args:
        records: List of audit log entry dicts.

    Returns:
        CSV string with header row and one row per record.
    """
    buf = io.StringIO()
    writer = csv.DictWriter(
        buf,
        fieldnames=_CSV_HEADERS,
        extrasaction="ignore",
        lineterminator="\n",
    )
    writer.writeheader()
    for rec in records:
        row = {
            "timestamp": rec.get("timestamp", ""),
            "invocation_id": rec.get("invocation_id", ""),
            "workspace_id": rec.get("workspace_id", ""),
            "agent_id": rec.get("actor_id", ""),
            "tool_name": rec.get("tool_name", ""),
            "decision": rec.get("decision", ""),
            "decision_code": rec.get("decision_code", ""),
            "reason_codes": json.dumps(rec.get("reason_codes", [])),
            "degraded": str(rec.get("degraded", False)).lower(),
        }
        writer.writerow(row)
    return buf.getvalue()


def format_json(records: list[dict[str, Any]]) -> str:
    """Render records as a JSON array.

    Args:
        records: List of audit log entry dicts.

    Returns:
        Formatted JSON string.
    """
    # Strip chain fields for clean output.
    cleaned = [
        {k: v for k, v in r.items() if k not in ("prev_hash", "entry_hash")}
        for r in records
    ]
    return json.dumps(cleaned, indent=2, sort_keys=True)


def format_sarif(records: list[dict[str, Any]]) -> str:
    """Render records as SARIF 2.1.0 for GitHub Security tab integration.

    Maps DENY decisions to SARIF results with severity.

    Args:
        records: List of audit log entry dicts.

    Returns:
        SARIF JSON string.
    """
    results = []
    for rec in records:
        decision = str(rec.get("decision", ""))
        if decision not in ("DENY", "FAIL"):
            continue
        decision_code = str(rec.get("decision_code", "SG_DENY_UNKNOWN"))
        reason_codes = rec.get("reason_codes", [])
        results.append(
            {
                "ruleId": decision_code,
                "message": {
                    "text": f"SkillGate blocked {rec.get('tool_name', 'unknown')} "
                    f"in workspace {rec.get('workspace_id', 'unknown')}. "
                    f"Reason: {', '.join(reason_codes) if reason_codes else 'policy violation'}."
                },
                "level": "error",
                "properties": {
                    "invocation_id": rec.get("invocation_id", ""),
                    "timestamp": rec.get("timestamp", ""),
                    "workspace_id": rec.get("workspace_id", ""),
                    "decision_code": decision_code,
                },
            }
        )

    sarif: dict[str, Any] = {
        "$schema": _SARIF_SCHEMA,
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "SkillGate",
                        "version": "2.0",
                        "informationUri": "https://skillgate.io",
                        "rules": [],
                    }
                },
                "results": results,
            }
        ],
    }
    return json.dumps(sarif, indent=2)


def export_records(
    log_dir: Path,
    fmt: str,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    workspace: str | None = None,
) -> str:
    """Load and format audit records.

    Args:
        log_dir: Root audit log directory.
        fmt: Output format: ``csv``, ``json``, or ``sarif``.
        from_dt: Inclusive start date filter.
        to_dt: Inclusive end date filter.
        workspace: Optional workspace filter.

    Returns:
        Formatted string output.

    Raises:
        ValueError: If format is unsupported.
    """
    records = load_records(log_dir, from_dt, to_dt, workspace)
    if fmt == "csv":
        return format_csv(records)
    if fmt == "json":
        return format_json(records)
    if fmt == "sarif":
        return format_sarif(records)
    if fmt in {"splunk-hec", "elastic-bulk", "ocsf"}:
        if workspace is None:
            msg = f"Format '{fmt}' requires --workspace."
            raise ValueError(msg)
        streamed = iter_audit_records(
            log_dir=log_dir,
            workspace_id=workspace,
            from_dt=from_dt,
            to_dt=to_dt,
        )
        return "".join(stream_export_lines(streamed, fmt))
    msg = f"Unsupported format '{fmt}'. Use: csv, json, sarif."
    raise ValueError(msg)


def export_command(
    format: Annotated[  # noqa: A002
        str,
        typer.Option(
            "--format",
            "-f",
            help="Output format: csv | json | sarif",
        ),
    ] = "json",
    from_: Annotated[
        str | None,
        typer.Option(
            "--from",
            help="Start date (YYYY-MM-DD or ISO-8601). Inclusive.",
            show_default=False,
        ),
    ] = None,
    to: Annotated[
        str | None,
        typer.Option(
            "--to",
            help="End date (YYYY-MM-DD or ISO-8601). Inclusive.",
            show_default=False,
        ),
    ] = None,
    workspace: Annotated[
        str | None,
        typer.Option(
            "--workspace",
            "-w",
            help="Filter to a specific workspace ID.",
            show_default=False,
        ),
    ] = None,
    log_dir: Annotated[
        str | None,
        typer.Option(
            "--log-dir",
            help="Audit log root directory. Defaults to ~/.skillgate/audit-logs.",
            show_default=False,
        ),
    ] = None,
    out: Annotated[
        str | None,
        typer.Option(
            "--out",
            "-o",
            help="Write output to file instead of stdout.",
            show_default=False,
        ),
    ] = None,
    manifest_out: Annotated[
        str | None,
        typer.Option(
            "--manifest-out",
            help="Write signed export manifest JSON to file.",
            show_default=False,
        ),
    ] = None,
) -> None:
    """Export decision records for local and enterprise pipelines."""
    root = Path(log_dir) if log_dir else _DEFAULT_LOG_DIR

    from_dt: datetime | None = None
    to_dt: datetime | None = None
    try:
        if from_:
            from_dt = _parse_date(from_)
        if to:
            to_dt = _parse_date(to)
    except ValueError as exc:
        _console.print(f"[red]Error:[/red] {exc}")
        raise typer.Exit(code=3) from exc

    if format not in ("csv", "json", "sarif", "splunk-hec", "elastic-bulk", "ocsf"):
        _console.print(
            "[red]Error:[/red] Unsupported format. "
            "Use: csv, json, sarif, splunk-hec, elastic-bulk, ocsf."
        )
        raise typer.Exit(code=3)

    try:
        output = export_records(root, format, from_dt, to_dt, workspace)
    except Exception as exc:  # noqa: BLE001
        _console.print(f"[red]Export failed:[/red] {exc}")
        raise typer.Exit(code=2) from exc

    if out:
        Path(out).write_text(output, encoding="utf-8")
        _console.print(f"Exported {format.upper()} to {out}")
    else:
        typer.echo(output)

    if manifest_out:
        if workspace is None:
            _console.print("[red]Error:[/red] --manifest-out requires --workspace.")
            raise typer.Exit(code=3)
        count = sum(
            1
            for _ in iter_audit_records(
                log_dir=root,
                workspace_id=workspace,
                from_dt=from_dt,
                to_dt=to_dt,
            )
        )
        manifest = build_manifest(
            workspace_id=workspace,
            from_dt=from_dt,
            to_dt=to_dt,
            fmt=format,
            record_count=count,
            generated_at=datetime.now(tz=timezone.utc),
        )
        Path(manifest_out).write_text(
            json.dumps(manifest.__dict__, indent=2, sort_keys=True),
            encoding="utf-8",
        )
