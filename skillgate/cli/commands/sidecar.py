"""Sidecar lifecycle commands."""

from __future__ import annotations

import typer
from rich.console import Console

console = Console(stderr=True)


def start_sidecar_server(
    *,
    host: str = "127.0.0.1",
    port: int = 9911,
    log_level: str = "info",
) -> None:
    """Start the local SkillGate sidecar HTTP server."""
    try:
        import uvicorn
    except ImportError:
        console.print(
            "[red]Sidecar dependencies are not installed.[/red] "
            "Install with: [cyan]pipx reinstall 'skillgate[api]'[/cyan]"
        )
        raise typer.Exit(code=1) from None

    uvicorn.run(
        "skillgate.sidecar.app:create_sidecar_app",
        host=host,
        port=port,
        factory=True,
        log_level=log_level,
    )


def sidecar_start_command(
    host: str = typer.Option("127.0.0.1", "--host", help="Bind host."),
    port: int = typer.Option(9911, "--port", help="Bind port."),
    log_level: str = typer.Option(
        "info",
        "--log-level",
        help="Uvicorn log level (critical|error|warning|info|debug|trace).",
    ),
) -> None:
    """Start the local SkillGate sidecar process."""
    start_sidecar_server(host=host, port=port, log_level=log_level)
