"""Artifact and provenance data models for multi-artifact security coverage."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class OriginType(str, Enum):
    """Classification of artifact origin for policy and reporting."""

    CODE = "code"  # Traditional source code files
    MARKDOWN_PROSE = "markdown_prose"  # Prose/instructions in markdown/text
    MARKDOWN_CODEBLOCK = "markdown_codeblock"  # Extracted fenced code blocks
    DOCUMENT_TEXT = "document_text"  # Extracted text from PDF/DOCX
    CONFIG = "config"  # Configuration files (json/yaml/toml/env)
    ARCHIVE_MEMBER = "archive_member"  # File extracted from archive
    UNKNOWN = "unknown"  # Unclassified or unsupported


class ArtifactProvenance(BaseModel):
    """Canonical provenance schema for extracted or analyzed artifacts."""

    origin_type: OriginType = Field(description="Classification of artifact source/origin")
    source_file: str = Field(description="Original file path within bundle")
    section: str | None = Field(default=None, description="Section/heading/page identifier")
    line_start: int | None = Field(default=None, ge=1, description="1-based start line")
    line_end: int | None = Field(default=None, ge=1, description="1-based end line")
    page_start: int | None = Field(
        default=None, ge=1, description="1-based start page (for documents)"
    )
    page_end: int | None = Field(default=None, ge=1, description="1-based end page (for documents)")
    language: str | None = Field(default=None, description="Detected or declared language")
    extraction_hash: str | None = Field(
        default=None, description="SHA-256 hash of normalized extracted content"
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional context (fence info, title, etc.)"
    )


class ExtractedArtifact(BaseModel):
    """A virtual source unit extracted from markdown/documents/archives."""

    content: str = Field(description="Extracted content (code block, text, config)")
    provenance: ArtifactProvenance = Field(description="Source mapping and context")
    is_executable: bool = Field(
        default=False, description="Whether content represents executable code"
    )
    normalized_content: str | None = Field(
        default=None,
        description="Unicode-normalized content for matching (if applicable)",
    )


class ExtractionManifest(BaseModel):
    """Aggregated extraction metadata for attestation and audit."""

    total_artifacts: int = Field(ge=0, description="Total extracted artifacts")
    artifacts_by_origin: dict[str, int] = Field(
        default_factory=dict, description="Count by origin type"
    )
    artifacts_by_language: dict[str, int] = Field(
        default_factory=dict, description="Count by detected language"
    )
    extraction_warnings: list[str] = Field(
        default_factory=list, description="Warnings from extraction process"
    )
    provenance_records: list[ArtifactProvenance] = Field(
        default_factory=list, description="Full provenance for all extracted artifacts"
    )


class ArtifactLimits(BaseModel):
    """Bounded parsing and extraction limits for resilience."""

    max_file_size_mb: int = Field(
        default=10, ge=0, description="Max file size in MB (0=reject all)"
    )
    max_document_pages: int = Field(
        default=500, ge=0, description="Max PDF/DOCX pages (0=reject all)"
    )
    max_archive_depth: int = Field(
        default=3, ge=0, description="Max nested archive depth (0=reject all)"
    )
    max_extracted_artifacts: int = Field(
        default=1000, ge=0, description="Max total extracted artifacts per bundle (0=reject all)"
    )
    max_extracted_bytes: int = Field(
        default=10_000_000, ge=0, description="Max total extracted bytes (0=reject all)"
    )
    extraction_timeout_seconds: int = Field(
        default=30, ge=1, description="Timeout per file extraction"
    )
