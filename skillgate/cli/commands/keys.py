"""Key management commands."""

from __future__ import annotations

import json
from pathlib import Path

import typer
from rich.console import Console

from skillgate.core.errors import SigningError
from skillgate.core.signer.keys import (
    DEFAULT_KEY_DIR,
    generate_keypair,
    load_public_key_hex,
)

console = Console(stderr=True)


def _resolve_paths(directory: Path) -> tuple[Path, Path]:
    return directory / "signing.key", directory / "signing.pub"


def keys_generate_command(
    key_dir: str | None = typer.Option(
        None, "--key-dir", help="Custom key directory (default: ~/.skillgate/keys/)"
    ),
    force: bool = typer.Option(False, "--force", help="Overwrite existing keys"),
) -> None:
    """Generate a new Ed25519 signing keypair."""
    directory = Path(key_dir) if key_dir else None

    if force and directory:
        private_path, public_path = _resolve_paths(directory)
        if private_path.exists():
            private_path.unlink()
        if public_path.exists():
            public_path.unlink()
    elif force:
        private_path, public_path = _resolve_paths(DEFAULT_KEY_DIR)
        if private_path.exists():
            private_path.unlink()
        if public_path.exists():
            public_path.unlink()

    try:
        private_path, public_path = generate_keypair(directory)
    except SigningError as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(code=2) from e

    console.print("[green]Generated Ed25519 keypair:[/green]")
    console.print(f"  Private key: {private_path}")
    console.print(f"  Public key:  {public_path}")
    console.print()

    try:
        pub_hex = load_public_key_hex(directory)
        console.print(f"[dim]Public key (hex):[/dim] {pub_hex}")
    except SigningError:
        pass


def keys_list_command(
    key_dir: str | None = typer.Option(
        None, "--key-dir", help="Custom key directory (default: ~/.skillgate/keys/)"
    ),
    output: str = typer.Option("human", "--output", help="Output format: human or json"),
) -> None:
    """List available signing key material for this workspace/user."""
    if output not in {"human", "json"}:
        console.print("[red]Error:[/red] --output must be one of: human, json")
        raise typer.Exit(code=3)

    directory = Path(key_dir) if key_dir else DEFAULT_KEY_DIR
    private_path, public_path = _resolve_paths(directory)
    private_exists = private_path.exists()
    public_exists = public_path.exists()

    public_hex = ""
    if public_exists:
        try:
            public_hex = load_public_key_hex(directory)
        except SigningError:
            public_hex = ""

    payload = {
        "key_dir": str(directory),
        "private_key_path": str(private_path),
        "public_key_path": str(public_path),
        "private_key_exists": private_exists,
        "public_key_exists": public_exists,
        "public_key_hex": public_hex,
    }

    if output == "json":
        typer.echo(json.dumps(payload, indent=2, sort_keys=True))
        return

    console.print(f"Key directory: {directory}")
    console.print(
        f"Private key: {private_path} [{'present' if private_exists else 'missing'}]"
    )
    console.print(f"Public key:  {public_path} [{'present' if public_exists else 'missing'}]")
    if public_hex:
        console.print(f"[dim]Public key (hex):[/dim] {public_hex}")
    if not private_exists and not public_exists:
        console.print(
            "[yellow]No keypair found. Run 'skillgate keys generate' to create one.[/yellow]"
        )


def keys_export_command(
    key_dir: str | None = typer.Option(
        None, "--key-dir", help="Custom key directory (default: ~/.skillgate/keys/)"
    ),
    output_file: str | None = typer.Option(
        None,
        "--output-file",
        help="Write exported material to file instead of stdout.",
    ),
    output: str = typer.Option("human", "--output", help="Output format: human or json"),
    include_private: bool = typer.Option(
        False,
        "--include-private",
        help="Include private key hex in export output (use with caution).",
    ),
) -> None:
    """Export key material (public key by default, private key optional)."""
    if output not in {"human", "json"}:
        console.print("[red]Error:[/red] --output must be one of: human, json")
        raise typer.Exit(code=3)

    directory = Path(key_dir) if key_dir else DEFAULT_KEY_DIR
    private_path, public_path = _resolve_paths(directory)

    try:
        public_hex = load_public_key_hex(directory)
    except SigningError as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(code=2) from e

    payload: dict[str, str] = {
        "key_dir": str(directory),
        "public_key_path": str(public_path),
        "public_key_hex": public_hex,
    }

    if include_private:
        if not private_path.exists():
            console.print(
                f"[red]Error:[/red] No private key found at {private_path}. Run 'skillgate keys generate' first."
            )
            raise typer.Exit(code=2)
        payload["private_key_path"] = str(private_path)
        payload["private_key_hex"] = private_path.read_bytes().hex()

    if output == "json":
        rendered = json.dumps(payload, indent=2, sort_keys=True)
    else:
        lines = [
            f"Key directory: {payload['key_dir']}",
            f"Public key path: {payload['public_key_path']}",
            f"Public key (hex): {payload['public_key_hex']}",
        ]
        if include_private:
            lines.extend(
                [
                    f"Private key path: {payload['private_key_path']}",
                    f"Private key (hex): {payload['private_key_hex']}",
                ]
            )
        rendered = "\n".join(lines)

    if output_file:
        out_path = Path(output_file)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(rendered + ("\n" if not rendered.endswith("\n") else ""), encoding="utf-8")
        console.print(f"[green]Exported key material to:[/green] {out_path}")
        return

    if output == "json":
        typer.echo(rendered)
    else:
        console.print(rendered)
