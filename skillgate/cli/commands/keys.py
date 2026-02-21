"""Key management commands."""

from __future__ import annotations

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


def keys_generate_command(
    key_dir: str | None = typer.Option(
        None, "--key-dir", help="Custom key directory (default: ~/.skillgate/keys/)"
    ),
    force: bool = typer.Option(False, "--force", help="Overwrite existing keys"),
) -> None:
    """Generate a new Ed25519 signing keypair."""
    directory = Path(key_dir) if key_dir else None

    if force and directory:
        private_path = directory / "signing.key"
        public_path = directory / "signing.pub"
        if private_path.exists():
            private_path.unlink()
        if public_path.exists():
            public_path.unlink()
    elif force:
        private_path = DEFAULT_KEY_DIR / "signing.key"
        public_path = DEFAULT_KEY_DIR / "signing.pub"
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
