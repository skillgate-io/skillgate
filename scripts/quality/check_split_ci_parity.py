"""Validate split CI parity contract against current monorepo workflow."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

MATRIX_PATH = Path("docs/open-core/ci-parity-matrix.json")
WORKFLOW_PATH = Path(".github/workflows/ci.yml")


def validate() -> list[str]:
    errors: list[str] = []
    matrix = json.loads(MATRIX_PATH.read_text(encoding="utf-8"))
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    required_gates = matrix.get("required_gates")
    if not isinstance(required_gates, list) or not required_gates:
        return ["required_gates must be a non-empty list"]

    for gate in required_gates:
        gate_id = gate.get("id")
        job = gate.get("monorepo_job")
        public_contract = gate.get("public_repo_contract")
        private_contract = gate.get("private_repo_contract")

        if not gate_id or not job:
            errors.append("gate entry missing id or monorepo_job")
            continue
        if not public_contract or not private_contract:
            errors.append(f"{gate_id}: missing public/private split contract")

        if f"\n  {job}:" not in workflow:
            errors.append(f"{gate_id}: monorepo job not found in ci.yml: {job}")

    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate CI parity matrix for split repos.")
    parser.add_argument(
        "--output",
        default="docs/section-16-open-core-split-governance/artifacts/ci-parity-validation.json",
        help="Validation report output path",
    )
    args = parser.parse_args()

    errors = validate()
    report = {
        "ok": not errors,
        "matrix": str(MATRIX_PATH),
        "workflow": str(WORKFLOW_PATH),
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
