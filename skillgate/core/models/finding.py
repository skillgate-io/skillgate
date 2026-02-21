"""Finding data model."""

from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field, model_validator

from skillgate.core.models.enums import Category, Severity

if TYPE_CHECKING:
    from skillgate.core.models.artifact import ArtifactProvenance


class FindingLocation(BaseModel):
    """Canonical file location for a finding."""

    path: str = Field(description="Relative file path within the bundle")
    line_start: int = Field(ge=1, description="Start line (1-based)")
    line_end: int = Field(ge=1, description="End line (1-based)")


class Finding(BaseModel):
    """A single security finding detected during analysis."""

    finding_id: str | None = Field(
        default=None, description="Stable finding ID generated when omitted"
    )
    rule_id: str = Field(description="Unique rule ID, e.g. SG-SHELL-001")
    rule_name: str = Field(description="Human-readable rule name")
    type: str | None = Field(default=None, description="Normalized finding type taxonomy key")
    severity: Severity
    category: Category
    message: str = Field(description="Human-readable description of the finding")
    file: str = Field(description="Relative file path within the bundle")
    line: int = Field(ge=1, description="1-based line number")
    column: int | None = Field(default=None, ge=1, description="1-based column number")
    snippet: str = Field(default="", description="Code snippet containing the finding")
    weight: int = Field(ge=0, description="Risk weight for scoring")
    remediation: str | None = Field(default=None, description="Suggested fix")
    engine_source: str = Field(
        default="deterministic_v1", description="Engine/provider that produced this finding"
    )
    reasoning_summary: str | None = Field(
        default=None, description="Concise non-CoT reasoning summary"
    )
    exploit_scenario: str | None = Field(
        default=None, description="Concise attack/exploit narrative"
    )
    policy_reference: str | None = Field(
        default=None, description="Policy path or rule reference used for decisioning"
    )
    files: list[FindingLocation] = Field(
        default_factory=list, description="Canonical finding location list"
    )
    provenance: ArtifactProvenance | None = Field(
        default=None, description="Artifact provenance for markdown/document findings"
    )

    @model_validator(mode="after")
    def _populate_canonical_fields(self) -> Finding:
        """Populate canonical fields while keeping legacy fields stable."""
        if self.type is None:
            self.type = self.category.value
        if self.reasoning_summary is None:
            self.reasoning_summary = self.message
        if not self.files:
            self.files = [
                FindingLocation(
                    path=self.file,
                    line_start=self.line,
                    line_end=self.line,
                )
            ]
        if self.finding_id is None:
            digest = hashlib.sha256(
                f"{self.rule_id}|{self.file}|{self.line}|{self.column or 0}|{self.message}".encode()
            ).hexdigest()[:12]
            self.finding_id = f"SGF-{digest}"
        return self
