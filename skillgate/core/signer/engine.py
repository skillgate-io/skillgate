"""Ed25519 signing and verification engine."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from nacl.exceptions import BadSignatureError
from nacl.signing import VerifyKey

from skillgate.core.errors import SigningError
from skillgate.core.signer.canonical import build_signing_scope, canonical_json, hash_canonical
from skillgate.core.signer.keys import load_public_key_hex, load_signing_key, public_key_from_hex


def sign_report(report_data: dict[str, Any], key_dir: Path | None = None) -> dict[str, Any]:
    """Sign a scan report and return attestation block.

    The attestation block contains:
    - report_hash: SHA-256 of canonical JSON (without attestation field)
    - timestamp: ISO 8601 UTC timestamp of signing
    - public_key: hex-encoded Ed25519 public key
    - signature: hex-encoded Ed25519 signature of the report hash

    Returns the attestation dict to be added to the report.
    """
    signing_key = load_signing_key(key_dir)
    public_key_hex = load_public_key_hex(key_dir)

    # Hash the report without attestation field
    signable = build_signing_scope(report_data)
    report_hash = hash_canonical(signable)

    # Sign the hash
    signed = signing_key.sign(report_hash.encode("utf-8"))
    signature_hex = signed.signature.hex()

    return {
        "report_hash": report_hash,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "public_key": public_key_hex,
        "signature": signature_hex,
    }


def verify_report(report_data: dict[str, Any]) -> bool:
    """Verify a signed scan report.

    Checks that:
    1. The attestation block exists
    2. The report hash matches recomputed hash
    3. The Ed25519 signature is valid

    Returns True if verification passes.
    Raises SigningError on verification failure.
    """
    attestation = report_data.get("attestation")
    if not attestation or not isinstance(attestation, dict):
        raise SigningError("Report has no attestation block")

    required_fields = {"report_hash", "public_key", "signature", "timestamp"}
    missing = required_fields - set(attestation.keys())
    if missing:
        raise SigningError(f"Attestation missing fields: {', '.join(sorted(missing))}")

    # Recompute hash from report data (excluding attestation)
    signable = build_signing_scope(report_data)
    recomputed_hash = hash_canonical(signable)

    if recomputed_hash != attestation["report_hash"]:
        raise SigningError("Report hash mismatch: report has been tampered with")

    # Verify Ed25519 signature
    public_key_bytes = public_key_from_hex(attestation["public_key"])
    verify_key = VerifyKey(public_key_bytes)

    try:
        signature_bytes = bytes.fromhex(attestation["signature"])
    except ValueError as e:
        raise SigningError(f"Invalid signature hex: {e}") from e

    try:
        verify_key.verify(
            recomputed_hash.encode("utf-8"),
            signature_bytes,
        )
    except BadSignatureError as e:
        raise SigningError("Invalid signature: report has been tampered with") from e

    return True


def verify_report_with_key(report_data: dict[str, Any], public_key_hex: str) -> bool:
    """Verify a signed report using an explicit public key.

    Same as verify_report but uses the provided key instead of the one
    embedded in the attestation. This is useful for third-party verification
    where you want to check against a known trusted key.
    """
    attestation = report_data.get("attestation")
    if not attestation or not isinstance(attestation, dict):
        raise SigningError("Report has no attestation block")

    # Recompute hash
    signable = build_signing_scope(report_data)
    recomputed_hash = hash_canonical(signable)

    if recomputed_hash != attestation["report_hash"]:
        raise SigningError("Report hash mismatch: report has been tampered with")

    # Verify with provided key
    public_key_bytes = public_key_from_hex(public_key_hex)
    verify_key = VerifyKey(public_key_bytes)

    try:
        signature_bytes = bytes.fromhex(attestation["signature"])
    except ValueError as e:
        raise SigningError(f"Invalid signature hex: {e}") from e

    try:
        verify_key.verify(recomputed_hash.encode("utf-8"), signature_bytes)
    except BadSignatureError as e:
        raise SigningError("Invalid signature: key mismatch or tampering") from e

    return True


def create_signed_report(
    report_data: dict[str, Any], key_dir: Path | None = None
) -> dict[str, Any]:
    """Create a complete signed report with attestation block.

    Takes a report dict, signs it, and returns the report with
    the attestation block added.
    """
    attestation = sign_report(report_data, key_dir)
    result = dict(report_data)
    result["attestation"] = attestation

    # Return canonical JSON string for deterministic output
    return result


def get_report_canonical_json(report_data: dict[str, Any]) -> str:
    """Get the canonical JSON representation of a signed report.

    Useful for writing deterministic output files.
    """
    return canonical_json(report_data)
