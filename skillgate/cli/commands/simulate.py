"""Policy simulation command for org/repo dry-run impact analysis."""

from __future__ import annotations

import json
import os
from collections import Counter
from dataclasses import dataclass
from glob import glob
from pathlib import Path
from urllib.parse import quote

import httpx
import typer

from skillgate.cli.remote import fetch_bundle, normalize_intake_selector
from skillgate.config.license import get_api_key
from skillgate.core.analyzer.engine import analyze_bundle
from skillgate.core.entitlement import Capability, check_capability, resolve_runtime_entitlement
from skillgate.core.errors import EntitlementError, ParseError, PolicyError
from skillgate.core.parser.bundle import load_bundle
from skillgate.core.policy.engine import (
    apply_rule_overrides,
    evaluate_policy,
    filter_disabled_findings,
)
from skillgate.core.policy.loader import resolve_policy
from skillgate.core.policy.schema import PolicyConfig
from skillgate.core.scorer.engine import calculate_score

_ORG_MAX_REPOS = 200
_ORG_API_PER_PAGE = 100
_ORG_API_TIMEOUT = 15.0


@dataclass(frozen=True, slots=True)
class SimulationSample:
    """Result for one simulated bundle path."""

    path: str
    passed: bool
    findings: int
    score: int
    violations: tuple[str, ...]
    warnings: tuple[str, ...]
    error: str | None = None


def simulate_command(
    paths: list[str] = typer.Argument(default=[], help="One or more bundle paths to simulate."),  # noqa: B008
    org: str | None = typer.Option(
        None,
        "--org",
        help="Organization selector (for example: github:acme/* or ./repos/acme/*).",
    ),
    policy: str = typer.Option(
        "production",
        "--policy",
        "-p",
        help="Policy preset or policy file path used for simulation.",
    ),
    output: str = typer.Option("human", "--output", "-o", help="Output format: human|json"),
    fail_on_failures: bool = typer.Option(
        False,
        "--fail-on-failures",
        help="Exit with code 1 if any simulated bundle would fail policy.",
    ),
) -> None:
    """Dry-run policy impact without enforcing runtime/blocking side effects."""
    in_test_mode = os.environ.get("SKILLGATE_TEST_MODE", "").lower() in {"1", "true"}
    if org and not in_test_mode:
        try:
            entitlement = resolve_runtime_entitlement(get_api_key())
            check_capability(entitlement, Capability.CI_BLOCKING)
        except EntitlementError as exc:
            raise typer.BadParameter(str(exc)) from exc

    try:
        policy_config = resolve_policy(policy)
    except PolicyError as exc:
        raise typer.BadParameter(str(exc)) from exc
    if policy_config is None:
        raise typer.BadParameter("Policy simulation requires a resolved policy.")

    resolved_paths = list(paths)
    if org:
        resolved_paths.extend(_resolve_org_selector(org))
    if not resolved_paths:
        raise typer.BadParameter("Provide one or more paths or use --org selector.")

    samples = _simulate_paths(resolved_paths, policy_config)
    summary = _build_summary(samples)
    summary["org_selector"] = org
    summary["repositories"] = len(resolved_paths)

    if output == "json":
        typer.echo(json.dumps(summary, sort_keys=True, separators=(",", ":")))
    else:
        typer.echo(_format_human(summary))

    raw_failing = summary.get("failing_bundles", 0)
    failing_bundles = int(raw_failing) if isinstance(raw_failing, int | float | str) else 0
    if fail_on_failures and failing_bundles > 0:
        raise typer.Exit(code=1)
    raise typer.Exit(code=0)


def _simulate_paths(paths: list[str], policy_config: PolicyConfig) -> list[SimulationSample]:
    samples: list[SimulationSample] = []
    for path in paths:
        try:
            bundle = load_bundle(path)
            disabled = policy_config.rules.disabled
            findings = analyze_bundle(bundle, disabled_rules=disabled)
            findings = filter_disabled_findings(findings, policy_config)
            findings = apply_rule_overrides(findings, policy_config)
            score = calculate_score(findings)
            policy_result = evaluate_policy(findings, score, policy_config)
            violations = tuple(v.rule for v in policy_result.violations)
            warnings = tuple(w.rule for w in policy_result.warnings)
            samples.append(
                SimulationSample(
                    path=path,
                    passed=policy_result.passed,
                    findings=len(findings),
                    score=score.total,
                    violations=violations,
                    warnings=warnings,
                )
            )
        except ParseError as exc:
            samples.append(
                SimulationSample(
                    path=path,
                    passed=False,
                    findings=0,
                    score=0,
                    violations=(),
                    warnings=(),
                    error=str(exc),
                )
            )
    return samples


def _build_summary(samples: list[SimulationSample]) -> dict[str, object]:
    total = len(samples)
    failing = sum(1 for sample in samples if not sample.passed)
    passing = total - failing

    violation_counter: Counter[str] = Counter()
    findings_total = 0
    score_total = 0
    errored = 0
    for sample in samples:
        violation_counter.update(sample.violations)
        findings_total += sample.findings
        score_total += sample.score
        if sample.error:
            errored += 1

    top_violations = [
        {"rule": rule, "count": count}
        for rule, count in sorted(
            violation_counter.items(),
            key=lambda item: (-item[1], item[0]),
        )[:10]
    ]

    noise_estimate_pct = 0.0
    if total > 0:
        warning_bundles = sum(1 for sample in samples if sample.warnings)
        noise_estimate_pct = round((warning_bundles / total) * 100, 2)

    return {
        "bundles": total,
        "passing_bundles": passing,
        "failing_bundles": failing,
        "errored_bundles": errored,
        "fail_rate_pct": round((failing / total) * 100, 2) if total > 0 else 0.0,
        "avg_findings_per_bundle": round((findings_total / total), 2) if total > 0 else 0.0,
        "avg_score_per_bundle": round((score_total / total), 2) if total > 0 else 0.0,
        "noise_estimate_pct": noise_estimate_pct,
        "top_violations": top_violations,
        "samples": [
            {
                "path": sample.path,
                "passed": sample.passed,
                "findings": sample.findings,
                "score": sample.score,
                "violations": list(sample.violations),
                "warnings": list(sample.warnings),
                "error": sample.error,
            }
            for sample in samples
        ],
    }


def _format_human(summary: dict[str, object]) -> str:
    lines = [
        "SkillGate Policy Simulation",
        "",
        f"Bundles:          {summary['bundles']}",
        f"Passing:          {summary['passing_bundles']}",
        f"Failing:          {summary['failing_bundles']}",
        f"Errored:          {summary['errored_bundles']}",
        f"Fail rate:        {summary['fail_rate_pct']}%",
        f"Avg findings:     {summary['avg_findings_per_bundle']}",
        f"Avg risk score:   {summary['avg_score_per_bundle']}",
        f"Noise estimate:   {summary['noise_estimate_pct']}%",
        f"Repositories:     {summary.get('repositories', summary['bundles'])}",
        "",
        "Top Violations:",
    ]
    top_violations = summary.get("top_violations", [])
    if isinstance(top_violations, list) and top_violations:
        for item in top_violations:
            if isinstance(item, dict):
                lines.append(f" - {item['rule']}: {item['count']}")
    else:
        lines.append(" - none")
    return "\n".join(lines)


def _resolve_org_selector(selector: str) -> list[str]:
    value = selector.strip()
    lowered = value.lower()
    if lowered.startswith("path:"):
        return _resolve_local_selector(value.split(":", 1)[1], selector)
    if lowered.startswith("github:"):
        return _resolve_github_selector(value.split(":", 1)[1], selector)
    if lowered.startswith("gitlab:"):
        return _resolve_gitlab_selector(value.split(":", 1)[1], selector)
    if lowered.startswith("forge:"):
        return _resolve_forge_selector(value.split(":", 1)[1], selector)
    return _resolve_local_selector(value, selector)


def _resolve_local_selector(pattern: str, selector: str) -> list[str]:
    matches = [candidate for candidate in glob(pattern) if Path(candidate).is_dir()]
    if not matches:
        raise typer.BadParameter(f"No repositories matched org selector '{selector}'.")
    return sorted(set(matches))


def _resolve_github_selector(raw: str, selector: str) -> list[str]:
    payload = raw.strip().strip("/")
    if payload.endswith("/*"):
        owner_target = payload[:-2].strip("/")
        host, owner = _split_owner_selector(owner_target, default_host="github.com")
        repo_urls = _list_github_repo_urls(host, owner)
        return _fetch_repo_urls(repo_urls)
    return [_fetch_repo_selector(f"github:{payload}", selector)]


def _resolve_gitlab_selector(raw: str, selector: str) -> list[str]:
    payload = raw.strip().strip("/")
    if payload.endswith("/*"):
        group_target = payload[:-2].strip("/")
        host, group = _split_owner_selector(group_target, default_host="gitlab.com")
        repo_urls = _list_gitlab_repo_urls(host, group)
        return _fetch_repo_urls(repo_urls)
    return [_fetch_repo_selector(f"gitlab:{payload}", selector)]


def _resolve_forge_selector(raw: str, selector: str) -> list[str]:
    payload = raw.strip().strip("/")
    if payload.endswith("/*"):
        raise typer.BadParameter(
            f"Selector '{selector}' requires explicit repositories for forge domains "
            "(for example forge:host/org/repo)."
        )
    return [_fetch_repo_selector(f"forge:{payload}", selector)]


def _fetch_repo_urls(repo_urls: list[str]) -> list[str]:
    if not repo_urls:
        raise typer.BadParameter("No remote repositories matched org selector.")
    if len(repo_urls) > _ORG_MAX_REPOS:
        raise typer.BadParameter(
            f"Org selector matched {len(repo_urls)} repositories; limit is {_ORG_MAX_REPOS}."
        )
    # deterministic ordering and dedupe
    return [str(fetch_bundle(url).resolve()) for url in sorted(set(repo_urls))]


def _fetch_repo_selector(selector: str, original_selector: str) -> str:
    try:
        normalized = normalize_intake_selector(selector)
    except ValueError as exc:
        raise typer.BadParameter(str(exc)) from exc
    try:
        return str(fetch_bundle(normalized).resolve())
    except Exception as exc:
        raise typer.BadParameter(
            f"Failed to resolve selector '{original_selector}': {exc}"
        ) from exc


def _split_owner_selector(raw: str, *, default_host: str) -> tuple[str, str]:
    parts = [part for part in raw.split("/") if part]
    if not parts:
        raise typer.BadParameter("Org selector owner/group is required.")
    if len(parts) >= 2 and ("." in parts[0] or ":" in parts[0]):
        host = parts[0]
        owner = "/".join(parts[1:])
    else:
        host = default_host
        owner = "/".join(parts)
    if not owner:
        raise typer.BadParameter("Org selector owner/group is required.")
    return host, owner


def _list_github_repo_urls(host: str, owner: str) -> list[str]:
    base_api = _github_api_base(host)
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "skillgate-simulate-org/1",
    }
    token = os.getenv("SKILLGATE_GITHUB_TOKEN") or os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    org_endpoint = f"{base_api}/orgs/{owner}/repos"
    user_endpoint = f"{base_api}/users/{owner}/repos"

    with httpx.Client(timeout=_ORG_API_TIMEOUT) as client:
        try:
            return _github_list_endpoint(client, org_endpoint, headers)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code not in {403, 404}:
                raise typer.BadParameter(
                    f"GitHub org discovery failed for '{owner}' ({exc.response.status_code})."
                ) from exc
        try:
            return _github_list_endpoint(client, user_endpoint, headers)
        except httpx.HTTPStatusError as exc:
            raise typer.BadParameter(
                f"GitHub selector '{owner}' could not be resolved ({exc.response.status_code})."
            ) from exc


def _github_list_endpoint(
    client: httpx.Client,
    endpoint: str,
    headers: dict[str, str],
) -> list[str]:
    repo_urls: list[str] = []
    page = 1
    while len(repo_urls) < _ORG_MAX_REPOS:
        response = client.get(
            endpoint,
            headers=headers,
            params={"per_page": _ORG_API_PER_PAGE, "page": page},
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, list):
            break
        for item in payload:
            if not isinstance(item, dict):
                continue
            html_url = item.get("html_url")
            if isinstance(html_url, str) and html_url:
                repo_urls.append(html_url)
        if len(payload) < _ORG_API_PER_PAGE:
            break
        page += 1
    return repo_urls


def _list_gitlab_repo_urls(host: str, group: str) -> list[str]:
    base_api = f"https://{host}/api/v4"
    headers = {"User-Agent": "skillgate-simulate-org/1"}
    token = os.getenv("SKILLGATE_GITLAB_TOKEN") or os.getenv("GITLAB_TOKEN")
    if token:
        headers["PRIVATE-TOKEN"] = token

    repo_urls: list[str] = []
    page = 1
    group_quoted = quote(group, safe="")
    with httpx.Client(timeout=_ORG_API_TIMEOUT) as client:
        while len(repo_urls) < _ORG_MAX_REPOS:
            response = client.get(
                f"{base_api}/groups/{group_quoted}/projects",
                headers=headers,
                params={
                    "include_subgroups": "true",
                    "per_page": _ORG_API_PER_PAGE,
                    "page": page,
                },
            )
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, list):
                break
            for item in payload:
                if not isinstance(item, dict):
                    continue
                web_url = item.get("web_url")
                if isinstance(web_url, str) and web_url:
                    repo_urls.append(web_url)
            if len(payload) < _ORG_API_PER_PAGE:
                break
            page += 1
    return repo_urls


def _github_api_base(host: str) -> str:
    if host.lower() == "github.com":
        return "https://api.github.com"
    return f"https://{host}/api/v3"
