"""Ed25519 key generation and management."""

from __future__ import annotations

import logging
from pathlib import Path

from nacl.signing import SigningKey

from skillgate.core.errors import SigningError

logger = logging.getLogger(__name__)

DEFAULT_KEY_DIR = Path.home() / ".skillgate" / "keys"
PRIVATE_KEY_FILE = "signing.key"
PUBLIC_KEY_FILE = "signing.pub"


def get_key_dir(key_dir: Path | None = None, namespace: str | None = None) -> Path:
    """Return the key directory, creating it if necessary.

    Args:
        key_dir: Custom key directory path
        namespace: Optional namespace for key isolation (enterprise feature)

    Returns:
        Path to the key directory
    """
    base_dir = key_dir or DEFAULT_KEY_DIR
    directory = base_dir / namespace if namespace else base_dir
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def generate_keypair(
    key_dir: Path | None = None, namespace: str | None = None
) -> tuple[Path, Path]:
    """Generate a new Ed25519 keypair and save to disk.

    Args:
        key_dir: Custom key directory path
        namespace: Optional namespace for key isolation (enterprise feature)

    Returns (private_key_path, public_key_path).
    Private key file is set to mode 0o600.
    """
    directory = get_key_dir(key_dir, namespace)
    private_path = directory / PRIVATE_KEY_FILE
    public_path = directory / PUBLIC_KEY_FILE

    if private_path.exists():
        raise SigningError(f"Key already exists at {private_path}. Remove it first to regenerate.")

    signing_key = SigningKey.generate()
    verify_key = signing_key.verify_key

    # Write private key (raw 32 bytes)
    private_path.write_bytes(bytes(signing_key))
    private_path.chmod(0o600)

    # Write public key (hex-encoded for easy sharing)
    public_path.write_text(verify_key.encode().hex() + "\n", encoding="utf-8")

    logger.info("Generated Ed25519 keypair in %s", directory)
    return private_path, public_path


def load_signing_key(key_dir: Path | None = None, namespace: str | None = None) -> SigningKey:
    """Load the private signing key from disk.

    Args:
        key_dir: Custom key directory path
        namespace: Optional namespace for key isolation (enterprise feature)
    """
    directory = get_key_dir(key_dir, namespace)
    private_path = directory / PRIVATE_KEY_FILE

    if not private_path.exists():
        raise SigningError(
            f"No signing key found at {private_path}. Run 'skillgate keys generate' first."
        )

    key_bytes = private_path.read_bytes()
    if len(key_bytes) != 32:
        raise SigningError(
            f"Invalid key file at {private_path}: expected 32 bytes, got {len(key_bytes)}"
        )

    return SigningKey(key_bytes)


def load_public_key_hex(key_dir: Path | None = None, namespace: str | None = None) -> str:
    """Load the public key as hex string from disk.

    Args:
        key_dir: Custom key directory path
        namespace: Optional namespace for key isolation (enterprise feature)
    """
    directory = get_key_dir(key_dir, namespace)
    public_path = directory / PUBLIC_KEY_FILE

    if not public_path.exists():
        raise SigningError(
            f"No public key found at {public_path}. Run 'skillgate keys generate' first."
        )

    return public_path.read_text(encoding="utf-8").strip()


def public_key_from_hex(hex_key: str) -> bytes:
    """Decode a hex-encoded public key to raw bytes."""
    try:
        key_bytes = bytes.fromhex(hex_key)
    except ValueError as e:
        raise SigningError(f"Invalid hex public key: {e}") from e

    if len(key_bytes) != 32:
        raise SigningError(f"Invalid public key length: expected 32 bytes, got {len(key_bytes)}")

    return key_bytes
