"""Canonical JSON serialization for deterministic signing."""

from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_json(data: dict[str, Any]) -> str:
    """Serialize data to canonical JSON (sorted keys, no whitespace).

    This produces a deterministic representation suitable for signing.
    """
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def hash_canonical(data: dict[str, Any]) -> str:
    """Produce SHA-256 hex digest of canonical JSON representation."""
    canonical = canonical_json(data)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_signing_scope(report_dict: dict[str, Any]) -> dict[str, Any]:
    """Build the canonical signing scope from a report dict.

    Excludes the ``attestation`` field (which is added *after* signing)
    so that the hash is computed over a stable, pre-attestation snapshot.

    The result is deterministic: the same report always produces the same
    hash regardless of insertion order or whitespace.

    Fields included in scope:
    - All top-level report fields except ``attestation``
    - ``extraction_manifest`` (provenance records, warnings, counts)
    - ``findings`` with per-finding ``provenance`` metadata

    Args:
        report_dict: Full report as a plain dict (from ``model_dump()``).

    Returns:
        Filtered dict ready for ``hash_canonical()``.
    """
    return {k: v for k, v in report_dict.items() if k != "attestation"}
