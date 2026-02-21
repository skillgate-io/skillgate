"""GitHub Actions annotation generator for PR inline comments."""

from __future__ import annotations

from pathlib import Path

from skillgate.ci.noise import CINoiseFilter
from skillgate.core.models.enums import Severity
from skillgate.core.models.finding import Finding

# Map severity to GitHub annotation level
_SEVERITY_TO_ANNOTATION_LEVEL: dict[str, str] = {
    Severity.CRITICAL: "error",
    Severity.HIGH: "error",
    Severity.MEDIUM: "warning",
    Severity.LOW: "notice",
}


def finding_to_annotation(finding: Finding, bundle_root: str = "") -> str:
    """Convert a finding to a GitHub Actions workflow annotation command.

    Args:
        finding: The security finding.
        bundle_root: Bundle root path to prefix to file paths.

    Returns:
        GitHub Actions annotation command string.
    """
    level = _SEVERITY_TO_ANNOTATION_LEVEL.get(finding.severity, "warning")
    file_path = f"{bundle_root}/{finding.file}" if bundle_root else finding.file
    # Remove leading slash duplication
    file_path = file_path.replace("//", "/")

    col_part = f",col={finding.column}" if finding.column else ""
    return (
        f"::{level} file={file_path},line={finding.line}{col_part}"
        f"::[{finding.rule_id}] {finding.message}"
    )


def generate_annotations(
    findings: list[Finding],
    bundle_root: str = "",
    baseline_path: Path | None = None,
    max_per_file: int = 5,
) -> list[str]:
    """Generate GitHub Actions annotations for all findings.

    Args:
        findings: List of security findings.
        bundle_root: Bundle root path for file references.
        baseline_path: Optional path to .skillgate-baseline.json for suppression.
        max_per_file: Maximum annotations per file (default: 5).

    Returns:
        List of annotation command strings.
    """
    noise_filter = CINoiseFilter()

    # Deduplicate findings
    findings = noise_filter.deduplicate(findings)

    # Apply baseline suppression if provided
    if baseline_path and baseline_path.exists():
        baseline = noise_filter.load_baseline(baseline_path)
        findings, suppressed_ids = noise_filter.suppress_baseline(findings, baseline)
        if suppressed_ids:
            # Log suppression count as notice
            return [
                f"::notice ::SkillGate suppressed {len(suppressed_ids)} baseline finding(s)"
            ] + [finding_to_annotation(f, bundle_root) for f in findings]

    # Generate annotations and apply per-file grouping
    annotations = [finding_to_annotation(f, bundle_root) for f in findings]
    return noise_filter.group_annotations(annotations, max_per_file=max_per_file)


def generate_status_summary(
    passed: bool,
    risk_score: int,
    findings_count: int,
    policy_name: str | None = None,
) -> str:
    """Generate a markdown summary for GitHub Actions step summary.

    Args:
        passed: Whether the policy check passed.
        risk_score: Numeric risk score.
        findings_count: Number of findings.
        policy_name: Policy name used for evaluation.

    Returns:
        Markdown-formatted summary string.
    """
    status = "PASSED" if passed else "FAILED"
    icon = "white_check_mark" if passed else "x"

    lines = [
        f"## :{icon}: SkillGate Scan {status}",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| Risk Score | **{risk_score}** / 200 |",
        f"| Findings | **{findings_count}** |",
    ]

    if policy_name:
        lines.append(f"| Policy | `{policy_name}` |")

    lines.append(f"| Status | **{status}** |")
    return "\n".join(lines)
