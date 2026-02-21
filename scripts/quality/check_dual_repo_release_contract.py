"""Validate dual-repo release contract sequencing and rollback invariants."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

CONTRACT_PATH = Path("docs/open-core/dual-repo-release-contract.json")
CI_WORKFLOW_PATH = Path(".github/workflows/ci.yml")

EXPECTED_RELEASE_SEQUENCE = [
    "ce_validate",
    "ee_validate",
    "npm_publish",
    "web_deploy",
]


def _load_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("contract JSON must be an object")
    return data


def _validate_sequence(
    *,
    steps: list[dict[str, Any]],
    expected_ids: list[str],
    label: str,
    errors: list[str],
) -> None:
    ids: list[str] = []
    for index, step in enumerate(steps):
        if not isinstance(step, dict):
            errors.append(f"{label}[{index}] must be an object")
            continue
        step_id = step.get("id")
        if not isinstance(step_id, str) or not step_id:
            errors.append(f"{label}[{index}] missing non-empty id")
            continue
        ids.append(step_id)

        state_checks = step.get("state_checks")
        if not isinstance(state_checks, list) or not state_checks:
            errors.append(f"{label}[{index}] ({step_id}) requires non-empty state_checks")
        elif not all(isinstance(item, str) and item for item in state_checks):
            errors.append(f"{label}[{index}] ({step_id}) state_checks must be non-empty strings")

    if ids != expected_ids:
        errors.append(f"{label} order mismatch: expected {expected_ids}, got {ids}")


def _validate_release_step_contracts(
    steps: list[dict[str, Any]],
    workflow_text: str,
    errors: list[str],
) -> None:
    for step in steps:
        step_id = step.get("id")
        if not isinstance(step_id, str):
            continue

        required_files = step.get("required_files")
        if not isinstance(required_files, list) or not required_files:
            errors.append(f"release_sequence step '{step_id}' requires non-empty required_files")
        else:
            for file_path in required_files:
                if not isinstance(file_path, str) or not file_path:
                    errors.append(
                        f"release_sequence step '{step_id}' has invalid required file entry"
                    )
                    continue
                if not Path(file_path).exists():
                    errors.append(
                        f"release_sequence step '{step_id}' missing required file: {file_path}"
                    )

        required_ci_jobs = step.get("required_ci_jobs")
        if not isinstance(required_ci_jobs, list) or not required_ci_jobs:
            errors.append(f"release_sequence step '{step_id}' requires non-empty required_ci_jobs")
        else:
            for job in required_ci_jobs:
                if not isinstance(job, str) or not job:
                    errors.append(
                        f"release_sequence step '{step_id}' has invalid required ci job entry"
                    )
                    continue
                if f"\n  {job}:" not in workflow_text:
                    errors.append(
                        f"release_sequence step '{step_id}' references missing CI job: {job}"
                    )


def validate(
    *,
    contract_path: Path = CONTRACT_PATH,
    ci_workflow_path: Path = CI_WORKFLOW_PATH,
) -> list[str]:
    errors: list[str] = []

    if not contract_path.exists():
        return [f"contract file missing: {contract_path}"]
    if not ci_workflow_path.exists():
        return [f"CI workflow file missing: {ci_workflow_path}"]

    contract = _load_json(contract_path)
    workflow_text = ci_workflow_path.read_text(encoding="utf-8")

    if contract.get("contract_version") != "1":
        errors.append("contract_version must be '1'")

    release_steps = contract.get("release_sequence")
    rollback_steps = contract.get("rollback_sequence")

    if not isinstance(release_steps, list) or not release_steps:
        errors.append("release_sequence must be a non-empty list")
        release_steps = []
    if not isinstance(rollback_steps, list) or not rollback_steps:
        errors.append("rollback_sequence must be a non-empty list")
        rollback_steps = []

    release_step_dicts = [step for step in release_steps if isinstance(step, dict)]
    rollback_step_dicts = [step for step in rollback_steps if isinstance(step, dict)]

    _validate_sequence(
        steps=release_step_dicts,
        expected_ids=EXPECTED_RELEASE_SEQUENCE,
        label="release_sequence",
        errors=errors,
    )
    _validate_sequence(
        steps=rollback_step_dicts,
        expected_ids=list(reversed(EXPECTED_RELEASE_SEQUENCE)),
        label="rollback_sequence",
        errors=errors,
    )
    _validate_release_step_contracts(release_step_dicts, workflow_text, errors)

    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate dual-repo release contract.")
    parser.add_argument(
        "--output",
        default="docs/section-16-open-core-split-governance/artifacts/dual-repo-release-contract-validation.json",
        help="Validation report output path",
    )
    args = parser.parse_args()

    errors = validate()
    report = {
        "ok": not errors,
        "contract": str(CONTRACT_PATH),
        "ci_workflow": str(CI_WORKFLOW_PATH),
        "errors": errors,
    }

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    print(json.dumps(report, sort_keys=True))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
