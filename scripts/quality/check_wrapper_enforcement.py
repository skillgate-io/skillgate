"""Enforce wrapper-only runtime execution in CI templates and workflows."""

from __future__ import annotations

import argparse
from pathlib import Path

AI_CLI_MARKERS = ("codex", "claude", "cursor", "copilot", "openclaw", "claw")
SKIP_PREFIXES = ("#", "echo ", "printf ", "name:", "description:")


def find_wrapper_bypass(paths: list[Path]) -> list[str]:
    """Return lines that appear to invoke AI CLIs without `skillgate run` wrapper."""
    violations: list[str] = []
    for path in paths:
        if not path.exists() or not path.is_file():
            continue
        lines = path.read_text(encoding="utf-8").splitlines()
        for idx, line in enumerate(lines, start=1):
            text = line.strip().lower()
            if not text:
                continue
            if text.startswith(SKIP_PREFIXES):
                continue
            if "skillgate run" in text:
                continue
            if not any(marker in text for marker in AI_CLI_MARKERS):
                continue
            violations.append(f"{path}:{idx}: {line.strip()}")
    return violations


def _expand_targets(targets: tuple[str, ...]) -> list[Path]:
    expanded: list[Path] = []
    for target in targets:
        root = Path(target)
        if root.is_file():
            expanded.append(root)
            continue
        if not root.exists():
            continue
        for suffix in ("*.yml", "*.yaml"):
            expanded.extend(root.rglob(suffix))
    return sorted(set(expanded))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "targets",
        nargs="*",
        default=[".github/workflows", "skillgate/ci"],
        help="Files or directories to scan for wrapper bypasses.",
    )
    args = parser.parse_args()

    scan_paths = _expand_targets(tuple(args.targets))
    violations = find_wrapper_bypass(scan_paths)
    if not violations:
        print("Wrapper enforcement check passed.")
        return 0

    print("Wrapper enforcement violations detected:")
    for entry in violations:
        print(f" - {entry}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
