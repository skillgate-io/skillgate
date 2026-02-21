"""AI-BOM commands for runtime gateway workflows."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import typer
from rich.console import Console

from skillgate.core.gateway import BomGate

console = Console(stderr=True)


def bom_import_command(
    cyclonedx_path: str = typer.Argument(help="Path to CycloneDX JSON BOM."),
    output: str = typer.Option(
        ".skillgate/bom/approved.json",
        "--output",
        help="Path to write SkillGate approved BOM store.",
    ),
) -> None:
    """Import CycloneDX BOM into SkillGate runtime AI-BOM store."""
    source = Path(cyclonedx_path)
    if not source.exists():
        console.print(f"[red]Error:[/red] BOM file not found: {source}")
        raise typer.Exit(code=3)

    raw = json.loads(source.read_text(encoding="utf-8"))
    components = raw.get("components")
    if not isinstance(components, list):
        console.print("[red]Error:[/red] CycloneDX JSON missing `components` array.")
        raise typer.Exit(code=3)

    approved: dict[str, dict[str, str]] = {}
    for component in components:
        if not isinstance(component, dict):
            continue
        skill_id = component.get("name")
        hashes = component.get("hashes")
        if not isinstance(skill_id, str) or not isinstance(hashes, list):
            continue
        hash_value = _extract_sha256(hashes)
        if hash_value:
            approved[skill_id] = {"hash": hash_value}

    destination = Path(output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(
            {"approved_skills": approved, "source": str(source)},
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n",
        encoding="utf-8",
    )
    typer.echo(f"Imported {len(approved)} approved skills into {destination}")


def bom_validate_command(
    skill_id: str = typer.Option(..., "--skill-id", help="Skill id to validate."),
    skill_hash: str | None = typer.Option(None, "--skill-hash", help="Skill hash to validate."),
    scan_attestation: str | None = typer.Option(
        None,
        "--scan-attestation",
        help="SkillGate scan attestation marker.",
    ),
    mode: str = typer.Option("strict", "--mode", help="Validation mode: dev|ci|prod|strict."),
    store: str = typer.Option(
        ".skillgate/bom/approved.json",
        "--store",
        help="Path to approved AI-BOM store JSON.",
    ),
) -> None:
    """Validate runtime skill invocation against AI-BOM store."""
    gate = BomGate.from_store(Path(store), mode=mode)
    decision = gate.check(skill_id, skill_hash, scan_attestation)
    typer.echo(
        json.dumps(
            {
                "allowed": decision.allowed,
                "code": decision.code,
                "reason": decision.reason,
                "warning": decision.warning,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
    )
    if decision.allowed:
        raise typer.Exit(code=0)
    raise typer.Exit(code=1)


def _extract_sha256(hashes: list[Any]) -> str | None:
    for item in hashes:
        if not isinstance(item, dict):
            continue
        if str(item.get("alg", "")).upper() == "SHA-256":
            value = item.get("content")
            if isinstance(value, str) and value:
                return value.lower()
    return None
