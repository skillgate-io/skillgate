"""Core data models for SkillGate."""

from skillgate.core.models.artifact import (
    ArtifactLimits,
    ArtifactProvenance,
    ExtractedArtifact,
    ExtractionManifest,
    OriginType,
)
from skillgate.core.models.bundle import SkillBundle, SkillManifest, SourceFile
from skillgate.core.models.enums import Category, Language, Severity
from skillgate.core.models.finding import Finding
from skillgate.core.models.report import RiskScore, ScanReport

# Rebuild models with forward references now that all types are defined
Finding.model_rebuild()
ScanReport.model_rebuild()

__all__ = [
    "ArtifactLimits",
    "ArtifactProvenance",
    "Category",
    "ExtractionManifest",
    "ExtractedArtifact",
    "Finding",
    "Language",
    "OriginType",
    "RiskScore",
    "ScanReport",
    "Severity",
    "SkillBundle",
    "SkillManifest",
    "SourceFile",
]
