"""Generate a signed release manifest for distributable artifacts."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from nacl.signing import SigningKey

from skillgate.core.signer.keys import load_public_key_hex, load_signing_key


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


def _artifact_entry(path: Path) -> dict[str, Any]:
    return {
        "name": path.name,
        "path": str(path),
        "sha256": _sha256_file(path),
        "size_bytes": path.stat().st_size,
    }


def build_unsigned_manifest(*, release_version: str, artifacts: list[Path]) -> dict[str, Any]:
    ordered = sorted(artifacts, key=lambda p: str(p))
    return {
        "manifest_version": "1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "release_version": release_version,
        "artifacts": [_artifact_entry(path) for path in ordered],
    }


def sign_manifest(
    unsigned_manifest: dict[str, Any],
    signing_key: SigningKey,
    public_key: str,
) -> dict[str, Any]:
    payload = _canonical_json(unsigned_manifest).encode("utf-8")
    payload_hash = _sha256_bytes(payload)
    signature = signing_key.sign(payload).signature.hex()
    signed = dict(unsigned_manifest)
    signed["signature_metadata"] = {
        "algorithm": "ed25519",
        "public_key": public_key,
        "signed_payload_sha256": payload_hash,
        "signature": signature,
    }
    return signed


def generate_manifest(
    *,
    release_version: str,
    artifact_paths: list[Path],
    key_dir: Path | None,
    output_path: Path,
) -> dict[str, Any]:
    for path in artifact_paths:
        if not path.exists() or not path.is_file():
            raise FileNotFoundError(f"Artifact not found: {path}")
    signing_key = load_signing_key(key_dir)
    public_key = load_public_key_hex(key_dir)
    unsigned = build_unsigned_manifest(release_version=release_version, artifacts=artifact_paths)
    signed = sign_manifest(unsigned, signing_key, public_key)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(_canonical_json(signed) + "\n", encoding="utf-8")
    return signed


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a signed release manifest.")
    parser.add_argument("--release-version", required=True, help="Release version (e.g. 1.0.0)")
    parser.add_argument(
        "--artifact",
        action="append",
        required=True,
        help="Artifact path (repeatable)",
    )
    parser.add_argument("--key-dir", default=None, help="Signing key directory")
    parser.add_argument(
        "--output",
        default="docs/section-13-installation-ux/artifacts/release-manifest.json",
        help="Output manifest path",
    )
    args = parser.parse_args()

    key_dir = Path(args.key_dir) if args.key_dir else None
    artifacts = [Path(item) for item in args.artifact]
    output = Path(args.output)

    manifest = generate_manifest(
        release_version=args.release_version,
        artifact_paths=artifacts,
        key_dir=key_dir,
        output_path=output,
    )
    print(
        json.dumps(
            {
                "ok": True,
                "output": str(output),
                "artifact_count": len(manifest["artifacts"]),
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
