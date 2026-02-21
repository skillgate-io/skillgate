"""Generate a false-negative defense recall report and enforce minimum recall."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from skillgate.core.analyzer.engine import analyze_bundle  # noqa: E402
from skillgate.core.parser.bundle import load_bundle  # noqa: E402
from tests.defense.test_false_negative_corpus import CORPUS_DIR, CORPUS_EXPECTATIONS  # noqa: E402


@dataclass
class SampleResult:
    sample: str
    expected_rules: list[str]
    found_rules: list[str]
    missing_rules: list[str]
    passed: bool


def run_recall_report() -> tuple[float, list[SampleResult]]:
    """Analyze the malicious corpus and compute recall score."""
    results: list[SampleResult] = []
    for sample_name, expected_rule_ids in CORPUS_EXPECTATIONS:
        sample_path = CORPUS_DIR / sample_name
        if not sample_path.exists():
            results.append(
                SampleResult(
                    sample=sample_name,
                    expected_rules=expected_rule_ids,
                    found_rules=[],
                    missing_rules=expected_rule_ids,
                    passed=False,
                )
            )
            continue

        bundle = load_bundle(str(sample_path))
        findings = analyze_bundle(bundle)
        found_rules = sorted({f.rule_id for f in findings})
        missing = sorted([rule for rule in expected_rule_ids if rule not in found_rules])
        results.append(
            SampleResult(
                sample=sample_name,
                expected_rules=expected_rule_ids,
                found_rules=found_rules,
                missing_rules=missing,
                passed=len(missing) == 0,
            )
        )

    passed = sum(1 for item in results if item.passed)
    recall = passed / len(results) if results else 0.0
    return recall, results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--min-recall", type=float, default=1.0)
    parser.add_argument("--output", type=Path, default=Path("recall-report.json"))
    args = parser.parse_args()

    recall, results = run_recall_report()
    report = {
        "corpus_dir": str(CORPUS_DIR),
        "min_recall": args.min_recall,
        "recall": recall,
        "total_samples": len(results),
        "passed_samples": sum(1 for item in results if item.passed),
        "failed_samples": sum(1 for item in results if not item.passed),
        "samples": [asdict(item) for item in results],
    }
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    print(f"recall={recall:.3f} min_recall={args.min_recall:.3f} output={args.output}")
    return 0 if recall >= args.min_recall else 1


if __name__ == "__main__":
    raise SystemExit(main())
