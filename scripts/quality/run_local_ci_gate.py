#!/usr/bin/env python3
"""Run a local CI-equivalent gate pack and write consolidated audit artifacts."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from pathlib import Path

DEFAULT_DB_URL = "postgresql+asyncpg://skillgate:skillgate@localhost:5432/skillgate"


@dataclass(frozen=True)
class GateStep:
    name: str
    command: str
    env: Mapping[str, str] | None = None


def _default_steps(skip_web_ui: bool) -> list[GateStep]:
    db_env = {"SKILLGATE_DATABASE_URL": os.getenv("SKILLGATE_DATABASE_URL", DEFAULT_DB_URL)}
    steps = [
        GateStep(
            "lint",
            "./venv/bin/ruff check . && ./venv/bin/ruff format --check . && "
            "./venv/bin/python scripts/quality/check_wrapper_enforcement.py && "
            "./venv/bin/python scripts/quality/check_claim_ledger.py && "
            "./venv/bin/python scripts/quality/check_install_docs_freshness.py",
        ),
        GateStep("typecheck", "./venv/bin/mypy --strict skillgate/"),
        GateStep("test", "./venv/bin/pytest"),
        GateStep(
            "capability-testbed-contract",
            "./venv/bin/pytest tests/integration/test_capability_testbed_scripts.py -v",
        ),
        GateStep("slo-gates", "./venv/bin/pytest -m slow tests/slo/ -v"),
        GateStep(
            "reliability-evidence",
            "./venv/bin/python scripts/quality/generate_reliability_scorecard.py",
        ),
        GateStep(
            "packaging",
            "./venv/bin/pytest -m slow tests/e2e/test_packaging_release.py -v && "
            "./venv/bin/python -m build --sdist --wheel --no-isolation --outdir dist && "
            "./venv/bin/python -m twine check dist/*",
        ),
        GateStep("api-command-matrix", "./venv/bin/pytest tests/e2e/test_api_command_matrix.py -v"),
        GateStep(
            "api-migrations",
            "./venv/bin/alembic upgrade head && "
            "./venv/bin/alembic downgrade base && "
            "./venv/bin/alembic upgrade head",
            env=db_env,
        ),
        GateStep(
            "security",
            "./venv/bin/python -m pip freeze --exclude-editable > /tmp/requirements-audit.txt && "
            "./venv/bin/pip-audit --strict --disable-pip --no-deps "
            "-r /tmp/requirements-audit.txt && "
            "(./venv/bin/detect-secrets scan --baseline .secrets.baseline || "
            "./venv/bin/detect-secrets scan)",
        ),
        GateStep(
            "ga-decision-gate",
            "./venv/bin/python scripts/quality/check_claim_ledger.py && "
            "./venv/bin/python scripts/quality/check_governance_scope_gate.py && "
            "./venv/bin/python scripts/quality/check_phase_ship_gates.py --phase phase2 && "
            "./venv/bin/pytest tests/unit/test_hunt/test_cli.py "
            "tests/unit/test_retroscan/test_cli.py -v && "
            "./venv/bin/pytest tests/unit/test_api/test_hunt_api.py "
            "tests/unit/test_api/test_retroscan_api.py -v && "
            "./venv/bin/pytest tests/unit/test_api/test_entitlements_api.py "
            "tests/unit/test_cli/test_entitlement_gates.py -v && "
            "./venv/bin/pytest tests/docs/test_pricing_launch_controls.py -v",
        ),
    ]
    if not skip_web_ui:
        steps.insert(7, GateStep("web-ui", "cd web-ui && npm ci && npm run check && npm run build"))
    return steps


def _run_step(step: GateStep, log_file: Path, offline_safe: bool) -> tuple[int, str]:
    env = os.environ.copy()
    if step.env:
        env.update(step.env)
    if offline_safe:
        env.update(
            {
                "PIP_NO_INDEX": "1",
                "PIP_DISABLE_PIP_VERSION_CHECK": "1",
                "npm_config_update_notifier": "false",
            }
        )
    cmd = f"set -euo pipefail; {step.command}"
    proc = subprocess.run(
        ["/bin/zsh", "-lc", cmd],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )
    with log_file.open("a", encoding="utf-8") as handle:
        handle.write(f"\n=== [{step.name}] exit={proc.returncode} ===\n")
        handle.write(proc.stdout)
        if not proc.stdout.endswith("\n"):
            handle.write("\n")
    return proc.returncode, proc.stdout


def _write_markdown(
    path: Path, stamp: str, results: list[dict[str, object]], all_green: bool
) -> None:
    lines = [
        f"# Consolidated Release Audit ({stamp})",
        "",
        "Scope: local CI-equivalent gate pack run.",
        "",
        "## Step Results",
    ]
    for item in results:
        status = "PASS" if item["exit_code"] == 0 else "FAIL"
        lines.append(f"- `{item['name']}`: {status} (exit={item['exit_code']})")
    lines.extend(
        [
            "",
            "## Verdict",
            f"- all_green: `{str(all_green).lower()}`",
            "",
            "## Raw Artifacts",
            f"- `{path.with_suffix('.json').as_posix()}`",
            f"- `{path.with_suffix('.log').as_posix()}`",
        ]
    )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        default="docs/section-11-risk-mitigation/artifacts",
        help="Directory to write consolidated audit artifacts.",
    )
    parser.add_argument(
        "--stamp",
        default=str(date.today()),
        help="Date stamp for artifact files (default: today, YYYY-MM-DD).",
    )
    parser.add_argument(
        "--offline-safe",
        action="store_true",
        help="Disable package index access for commands that might call installers.",
    )
    parser.add_argument(
        "--skip-web-ui",
        action="store_true",
        help="Skip web-ui gate for backend-only local runs.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print commands without executing.",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[2]
    os.chdir(root)

    steps = _default_steps(skip_web_ui=args.skip_web_ui)
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    base_name = f"consolidated-release-audit-{args.stamp}"
    log_path = out_dir / f"{base_name}.log"
    json_path = out_dir / f"{base_name}.json"
    md_path = out_dir / f"{base_name}.md"

    if args.dry_run:
        for step in steps:
            print(f"[dry-run] {step.name}: {step.command}")
        return 0

    log_path.write_text(
        f"# Local CI gate log ({args.stamp})\n# offline_safe={args.offline_safe}\n",
        encoding="utf-8",
    )

    results: list[dict[str, object]] = []
    for step in steps:
        print(f"[gate] running {step.name}")
        code, _ = _run_step(step, log_file=log_path, offline_safe=args.offline_safe)
        results.append({"name": step.name, "exit_code": code})
        if code != 0:
            break

    all_green = all(item["exit_code"] == 0 for item in results) and len(results) == len(steps)
    payload = {
        "stamp": args.stamp,
        "offline_safe": args.offline_safe,
        "skip_web_ui": args.skip_web_ui,
        "steps": results,
        "all_green": all_green,
    }
    json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    _write_markdown(md_path, args.stamp, results, all_green)

    if all_green:
        print(f"[gate] PASS: {md_path}")
        return 0
    print(f"[gate] FAIL: see {log_path}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
