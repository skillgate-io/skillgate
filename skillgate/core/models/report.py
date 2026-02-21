"""Report and scoring data models."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

from skillgate.core.models.enums import Severity
from skillgate.version import __version__

if TYPE_CHECKING:
    from skillgate.core.models.artifact import ExtractionManifest


class RiskScore(BaseModel):
    """Aggregated risk score from findings."""

    total: int = Field(ge=0, description="Total weighted score")
    severity: Severity = Field(description="Classified severity level")
    risk_model_version: str = Field(
        default="v1", description="Versioned deterministic risk model identifier"
    )
    model_inputs: dict[str, float] = Field(
        default_factory=lambda: {
            "confidence": 1.0,
            "exploitability_factor": 1.0,
            "repo_sensitivity": 1.0,
        },
        description="Deterministic scoring factors used for this score",
    )
    breakdown: dict[str, int] = Field(
        default_factory=dict, description="Score breakdown by category"
    )
    findings_count: int = Field(ge=0, description="Number of findings")


class FleetSummary(BaseModel):
    """Aggregated fleet scan outcomes."""

    bundles_scanned: int = Field(default=0, ge=0)
    passed_bundles: int = Field(default=0, ge=0)
    failed_bundles: int = Field(default=0, ge=0)
    errored_bundles: int = Field(default=0, ge=0)
    fail_rate_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    critical_findings: int = Field(default=0, ge=0)
    unsigned_attestations: int = Field(default=0, ge=0)
    stale_attestations: int = Field(default=0, ge=0)


class FleetBundleReport(BaseModel):
    """Per-bundle result inside fleet scans."""

    path: str
    bundle_name: str = Field(default="unknown")
    bundle_version: str | None = Field(default=None)
    bundle_hash: str = Field(default="")
    files_scanned: int = Field(default=0, ge=0)
    manifest_found: bool = Field(default=False)
    risk_score: RiskScore
    findings: list[dict[str, object]] = Field(default_factory=list)
    findings_total: int | None = Field(default=None)
    policy: dict[str, object] | None = Field(default=None)
    reputation: dict[str, object] | None = Field(default=None)
    attestation: dict[str, object] | None = Field(default=None)
    error: str | None = Field(default=None)


class ScanReport(BaseModel):
    """Complete scan report."""

    version: str = Field(default=__version__)
    timestamp: str = Field(description="ISO 8601 timestamp")
    scanner_version: str = Field(default=__version__)
    bundle_name: str = Field(default="unknown")
    bundle_version: str | None = Field(default=None)
    bundle_hash: str = Field(default="")
    bundle_root: str = Field(default="")
    files_scanned: int = Field(default=0)
    manifest_found: bool = Field(default=False)
    risk_score: RiskScore
    findings: list[dict[str, object]] = Field(default_factory=list)
    findings_total: int | None = Field(
        default=None, description="Total findings before cap (if capped)"
    )
    enrichment: list[dict[str, object]] | None = Field(default=None)
    explanations: list[dict[str, str]] | None = Field(default=None)
    policy: dict[str, object] | None = Field(default=None)
    reputation: dict[str, object] | None = Field(default=None)
    attestation: dict[str, object] | None = Field(default=None)
    fleet_summary: FleetSummary | None = Field(
        default=None, description="Fleet aggregate metrics for --fleet scans."
    )
    fleet_results: list[FleetBundleReport] | None = Field(
        default=None, description="Per-bundle records for --fleet scans."
    )
    extraction_manifest: ExtractionManifest | None = Field(
        default=None, description="Artifact extraction metadata (if applicable)"
    )
