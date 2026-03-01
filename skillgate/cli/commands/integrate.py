"""``skillgate integrate`` — auto-generate framework-specific SDK integration code."""

from __future__ import annotations

from typing import Annotated

import typer


def integrate_command(
    framework: Annotated[
        str | None,
        typer.Option(
            "--framework",
            "-f",
            help="Target framework: pydantic-ai | langchain | crewai | generic.",
            show_default=False,
        ),
    ] = None,
    detect: Annotated[
        bool,
        typer.Option(
            "--detect",
            help="Auto-detect installed frameworks and show integration code for each.",
        ),
    ] = False,
    output: Annotated[
        str | None,
        typer.Option(
            "--output",
            "-o",
            help="Write generated code to this file instead of stdout.",
            show_default=False,
        ),
    ] = None,
) -> None:
    """Generate framework-specific SkillGate SDK integration code.

    With no arguments, lists detected installed frameworks.

    Examples::

        skillgate integrate --framework pydantic-ai
        skillgate integrate --framework langchain --output tools/enforce.py
        skillgate integrate --detect
    """
    from skillgate.sdk.integrations import detect_frameworks, generate_integration_code

    if detect:
        found = detect_frameworks()
        if not found:
            typer.echo(
                "No supported agent frameworks detected in the current environment.\n"
                "Install one of: pydantic-ai, langchain, crewai\n"
                "Then re-run `skillgate integrate --detect`."
            )
            return
        typer.echo(f"Detected frameworks: {', '.join(found)}\n")
        for fw in found:
            typer.echo(f"{'─' * 60}")
            typer.echo(f"# Integration code for {fw}\n")
            typer.echo(generate_integration_code(fw))
        return

    if framework is None:
        # No flag given — show detected or prompt to pick one
        found = detect_frameworks()
        if found:
            typer.echo(
                f"Detected: {', '.join(found)}\n"
                "Pass --framework <name> to generate integration code, e.g.:\n"
                f"  skillgate integrate --framework {found[0]}"
            )
        else:
            typer.echo(
                "Pass --framework <name> to generate integration code.\n"
                "Supported: pydantic-ai | langchain | crewai | generic\n\n"
                "Example:\n  skillgate integrate --framework generic"
            )
        return

    code = generate_integration_code(framework)

    if output:
        import pathlib

        dest = pathlib.Path(output)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(code, encoding="utf-8")
        typer.echo(f"Integration code written to {dest}")
    else:
        typer.echo(f"# SkillGate SDK integration — {framework}\n")
        typer.echo(code)
