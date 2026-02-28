"""Scan command implementation."""

from __future__ import annotations

import shutil
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import NamedTuple

import httpx
import typer
from rich.console import Console

from skillgate.cli.formatters.human import format_human
from skillgate.cli.formatters.json_fmt import format_json
from skillgate.cli.formatters.sarif import format_sarif
from skillgate.cli.remote import fetch_bundle, is_url, normalize_intake_selector
from skillgate.cli.scan_submit import submit_scan_report
from skillgate.config.license import get_api_key
from skillgate.core.analyzer.engine import analyze_bundle
from skillgate.core.enricher.engine import enrich_findings
from skillgate.core.entitlement import (
    Capability,
    Entitlement,
    EntitlementEnforcementMode,
    ScanQuotaTracker,
    cap_findings,
    check_capability,
    check_seat_limit,
    consume_scan_authoritatively,
    get_enforcement_mode,
    resolve_runtime_entitlement,
)
from skillgate.core.errors import (
    EntitlementError,
    ParseError,
    PolicyError,
    SkillGateError,
)
from skillgate.core.explainer.engine import explain_findings
from skillgate.core.gateway import RuntimeEnvironment
from skillgate.core.models.enums import Severity
from skillgate.core.models.report import FleetBundleReport, FleetSummary, RiskScore, ScanReport
from skillgate.core.parser.bundle import load_bundle
from skillgate.core.parser.fleet import discover_fleet_bundles, has_supported_manifest
from skillgate.core.policy.engine import (
    apply_rule_overrides,
    evaluate_policy,
    filter_disabled_findings,
)
from skillgate.core.policy.loader import resolve_policy
from skillgate.core.policy.schema import PolicyConfig
from skillgate.core.reputation import evaluate_runtime_reputation
from skillgate.core.scorer.engine import calculate_score
from skillgate.core.scorer.severity import classify_severity
from skillgate.core.signer.engine import create_signed_report

console = Console(stderr=True)


class _BundleScanResult(NamedTuple):
    report: ScanReport
    policy_passed: bool


def _write_stdout_safe(text: str) -> None:
    """Write text to stdout without crashing on narrow terminal encodings."""
    try:
        sys.stdout.write(text)
        sys.stdout.flush()
        return
    except UnicodeEncodeError:
        pass

    encoding = sys.stdout.encoding or "utf-8"
    safe_bytes = text.encode(encoding, errors="replace")
    buffer = getattr(sys.stdout, "buffer", None)
    if buffer is not None:
        buffer.write(safe_bytes)
        buffer.flush()
        return

    safe_text = safe_bytes.decode(encoding, errors="replace")
    sys.stdout.write(safe_text)
    sys.stdout.flush()


def _enforce_runtime_seat_contract(entitlement: Entitlement) -> None:
    import os

    max_seats = int(entitlement.limits.max_seats or 0)
    if max_seats <= 0:
        return
    active_raw = os.environ.get("SKILLGATE_TEAM_ACTIVE_SEATS", "").strip()
    if not active_raw:
        return
    try:
        active = int(active_raw)
    except ValueError as exc:
        raise EntitlementError(
            "Invalid SKILLGATE_TEAM_ACTIVE_SEATS; expected integer.",
            tier=entitlement.tier.value.upper(),
        ) from exc
    check_seat_limit(entitlement, active)


def _is_ci_blocking_context() -> bool:
    """Return True when scan enforce is executed in CI blocking context."""
    import os

    return os.environ.get("SKILLGATE_CI_MODE", "").strip().lower() in {"1", "true", "yes"}


def _resolve_bundle_path(path: str, verbose: bool, quiet: bool) -> tuple[Path, Path | None]:
    """Resolve a local path or remote URL to a local directory.

    Returns (bundle_path, cleanup_path). If cleanup_path is not None,
    it should be removed after scanning.
    """
    try:
        normalized_path = normalize_intake_selector(path)
    except ValueError as exc:
        if not quiet:
            console.print(f"[red]Error:[/red] {exc}")
        raise typer.Exit(code=3) from exc
    if is_url(normalized_path):
        if verbose and not quiet:
            console.print(f"[dim]Fetching remote bundle: {normalized_path}[/dim]")
        try:
            local_path = fetch_bundle(normalized_path)
        except httpx.HTTPStatusError as e:
            if not quiet:
                console.print(f"[red]Download error:[/red] HTTP {e.response.status_code}")
            raise typer.Exit(code=3) from e
        except (ValueError, httpx.HTTPError) as e:
            if not quiet:
                console.print(f"[red]Download error:[/red] {e}")
            raise typer.Exit(code=3) from e
        # cleanup_path is the temp dir root (parent if we descended into it)
        cleanup = (
            local_path
            if local_path.parent.name.startswith("skillgate-remote-")
            else local_path.parent
        )
        return local_path, cleanup

    bundle_path = Path(path)
    if not bundle_path.exists():
        if not quiet:
            console.print(f"[red]Error:[/red] Path does not exist: {path}")
        raise typer.Exit(code=3)
    if not bundle_path.is_dir():
        if not quiet:
            console.print(f"[red]Error:[/red] Path is not a directory: {path}")
        raise typer.Exit(code=3)
    return bundle_path, None


def scan_command(
    path: str = typer.Argument(help="Path or URL to skill bundle"),
    fleet: bool = typer.Option(False, "--fleet", help="Enable fleet scan mode."),
    require_skill_manifest: bool = typer.Option(
        False,
        "--require-skill-manifest",
        help="In fleet mode, scan only bundle roots containing a supported manifest.",
    ),
    fail_on_any: bool = typer.Option(
        False,
        "--fail-on-any",
        help="In fleet mode, exit 1 when any bundle fails policy or scan.",
    ),
    fail_on_threshold: float | None = typer.Option(
        None,
        "--fail-on-threshold",
        min=0.0,
        max=100.0,
        help="In fleet mode, exit 1 when fleet fail-rate percentage reaches threshold.",
    ),
    fleet_workers: int = typer.Option(
        4,
        "--fleet-workers",
        min=1,
        max=32,
        help="Maximum parallel workers for bundle-level fleet scanning.",
    ),
    output: str = typer.Option("human", "--output", "-o", help="Output format: human, json, sarif"),
    policy: str | None = typer.Option(
        None, "--policy", "-p", help="Policy preset name or YAML file path"
    ),
    enforce: bool = typer.Option(
        False, "--enforce", help="Enable enforcement mode (exit 1 on violation)"
    ),
    report_file: str | None = typer.Option(None, "--report-file", help="Write report to file"),
    quiet: bool = typer.Option(False, "--quiet", "-q", help="Suppress non-error output"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable verbose output"),
    sign: bool = typer.Option(False, "--sign", help="Sign the report with Ed25519 key"),
    key_dir: str | None = typer.Option(None, "--key-dir", help="Custom key directory for signing"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable colored output"),
    watch: bool = typer.Option(False, "--watch", help="Re-scan on file changes"),
    explain: bool = typer.Option(
        False, "--explain", help="Add LLM-powered explanations to findings"
    ),
    explain_source: str = typer.Option(
        "auto",
        "--explain-source",
        help="Explanation source: auto | offline | ai",
    ),
    llm_provider: str | None = typer.Option(
        None,
        "--llm-provider",
        help="LLM provider (advanced): openai | anthropic | custom",
    ),
    explain_backend: str | None = typer.Option(
        None,
        "--explain-backend",
        help="Deprecated alias for explanation backend: anthropic | openai | template",
        hidden=True,
    ),
    explain_mode: str = typer.Option(
        "technical",
        "--explain-mode",
        help="Explanation mode: technical | executive",
    ),
    reputation_store: str = typer.Option(
        ".skillgate/reputation/reputation.json",
        "--reputation-store",
        help="Path to signed reputation graph JSON for scan/report integration.",
    ),
    reputation_env: str = typer.Option(
        "ci",
        "--reputation-env",
        help="Reputation decision environment: dev | ci | prod | strict",
    ),
    mode: str = typer.Option(
        "default",
        "--mode",
        "-m",
        help="Scan mode: default, agent-output, or pre-commit",
    ),
    submit: bool = typer.Option(
        False,
        "--submit",
        help="Submit scan report to API (/api/v1/scans) using CLI auth bearer token.",
    ),
) -> None:
    """Scan a skill bundle for security risks."""
    resolved_explain_backend = _resolve_explain_backend(
        explain_source=explain_source,
        llm_provider=llm_provider,
        explain_backend_legacy=explain_backend,
        quiet=quiet,
    )
    explain_mode_value = explain_mode.strip().lower()
    if explain_mode_value not in {"technical", "executive"}:
        if not quiet:
            console.print(
                f"[red]Error:[/red] Unknown explain mode '{explain_mode}'. "
                "Use 'technical' or 'executive'."
            )
        raise typer.Exit(code=3)
    reputation_env_value = reputation_env.strip().lower()
    if reputation_env_value not in {"dev", "ci", "prod", "strict"}:
        if not quiet:
            console.print(
                f"[red]Error:[/red] Unknown reputation environment '{reputation_env}'. "
                "Use dev, ci, prod, or strict."
            )
        raise typer.Exit(code=3)

    # --mode shortcuts: auto-apply policy preset + enforce
    if mode == "agent-output":
        policy = "agent-output"
        enforce = True
    elif mode == "pre-commit":
        policy = policy or "production"
        enforce = True
    elif mode != "default":
        if not quiet:
            console.print(
                f"[red]Error:[/red] Unknown mode '{mode}'. "
                "Use 'default', 'agent-output', or 'pre-commit'."
            )
        raise typer.Exit(code=3)

    bundle_path, cleanup_path = _resolve_bundle_path(path, verbose, quiet)
    policy_config = _resolve_policy_config(policy, enforce, quiet)

    try:
        if watch:
            if fleet:
                if not quiet:
                    console.print("[red]Error:[/red] --watch is not supported with --fleet.")
                raise typer.Exit(code=3)
            if submit:
                if not quiet:
                    console.print("[red]Error:[/red] --submit is not supported with --watch.")
                raise typer.Exit(code=3)
            _run_watch_mode(
                str(bundle_path),
                output,
                policy,
                enforce,
                quiet,
                verbose,
                no_color,
                sign,
                key_dir,
                report_file,
                explain,
                resolved_explain_backend,
                explain_mode_value,
                reputation_store,
                reputation_env_value,
            )
            return

        if fleet:
            _run_fleet_scan(
                fleet_path=bundle_path,
                output=output,
                policy_config=policy_config,
                policy_ref=policy,
                enforce=enforce,
                report_file=report_file,
                quiet=quiet,
                verbose=verbose,
                sign=sign,
                key_dir=key_dir,
                no_color=no_color,
                explain=explain,
                explain_backend=resolved_explain_backend,
                explain_mode=explain_mode_value,
                reputation_store=reputation_store,
                reputation_env=reputation_env_value,
                require_skill_manifest=require_skill_manifest,
                fail_on_any=fail_on_any,
                fail_on_threshold=fail_on_threshold,
                fleet_workers=fleet_workers,
                submit=submit,
            )
            return

        _run_single_scan(
            path=str(bundle_path),
            output=output,
            policy_config=policy_config,
            enforce=enforce,
            report_file=report_file,
            quiet=quiet,
            verbose=verbose,
            sign=sign,
            key_dir=key_dir,
            no_color=no_color,
            explain=explain,
            explain_backend=resolved_explain_backend,
            explain_mode=explain_mode_value,
            reputation_store=reputation_store,
            reputation_env=reputation_env_value,
            submit=submit,
        )

    finally:
        if cleanup_path and cleanup_path.exists():
            shutil.rmtree(cleanup_path, ignore_errors=True)


def _resolve_policy_config(policy: str | None, enforce: bool, quiet: bool) -> PolicyConfig | None:
    policy_config = None
    if policy or enforce:
        try:
            policy_ref = policy if policy else "production"
            policy_config = resolve_policy(policy_ref)
        except PolicyError as e:
            if not quiet:
                console.print(f"[red]Policy error:[/red] {e}")
            raise typer.Exit(code=3) from e
    return policy_config


def _resolve_explain_backend(
    *,
    explain_source: str,
    llm_provider: str | None,
    explain_backend_legacy: str | None,
    quiet: bool,
) -> str | None:
    source_value = explain_source.strip().lower()
    if source_value not in {"auto", "offline", "ai"}:
        if not quiet:
            console.print(
                f"[red]Error:[/red] Unknown explain source '{explain_source}'. "
                "Use 'auto', 'offline', or 'ai'."
            )
        raise typer.Exit(code=3)

    provider_value = llm_provider.strip().lower() if llm_provider else None
    if provider_value is not None and provider_value not in {"openai", "anthropic", "custom"}:
        if not quiet:
            console.print(
                f"[red]Error:[/red] Unknown llm provider '{llm_provider}'. "
                "Use 'openai', 'anthropic', or 'custom'."
            )
        raise typer.Exit(code=3)

    legacy_value = explain_backend_legacy.strip().lower() if explain_backend_legacy else None
    if legacy_value is not None and legacy_value not in {"openai", "anthropic", "template"}:
        if not quiet:
            console.print(
                f"[red]Error:[/red] Unknown explain backend '{explain_backend_legacy}'. "
                "Use 'anthropic', 'openai', or 'template'."
            )
        raise typer.Exit(code=3)
    if legacy_value is not None:
        if source_value != "auto" or provider_value is not None:
            if not quiet:
                console.print(
                    "[red]Error:[/red] Do not combine --explain-backend with "
                    "--explain-source/--llm-provider."
                )
            raise typer.Exit(code=3)
        if not quiet:
            console.print(
                "[yellow]Warning:[/yellow] --explain-backend is deprecated; "
                "use --explain-source and --llm-provider."
            )
        return legacy_value

    if source_value == "offline":
        return "template"

    if provider_value == "custom":
        return "custom"

    if source_value == "ai":
        return provider_value

    return provider_value


def _scan_bundle_core(
    path: str,
    policy_config: PolicyConfig | None,
    verbose: bool,
    quiet: bool,
    sign: bool,
    key_dir: str | None,
    explain: bool,
    explain_backend: str | None,
    explain_mode: str,
    reputation_store: str,
    reputation_env: str,
    max_findings_returned: int = 0,
) -> _BundleScanResult:
    if verbose and not quiet:
        console.print(f"[dim]Scanning bundle: {path}[/dim]")
    bundle = load_bundle(path)

    disabled_rules = policy_config.rules.disabled if policy_config else None
    if verbose and not quiet:
        console.print(
            f"[dim]Analyzing {len(bundle.source_files)} files with {bundle.manifest.name}...[/dim]"
        )
    findings = analyze_bundle(bundle, disabled_rules=disabled_rules)
    findings_total = len(findings)

    if max_findings_returned > 0:
        findings, _ = cap_findings(findings, max_findings_returned)

    if policy_config:
        findings = filter_disabled_findings(findings, policy_config)
        findings = apply_rule_overrides(findings, policy_config)

    risk_score = calculate_score(findings)
    enrichments = enrich_findings(findings)
    enrichment_list: list[dict[str, object]] | None = (
        [e.model_dump(exclude_none=True) for e in enrichments] if enrichments else None
    )

    policy_result = None
    policy_dict = None
    if policy_config:
        policy_result = evaluate_policy(
            findings,
            risk_score,
            policy_config,
            enrichments=enrichments or None,
        )
        policy_dict = {
            "name": policy_result.policy_name,
            "version": policy_result.policy_version,
            "passed": policy_result.passed,
            "enforcement_mode": policy_result.enforcement_mode,
            "violations": [v.model_dump() for v in policy_result.violations],
            "warnings": [w.model_dump() for w in policy_result.warnings],
        }

    explanations_list: list[dict[str, str]] | None = None
    if explain and findings:
        if verbose and not quiet:
            console.print("[dim]Generating explanations...[/dim]")
        exps = explain_findings(findings, backend=explain_backend, mode=explain_mode)
        explanations_list = [
            {"rule_id": e.rule_id, "text": e.text, "source": e.source} for e in exps
        ]

    report = ScanReport(
        timestamp=datetime.now(timezone.utc).isoformat(),
        bundle_name=bundle.manifest.name,
        bundle_version=bundle.manifest.version,
        bundle_hash=bundle.hash,
        bundle_root=bundle.root,
        files_scanned=bundle.files_scanned,
        manifest_found=has_supported_manifest(Path(path)),
        risk_score=risk_score,
        findings=[f.model_dump() for f in findings],
        findings_total=findings_total if findings_total != len(findings) else None,
        enrichment=enrichment_list,
        explanations=explanations_list,
        policy=policy_dict,
    )
    reputation_decision = evaluate_runtime_reputation(
        bundle_hash=bundle.hash,
        environment=RuntimeEnvironment(reputation_env),
        store_path=Path(reputation_store),
    )
    report = report.model_copy(
        update={
            "reputation": {
                "allowed": reputation_decision.allowed,
                "code": reputation_decision.code,
                "reason": reputation_decision.reason,
                "verdict": reputation_decision.verdict.value,
                "confidence": reputation_decision.confidence,
                "bundle_hash": reputation_decision.redacted_bundle_hash,
            }
        }
    )

    if sign:
        key_path = Path(key_dir) if key_dir else None
        report_dict = report.model_dump()
        signed_data = create_signed_report(report_dict, key_path)
        report = ScanReport(**{k: v for k, v in signed_data.items() if k != "attestation"})
        report = report.model_copy(update={"attestation": signed_data["attestation"]})

    policy_passed = True if policy_result is None else policy_result.passed
    policy_passed = policy_passed and reputation_decision.allowed
    return _BundleScanResult(report=report, policy_passed=policy_passed)


def _write_report_output(
    report: ScanReport,
    output: str,
    report_file: str | None,
    quiet: bool,
    no_color: bool,
) -> None:
    if quiet:
        return

    if output == "json":
        formatted = format_json(report)
    elif output == "sarif":
        formatted = format_sarif(report)
    else:
        formatted = format_human(report, no_color=no_color)

    if report_file:
        if output == "human":
            plain = format_human(report, no_color=True)
            Path(report_file).write_text(plain, encoding="utf-8")
        else:
            Path(report_file).write_text(formatted, encoding="utf-8")
        console.print(f"Report written to {report_file}")
    elif output in ("json", "sarif"):
        _write_stdout_safe(formatted + "\n")
    else:
        _write_stdout_safe(formatted)


def _run_single_scan(
    path: str,
    output: str,
    policy_config: PolicyConfig | None,
    enforce: bool,
    report_file: str | None,
    quiet: bool,
    verbose: bool,
    sign: bool,
    key_dir: str | None,
    no_color: bool,
    explain: bool = False,
    explain_backend: str | None = None,
    explain_mode: str = "technical",
    reputation_store: str = ".skillgate/reputation/reputation.json",
    reputation_env: str = "ci",
    submit: bool = False,
) -> None:
    """Execute a single scan pass."""
    try:
        api_key = get_api_key()
        entitlement = resolve_runtime_entitlement(api_key)
        enforcement_mode = get_enforcement_mode()

        import os

        in_test_mode = os.environ.get("SKILLGATE_TEST_MODE", "").lower() in ("1", "true")
        if not in_test_mode:
            _enforce_runtime_seat_contract(entitlement)
            if enforce:
                required = (
                    Capability.CI_BLOCKING if _is_ci_blocking_context() else Capability.ENFORCE
                )
                check_capability(entitlement, required)
            if sign:
                check_capability(entitlement, Capability.SIGN)
            if explain:
                check_capability(entitlement, Capability.EXPLAIN)
            if output == "sarif":
                check_capability(entitlement, Capability.CI_ANNOTATIONS)

        max_findings_returned = 0
        if not in_test_mode and entitlement.limits.max_findings_returned > 0:
            max_findings_returned = entitlement.limits.max_findings_returned

        result = _scan_bundle_core(
            path=path,
            policy_config=policy_config,
            verbose=verbose,
            quiet=quiet,
            sign=sign,
            key_dir=key_dir,
            explain=explain,
            explain_backend=explain_backend,
            explain_mode=explain_mode,
            reputation_store=reputation_store,
            reputation_env=reputation_env,
            max_findings_returned=max_findings_returned,
        )

        if (
            not in_test_mode
            and entitlement.limits.scans_per_day > 0
            and result.report.files_scanned > 0
        ):
            if enforcement_mode == EntitlementEnforcementMode.LOCAL:
                tracker = ScanQuotaTracker()
                tracker.check_quota(entitlement.limits.scans_per_day)
                tracker.record_scan()
            else:
                consume_scan_authoritatively(
                    mode=enforcement_mode,
                    api_key=api_key,
                    entitlement=entitlement,
                )

        _write_report_output(result.report, output, report_file, quiet, no_color)

        if submit:
            scan_id = submit_scan_report(report=result.report.model_dump())
            if not quiet:
                console.print(f"[green]Submitted scan:[/] {scan_id}")

        if enforce and not result.policy_passed:
            raise typer.Exit(code=1)
        return

    except ParseError as e:
        if not quiet:
            console.print(f"[red]Parse error:[/red] {e}")
        raise typer.Exit(code=3) from e
    except PolicyError as e:
        if not quiet:
            console.print(f"[red]Policy error:[/red] {e}")
        raise typer.Exit(code=3) from e
    except EntitlementError as e:
        if not quiet:
            console.print(f"[yellow]Entitlement:[/yellow] {e}")
        raise typer.Exit(code=1) from e
    except SkillGateError as e:
        if not quiet:
            console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(code=2) from e
    except typer.Exit:
        raise
    except Exception as e:
        if not quiet:
            console.print(f"[red]Internal error:[/red] {e}")
        raise typer.Exit(code=2) from e


def _run_fleet_scan(
    *,
    fleet_path: Path,
    output: str,
    policy_config: PolicyConfig | None,
    policy_ref: str | None,
    enforce: bool,
    report_file: str | None,
    quiet: bool,
    verbose: bool,
    sign: bool,
    key_dir: str | None,
    no_color: bool,
    explain: bool,
    explain_backend: str | None,
    explain_mode: str,
    reputation_store: str,
    reputation_env: str,
    require_skill_manifest: bool,
    fail_on_any: bool,
    fail_on_threshold: float | None,
    fleet_workers: int,
    submit: bool,
) -> None:
    if output == "sarif":
        if not quiet:
            console.print("[red]Error:[/red] Fleet mode supports only human or json output.")
        raise typer.Exit(code=3)

    try:
        api_key = get_api_key()
        entitlement = resolve_runtime_entitlement(api_key)
        enforcement_mode = get_enforcement_mode()

        import os

        in_test_mode = os.environ.get("SKILLGATE_TEST_MODE", "").lower() in ("1", "true")
        if not in_test_mode:
            _enforce_runtime_seat_contract(entitlement)
            check_capability(entitlement, Capability.FLEET_SCAN)
            if enforce:
                required = (
                    Capability.CI_BLOCKING if _is_ci_blocking_context() else Capability.ENFORCE
                )
                check_capability(entitlement, required)
            if sign:
                check_capability(entitlement, Capability.SIGN)
            if explain:
                check_capability(entitlement, Capability.EXPLAIN)

        fleet_cfg = policy_config.fleet if policy_config else None
        require_manifest = require_skill_manifest or (
            fleet_cfg.require_manifest if fleet_cfg else False
        )
        fail_any = fail_on_any or (fleet_cfg.fail_on_any if fleet_cfg else False)
        fail_threshold = (
            fail_on_threshold
            if fail_on_threshold is not None
            else (fleet_cfg.fail_on_threshold if fleet_cfg else None)
        )
        max_workers = (
            fleet_workers if fleet_workers > 0 else (fleet_cfg.max_workers if fleet_cfg else 4)
        )
        skill_roots = fleet_cfg.skill_roots if fleet_cfg else []
        exclude = fleet_cfg.exclude if fleet_cfg else []

        bundle_paths = discover_fleet_bundles(
            fleet_path,
            skill_roots=skill_roots,
            exclude=exclude,
            require_manifest=require_manifest,
        )
        if not bundle_paths:
            if not quiet:
                console.print("[red]Error:[/red] No fleet bundle roots discovered.")
            raise typer.Exit(code=3)

        max_findings_returned = 0
        if not in_test_mode and entitlement.limits.max_findings_returned > 0:
            max_findings_returned = entitlement.limits.max_findings_returned

        if verbose and not quiet:
            policy_label = policy_ref if policy_ref else "none"
            console.print(
                f"[dim]Fleet scan discovered {len(bundle_paths)} bundles "
                f"(policy={policy_label}, workers={max_workers})[/dim]"
            )

        per_bundle: dict[str, FleetBundleReport] = {}
        policy_pass_map: dict[str, bool] = {}
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_map = {
                executor.submit(
                    _scan_bundle_core,
                    path=str(bundle_path),
                    policy_config=policy_config,
                    verbose=verbose,
                    quiet=quiet,
                    sign=sign,
                    key_dir=key_dir,
                    explain=explain,
                    explain_backend=explain_backend,
                    explain_mode=explain_mode,
                    reputation_store=reputation_store,
                    reputation_env=reputation_env,
                    max_findings_returned=max_findings_returned,
                ): bundle_path
                for bundle_path in bundle_paths
            }
            for future in as_completed(future_map):
                bundle_path = future_map[future]
                path_key = str(bundle_path.resolve())
                rel_path = _relative_bundle_path(bundle_path, fleet_path)
                try:
                    result = future.result()
                    per_bundle[path_key] = FleetBundleReport(
                        path=rel_path,
                        bundle_name=result.report.bundle_name,
                        bundle_version=result.report.bundle_version,
                        bundle_hash=result.report.bundle_hash,
                        files_scanned=result.report.files_scanned,
                        manifest_found=result.report.manifest_found,
                        risk_score=result.report.risk_score,
                        findings=result.report.findings,
                        findings_total=result.report.findings_total,
                        policy=result.report.policy,
                        reputation=result.report.reputation,
                        attestation=result.report.attestation,
                    )
                    policy_pass_map[path_key] = result.policy_passed
                except Exception as exc:
                    per_bundle[path_key] = FleetBundleReport(
                        path=rel_path,
                        risk_score=_result_risk_score_zero(),
                        error=str(exc),
                    )
                    policy_pass_map[path_key] = False

        ordered_results: list[FleetBundleReport] = []
        for bundle_path in sorted(bundle_paths, key=lambda p: p.as_posix()):
            item = per_bundle[str(bundle_path.resolve())]
            ordered_results.append(item)

        failed_bundles = 0
        passed_bundles = 0
        errored_bundles = 0
        critical_findings = 0
        unsigned_attestations = 0
        stale_attestations = 0
        total_score = 0
        total_files = 0
        total_findings = 0
        breakdown: dict[str, int] = {}

        for bundle_path in sorted(bundle_paths, key=lambda p: p.as_posix()):
            key = str(bundle_path.resolve())
            bundle_result = per_bundle[key]
            total_score += bundle_result.risk_score.total
            total_files += bundle_result.files_scanned
            total_findings += bundle_result.risk_score.findings_count
            for category, score in bundle_result.risk_score.breakdown.items():
                breakdown[category] = breakdown.get(category, 0) + score
            critical_findings += _count_critical_findings(bundle_result.findings)
            if bundle_result.attestation is None:
                unsigned_attestations += 1
            elif _is_stale_attestation(bundle_result.attestation):
                stale_attestations += 1
            passed = policy_pass_map.get(key, False) and bundle_result.error is None
            if passed:
                passed_bundles += 1
            else:
                failed_bundles += 1
            if bundle_result.error is not None:
                errored_bundles += 1

        bundles_scanned = len(ordered_results)
        fail_rate = round((failed_bundles / bundles_scanned) * 100, 2) if bundles_scanned else 0.0
        fleet_summary = FleetSummary(
            bundles_scanned=bundles_scanned,
            passed_bundles=passed_bundles,
            failed_bundles=failed_bundles,
            errored_bundles=errored_bundles,
            fail_rate_pct=fail_rate,
            critical_findings=critical_findings,
            unsigned_attestations=unsigned_attestations,
            stale_attestations=stale_attestations,
        )

        report = ScanReport(
            timestamp=datetime.now(timezone.utc).isoformat(),
            bundle_name="fleet",
            bundle_root=str(fleet_path.resolve()),
            files_scanned=total_files,
            manifest_found=True,
            risk_score=_result_risk_score(total_score, total_findings, breakdown),
            findings=[],
            fleet_summary=fleet_summary,
            fleet_results=ordered_results,
        )

        _write_report_output(report, output, report_file, quiet, no_color)

        if submit:
            scan_id = submit_scan_report(report=report.model_dump())
            if not quiet:
                console.print(f"[green]Submitted scan:[/] {scan_id}")

        if (
            (enforce and failed_bundles > 0)
            or (fail_any and failed_bundles > 0)
            or (fail_threshold is not None and fail_rate >= fail_threshold)
        ):
            raise typer.Exit(code=1)

        if not in_test_mode and entitlement.limits.scans_per_day > 0 and bundles_scanned > 0:
            if enforcement_mode == EntitlementEnforcementMode.LOCAL:
                tracker = ScanQuotaTracker()
                tracker.check_quota(entitlement.limits.scans_per_day)
                for _ in range(bundles_scanned):
                    tracker.record_scan()
            else:
                for _ in range(bundles_scanned):
                    consume_scan_authoritatively(
                        mode=enforcement_mode,
                        api_key=api_key,
                        entitlement=entitlement,
                    )
        raise typer.Exit(code=0)

    except ParseError as e:
        if not quiet:
            console.print(f"[red]Parse error:[/red] {e}")
        raise typer.Exit(code=3) from e
    except PolicyError as e:
        if not quiet:
            console.print(f"[red]Policy error:[/red] {e}")
        raise typer.Exit(code=3) from e
    except EntitlementError as e:
        if not quiet:
            console.print(f"[yellow]Entitlement:[/yellow] {e}")
        raise typer.Exit(code=1) from e
    except SkillGateError as e:
        if not quiet:
            console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(code=2) from e
    except typer.Exit:
        raise
    except Exception as e:
        if not quiet:
            console.print(f"[red]Internal error:[/red] {e}")
        raise typer.Exit(code=2) from e


def _result_risk_score(total: int, findings_count: int, breakdown: dict[str, int]) -> RiskScore:
    return RiskScore(
        total=total,
        severity=classify_severity(total),
        breakdown=breakdown,
        findings_count=findings_count,
    )


def _result_risk_score_zero() -> RiskScore:
    return _result_risk_score(total=0, findings_count=0, breakdown={})


def _relative_bundle_path(bundle_path: Path, fleet_root: Path) -> str:
    try:
        return bundle_path.resolve().relative_to(fleet_root.resolve()).as_posix() or "."
    except ValueError:
        return str(bundle_path.resolve())


def _count_critical_findings(findings: list[dict[str, object]]) -> int:
    count = 0
    for finding in findings:
        raw = finding.get("severity")
        if isinstance(raw, str) and raw.lower() == Severity.CRITICAL.value:
            count += 1
    return count


def _is_stale_attestation(attestation: dict[str, object], max_age_days: int = 30) -> bool:
    raw_ts = attestation.get("timestamp")
    if not isinstance(raw_ts, str):
        return False
    try:
        normalized = raw_ts.replace("Z", "+00:00")
        created = datetime.fromisoformat(normalized)
    except ValueError:
        return False
    now = datetime.now(timezone.utc)
    return (now - created).days > max_age_days


def _run_watch_mode(
    path: str,
    output: str,
    policy: str | None,
    enforce: bool,
    quiet: bool,
    verbose: bool,
    no_color: bool,
    sign: bool,
    key_dir: str | None,
    report_file: str | None,
    explain: bool = False,
    explain_backend: str | None = None,
    explain_mode: str = "technical",
    reputation_store: str = ".skillgate/reputation/reputation.json",
    reputation_env: str = "ci",
) -> None:
    """Run scan in watch mode — re-scan on file changes."""
    try:
        from watchdog.events import FileSystemEventHandler
        from watchdog.observers import Observer
    except ImportError:
        console.print(
            "[red]Error:[/red] Watch mode requires watchdog. "
            "Install with: pip install 'skillgate[watch]'"
        )
        raise typer.Exit(code=2) from None

    import contextlib
    import threading
    import time

    if not quiet:
        console.print(f"[bold]Watching {path} for changes...[/bold] (Ctrl+C to stop)\n")

    policy_config = _resolve_policy_config(policy, enforce, quiet)

    # Run initial scan — don't exit on policy violation in watch mode
    with contextlib.suppress(typer.Exit):
        _run_single_scan(
            path=path,
            output=output,
            policy_config=policy_config,
            enforce=False,
            report_file=report_file,
            quiet=quiet,
            verbose=verbose,
            sign=sign,
            key_dir=key_dir,
            no_color=no_color,
            explain=explain,
            explain_backend=explain_backend,
            explain_mode=explain_mode,
            reputation_store=reputation_store,
            reputation_env=reputation_env,
        )

    debounce_timer: threading.Timer | None = None
    lock = threading.Lock()

    class ScanHandler(FileSystemEventHandler):  # type: ignore[misc]
        def on_any_event(self, event: object) -> None:
            nonlocal debounce_timer
            with lock:
                if debounce_timer is not None:
                    debounce_timer.cancel()
                debounce_timer = threading.Timer(1.0, self._rescan)
                debounce_timer.daemon = True
                debounce_timer.start()

        def _rescan(self) -> None:
            if not quiet:
                console.print("\n[dim]Change detected, re-scanning...[/dim]\n")
            try:
                _run_single_scan(
                    path=path,
                    output=output,
                    policy_config=policy_config,
                    enforce=False,
                    report_file=report_file,
                    quiet=quiet,
                    verbose=verbose,
                    sign=sign,
                    key_dir=key_dir,
                    no_color=no_color,
                    explain=explain,
                    explain_backend=explain_backend,
                    explain_mode=explain_mode,
                    reputation_store=reputation_store,
                    reputation_env=reputation_env,
                )
            except typer.Exit:
                pass
            except Exception as exc:
                console.print(f"[red]Scan error:[/red] {exc}")

    handler = ScanHandler()
    observer = Observer()
    observer.schedule(handler, path, recursive=True)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        if not quiet:
            console.print("\n[bold]Watch mode stopped.[/bold]")
        observer.stop()
    observer.join()
