"""Approval workflow commands."""

from __future__ import annotations

import json
from pathlib import Path

import typer

from skillgate.core.gateway import verify_approval_file, write_signed_approval_file
from skillgate.core.signer.keys import load_signing_key


def approval_sign_command(
    skill_id: str = typer.Option(  # noqa: B008
        ...,
        "--skill-id",
        help="Approved skill identifier.",
    ),
    skill_hash: str = typer.Option(..., "--skill-hash", help="Approved skill hash."),  # noqa: B008
    reviewer: list[str] = typer.Option(  # noqa: B008
        ...,
        "--reviewer",
        help="Reviewer identifier. Repeat for quorum.",
    ),
    env: str = typer.Option("prod", "--env", help="Approved environment."),  # noqa: B008
    output: str = typer.Option(  # noqa: B008
        ".skillgate/approvals/approval.json",
        "--output",
        help="Output approval file path.",
    ),
    key_dir: str | None = typer.Option(  # noqa: B008
        None,
        "--key-dir",
        help="Optional signing key directory.",
    ),
) -> None:
    """Create a signed approval file used by runtime approval gates."""
    signing_key = load_signing_key(Path(key_dir) if key_dir else None)
    write_signed_approval_file(
        output_path=Path(output),
        skill_id=skill_id,
        skill_hash=skill_hash,
        environment=env,
        reviewer_ids=reviewer,
        signing_key=signing_key,
    )
    typer.echo(
        json.dumps(
            {"ok": True, "output": output, "reviewers": len(set(reviewer))},
            sort_keys=True,
            separators=(",", ":"),
        )
    )


def approval_verify_command(
    approval_file: str = typer.Argument(help="Path to signed approval file."),  # noqa: B008
    skill_id: str = typer.Option(..., "--skill-id", help="Expected skill identifier."),  # noqa: B008
    skill_hash: str = typer.Option(..., "--skill-hash", help="Expected skill hash."),  # noqa: B008
    env: str = typer.Option("prod", "--env", help="Expected environment."),  # noqa: B008
    required_reviewers: int = typer.Option(  # noqa: B008
        2,
        "--required-reviewers",
        help="Minimum unique reviewers required.",
    ),
) -> None:
    """Verify signed approval file and reviewer quorum."""
    decision = verify_approval_file(
        path=Path(approval_file),
        required_reviewers=max(0, required_reviewers),
        skill_id=skill_id,
        skill_hash=skill_hash,
        environment=env,
    )
    typer.echo(
        json.dumps(
            {
                "allowed": decision.allowed,
                "code": decision.code,
                "reason": decision.reason,
                "reviewer_count": decision.reviewer_count,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
    )
    raise typer.Exit(code=0 if decision.allowed else 1)
