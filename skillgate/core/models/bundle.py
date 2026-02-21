"""Bundle and manifest data models."""

from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel, Field

from skillgate.core.models.enums import Language


class SourceFile(BaseModel):
    """A source file within a skill bundle."""

    path: str = Field(description="Relative path within bundle")
    language: Language
    content: str = Field(description="Raw file content")
    lines: list[str] = Field(default_factory=list, description="Split lines")


class SkillManifest(BaseModel):
    """Parsed skill manifest metadata."""

    name: str = Field(default="unknown")
    version: str | None = Field(default=None)
    author: str | None = Field(default=None)
    description: str | None = Field(default=None)
    declared_permissions: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)


class SkillBundle(BaseModel):
    """A complete skill bundle ready for analysis."""

    root: str = Field(description="Absolute path to bundle root")
    manifest: SkillManifest
    source_files: list[SourceFile] = Field(default_factory=list)
    hash: str = Field(default="", description="SHA-256 hash of bundle contents")

    @property
    def root_path(self) -> Path:
        """Return root as a Path object."""
        return Path(self.root)

    @property
    def files_scanned(self) -> int:
        """Return number of source files."""
        return len(self.source_files)
