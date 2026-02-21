"""Validate repository files against open-core public export denylist policy."""

from __future__ import annotations

import argparse
import json
import subprocess
from fnmatch import fnmatch
from pathlib import Path
from typing import Any


def _normalize(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def _load_policy(policy_path: Path) -> dict[str, Any]:
    try:
        data = json.loads(policy_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SystemExit(f"Policy file not found: {policy_path}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in policy file: {policy_path}: {exc}") from exc

    if not isinstance(data, dict):
        raise SystemExit("Policy JSON must be an object.")
    if "deny" not in data or not isinstance(data["deny"], list):
        raise SystemExit("Policy JSON must include a 'deny' list.")
    if "allow_exceptions" in data and not isinstance(data["allow_exceptions"], list):
        raise SystemExit("Policy key 'allow_exceptions' must be a list when present.")
    return data


def _git_tracked_files(root: Path) -> list[str]:
    proc = subprocess.run(
        ["git", "-C", str(root), "ls-files"],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise SystemExit(f"Failed to list git tracked files:\n{proc.stderr.strip()}")
    return [line.strip() for line in proc.stdout.splitlines() if line.strip()]


def _walk_files(root: Path) -> list[str]:
    return [_normalize(path, root) for path in root.rglob("*") if path.is_file()]


def _matches_any(path: str, patterns: list[str]) -> bool:
    return any(fnmatch(path, pattern) for pattern in patterns)


def _collect_candidates(root: Path, policy: dict[str, Any]) -> list[str]:
    scan_cfg = policy.get("scan", {})
    use_git = bool(scan_cfg.get("use_git_tracked_files", True))
    ignore_globs = [str(p) for p in scan_cfg.get("ignore_globs", [])]
    include_globs = [str(p) for p in scan_cfg.get("include_globs", [])]

    files = _git_tracked_files(root) if use_git else _walk_files(root)
    candidates = [path for path in files if not _matches_any(path, ignore_globs)]
    if include_globs:
        candidates = [path for path in candidates if _matches_any(path, include_globs)]
    return candidates


def _violations(files: list[str], deny: list[str], allow_exceptions: list[str]) -> list[str]:
    hits: list[str] = []
    for rel_path in files:
        if _matches_any(rel_path, deny) and not _matches_any(rel_path, allow_exceptions):
            hits.append(rel_path)
    return sorted(hits)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--policy",
        type=Path,
        default=Path("docs/open-core/public-export-policy.json"),
        help="Path to denylist policy JSON.",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path("."),
        help="Repository root to scan.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return non-zero exit code when any violation is found.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit JSON output instead of text.",
    )
    args = parser.parse_args()

    root = args.root.resolve()
    policy_path = args.policy.resolve()
    policy = _load_policy(policy_path)

    deny = [str(p) for p in policy.get("deny", [])]
    allow_exceptions = [str(p) for p in policy.get("allow_exceptions", [])]

    files = _collect_candidates(root, policy)
    violations = _violations(files, deny, allow_exceptions)

    if args.json:
        report = {
            "policy": str(policy_path),
            "root": str(root),
            "scanned_files": len(files),
            "violation_count": len(violations),
            "violations": violations,
        }
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print(f"Policy: {policy_path}")
        print(f"Scanned files: {len(files)}")
        print(f"Violations: {len(violations)}")
        if violations:
            print("\nDenied paths detected:")
            for path in violations:
                print(f" - {path}")

    if violations and args.strict:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
