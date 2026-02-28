#!/usr/bin/env python3
"""Validate phase ship gates with runtime and integration evidence."""

from __future__ import annotations

import argparse
import json
import subprocess
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_DIR = ROOT / "docs" / "phase2" / "artifacts"
DEFAULT_CONTRACT_PATH = ROOT / "docs" / "quality" / "ship-gate-contract.json"


@dataclass(frozen=True)
class SprintGate:
    phase: str
    sprint_id: str
    label: str
    runtime_commands: tuple[str, ...]
    required_paths: tuple[str, ...]
    required_json_values: tuple[tuple[str, tuple[tuple[str, str], ...]], ...]
    required_text_snippets: tuple[tuple[str, tuple[str, ...]], ...]


@dataclass(frozen=True)
class CommandResult:
    command: str
    exit_code: int
    output: str


def _read_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"JSON payload must be an object: {path}")
    return payload


def _lookup_json_key(payload: dict[str, Any], dotted_key: str) -> Any:
    current: Any = payload
    for segment in dotted_key.split("."):
        if not isinstance(current, dict) or segment not in current:
            return None
        current = current[segment]
    return current


def _coerce_gate(phase: str, item: dict[str, Any]) -> SprintGate:
    sprint = str(item.get("sprint", "")).strip()
    label = str(item.get("label", "")).strip()
    if not sprint or not label:
        raise ValueError("Each sprint entry must include non-empty 'sprint' and 'label'")

    runtime_raw = item.get("runtime_commands", [])
    if not isinstance(runtime_raw, list):
        raise ValueError(f"{phase}:{sprint} runtime_commands must be a list")
    runtime_commands = tuple(str(cmd).strip() for cmd in runtime_raw if str(cmd).strip())

    paths_raw = item.get("required_paths", [])
    if not isinstance(paths_raw, list):
        raise ValueError(f"{phase}:{sprint} required_paths must be a list")
    required_paths = tuple(str(path).strip() for path in paths_raw if str(path).strip())

    json_values_raw = item.get("required_json_values", [])
    if not isinstance(json_values_raw, list):
        raise ValueError(f"{phase}:{sprint} required_json_values must be a list")
    required_json_values: list[tuple[str, tuple[tuple[str, str], ...]]] = []
    for row in json_values_raw:
        if not isinstance(row, dict):
            raise ValueError(f"{phase}:{sprint} required_json_values entry must be object")
        rel_path = str(row.get("path", "")).strip()
        checks_raw = row.get("checks", [])
        if not rel_path or not isinstance(checks_raw, list):
            raise ValueError(f"{phase}:{sprint} required_json_values entry malformed")
        checks: list[tuple[str, str]] = []
        for check in checks_raw:
            if not isinstance(check, dict):
                raise ValueError(f"{phase}:{sprint} required_json_values.check must be object")
            key = str(check.get("key", "")).strip()
            expected = str(check.get("expected", "")).strip()
            if not key:
                raise ValueError(f"{phase}:{sprint} required_json_values.check missing key")
            checks.append((key, expected))
        required_json_values.append((rel_path, tuple(checks)))

    text_raw = item.get("required_text_snippets", [])
    if not isinstance(text_raw, list):
        raise ValueError(f"{phase}:{sprint} required_text_snippets must be a list")
    required_text_snippets: list[tuple[str, tuple[str, ...]]] = []
    for row in text_raw:
        if not isinstance(row, dict):
            raise ValueError(f"{phase}:{sprint} required_text_snippets entry must be object")
        rel_path = str(row.get("path", "")).strip()
        snippets_raw = row.get("snippets", [])
        if not rel_path or not isinstance(snippets_raw, list):
            raise ValueError(f"{phase}:{sprint} required_text_snippets entry malformed")
        snippets = tuple(str(snippet).strip() for snippet in snippets_raw if str(snippet).strip())
        required_text_snippets.append((rel_path, snippets))

    return SprintGate(
        phase=phase,
        sprint_id=sprint,
        label=label,
        runtime_commands=runtime_commands,
        required_paths=required_paths,
        required_json_values=tuple(required_json_values),
        required_text_snippets=tuple(required_text_snippets),
    )


def _load_gates(
    contract_path: Path, phase: str, selected_sprints: set[str]
) -> tuple[SprintGate, ...]:
    contract = _read_json(contract_path)
    phases = contract.get("phases")
    if not isinstance(phases, dict):
        raise ValueError("contract must contain a 'phases' object")
    phase_data = phases.get(phase)
    if not isinstance(phase_data, dict):
        raise ValueError(f"phase '{phase}' not found in contract")
    sprint_rows = phase_data.get("sprints", [])
    if not isinstance(sprint_rows, list) or not sprint_rows:
        raise ValueError(f"phase '{phase}' must have non-empty 'sprints' list")

    gates: list[SprintGate] = []
    for row in sprint_rows:
        if not isinstance(row, dict):
            raise ValueError("sprint entries must be objects")
        gate = _coerce_gate(phase, row)
        if selected_sprints and gate.sprint_id not in selected_sprints:
            continue
        gates.append(gate)
    return tuple(gates)


def _run_command(command: str) -> CommandResult:
    proc = subprocess.run(
        ["/bin/zsh", "-lc", f"set -euo pipefail; {command}"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )
    return CommandResult(command=command, exit_code=proc.returncode, output=proc.stdout)


def _validate_evidence(gate: SprintGate) -> list[str]:
    errors: list[str] = []
    for rel_path in gate.required_paths:
        if not (ROOT / rel_path).exists():
            errors.append(f"missing required path: {rel_path}")

    for rel_path, checks in gate.required_json_values:
        path = ROOT / rel_path
        if not path.exists():
            errors.append(f"missing required path: {rel_path}")
            continue
        payload = _read_json(path)
        for key, expected in checks:
            actual = _lookup_json_key(payload, key)
            if str(actual) != expected:
                errors.append(
                    f"{rel_path}: expected {key}={expected!r}, found {actual!r}"
                )

    for rel_path, snippets in gate.required_text_snippets:
        path = ROOT / rel_path
        if not path.exists():
            errors.append(f"missing required path: {rel_path}")
            continue
        text = path.read_text(encoding="utf-8").lower()
        for snippet in snippets:
            if snippet.lower() not in text:
                errors.append(f"{rel_path}: missing required text snippet {snippet!r}")
    return errors


def _run_gate(gate: SprintGate, *, skip_runtime: bool) -> dict[str, Any]:
    runtime_results: list[dict[str, Any]] = []
    runtime_ok = True
    if not skip_runtime:
        for command in gate.runtime_commands:
            result = _run_command(command)
            runtime_results.append(
                {
                    "command": result.command,
                    "exit_code": result.exit_code,
                    "output_tail": result.output[-2000:],
                }
            )
            if result.exit_code != 0:
                runtime_ok = False
                break

    evidence_errors = _validate_evidence(gate)
    evidence_ok = len(evidence_errors) == 0
    status = "PASS" if runtime_ok and evidence_ok else "FAIL"
    return {
        "phase": gate.phase,
        "sprint": gate.sprint_id,
        "label": gate.label,
        "status": status,
        "runtime_ok": runtime_ok,
        "evidence_ok": evidence_ok,
        "runtime_results": runtime_results,
        "evidence_errors": evidence_errors,
    }


def _write_markdown(path: Path, report: dict[str, Any]) -> None:
    lines = [
        f"# {report['phase']} Ship Gate Audit ({report['stamp']})",
        "",
        "| Sprint | Status | Runtime | Evidence |",
        "|---|---|---|---|",
    ]
    for sprint in report["sprints"]:
        runtime = "PASS" if sprint["runtime_ok"] else "FAIL"
        evidence = "PASS" if sprint["evidence_ok"] else "FAIL"
        sprint_name = f"{sprint['sprint']} {sprint['label']}"
        lines.append(
            f"| {sprint_name} | {sprint['status']} | {runtime} | {evidence} |"
        )
    lines.extend(
        [
            "",
            "## Verdict",
            f"- all_green: `{str(report['all_green']).lower()}`",
            "",
        ]
    )
    for sprint in report["sprints"]:
        lines.append(f"### Sprint {sprint['sprint']} — {sprint['label']}")
        if sprint["runtime_results"]:
            lines.append("- Runtime commands:")
            for item in sprint["runtime_results"]:
                lines.append(f"  - `{item['command']}` (exit={item['exit_code']})")
        if sprint["evidence_errors"]:
            lines.append("- Evidence errors:")
            for err in sprint["evidence_errors"]:
                lines.append(f"  - {err}")
        else:
            lines.append("- Evidence checks passed.")
        lines.append("")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--phase",
        default="phase2",
        help="Phase key in ship-gate contract (default: phase2).",
    )
    parser.add_argument(
        "--contract",
        default=str(DEFAULT_CONTRACT_PATH),
        help="Path to ship-gate contract JSON.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory to write JSON/Markdown audit artifacts.",
    )
    parser.add_argument(
        "--stamp",
        default=str(date.today()),
        help="Artifact stamp (default: YYYY-MM-DD).",
    )
    parser.add_argument(
        "--skip-runtime",
        action="store_true",
        help="Skip command execution and validate integration evidence only.",
    )
    parser.add_argument(
        "--sprint",
        action="append",
        default=[],
        help="Run only selected sprint ids. Repeatable.",
    )
    args = parser.parse_args()

    selected = {item.strip() for item in args.sprint if item.strip()}
    gates = _load_gates(Path(args.contract), args.phase, selected)
    if not gates:
        raise SystemExit("No matching sprint gates selected.")

    sprint_results = [_run_gate(gate, skip_runtime=args.skip_runtime) for gate in gates]
    all_green = all(result["status"] == "PASS" for result in sprint_results)
    payload = {
        "phase": args.phase,
        "stamp": args.stamp,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "skip_runtime": args.skip_runtime,
        "contract": str(Path(args.contract)),
        "all_green": all_green,
        "sprints": sprint_results,
    }

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = f"{args.phase}-ship-gate-audit-{args.stamp}"
    json_path = output_dir / f"{stem}.json"
    md_path = output_dir / f"{stem}.md"

    json_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    _write_markdown(md_path, payload)

    print(json.dumps({"all_green": all_green, "json": str(json_path), "md": str(md_path)}))
    return 0 if all_green else 1


if __name__ == "__main__":
    raise SystemExit(main())
