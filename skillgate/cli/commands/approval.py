"""Approval workflow commands."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

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


def approval_request_command(
    decision_code: str = typer.Option(
        ...,
        "--decision-code",
        help="Decision code that triggered approval workflow.",
    ),
    invocation_id: str = typer.Option(
        ...,
        "--invocation-id",
        help="Invocation identifier that requires approval.",
    ),
    reason: list[str] | None = typer.Option(  # noqa: B008
        None,
        "--reason",
        help="Reason code for approval requirement. Repeat for multiple values.",
    ),
    output_dir: str = typer.Option(
        ".skillgate/approvals/requests",
        "--output-dir",
        help="Directory where request files are written.",
    ),
) -> None:
    """Create a local approval request artifact for IDE/CLI workflows."""
    approval_id = f"apr-{uuid4().hex[:12]}"
    now = datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat()
    payload = {
        "approval_id": approval_id,
        "status": "pending",
        "decision_code": decision_code,
        "invocation_id": invocation_id,
        "reasons": sorted(set(reason or [])),
        "created_at": now,
    }

    request_dir = Path(output_dir)
    request_dir.mkdir(parents=True, exist_ok=True)
    path = request_dir / f"{approval_id}.json"
    path.write_text(
        json.dumps(payload, sort_keys=True, separators=(",", ":")),
        encoding="utf-8",
    )

    typer.echo(
        json.dumps(
            {"approval_id": approval_id, "status": "pending", "path": str(path)},
            sort_keys=True,
            separators=(",", ":"),
        )
    )
