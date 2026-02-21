"""JSON output formatter."""

from __future__ import annotations

import json

from skillgate.core.models.report import ScanReport


def format_json(report: ScanReport) -> str:
    """Format a scan report as JSON.

    Args:
        report: The scan report to format.

    Returns:
        JSON string with sorted keys and 2-space indentation.
    """
    return json.dumps(report.model_dump(), indent=2, sort_keys=False, default=str)
