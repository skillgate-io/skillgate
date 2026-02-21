"""Ed25519 signing and attestation module."""

from skillgate.core.signer.canonical import canonical_json, hash_canonical
from skillgate.core.signer.engine import (
    create_signed_report,
    sign_report,
    verify_report,
    verify_report_with_key,
)
from skillgate.core.signer.keys import generate_keypair, load_public_key_hex, load_signing_key

__all__ = [
    "canonical_json",
    "create_signed_report",
    "generate_keypair",
    "hash_canonical",
    "load_public_key_hex",
    "load_signing_key",
    "sign_report",
    "verify_report",
    "verify_report_with_key",
]
