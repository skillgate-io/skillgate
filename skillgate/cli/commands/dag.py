"""Session lineage / DAG artifact commands."""

from __future__ import annotations

import json
from pathlib import Path

import typer
from rich.console import Console

from skillgate.cli.commands.auth import get_api_key
from skillgate.core.entitlement import Capability, resolve_runtime_entitlement
from skillgate.core.entitlement.gates import check_capability
from skillgate.core.errors import EntitlementError
from skillgate.core.gateway import analyze_lineage_artifact, verify_session_artifact

console = Console(stderr=True)


def dag_show_command(
    session_artifact: str = typer.Argument(help="Path to signed session artifact JSON."),
) -> None:
    """Display session DAG artifact."""
    artifact_path = Path(session_artifact)
    if not artifact_path.exists():
        console.print(f"[red]Error:[/red] Session artifact not found: {artifact_path}")
        raise typer.Exit(code=3)
    data = json.loads(artifact_path.read_text(encoding="utf-8"))
    typer.echo(json.dumps(data, indent=2, sort_keys=True))


def dag_verify_command(
    session_artifact: str = typer.Argument(help="Path to signed session artifact JSON."),
) -> None:
    """Verify signatures for a session DAG artifact."""
    artifact_path = Path(session_artifact)
    if not artifact_path.exists():
        console.print(f"[red]Error:[/red] Session artifact not found: {artifact_path}")
        raise typer.Exit(code=3)
    ok = verify_session_artifact(artifact_path)
    if ok:
        typer.echo('{"verified":true}')
        raise typer.Exit(code=0)
    typer.echo('{"verified":false}')
    raise typer.Exit(code=1)


def dag_risk_command(
    session_artifact: str = typer.Argument(help="Path to signed session artifact JSON."),
    output: str = typer.Option("human", "--output", "-o", help="Output format: human|json"),
    max_depth: int | None = typer.Option(
        None, "--max-depth", help="Optional threshold: fail if DAG depth exceeds this value."
    ),
    max_risk_score: int | None = typer.Option(
        None,
        "--max-risk-score",
        help="Optional threshold: fail if lineage risk score exceeds this value.",
    ),
    allow_unsigned: bool = typer.Option(
        False,
        "--allow-unsigned",
        help="Allow risk analysis without signature verification (debug only).",
    ),
) -> None:
    """Compute transitive privilege/risk metrics from session DAG artifact."""
    try:
        entitlement = resolve_runtime_entitlement(get_api_key())
        check_capability(entitlement, Capability.TRUST_GRAPH)
    except EntitlementError as exc:
        console.print(f"[red]Error:[/red] {exc}")
        raise typer.Exit(code=1) from None

    artifact_path = Path(session_artifact)
    if not artifact_path.exists():
        console.print(f"[red]Error:[/red] Session artifact not found: {artifact_path}")
        raise typer.Exit(code=3)

    verified = verify_session_artifact(artifact_path)
    if not verified and not allow_unsigned:
        console.print("[red]Error:[/red] Session artifact signature verification failed.")
        raise typer.Exit(code=1)

    summary = analyze_lineage_artifact(artifact_path)
    payload = {
        "verified": verified,
        "session_id": summary.session_id,
        "node_count": summary.node_count,
        "edge_count": summary.edge_count,
        "max_depth": summary.max_depth,
        "blast_radius": summary.blast_radius,
        "high_risk_decisions": summary.high_risk_decisions,
        "high_risk_path_count": summary.high_risk_path_count,
        "lateral_movement_potential": summary.lateral_movement_potential,
        "secret_exposure_radius": summary.secret_exposure_radius,
        "blocked_decisions": summary.blocked_decisions,
        "risk_score": summary.risk_score,
    }
    if output == "json":
        typer.echo(json.dumps(payload, sort_keys=True, separators=(",", ":")))
    else:
        typer.echo(
            "\n".join(
                [
                    "SkillGate Lineage Risk",
                    f"Session:            {summary.session_id}",
                    f"Nodes:              {summary.node_count}",
                    f"Edges:              {summary.edge_count}",
                    f"Max depth:          {summary.max_depth}",
                    f"Blast radius:       {summary.blast_radius}",
                    f"High-risk events:   {summary.high_risk_decisions}",
                    f"High-risk paths:    {summary.high_risk_path_count}",
                    f"Lateral movement:   {summary.lateral_movement_potential}",
                    f"Secret exposure:    {summary.secret_exposure_radius}",
                    f"Blocked events:     {summary.blocked_decisions}",
                    f"Lineage risk score: {summary.risk_score}",
                ]
            )
        )

    if max_depth is not None and summary.max_depth > max_depth:
        raise typer.Exit(code=1)
    if max_risk_score is not None and summary.risk_score > max_risk_score:
        raise typer.Exit(code=1)
    raise typer.Exit(code=0)
