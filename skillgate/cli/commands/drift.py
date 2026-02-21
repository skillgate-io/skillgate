"""Skill drift baseline/check commands."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import typer

from skillgate.core.analyzer.engine import analyze_bundle
from skillgate.core.gateway import verify_session_artifact
from skillgate.core.models.bundle import SkillBundle
from skillgate.core.models.enums import Category
from skillgate.core.parser.bundle import load_bundle
from skillgate.core.parser.fleet import discover_fleet_bundles

_URL_RE = re.compile(r"https?://([a-zA-Z0-9.-]+)")


def drift_baseline_command(
    paths: list[str] = typer.Argument(help="Repository or bundle paths to baseline."),  # noqa: B008
    fleet: bool = typer.Option(False, "--fleet", help="Enable fleet baseline mode."),
    output: str = typer.Option(
        ".skillgate/drift/baseline.json",
        "--output",
        help="Baseline output path.",
    ),
) -> None:
    """Create deterministic drift baseline snapshot."""
    payload = _build_baseline(paths, fleet=fleet)
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    typer.echo(
        json.dumps(
            {"ok": True, "output": str(output_path)},
            sort_keys=True,
            separators=(",", ":"),
        )
    )


def drift_check_command(
    paths: list[str] = typer.Argument(default=[], help="Optional paths to compare."),  # noqa: B008
    fleet: bool = typer.Option(False, "--fleet", help="Enable fleet drift comparison mode."),
    baseline: str = typer.Option(
        ".skillgate/drift/baseline.json",
        "--baseline",
        help="Baseline snapshot path.",
    ),
    output: str = typer.Option("human", "--output", "-o", help="Output format: human|json"),
    fail_on_drift: bool = typer.Option(
        True,
        "--fail-on-drift/--no-fail-on-drift",
        help="Exit with code 1 when drift is detected.",
    ),
) -> None:
    """Compare current state with stored baseline snapshot."""
    baseline_path = Path(baseline)
    if not baseline_path.exists():
        raise typer.BadParameter(f"Baseline not found: {baseline}")
    base_payload = json.loads(baseline_path.read_text(encoding="utf-8"))
    baseline_entries_raw = base_payload.get("repositories", [])
    baseline_entries = baseline_entries_raw if isinstance(baseline_entries_raw, list) else []
    baseline_map = {
        str(entry.get("path")): entry
        for entry in baseline_entries
        if isinstance(entry, dict) and isinstance(entry.get("path"), str)
    }

    target_paths = list(paths)
    if not target_paths:
        target_paths = sorted(baseline_map.keys())
    current_payload = _build_baseline(target_paths, fleet=fleet)
    current_entries_raw = current_payload.get("repositories", [])
    current_entries = current_entries_raw if isinstance(current_entries_raw, list) else []
    current_map = {
        str(entry.get("path")): entry
        for entry in current_entries
        if isinstance(entry, dict) and isinstance(entry.get("path"), str)
    }

    drifts: list[dict[str, object]] = []
    for path in target_paths:
        baseline_entry = baseline_map.get(path)
        current_entry = current_map.get(path)
        if not baseline_entry or not current_entry:
            drifts.append({"path": path, "type": "missing_baseline_or_current"})
            continue
        drifts.extend(_diff_entries(path, baseline_entry, current_entry))

    summary = {
        "baseline": str(baseline_path),
        "repositories": len(target_paths),
        "drift_count": len(drifts),
        "drifts": drifts,
    }
    if output == "json":
        typer.echo(json.dumps(summary, sort_keys=True, separators=(",", ":")))
    else:
        typer.echo(_format_human(summary))

    if fail_on_drift and drifts:
        raise typer.Exit(code=1)
    raise typer.Exit(code=0)


def _build_baseline(paths: list[str], *, fleet: bool = False) -> dict[str, object]:
    repositories: list[dict[str, object]] = []
    for path in paths:
        if fleet:
            root = Path(path)
            bundle_paths = discover_fleet_bundles(root)
            bundles: list[dict[str, object]] = []
            for bundle_path in sorted(bundle_paths, key=lambda p: p.as_posix()):
                bundles.append(_build_entry_for_bundle(path, bundle_path))
            repositories.append(
                {
                    "path": str(path),
                    "fleet": True,
                    "bundle_count": len(bundles),
                    "bundles": bundles,
                }
            )
        else:
            repositories.append(_build_entry_for_bundle(path, Path(path)))
    return {
        "version": "1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "fleet": fleet,
        "repositories": repositories,
    }


def _build_entry_for_bundle(root_path: str, bundle_path: Path) -> dict[str, object]:
    bundle = load_bundle(bundle_path)
    findings = analyze_bundle(bundle)
    permissions = sorted({_category_to_permission(str(finding.category)) for finding in findings})
    domains = sorted(_extract_domains(bundle))
    unsigned_runtime_artifacts = _count_unsigned_runtime_artifacts(bundle_path)
    return {
        "path": str(root_path),
        "bundle": str(bundle_path),
        "bundle_key": _bundle_key(bundle_path, root_path),
        "bundle_hash": bundle.hash,
        "permissions": permissions,
        "domains": domains,
        "unsigned_runtime_artifacts": unsigned_runtime_artifacts,
    }


def _extract_domains(bundle: SkillBundle) -> set[str]:
    domains: set[str] = set()
    for source_file in bundle.source_files:
        for match in _URL_RE.finditer(source_file.content):
            host = match.group(1).strip().lower().rstrip(".")
            if host:
                domains.add(host)
    return domains


def _category_to_permission(category: str) -> str:
    mapping = {
        Category.SHELL.value: "shell",
        Category.NETWORK.value: "network",
        Category.FILESYSTEM.value: "filesystem",
        Category.EVAL.value: "eval",
        Category.CREDENTIAL.value: "credential",
        Category.INJECTION.value: "injection",
        Category.OBFUSCATION.value: "obfuscation",
    }
    return mapping.get(category, category)


def _count_unsigned_runtime_artifacts(repo_path: Path) -> int:
    runtime_dir = repo_path / ".skillgate" / "runtime"
    if not runtime_dir.exists():
        return 0
    count = 0
    for artifact in runtime_dir.glob("*.json"):
        if not verify_session_artifact(artifact):
            count += 1
    return count


def _diff_entries(
    path: str,
    baseline_entry: dict[str, object],
    current_entry: dict[str, object],
) -> list[dict[str, object]]:
    baseline_is_fleet = bool(baseline_entry.get("fleet", False))
    current_is_fleet = bool(current_entry.get("fleet", False))
    if baseline_is_fleet or current_is_fleet:
        return _diff_fleet_entries(path, baseline_entry, current_entry)

    drifts: list[dict[str, object]] = []
    base_permissions = _as_str_set(baseline_entry.get("permissions", []))
    curr_permissions = _as_str_set(current_entry.get("permissions", []))
    added_permissions = sorted(curr_permissions - base_permissions)
    if added_permissions:
        drifts.append({"path": path, "type": "new_permissions", "values": added_permissions})

    base_domains = _as_str_set(baseline_entry.get("domains", []))
    curr_domains = _as_str_set(current_entry.get("domains", []))
    added_domains = sorted(curr_domains - base_domains)
    if added_domains:
        drifts.append({"path": path, "type": "new_external_domains", "values": added_domains})

    base_unsigned = _as_int(baseline_entry.get("unsigned_runtime_artifacts", 0))
    curr_unsigned = _as_int(current_entry.get("unsigned_runtime_artifacts", 0))
    if curr_unsigned > base_unsigned:
        drifts.append(
            {
                "path": path,
                "type": "new_unsigned_runtime_artifacts",
                "delta": curr_unsigned - base_unsigned,
            }
        )

    if str(current_entry.get("bundle_hash")) != str(baseline_entry.get("bundle_hash")):
        drifts.append({"path": path, "type": "bundle_hash_changed"})
    return drifts


def _diff_fleet_entries(
    path: str,
    baseline_entry: dict[str, object],
    current_entry: dict[str, object],
) -> list[dict[str, object]]:
    drifts: list[dict[str, object]] = []
    baseline_raw = baseline_entry.get("bundles", [])
    current_raw = current_entry.get("bundles", [])
    baseline_bundles = baseline_raw if isinstance(baseline_raw, list) else []
    current_bundles = current_raw if isinstance(current_raw, list) else []

    baseline_map = _bundle_map(baseline_bundles)
    current_map = _bundle_map(current_bundles)

    removed = sorted(set(baseline_map) - set(current_map))
    added = sorted(set(current_map) - set(baseline_map))
    if removed:
        drifts.append({"path": path, "type": "removed_bundles", "values": removed})
    if added:
        drifts.append({"path": path, "type": "new_risky_skills", "values": added})

    shared = sorted(set(baseline_map) & set(current_map))
    for bundle_key in shared:
        drifts.extend(
            _diff_entries(
                f"{path}::{bundle_key}",
                baseline_map[bundle_key],
                current_map[bundle_key],
            )
        )
    return drifts


def _bundle_map(entries: list[object]) -> dict[str, dict[str, object]]:
    mapped: dict[str, dict[str, object]] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        key = entry.get("bundle_key")
        if isinstance(key, str):
            mapped[key] = entry
    return mapped


def _bundle_key(bundle_path: Path, root_path: str) -> str:
    root = Path(root_path).resolve()
    try:
        return bundle_path.resolve().relative_to(root).as_posix()
    except ValueError:
        return bundle_path.resolve().as_posix()


def _format_human(summary: dict[str, object]) -> str:
    lines = [
        "SkillGate Drift Report",
        "",
        f"Baseline:      {summary['baseline']}",
        f"Repositories:  {summary['repositories']}",
        f"Drift count:   {summary['drift_count']}",
        "",
        "Drifts:",
    ]
    drifts = summary.get("drifts", [])
    if isinstance(drifts, list) and drifts:
        for drift in drifts:
            if isinstance(drift, dict):
                lines.append(f" - {drift.get('path')}: {drift.get('type')}")
    else:
        lines.append(" - none")
    return "\n".join(lines)


def _as_str_set(value: object) -> set[str]:
    if not isinstance(value, list):
        return set()
    return {str(item) for item in value}


def _as_int(value: object) -> int:
    if not isinstance(value, int | float | str):
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0
