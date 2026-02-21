"""CI low-noise controls for annotation filtering and baseline suppression."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from skillgate.core.models.finding import Finding


class CINoiseFilter:
    """Filter and deduplicate findings for CI annotation output."""

    @staticmethod
    def deduplicate(findings: list[Finding]) -> list[Finding]:
        """Remove duplicate findings by (file, line, rule_id).

        Args:
            findings: List of findings (may contain duplicates).

        Returns:
            Deduplicated list preserving order.
        """
        seen: set[tuple[str, int, str]] = set()
        deduped: list[Finding] = []

        for finding in findings:
            key = (finding.file, finding.line, finding.rule_id)
            if key not in seen:
                seen.add(key)
                deduped.append(finding)

        return deduped

    @staticmethod
    def group_annotations(annotations: list[str], max_per_file: int = 5) -> list[str]:
        """Group and limit annotations per file to reduce noise.

        Args:
            annotations: List of GitHub annotation strings.
            max_per_file: Maximum annotations to emit per file.

        Returns:
            Filtered list with per-file caps applied.
        """
        # Parse file path from annotation format
        # "::error file=path/file.py,line=10::..."
        file_groups: dict[str, list[str]] = defaultdict(list)

        for annotation in annotations:
            # Extract file path from annotation
            if "file=" in annotation:
                start = annotation.index("file=") + 5
                if "," in annotation[start:]:
                    end = annotation.index(",", start)
                else:
                    end = annotation.index("::", start)
                file_path = annotation[start:end]
                file_groups[file_path].append(annotation)
            else:
                # No file path, keep as-is
                file_groups["__no_file__"].append(annotation)

        # Limit per file and collect
        result: list[str] = []
        for file_path, file_annotations in file_groups.items():
            if len(file_annotations) <= max_per_file:
                result.extend(file_annotations)
            else:
                # Take first max_per_file, add truncation notice
                result.extend(file_annotations[:max_per_file])
                if file_path != "__no_file__":
                    result.append(
                        f"::notice file={file_path}::"
                        f"[SkillGate] {len(file_annotations) - max_per_file} more "
                        f"finding(s) omitted to reduce noise"
                    )

        return result

    @staticmethod
    def suppress_baseline(
        findings: list[Finding], baseline: dict[str, list[str]]
    ) -> tuple[list[Finding], list[str]]:
        """Suppress findings in baseline, return filtered findings + suppressed IDs.

        Baseline format: {"path/file.py": ["SG-SHELL-001", "SG-NET-002"]}

        Args:
            findings: List of findings to filter.
            baseline: Baseline suppressions by file path.

        Returns:
            Tuple of (filtered_findings, suppressed_ids).
        """
        filtered: list[Finding] = []
        suppressed_ids: list[str] = []

        for finding in findings:
            file_suppressions = baseline.get(finding.file, [])
            if finding.rule_id in file_suppressions:
                suppressed_ids.append(f"{finding.file}:{finding.line}:{finding.rule_id}")
            else:
                filtered.append(finding)

        return filtered, suppressed_ids

    @staticmethod
    def load_baseline(baseline_path: Path) -> dict[str, list[str]]:
        """Load baseline suppressions from .skillgate-baseline.json.

        Args:
            baseline_path: Path to baseline JSON file.

        Returns:
            Baseline dict mapping file paths to list of rule IDs.

        Raises:
            FileNotFoundError: If baseline file doesn't exist.
            ValueError: If baseline file is invalid JSON.
        """
        if not baseline_path.exists():
            raise FileNotFoundError(f"Baseline file not found: {baseline_path}")

        try:
            with baseline_path.open("r", encoding="utf-8") as f:
                data: Any = json.load(f)
                if not isinstance(data, dict):
                    raise ValueError("Baseline must be a JSON object")
                # Validate structure
                for file_path, rule_ids in data.items():
                    if not isinstance(file_path, str):
                        raise ValueError(f"Invalid file path: {file_path}")
                    if not isinstance(rule_ids, list):
                        raise ValueError(f"Invalid rule IDs for {file_path}")
                    if not all(isinstance(r, str) for r in rule_ids):
                        raise ValueError(f"Non-string rule ID in {file_path}")
                return data
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in baseline file: {e}") from e

    @staticmethod
    def save_baseline(baseline: dict[str, list[str]], baseline_path: Path) -> None:
        """Save baseline suppressions to .skillgate-baseline.json.

        Args:
            baseline: Baseline dict mapping file paths to list of rule IDs.
            baseline_path: Path to baseline JSON file.
        """
        baseline_path.parent.mkdir(parents=True, exist_ok=True)
        with baseline_path.open("w", encoding="utf-8") as f:
            json.dump(baseline, f, indent=2, sort_keys=True)
            f.write("\n")
