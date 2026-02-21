"""Verify command — verify signed scan reports."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import typer
from rich.console import Console

from skillgate.core.errors import SigningError
from skillgate.core.signer.engine import verify_report, verify_report_with_key

console = Console(stderr=True)


def verify_command(
    report_path: str = typer.Argument(help="Path to signed JSON report file"),
    public_key: str | None = typer.Option(
        None, "--public-key", "-k", help="Hex-encoded public key for verification"
    ),
) -> None:
    """Verify a signed scan report."""
    path = Path(report_path)

    if not path.exists():
        console.print(f"[red]Error:[/red] Report file not found: {report_path}")
        raise typer.Exit(code=3)

    try:
        report_data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        console.print(f"[red]Error:[/red] Failed to read report: {e}")
        raise typer.Exit(code=3) from e

    try:
        if public_key:
            verify_report_with_key(report_data, public_key)
        else:
            verify_report(report_data)
    except SigningError as e:
        console.print(f"[red]Verification FAILED:[/red] {e}")
        raise typer.Exit(code=1) from e

    attestation = report_data.get("attestation", {})
    console.print("[green]Verification PASSED[/green]")
    console.print(f"  Report hash:  {attestation.get('report_hash', 'N/A')}")
    console.print(f"  Signed at:    {attestation.get('timestamp', 'N/A')}")
    console.print(f"  Public key:   {attestation.get('public_key', 'N/A')}")

    # Also write the verification result to stdout for machine consumption
    result = {"verified": True, "report_hash": attestation.get("report_hash")}
    sys.stdout.write(json.dumps(result) + "\n")
    sys.stdout.flush()
