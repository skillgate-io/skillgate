"""Codex CLI bridge commands."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal

import typer

from skillgate.codex_bridge.providers import ProviderRegistry
from skillgate.codex_bridge.wrapper import run_codex_wrapper


def codex_bridge_command(
    ctx: typer.Context,
    ci: bool = typer.Option(False, "--ci", help="Enable hardened CI guard mode."),
    sidecar_url: str = typer.Option(
        "http://127.0.0.1:8000",
        "--sidecar-url",
        help="SkillGate sidecar URL used for runtime enforcement decisions.",
    ),
    output: Literal["json", "sarif"] = typer.Option(
        "json",
        "--output",
        help="Preflight report format when findings are present.",
    ),
    directory: str = typer.Option(
        ".", "--directory", help="Project root for Codex governance scans."
    ),
    registry: str = typer.Option(
        ".skillgate/codex-provider-registry.json",
        "--registry",
        help="Approved provider registry path.",
    ),
    instruction_baseline: str = typer.Option(
        ".skillgate/codex-instructions-baseline.json",
        "--instruction-baseline",
        help="Instruction baseline snapshot path used for diff checks.",
    ),
    settings_baseline: str = typer.Option(
        ".skillgate/codex-settings-baseline.json",
        "--settings-baseline",
        help="Codex settings baseline path.",
    ),
    aibom_lock: str = typer.Option(
        ".skillgate/aibom.lock",
        "--aibom-lock",
        help="AI-BOM lock path for provider checksum enforcement.",
    ),
    codex_bin: str = typer.Option("codex", "--codex-bin", help="Codex executable name/path."),
) -> None:
    """Run Codex through SkillGate bridge preflight and enforcement wrapper."""
    forwarded = list(ctx.args)
    if not forwarded:
        raise typer.BadParameter('Missing Codex arguments. Example: skillgate codex exec "task".')
    if forwarded[0] == "approve":
        _run_approve_mode(forwarded[1:], directory=directory, registry=registry)
        return
    if forwarded[0] == "revoke":
        _run_revoke_mode(forwarded[1:], directory=directory, registry=registry)
        return

    project_root = Path(directory).resolve()

    exit_code = run_codex_wrapper(
        args=forwarded,
        sidecar_url=sidecar_url,
        ci_mode=ci,
        output=output,
        project_root=project_root,
        codex_bin=codex_bin,
        env=dict(os.environ),
        registry_path=(project_root / registry).resolve(),
        instruction_baseline_path=(project_root / instruction_baseline).resolve(),
        settings_baseline_path=(project_root / settings_baseline).resolve(),
        aibom_lock_path=(project_root / aibom_lock).resolve(),
    )
    raise typer.Exit(code=exit_code)


def _run_approve_mode(args: list[str], *, directory: str, registry: str) -> None:
    if not args:
        raise typer.BadParameter("Missing provider id. Usage: skillgate codex approve <provider>.")
    provider = args[0]
    permissions = ""
    idx = 1
    while idx < len(args):
        token = args[idx]
        if token == "--permissions" and (idx + 1) < len(args):
            permissions = args[idx + 1]
            idx += 2
            continue
        idx += 1

    root = Path(directory).resolve()
    registry_path = (root / registry).resolve()
    permissions_set = tuple(
        sorted({item.strip() for item in permissions.split(",") if item.strip()})
    )

    store = ProviderRegistry(registry_path)
    store.approve(provider, permissions_set)
    typer.echo(
        json.dumps(
            {
                "provider": provider,
                "permissions": list(permissions_set),
                "approved": True,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
    )


def _run_revoke_mode(args: list[str], *, directory: str, registry: str) -> None:
    if not args:
        raise typer.BadParameter("Missing provider id. Usage: skillgate codex revoke <provider>.")
    provider = args[0]

    root = Path(directory).resolve()
    registry_path = (root / registry).resolve()

    removed = ProviderRegistry(registry_path).revoke(provider)
    typer.echo(
        json.dumps(
            {"provider": provider, "revoked": removed},
            sort_keys=True,
            separators=(",", ":"),
        )
    )
    if not removed:
        raise typer.Exit(code=1)
