"""Helpers for submitting scan reports to SkillGate API."""

from __future__ import annotations

import os
from urllib.parse import urljoin

import httpx

from skillgate.cli.commands.auth import get_api_key, get_bearer_token
from skillgate.core.errors import SkillGateError


def resolve_scan_submit_endpoint() -> str:
    """Resolve API endpoint for scan report submission."""
    configured_base = os.environ.get("SKILLGATE_API_URL") or os.environ.get("NEXT_PUBLIC_API_URL")
    if configured_base:
        raw_base = configured_base.strip()
    else:
        env = os.environ.get("SKILLGATE_ENV", "").strip().lower()
        if env in {"development", "dev", "local"}:
            raw_base = "http://127.0.0.1:8000"
        else:
            raw_base = "https://api.skillgate.io"

    if "//" not in raw_base:
        if raw_base.startswith(("localhost", "127.0.0.1")):
            raw_base = f"http://{raw_base}"
        else:
            raw_base = f"https://{raw_base}"

    if "/api/v1" in raw_base:
        base = raw_base.rstrip("/")
        if base.endswith("/scans"):
            return base
        return f"{base}/scans"

    if raw_base.endswith("/"):
        return urljoin(raw_base, "api/v1/scans")
    return f"{raw_base}/api/v1/scans"


def submit_scan_report(
    *,
    report: dict[str, object],
    bearer_token: str | None = None,
) -> str:
    """Submit a scan report to hosted API and return created scan_id."""
    token = bearer_token or get_bearer_token() or get_api_key()
    if not token:
        raise SkillGateError(
            "Scan submission requires authentication. Run 'skillgate auth login' "
            "or set SKILLGATE_BEARER_TOKEN/SKILLGATE_API_KEY."
        )

    endpoint = resolve_scan_submit_endpoint()
    payload = {"report": report}

    try:
        resp = httpx.post(
            endpoint,
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=20.0,
        )
    except httpx.HTTPError as exc:
        raise SkillGateError(
            "Failed to submit scan report: "
            f"{exc}\n"
            f"Resolved endpoint: {endpoint}\n"
            "Set SKILLGATE_API_URL to your API base URL, for example:\n"
            "  export SKILLGATE_API_URL=http://127.0.0.1:8000"
        ) from exc

    if resp.status_code >= 400:
        detail = ""
        try:
            data = resp.json()
            detail = str(data.get("detail") or data.get("message") or "")
        except Exception:
            detail = resp.text[:200]
        raise SkillGateError(
            f"Scan submission failed ({resp.status_code})" + (f": {detail}" if detail else "")
        )

    body = resp.json()
    scan_id = str(body.get("scan_id", ""))
    if not scan_id:
        raise SkillGateError("Scan submission failed: missing scan_id in response")
    return scan_id
