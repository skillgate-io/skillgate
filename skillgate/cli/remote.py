"""Remote URL fetching for skill bundles."""

from __future__ import annotations

import io
import logging
import shutil
import tarfile
import tempfile
import zipfile
from pathlib import Path
from typing import Final
from urllib.parse import quote, urlparse

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = 30.0
_MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024  # 50MB
_MAX_ARCHIVE_MEMBERS: Final[int] = 10_000
_MAX_ARCHIVE_TOTAL_UNCOMPRESSED: Final[int] = 200 * 1024 * 1024  # 200MB
_MAX_ARCHIVE_DEPTH: Final[int] = 20
_SELECTOR_PREFIXES: Final[tuple[str, ...]] = ("github:", "gitlab:", "forge:")


def is_url(path: str) -> bool:
    """Check if a string looks like a remote URL."""
    lowered = path.lower()
    return lowered.startswith(("http://", "https://")) or lowered.startswith(_SELECTOR_PREFIXES)


def normalize_intake_selector(selector: str) -> str:
    """Normalize remote intake selectors to canonical URL forms."""
    value = selector.strip()
    lowered = value.lower()
    if lowered.startswith("github:"):
        return _normalize_provider_selector(value.split(":", 1)[1], default_host="github.com")
    if lowered.startswith("gitlab:"):
        return _normalize_provider_selector(value.split(":", 1)[1], default_host="gitlab.com")
    if lowered.startswith("forge:"):
        payload = value.split(":", 1)[1].strip().strip("/")
        parts = [part for part in payload.split("/") if part]
        if len(parts) < 3:
            raise ValueError("forge: selector must be in format forge:host/org/repo")
        host = parts[0]
        repo = "/".join(parts[1:])
        return f"https://{host}/{repo}"
    return value


def fetch_bundle(url: str) -> Path:
    """Download a remote skill bundle and extract to a temp directory.

    Supports .tar.gz, .zip archives, and GitHub/ClawHub repo URLs.
    Returns the path to a temporary directory containing the bundle.

    Args:
        url: The URL to fetch.

    Returns:
        Path to a temporary directory with the extracted bundle.

    Raises:
        httpx.HTTPStatusError: If the download fails.
        ValueError: If the response is too large or unsupported format.
    """
    normalized = normalize_intake_selector(url)
    candidates = _candidate_archive_urls(normalized)
    last_error: Exception | None = None

    with httpx.Client(timeout=_TIMEOUT, follow_redirects=True) as client:
        for candidate in candidates:
            try:
                response = client.get(candidate)
                response.raise_for_status()
            except Exception as exc:
                last_error = exc
                continue

            content = response.content
            if len(content) > _MAX_DOWNLOAD_SIZE:
                raise ValueError(
                    f"Download exceeds maximum size: {len(content)} > {_MAX_DOWNLOAD_SIZE}"
                )

            tmp_dir = Path(tempfile.mkdtemp(prefix="skillgate-remote-"))
            try:
                content_type = response.headers.get("content-type", "")
                _extract_response_content(content, content_type, candidate)
                _extract_to_dir(content, content_type, candidate, tmp_dir)
            except Exception as exc:
                last_error = exc
                shutil.rmtree(tmp_dir, ignore_errors=True)
                continue

            entries = list(tmp_dir.iterdir())
            if len(entries) == 1 and entries[0].is_dir():
                return entries[0]
            return tmp_dir

    candidate_list = ", ".join(candidates[:6])
    detail = f": {last_error}" if last_error is not None else ""
    raise ValueError(
        "Unable to fetch remote bundle from "
        f"'{url}' using archive candidates [{candidate_list}]{detail}"
    )


def _normalize_url(url: str) -> str:
    """Normalize GitHub/GitLab repository URLs to downloadable archives."""
    if url.endswith((".tar.gz", ".tgz", ".zip")):
        return url

    parsed = urlparse(url)
    host = (parsed.netloc or "").lower()
    if not host:
        return url
    path = parsed.path.strip("/")
    if not path:
        return url

    if _is_github_host(host):
        repo, branch = _extract_github_repo_and_branch(path)
        if repo is None:
            return url
        ref = quote(branch or "main", safe="")
        return f"{parsed.scheme}://{parsed.netloc}/{repo}/archive/refs/heads/{ref}.tar.gz"

    if _is_gitlab_host(host):
        repo, branch = _extract_gitlab_repo_and_branch(path)
        if repo is None:
            return url
        ref = quote(branch or "HEAD", safe="")
        repo_name = repo.rsplit("/", 1)[-1]
        return f"{parsed.scheme}://{parsed.netloc}/{repo}/-/archive/{ref}/{repo_name}-{ref}.tar.gz"
    return url


def _candidate_archive_urls(url: str) -> list[str]:
    normalized = _normalize_url(url)
    if normalized != url:
        return [normalized]
    if normalized.endswith((".tar.gz", ".tgz", ".zip")):
        return [normalized]

    parsed = urlparse(normalized)
    if not parsed.scheme or not parsed.netloc:
        return [normalized]

    path = parsed.path.strip("/")
    segments = [seg for seg in path.split("/") if seg]
    if len(segments) < 2:
        return [normalized]

    repo_name = segments[-1]
    base = f"{parsed.scheme}://{parsed.netloc}/{'/'.join(segments)}"
    refs = ("main", "master", "HEAD")
    candidates = [normalized]
    for ref in refs:
        quoted_ref = quote(ref, safe="")
        candidates.extend(
            (
                f"{base}/archive/refs/heads/{quoted_ref}.tar.gz",
                f"{base}/archive/{quoted_ref}.tar.gz",
                f"{base}/-/archive/{quoted_ref}/{repo_name}-{quoted_ref}.tar.gz",
                f"{base}/get/{quoted_ref}.tar.gz",
            )
        )
    # preserve order while removing duplicates
    return list(dict.fromkeys(candidates))


def _extract_response_content(content: bytes, content_type: str, url: str) -> None:
    # Fast format sanity check prior to extraction to reduce noisy archive attempts.
    url_lower = url.lower()
    if (
        url_lower.endswith(".tar.gz")
        or url_lower.endswith(".tgz")
        or "gzip" in content_type
        or "tar" in content_type
    ):
        return
    if url_lower.endswith(".zip") or "zip" in content_type:
        return
    # Unknown type is still allowed; _extract_to_dir tries tar then zip deterministically.
    if len(content) < 4:
        raise ValueError("Downloaded payload is too small to be a valid archive.")


def _extract_to_dir(content: bytes, content_type: str, source_url: str, target: Path) -> None:
    url_lower = source_url.lower()
    if (
        url_lower.endswith(".tar.gz")
        or url_lower.endswith(".tgz")
        or "gzip" in content_type
        or "tar" in content_type
    ):
        _extract_tar(content, target)
        return
    if url_lower.endswith(".zip") or "zip" in content_type:
        _extract_zip(content, target)
        return
    try:
        _extract_tar(content, target)
    except (tarfile.TarError, ValueError):
        try:
            _extract_zip(content, target)
        except (zipfile.BadZipFile, ValueError) as exc:
            raise ValueError(
                f"Unsupported archive format from {source_url}. Expected .tar.gz or .zip."
            ) from exc


def _normalize_provider_selector(raw: str, default_host: str) -> str:
    payload = raw.strip().strip("/")
    if not payload:
        raise ValueError(
            f"{default_host.split('.')[0]}: selector must be in format "
            f"{default_host.split('.')[0]}:owner/repo or "
            f"{default_host.split('.')[0]}:host/owner/repo"
        )
    parts = [part for part in payload.split("/") if part]
    if len(parts) < 2:
        raise ValueError(
            f"{default_host.split('.')[0]}: selector must be in format "
            f"{default_host.split('.')[0]}:owner/repo or "
            f"{default_host.split('.')[0]}:host/owner/repo"
        )

    host = default_host
    repo_parts = parts
    if len(parts) >= 3 and ("." in parts[0] or ":" in parts[0]):
        host = parts[0]
        repo_parts = parts[1:]
    if len(repo_parts) < 2:
        raise ValueError(
            f"{default_host.split('.')[0]}: selector must include repository path after host"
        )
    return f"https://{host}/{'/'.join(repo_parts)}"


def _is_github_host(host: str) -> bool:
    return host == "github.com" or "github" in host


def _is_gitlab_host(host: str) -> bool:
    return host == "gitlab.com" or "gitlab" in host


def _extract_github_repo_and_branch(path: str) -> tuple[str | None, str | None]:
    segments = [seg for seg in path.split("/") if seg]
    if len(segments) < 2:
        return None, None
    repo = "/".join(segments[:2])
    branch = None
    if len(segments) >= 4 and segments[2] == "tree":
        branch = "/".join(segments[3:])
    return repo, branch


def _extract_gitlab_repo_and_branch(path: str) -> tuple[str | None, str | None]:
    segments = [seg for seg in path.split("/") if seg]
    if not segments:
        return None, None
    if "-/" in path:
        marker = segments.index("-")
        if marker == 0:
            return None, None
        repo = "/".join(segments[:marker])
        branch = None
        if len(segments) > marker + 2 and segments[marker + 1] == "tree":
            branch = "/".join(segments[marker + 2 :])
        return repo, branch
    if len(segments) < 2:
        return None, None
    return "/".join(segments), None


def _extract_tar(data: bytes, target: Path) -> None:
    """Extract a tar.gz archive to the target directory."""
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        members = tar.getmembers()
        _validate_member_limits(members)
        total_uncompressed = 0
        for member in members:
            _validate_archive_member_path(member.name)
            if member.issym() or member.islnk():
                raise ValueError(f"Symlink member is not allowed: {member.name}")
            if member.isfile():
                total_uncompressed += max(member.size, 0)
            if total_uncompressed > _MAX_ARCHIVE_TOTAL_UNCOMPRESSED:
                raise ValueError("Archive exceeds uncompressed size safety limit.")
        try:
            # Python 3.12+ supports extraction filters.
            tar.extractall(path=target, filter="data")
        except TypeError:
            # Older Python versions do not support `filter`; path checks above still apply.
            tar.extractall(path=target)


def _extract_zip(data: bytes, target: Path) -> None:
    """Extract a zip archive to the target directory."""
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        infos = zf.infolist()
        _validate_member_limits(infos)
        total_uncompressed = 0
        for info in infos:
            _validate_archive_member_path(info.filename)
            if _is_zip_symlink(info):
                raise ValueError(f"Symlink member is not allowed: {info.filename}")
            total_uncompressed += max(info.file_size, 0)
            if total_uncompressed > _MAX_ARCHIVE_TOTAL_UNCOMPRESSED:
                raise ValueError("Archive exceeds uncompressed size safety limit.")
        zf.extractall(path=target)


def _validate_member_limits(members: list[tarfile.TarInfo] | list[zipfile.ZipInfo]) -> None:
    if len(members) > _MAX_ARCHIVE_MEMBERS:
        raise ValueError(f"Archive exceeds member limit: {len(members)} > {_MAX_ARCHIVE_MEMBERS}")


def _validate_archive_member_path(member_name: str) -> None:
    normalized = member_name.replace("\\", "/")
    parsed = urlparse(normalized)
    path = parsed.path if parsed.scheme else normalized
    if path.startswith("/"):
        raise ValueError(f"Unsafe path in archive: {member_name}")
    parts = [part for part in path.split("/") if part]
    if ".." in parts:
        raise ValueError(f"Unsafe path in archive: {member_name}")
    if len(parts) > _MAX_ARCHIVE_DEPTH:
        raise ValueError(
            f"Archive path depth exceeds safety limit ({_MAX_ARCHIVE_DEPTH}): {member_name}"
        )


def _is_zip_symlink(info: zipfile.ZipInfo) -> bool:
    # Symlink bit detection for unix zip entries.
    mode = (info.external_attr >> 16) & 0o170000
    return mode == 0o120000
