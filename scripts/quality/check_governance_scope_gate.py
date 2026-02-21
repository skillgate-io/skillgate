#!/usr/bin/env python3
"""Fail-closed Section 14 governance/scope gates based on TASKS.md statuses."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TASKS = ROOT / "docs" / "section-14-governed-pipeline" / "TASKS.md"

ROW_RE = re.compile(r"^\|\s*(\d+\.\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|")

P0_REQUIRED = {
    "17.109",
    "17.111",
    "17.112",
    "17.113",
    "17.152",
    "17.153",
    "17.154",
    "17.157",
    "17.161",
    "17.162",
    "17.163",
    "17.164",
}

AUTONOMY_SCOPE = {
    "17.114",
    "17.115",
    "17.116",
    "17.117",
    "17.118",
    "17.119",
    "17.120",
    "17.122",
    "17.123",
    "17.124",
    "17.125",
    "17.126",
    "17.127",
    "17.128",
    "17.129",
    "17.130",
    "17.131",
    "17.132",
    "17.155",
    "17.156",
    "17.158",
    "17.159",
    "17.160",
}

ACTIVE_STATUSES = {"In Progress", "Ready for Gate", "Complete"}


def _parse_statuses(tasks_md: Path) -> dict[str, str]:
    statuses: dict[str, str] = {}
    text = tasks_md.read_text(encoding="utf-8")
    for raw in text.splitlines():
        line = raw.strip()
        if not line or not line.startswith("|"):
            continue
        match = ROW_RE.match(line)
        if match is None:
            continue
        task_id, _name, _priority, status = match.groups()
        statuses[task_id.strip()] = status.strip()
    return statuses


def _non_green_p0(statuses: dict[str, str]) -> set[str]:
    return {task for task in P0_REQUIRED if statuses.get(task) != "Complete"}


def validate(tasks_md: Path) -> list[str]:
    errors: list[str] = []
    if not tasks_md.exists():
        return [f"Missing tasks file: {tasks_md}"]

    statuses = _parse_statuses(tasks_md)
    missing = sorted(P0_REQUIRED - set(statuses))
    if missing:
        errors.append(f"Missing required P0 tasks in status board: {', '.join(missing)}")

    non_green = _non_green_p0(statuses)
    autonomy_active = sorted(
        task for task in AUTONOMY_SCOPE if statuses.get(task, "Not Started") in ACTIVE_STATUSES
    )
    if non_green and autonomy_active:
        errors.append(
            "Governance-before-autonomy gate failed: "
            f"P0 not complete ({', '.join(sorted(non_green))}) but autonomy tasks active "
            f"({', '.join(autonomy_active)})."
        )

    for task in AUTONOMY_SCOPE:
        status = statuses.get(task)
        if status is None:
            continue
        if task in {"17.114", "17.156", "17.158"}:
            # P1 tasks allowed only when all P0 complete.
            if non_green and status in ACTIVE_STATUSES:
                errors.append(
                    f"Scope-freeze gate failed: {task} status '{status}' is not allowed "
                    "until all P0 tasks are Complete."
                )
            continue
        if status in ACTIVE_STATUSES:
            errors.append(
                f"Scope-freeze gate failed: deferred task {task} is '{status}' (must remain "
                "Not Started/Deferred while P0 is incomplete)."
            )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tasks", type=Path, default=DEFAULT_TASKS)
    args = parser.parse_args()

    errors = validate(args.tasks)
    if errors:
        for err in errors:
            print(f"ERROR: {err}")
        return 1
    print("Section 14 governance and scope-freeze gates passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
