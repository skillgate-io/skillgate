"""Scan result storage API endpoints."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from skillgate.api.auth_context import AuthContext, get_auth_context, require_api_key_scope
from skillgate.api.db import get_session
from skillgate.api.models import ScanRecord
from skillgate.api.rate_limit import enforce_rate_limit
from skillgate.config.license import RATE_LIMITS

router = APIRouter(prefix="/scans", tags=["scans"])

# SECURITY FIX 16.35: Limits to prevent DoS
MAX_REPORT_SIZE_BYTES = 5 * 1024 * 1024  # 5MB
MAX_PAGINATION_LIMIT = 100
DEFAULT_PAGINATION_LIMIT = 20


class ScanSubmitRequest(BaseModel):
    """Request to store a scan result."""

    report: dict[str, object] = Field(description="The full scan report JSON")


class ScanSubmitResponse(BaseModel):
    """Response after storing a scan result."""

    scan_id: str
    stored_at: str


class ScanListResponse(BaseModel):
    """Response with list of stored scans."""

    scans: list[dict[str, object]]
    total: int


@router.post("")
async def submit_scan(
    req: ScanSubmitRequest,
    auth_ctx: AuthContext = Depends(get_auth_context),  # noqa: B008
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> ScanSubmitResponse:
    """Store a scan result.

    SECURITY FIX 16.35: Enforce payload size limits to prevent DoS.
    """
    # Tier-aware rate limiting
    user, tier = require_api_key_scope(auth_ctx, "scan:write")
    scan_limit = RATE_LIMITS[tier]
    await enforce_rate_limit(
        session=session,
        scope="scan_submit",
        bucket_key=str(user.id),
        limit=scan_limit,
        window_seconds=60,
        block_seconds=300,
    )

    # SECURITY FIX 16.35: Validate report size
    report_json = json.dumps(req.report, separators=(",", ":"), sort_keys=True)
    if len(report_json) > MAX_REPORT_SIZE_BYTES:
        raise HTTPException(
            status_code=413, detail=f"Report size exceeds limit of {MAX_REPORT_SIZE_BYTES} bytes"
        )

    scan_id = str(uuid4())
    stored_at = datetime.now(timezone.utc).isoformat()
    record = ScanRecord(
        id=scan_id,
        user_id=user.id,
        report_json=report_json,
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    session.add(record)
    await session.commit()
    return ScanSubmitResponse(scan_id=scan_id, stored_at=stored_at)


@router.get("/{scan_id}")
async def get_scan(
    scan_id: str,
    auth_ctx: AuthContext = Depends(get_auth_context),  # noqa: B008
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> dict[str, object]:
    """Retrieve a stored scan result."""
    user, _ = require_api_key_scope(auth_ctx, "scan:read")
    record = await session.scalar(
        select(ScanRecord).where(ScanRecord.id == scan_id, ScanRecord.user_id == user.id)
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    report = json.loads(record.report_json)
    return {
        "scan_id": record.id,
        "stored_at": record.created_at.replace(tzinfo=timezone.utc).isoformat(),
        "report": report,
    }


@router.get("")
async def list_scans(
    limit: int = DEFAULT_PAGINATION_LIMIT,
    offset: int = 0,
    auth_ctx: AuthContext = Depends(get_auth_context),  # noqa: B008
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> ScanListResponse:
    """List stored scan results.

    SECURITY FIX 16.35: Cap pagination limit to prevent DoS.
    """
    # SECURITY FIX 16.35: Enforce maximum pagination limit
    if limit > MAX_PAGINATION_LIMIT:
        limit = MAX_PAGINATION_LIMIT
    if limit < 1:
        limit = DEFAULT_PAGINATION_LIMIT

    user, _ = require_api_key_scope(auth_ctx, "scan:read")

    rows = await session.scalars(
        select(ScanRecord)
        .where(ScanRecord.user_id == user.id)
        .order_by(ScanRecord.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    scans = [
        {
            "scan_id": row.id,
            "stored_at": row.created_at.replace(tzinfo=timezone.utc).isoformat(),
            "report": json.loads(row.report_json),
        }
        for row in rows.all()
    ]
    total = await session.scalar(
        select(func.count()).select_from(ScanRecord).where(ScanRecord.user_id == user.id)
    )
    return ScanListResponse(scans=scans, total=int(total or 0))
