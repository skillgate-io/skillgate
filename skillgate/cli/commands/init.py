"""Init command — generate a default skillgate.yml policy file."""

from __future__ import annotations

from pathlib import Path

import typer
from rich.console import Console

from skillgate.core.errors import PolicyError
from skillgate.core.policy.loader import generate_policy_yaml
from skillgate.core.policy.presets import list_presets

console = Console(stderr=True)


def init_command(
    preset: str = typer.Option(
        "production",
        "--preset",
        help=f"Policy preset: {', '.join(list_presets())}",
    ),
    output_path: str = typer.Option("./skillgate.yml", "--output", "-o", help="Output file path"),
    force: bool = typer.Option(False, "--force", help="Overwrite existing file"),
) -> None:
    """Initialize a policy configuration file."""
    target = Path(output_path)

    if target.exists() and not force:
        console.print(
            f"[yellow]Warning:[/yellow] {target} already exists. Use --force to overwrite."
        )
        raise typer.Exit(code=1)

    try:
        yaml_content = generate_policy_yaml(preset)
    except PolicyError as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(code=3) from e

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(yaml_content, encoding="utf-8")
    console.print(f"[green]Created policy file:[/green] {target} (preset: {preset})")
