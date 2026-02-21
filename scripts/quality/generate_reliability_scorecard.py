#!/usr/bin/env python3
"""Generate and enforce reliability evidence scorecard for Section 14."""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.quality.recall_report import run_recall_report  # noqa: E402
from skillgate.core.analyzer.engine import analyze_bundle  # noqa: E402
from skillgate.core.parser.bundle import load_bundle  # noqa: E402

SAFE_CORPUS_DIR = ROOT / "tests" / "fixtures" / "skills" / "safe"


def _safe_bundle_paths() -> list[Path]:
    if not SAFE_CORPUS_DIR.exists():
        return []
    paths: list[Path] = []
    for p in SAFE_CORPUS_DIR.iterdir():
        if not p.is_dir():
            continue
        if (p / "SKILL.md").exists() or (p / "skill.json").exists():
            paths.append(p)
    return sorted(paths)


def _false_positive_rate() -> tuple[float, int, int]:
    bundles = _safe_bundle_paths()
    if not bundles:
        return 100.0, 0, 0
    false_positives = 0
    for path in bundles:
        bundle = load_bundle(str(path))
        findings = analyze_bundle(bundle)
        if findings:
            false_positives += 1
    rate = (false_positives / len(bundles)) * 100.0
    return rate, false_positives, len(bundles)


def _median_scan_ms(limit: int = 10) -> float:
    bundles = _safe_bundle_paths()[:limit]
    if not bundles:
        return float("inf")
    samples: list[float] = []
    for path in bundles:
        start = time.perf_counter()
        bundle = load_bundle(str(path))
        analyze_bundle(bundle)
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        samples.append(elapsed_ms)
    samples.sort()
    mid = len(samples) // 2
    if len(samples) % 2 == 0:
        return (samples[mid - 1] + samples[mid]) / 2.0
    return samples[mid]


def _rule_recall(samples: list[dict[str, Any]]) -> dict[str, float]:
    expected: dict[str, int] = defaultdict(int)
    hit: dict[str, int] = defaultdict(int)
    for sample in samples:
        expected_rules = sample.get("expected_rules", [])
        found_rules = set(sample.get("found_rules", []))
        if not isinstance(expected_rules, list):
            continue
        for rule in expected_rules:
            if not isinstance(rule, str):
                continue
            expected[rule] += 1
            if rule in found_rules:
                hit[rule] += 1
    out: dict[str, float] = {}
    for rule, total in expected.items():
        out[rule] = hit[rule] / total if total > 0 else 0.0
    return dict(sorted(out.items()))


def _delta(current: float, previous: float | None) -> float | None:
    if previous is None:
        return None
    return round(current - previous, 6)


def _load_previous(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def _enforce(scorecard: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    thresholds = scorecard["thresholds"]
    metrics = scorecard["metrics"]
    if metrics["recall"] < thresholds["min_recall"]:
        errors.append(
            f"recall {metrics['recall']:.3f} below min_recall {thresholds['min_recall']:.3f}"
        )
    if metrics["false_positive_rate"] > thresholds["max_false_positive_rate"]:
        errors.append(
            "false_positive_rate "
            f"{metrics['false_positive_rate']:.3f} above max "
            f"{thresholds['max_false_positive_rate']:.3f}"
        )
    if metrics["median_scan_ms"] > thresholds["max_median_scan_ms"]:
        errors.append(
            f"median_scan_ms {metrics['median_scan_ms']:.3f} above max "
            f"{thresholds['max_median_scan_ms']:.3f}"
        )
    for rule, recall in metrics["rule_recall"].items():
        if recall < thresholds["min_rule_recall"]:
            errors.append(
                f"rule_recall {rule}={recall:.3f} below min_rule_recall "
                f"{thresholds['min_rule_recall']:.3f}"
            )
    return errors


def main() -> int:
    default_output = (
        ROOT / "docs" / "section-14-governed-pipeline" / "artifacts" / "reliability-scorecard.json"
    )
    default_previous = (
        ROOT
        / "docs"
        / "section-14-governed-pipeline"
        / "artifacts"
        / "reliability-scorecard.previous.json"
    )
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=default_output,
    )
    parser.add_argument(
        "--previous",
        type=Path,
        default=default_previous,
    )
    parser.add_argument("--min-recall", type=float, default=1.0)
    parser.add_argument("--max-fp-rate", type=float, default=5.0)
    parser.add_argument("--max-median-scan-ms", type=float, default=10000.0)
    parser.add_argument("--min-rule-recall", type=float, default=1.0)
    args = parser.parse_args()

    recall, sample_results = run_recall_report()
    samples = [s.__dict__ for s in sample_results]
    fp_rate, fp_count, bundle_count = _false_positive_rate()
    median_scan_ms = _median_scan_ms()
    rule_recall = _rule_recall(samples)

    previous = _load_previous(args.previous)
    prev_metrics = previous.get("metrics", {}) if previous else {}

    scorecard: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "thresholds": {
            "min_recall": args.min_recall,
            "max_false_positive_rate": args.max_fp_rate,
            "max_median_scan_ms": args.max_median_scan_ms,
            "min_rule_recall": args.min_rule_recall,
        },
        "metrics": {
            "recall": recall,
            "false_positive_rate": fp_rate,
            "false_positive_count": fp_count,
            "safe_bundle_count": bundle_count,
            "median_scan_ms": median_scan_ms,
            "rule_recall": rule_recall,
        },
        "delta": {
            "recall": _delta(recall, prev_metrics.get("recall")),
            "false_positive_rate": _delta(fp_rate, prev_metrics.get("false_positive_rate")),
            "median_scan_ms": _delta(median_scan_ms, prev_metrics.get("median_scan_ms")),
        },
        "samples": samples,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(scorecard, indent=2, sort_keys=True), encoding="utf-8")

    errors = _enforce(scorecard)
    if errors:
        for err in errors:
            print(f"ERROR: {err}")
        print(f"Scorecard written: {args.output}")
        return 1

    print(f"Reliability scorecard written: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
