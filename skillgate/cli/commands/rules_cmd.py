"""Rules listing command."""

from __future__ import annotations

import json

import typer
from rich.console import Console
from rich.table import Table

from skillgate.core.analyzer.rules import get_all_rules
from skillgate.core.models.enums import Category

console = Console()


def rules_command(
    category: str | None = typer.Option(None, "--category", help="Filter by category"),
    output: str = typer.Option("human", "--output", "-o", help="Output format: human, json"),
) -> None:
    """List all available detection rules."""
    rules = get_all_rules()

    if category:
        try:
            cat_enum = Category(category.lower())
            rules = [r for r in rules if r.category == cat_enum]
        except ValueError:
            console.print(f"[red]Unknown category:[/red] {category}")
            console.print(f"Valid categories: {', '.join(c.value for c in Category)}")
            raise typer.Exit(code=3) from None

    if output == "json":
        data = [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description,
                "severity": r.severity.value,
                "weight": r.weight,
                "category": r.category.value,
            }
            for r in rules
        ]
        console.print(json.dumps(data, indent=2))
        return

    # Group by category
    from skillgate.core.analyzer.rules.base import Rule

    by_category: dict[Category, list[Rule]] = {}
    for r in rules:
        by_category.setdefault(r.category, []).append(r)

    console.print(f"\n[bold]Detection Rules ({len(rules)} total)[/bold]\n")

    for cat in Category:
        cat_rules = by_category.get(cat, [])
        if not cat_rules:
            continue
        console.print(f"[bold]Category: {cat.value.capitalize()} ({len(cat_rules)} rules)[/bold]")
        table = Table(show_header=False, box=None, padding=(0, 2))
        table.add_column("ID", style="cyan", width=14)
        table.add_column("Name", width=20)
        table.add_column("Severity", width=10)
        table.add_column("Description")
        for r in cat_rules:
            sev_color = {
                "low": "green",
                "medium": "yellow",
                "high": "red",
                "critical": "bold red",
            }.get(r.severity.value, "white")
            table.add_row(
                r.id,
                r.name,
                f"[{sev_color}][{r.severity.value.upper()}][/{sev_color}]",
                r.description,
            )
        console.print(table)
        console.print()
