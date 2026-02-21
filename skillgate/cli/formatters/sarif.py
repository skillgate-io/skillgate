"""SARIF 2.1.0 output formatter for GitHub Security tab integration."""

from __future__ import annotations

import json
from typing import Any

from skillgate.core.analyzer.rules import ALL_RULE_CLASSES
from skillgate.core.models.enums import Severity
from skillgate.core.models.report import ScanReport

# SARIF schema URI
SARIF_SCHEMA = "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json"
SARIF_VERSION = "2.1.0"

# Map SkillGate severity to SARIF level
_SEVERITY_TO_LEVEL: dict[str, str] = {
    Severity.CRITICAL: "error",
    Severity.HIGH: "error",
    Severity.MEDIUM: "warning",
    Severity.LOW: "note",
}


def _build_rule_descriptors() -> list[dict[str, Any]]:
    """Build SARIF rule descriptors from all registered rules."""
    rules: list[dict[str, Any]] = []
    for rule_cls in ALL_RULE_CLASSES:
        instance = rule_cls()
        descriptor: dict[str, Any] = {
            "id": instance.id,
            "name": instance.name,
            "shortDescription": {"text": instance.description},
            "defaultConfiguration": {
                "level": _SEVERITY_TO_LEVEL.get(instance.severity, "warning"),
            },
            "properties": {
                "category": instance.category.value,
                "severity": instance.severity.value,
                "weight": instance.weight,
            },
        }
        rules.append(descriptor)
    return rules


def _finding_to_result(finding: dict[str, object], bundle_root: str) -> dict[str, Any]:
    """Convert a SkillGate finding dict to a SARIF result.

    When the finding has ``provenance`` metadata, the SARIF
    ``physicalLocation.artifactLocation`` is enriched with:

    - ``uriBaseId``: maps to the origin type (e.g. ``%ARCHIVE_MEMBER%``)
    - ``properties.originType``: string label for tooling consumers
    - ``properties.section``: prose section or heading if available
    """
    rule_id = str(finding.get("rule_id", ""))
    severity_val = str(finding.get("severity", "medium"))
    level = _SEVERITY_TO_LEVEL.get(severity_val, "warning")

    message_text = str(finding.get("message", ""))
    file_path = str(finding.get("file", ""))
    line_val = finding.get("line", 1)
    line = int(str(line_val)) if line_val else 1
    column = finding.get("column")

    region: dict[str, Any] = {"startLine": line}
    if column is not None:
        region["startColumn"] = int(str(column))

    snippet_text = str(finding.get("snippet", ""))
    if snippet_text:
        region["snippet"] = {"text": snippet_text}

    # Build artifact location, enriched with provenance when available
    artifact_location: dict[str, Any] = {
        "uri": file_path,
        "uriBaseId": "%SRCROOT%",
    }
    provenance = finding.get("provenance")
    if isinstance(provenance, dict):
        origin_type = str(provenance.get("origin_type", ""))
        if origin_type:
            # Represent origin class as a distinct uriBaseId for SARIF consumers
            artifact_location["uriBaseId"] = f"%{origin_type.upper()}%"
            artifact_location.setdefault("properties", {})
            artifact_location["properties"]["originType"] = origin_type
        section = provenance.get("section")
        if section:
            artifact_location.setdefault("properties", {})
            artifact_location["properties"]["section"] = str(section)
        page_start = provenance.get("page_start")
        if page_start is not None:
            artifact_location.setdefault("properties", {})
            artifact_location["properties"]["pageStart"] = int(str(page_start))

    result: dict[str, Any] = {
        "ruleId": rule_id,
        "level": level,
        "message": {"text": message_text},
        "locations": [
            {
                "physicalLocation": {
                    "artifactLocation": artifact_location,
                    "region": region,
                }
            }
        ],
    }

    remediation = finding.get("remediation")
    if remediation:
        result["fixes"] = [
            {
                "description": {"text": str(remediation)},
            }
        ]

    return result


def format_sarif(report: ScanReport) -> str:
    """Format a scan report as SARIF 2.1.0 JSON.

    Args:
        report: The scan report to format.

    Returns:
        SARIF 2.1.0 JSON string.
    """
    results = [_finding_to_result(f, report.bundle_root) for f in report.findings]

    sarif: dict[str, Any] = {
        "$schema": SARIF_SCHEMA,
        "version": SARIF_VERSION,
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "SkillGate",
                        "version": report.scanner_version,
                        "informationUri": "https://skillgate.io",
                        "rules": _build_rule_descriptors(),
                    }
                },
                "results": results,
                "invocations": [
                    {
                        "executionSuccessful": True,
                        "toolExecutionNotifications": [],
                    }
                ],
                "properties": {
                    "bundleName": report.bundle_name,
                    "bundleHash": report.bundle_hash,
                    "riskScore": report.risk_score.total,
                    "filesScanned": report.files_scanned,
                    **(
                        {
                            "extractionManifest": {
                                "totalArtifacts": report.extraction_manifest.total_artifacts,
                                "warnings": report.extraction_manifest.extraction_warnings,
                            }
                        }
                        if report.extraction_manifest
                        else {}
                    ),
                },
            }
        ],
    }

    return json.dumps(sarif, indent=2, sort_keys=False)
