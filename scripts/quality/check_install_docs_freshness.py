#!/usr/bin/env python3
"""Validate install docs/spec/manifests are fresh and consistent."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
INSTALL_SPEC_PATH = ROOT / "docs" / "install-spec.json"
INSTALL_GUIDE_PATH = ROOT / "docs" / "INSTALLATION-GUIDE.md"
RELEASE_MANIFEST_PATH = (
    ROOT / "docs" / "section-13-installation-ux" / "artifacts" / "release-manifest.json"
)
MANIFEST_VERIFY_PATH = (
    ROOT
    / "docs"
    / "section-13-installation-ux"
    / "artifacts"
    / "release-manifest-verification.json"
)
DEFAULT_OUTPUT = (
    ROOT / "docs" / "section-13-installation-ux" / "artifacts" / "docs-version-drift-check.json"
)


def _load_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"JSON root must be object: {path}")
    return payload


def validate() -> list[str]:
    errors: list[str] = []
    for required in [
        INSTALL_SPEC_PATH,
        INSTALL_GUIDE_PATH,
        RELEASE_MANIFEST_PATH,
        MANIFEST_VERIFY_PATH,
    ]:
        if not required.exists():
            errors.append(f"Missing required file: {required}")

    if errors:
        return errors

    spec = _load_json(INSTALL_SPEC_PATH)
    manifest = _load_json(RELEASE_MANIFEST_PATH)
    verification = _load_json(MANIFEST_VERIFY_PATH)
    guide_text = INSTALL_GUIDE_PATH.read_text(encoding="utf-8")

    version_targets = spec.get("version_targets")
    if not isinstance(version_targets, dict):
        errors.append("install-spec missing version_targets object")
        return errors

    latest = version_targets.get("latest")
    stable = version_targets.get("stable")
    if not isinstance(latest, str) or not latest:
        errors.append("install-spec latest target missing/invalid")
    if not isinstance(stable, str) or not stable:
        errors.append("install-spec stable target missing/invalid")

    release_version = manifest.get("release_version")
    if not isinstance(release_version, str) or not release_version:
        errors.append("release manifest missing release_version")
    else:
        if latest != release_version:
            errors.append(
                "version drift: install-spec latest "
                f"'{latest}' != release manifest '{release_version}'"
            )
        if stable != release_version:
            errors.append(
                "version drift: install-spec stable "
                f"'{stable}' != release manifest '{release_version}'"
            )

    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list) or not artifacts:
        errors.append("release manifest artifacts missing/invalid")
    else:
        artifact_paths = {item.get("path") for item in artifacts if isinstance(item, dict)}
        for expected in ["docs/install-spec.json", "docs/INSTALLATION-GUIDE.md"]:
            if expected not in artifact_paths:
                errors.append(f"release manifest missing required artifact: {expected}")

    ok = verification.get("ok")
    if ok is not True:
        errors.append("release manifest verification is not ok=true")

    if "docs/install-spec.json" not in guide_text:
        errors.append("installation guide missing source-of-truth reference")

    return errors


def write_result(output: Path, errors: list[str]) -> None:
    payload = {"ok": not errors, "errors": errors}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    errors = validate()
    write_result(args.output, errors)
    if errors:
        for err in errors:
            print(f"ERROR: {err}")
        return 1
    print("Install docs freshness validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
