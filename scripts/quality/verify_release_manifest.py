"""Verify signed release manifest integrity and artifact checksums."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from nacl.exceptions import BadSignatureError
from nacl.signing import VerifyKey

from skillgate.core.signer.keys import public_key_from_hex


def _canonical_json(data: dict[str, Any]) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(8192), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _verify_signature(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    sig = manifest.get("signature_metadata")
    if not isinstance(sig, dict):
        return ["missing signature_metadata"]

    for field in ["algorithm", "public_key", "signed_payload_sha256", "signature"]:
        if field not in sig:
            errors.append(f"signature_metadata missing field: {field}")
    if errors:
        return errors

    if sig.get("algorithm") != "ed25519":
        errors.append("unsupported signature algorithm")
        return errors

    unsigned = {k: v for k, v in manifest.items() if k != "signature_metadata"}
    payload = _canonical_json(unsigned).encode("utf-8")
    payload_hash = _sha256_bytes(payload)
    if payload_hash != sig["signed_payload_sha256"]:
        errors.append("signed payload hash mismatch")
        return errors

    try:
        public_key = public_key_from_hex(str(sig["public_key"]))
        verify_key = VerifyKey(public_key)
        signature = bytes.fromhex(str(sig["signature"]))
        verify_key.verify(payload, signature)
    except (ValueError, BadSignatureError) as exc:
        errors.append(f"signature verification failed: {exc}")

    return errors


def _verify_artifacts(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list):
        return ["manifest artifacts must be a list"]

    for item in artifacts:
        if not isinstance(item, dict):
            errors.append("artifact entry must be an object")
            continue
        for key in ["name", "path", "sha256", "size_bytes"]:
            if key not in item:
                errors.append(f"artifact missing field: {key}")
        path_value = item.get("path")
        if not isinstance(path_value, str):
            errors.append("artifact path must be string")
            continue
        artifact_path = Path(path_value)
        if not artifact_path.exists() or not artifact_path.is_file():
            errors.append(f"artifact not found: {artifact_path}")
            continue
        actual_hash = _sha256_file(artifact_path)
        if actual_hash != item.get("sha256"):
            errors.append(f"artifact hash mismatch: {artifact_path}")
        actual_size = artifact_path.stat().st_size
        if actual_size != item.get("size_bytes"):
            errors.append(f"artifact size mismatch: {artifact_path}")

    return errors


def verify_manifest(manifest_path: Path) -> dict[str, Any]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        return {"ok": False, "errors": ["manifest root must be object"]}

    errors: list[str] = []
    errors.extend(_verify_signature(manifest))
    errors.extend(_verify_artifacts(manifest))

    return {"ok": not errors, "errors": errors, "manifest": str(manifest_path)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify signed release manifest.")
    parser.add_argument(
        "--manifest",
        default="docs/section-13-installation-ux/artifacts/release-manifest.json",
        help="Path to release manifest JSON",
    )
    parser.add_argument(
        "--output",
        default="docs/section-13-installation-ux/artifacts/release-manifest-verification.json",
        help="Verification output path",
    )
    args = parser.parse_args()

    result = verify_manifest(Path(args.manifest))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
