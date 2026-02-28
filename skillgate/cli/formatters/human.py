"""Human-readable output formatter using Rich."""

from __future__ import annotations

import re

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from skillgate.core.models.artifact import OriginType
from skillgate.core.models.enums import Severity
from skillgate.core.models.finding import Finding
from skillgate.core.models.report import ScanReport

# --- Layer 1: Severity colors ---

SEVERITY_COLORS: dict[Severity, str] = {
    Severity.LOW: "cyan",
    Severity.MEDIUM: "yellow",
    Severity.HIGH: "dark_orange",
    Severity.CRITICAL: "bold bright_red",
}

SEVERITY_ICONS: dict[Severity, str] = {
    Severity.LOW: ".",
    Severity.MEDIUM: "!",
    Severity.HIGH: "!!",
    Severity.CRITICAL: "!!!",
}

# --- Layer 2: Risk score gradient ---

_SCORE_THRESHOLDS: list[tuple[int, str]] = [
    (25, "green"),
    (75, "yellow"),
    (125, "dark_orange"),
    (200, "bright_red"),
]

_BAR_WIDTH = 20


def _score_color(score: int) -> str:
    """Map a risk score (0..200) to a color name.

    Args:
        score: Numeric risk score clamped to 0..200.

    Returns:
        Rich color string.
    """
    for threshold, color in _SCORE_THRESHOLDS:
        if score <= threshold:
            return color
    return "bright_red"


def _score_bar(score: int) -> str:
    """Build a small colored bar representing the score 0..200.

    Args:
        score: Numeric risk score.

    Returns:
        Rich markup string with colored bar.
    """
    clamped = max(0, min(score, 200))
    filled = round(clamped / 200 * _BAR_WIDTH)
    empty = _BAR_WIDTH - filled
    color = _score_color(clamped)
    bar = "\u2588" * filled + "\u2591" * empty
    return f"[{color}]{bar}[/{color}]"


# --- Layer 3: Contextual emphasis (dangerous token highlighting) ---

_DANGEROUS_TOKENS: list[str] = [
    r"\beval\b",
    r"\bexec\b",
    r"\bos\.system\b",
    r"\bsubprocess\b",
    r"shell\s*=\s*True",
    r"curl\s*\|\s*bash",
    r"\brm\s+-rf\b",
    r"\bchmod\s+777\b",
    r"\bPickle\b",
    r"\b__import__\b",
    r"\bcompile\b",
]

_DANGEROUS_RE = re.compile("|".join(_DANGEROUS_TOKENS), re.IGNORECASE)


def _highlight_dangerous(text: str) -> str:
    """Wrap dangerous tokens in bold red markup.

    Args:
        text: Plain text string to scan.

    Returns:
        String with Rich markup around dangerous tokens.
    """

    def _repl(m: re.Match[str]) -> str:
        return f"[bold bright_red]{m.group(0)}[/bold bright_red]"

    return _DANGEROUS_RE.sub(_repl, text)


# Human-friendly labels for origin types
_ORIGIN_LABELS: dict[str, str] = {
    OriginType.CODE.value: "code",
    OriginType.MARKDOWN_PROSE.value: "markdown prose",
    OriginType.MARKDOWN_CODEBLOCK.value: "markdown code block",
    OriginType.DOCUMENT_TEXT.value: "document text",
    OriginType.CONFIG.value: "config",
    OriginType.ARCHIVE_MEMBER.value: "archive member",
    OriginType.UNKNOWN.value: "unknown origin",
}


def _format_provenance(finding: Finding) -> str | None:
    """Return a short provenance string or None if no provenance.

    Args:
        finding: The finding to describe.

    Returns:
        Human-friendly provenance string, or None.
    """
    prov = finding.provenance
    if prov is None:
        return None
    label = _ORIGIN_LABELS.get(prov.origin_type.value, prov.origin_type.value)
    parts = [label]
    if prov.section:
        parts.append(f"\u00a7 {prov.section}")
    if prov.page_start is not None:
        parts.append(f"p.{prov.page_start}")
    return ", ".join(parts)


def format_human(
    report: ScanReport,
    console: Console | None = None,
    *,
    no_color: bool = False,
) -> str:
    """Format a scan report as human-readable Rich output.

    Args:
        report: The scan report to format.
        console: Optional Rich console for output.
        no_color: Disable colored output (plain text fallback).

    Returns:
        Formatted string output.
    """
    if console is None:
        from io import StringIO

        buf = StringIO()
        con = Console(
            file=buf,
            width=100,
            no_color=no_color,
            force_terminal=True,
            color_system=None if no_color else "truecolor",
            highlight=False,
        )
    else:
        buf = None
        con = console

    # --- Fleet report ---
    if report.fleet_summary is not None and report.fleet_results is not None:
        summary = report.fleet_summary
        header_text = (
            f"[bold]SkillGate v{report.scanner_version}[/bold] \u2014 Fleet Security Scan\n\n"
            f"  Fleet root: [bold]{report.bundle_root}[/bold]\n"
            f"  Bundles scanned: {summary.bundles_scanned}\n"
            f"  Passed: {summary.passed_bundles}  Failed: {summary.failed_bundles}  "
            f"Errored: {summary.errored_bundles}\n"
            f"  Fail rate: {summary.fail_rate_pct}%\n"
            f"  Critical findings: {summary.critical_findings}\n"
            f"  Unsigned attestations: {summary.unsigned_attestations}\n"
            f"  Stale attestations: {summary.stale_attestations}"
        )
        con.print(Panel(header_text, border_style="blue"))

        bundles_table = Table(
            title="Fleet Bundle Results",
            show_header=True,
            header_style="bold",
            expand=True,
            border_style="dim",
        )
        bundles_table.add_column("Path", ratio=1)
        bundles_table.add_column("Status", width=10)
        bundles_table.add_column("Score", width=8, justify="right")
        bundles_table.add_column("Findings", width=10, justify="right")
        bundles_table.add_column("Critical", width=9, justify="right")
        bundles_table.add_column("Error", ratio=1)

        for item in report.fleet_results:
            crit_count = sum(
                1
                for finding in item.findings
                if str(finding.get("severity", "")).lower() == Severity.CRITICAL.value
            )
            has_policy_failure = bool(
                isinstance(item.policy, dict) and item.policy.get("passed") is False
            )
            has_error = item.error is not None
            status_text = "PASS"
            if has_error:
                status_text = "ERROR"
            elif has_policy_failure:
                status_text = "FAIL"
            status_color = (
                "green" if status_text == "PASS" else "red" if status_text == "FAIL" else "yellow"
            )
            bundles_table.add_row(
                item.path,
                f"[{status_color}]{status_text}[/{status_color}]",
                str(item.risk_score.total),
                str(item.risk_score.findings_count),
                str(crit_count),
                item.error or "",
            )

        con.print()
        con.print(bundles_table)
        if buf is not None:
            return buf.getvalue()
        return ""

    # --- Header panel ---
    score = report.risk_score.total
    severity_color = SEVERITY_COLORS.get(report.risk_score.severity, "white")
    score_clr = _score_color(score)
    bar = _score_bar(score)

    header_text = (
        f"[bold]SkillGate v{report.scanner_version}[/bold] \u2014 "
        f"Skill Security Scan Report\n\n"
        f"  Bundle: [bold]{report.bundle_name}[/bold]"
    )
    if report.bundle_version:
        header_text += f" v{report.bundle_version}"
    header_text += (
        f"\n  Files scanned: {report.files_scanned}\n"
        f"  Risk Score: [{score_clr}]{score}[/{score_clr}] "
        f"[{severity_color}]({report.risk_score.severity.value.upper()})"
        f"[/{severity_color}]  {bar}\n"
        f"  Findings: {report.risk_score.findings_count}"
    )

    # Policy status in header
    if report.policy:
        policy_name = str(report.policy.get("name", "unknown"))
        passed = bool(report.policy.get("passed", True))
        if passed:
            header_text += f"\n  Policy: {policy_name} \u2014 [green]PASSED[/green]"
        else:
            raw_violations = report.policy.get("violations", [])
            viol_list = list(raw_violations) if isinstance(raw_violations, list) else []
            header_text += (
                f"\n  Policy: {policy_name} \u2014 [red]FAILED[/red]"
                f"\n  Violations: {len(viol_list)}"
            )

    con.print(Panel(header_text, border_style="blue"))

    # --- Findings table ---
    if report.findings:
        findings_table = Table(
            title="Findings",
            show_header=True,
            header_style="bold",
            expand=True,
            border_style="dim",
        )
        findings_table.add_column("Sev", width=4, justify="center")
        findings_table.add_column("Rule", width=14)
        findings_table.add_column("File:Line", width=22)
        findings_table.add_column("Message", ratio=1)

        # Show Origin column only when at least one finding has provenance
        has_provenance = any(
            Finding.model_validate(f).provenance is not None for f in report.findings
        )
        if has_provenance:
            findings_table.add_column("Origin", width=18)

        for f_dict in report.findings:
            finding = Finding.model_validate(f_dict)
            sev = finding.severity
            color = SEVERITY_COLORS.get(sev, "white")
            icon = SEVERITY_ICONS.get(sev, "?")

            # Layer 3: highlight dangerous tokens in message
            msg = _highlight_dangerous(finding.message)

            row: list[str | Text] = [
                f"[{color}]{icon}[/{color}]",
                f"[{color}]{finding.rule_id}[/{color}]",
                f"[dim]{finding.file}:{finding.line}[/dim]",
                msg,
            ]
            if has_provenance:
                prov_str = _format_provenance(finding)
                row.append("[dim]{}[/dim]".format(prov_str or "\u2014"))
            findings_table.add_row(*row)

        con.print()
        con.print(findings_table)

        # Detailed findings with snippets/remediation
        has_details = any(
            Finding.model_validate(f).snippet or Finding.model_validate(f).remediation
            for f in report.findings
        )
        if has_details:
            con.print("\n[bold]Details:[/bold]\n")
            for f_dict in report.findings:
                finding = Finding.model_validate(f_dict)
                sev = finding.severity
                color = SEVERITY_COLORS.get(sev, "white")
                icon = SEVERITY_ICONS.get(sev, "?")

                con.print(
                    f"  [{color}]{icon} {finding.rule_id} [{sev.value.upper()}] "
                    f"{finding.rule_name}[/{color}]"
                )
                # Layer 3: dim file path, highlight dangerous tokens in message
                highlighted_msg = _highlight_dangerous(finding.message)
                con.print(f"    [dim]{finding.file}:{finding.line}[/dim] \u2014 {highlighted_msg}")
                prov_str = _format_provenance(finding)
                if prov_str:
                    con.print(f"    [dim]Origin: {prov_str}[/dim]")
                if finding.snippet:
                    # Layer 3: highlight dangerous tokens in snippets
                    highlighted_snippet = _highlight_dangerous(finding.snippet.rstrip())
                    con.print(f"    [dim]| {finding.line} |[/dim] {highlighted_snippet}")
                if finding.remediation:
                    con.print(f"    [italic]Remediation: {finding.remediation}[/italic]")
                con.print()

    # Explanations
    if report.explanations:
        con.print("[bold]Explanations:[/bold]\n")
        for exp_dict in report.explanations:
            rule_id = exp_dict.get("rule_id", "unknown")
            text = exp_dict.get("text", "")
            source = exp_dict.get("source", "unknown")
            con.print(f"  [bold]{rule_id}[/bold] [dim]({source})[/dim]")
            for line in text.split("\n"):
                con.print(f"    {line}")
            con.print()

    # Policy violations
    if report.policy and not bool(report.policy.get("passed", True)):
        raw_viols = report.policy.get("violations", [])
        viols = list(raw_viols) if isinstance(raw_viols, list) else []
        if viols:
            con.print("[bold]Policy Violations:[/bold]\n")
            for v in viols:
                reason = v.get("reason", "Unknown violation") if isinstance(v, dict) else str(v)
                con.print(f"  [red]x[/red] {reason}")
            con.print()

    # Extraction manifest summary
    if report.extraction_manifest:
        em = report.extraction_manifest
        total = em.total_artifacts
        warnings_count = len(em.extraction_warnings)
        lines = [f"  Artifacts extracted: {total}"]
        if warnings_count:
            lines.append(f"  Extraction warnings: {warnings_count}")
        if em.provenance_records:
            # Count by origin type
            origin_counts: dict[str, int] = {}
            for rec in em.provenance_records:
                key = rec.origin_type.value if hasattr(rec, "origin_type") else str(rec)
                origin_counts[key] = origin_counts.get(key, 0) + 1
            for origin, count in sorted(origin_counts.items()):
                label = _ORIGIN_LABELS.get(origin, origin)
                lines.append(f"    {label}: {count}")
        con.print("[bold]Extraction Manifest:[/bold]")
        for line in lines:
            con.print(line)
        con.print()

    # --- Score breakdown table (with colored scores) ---
    if report.risk_score.breakdown:
        breakdown_table = Table(
            title="Score Breakdown",
            show_header=True,
            header_style="bold",
            border_style="dim",
        )
        breakdown_table.add_column("Category", width=18)
        breakdown_table.add_column("Score", width=8, justify="right")
        breakdown_table.add_column("Pct", width=8, justify="right")

        total = max(report.risk_score.total, 1)
        for category, cat_score in sorted(
            report.risk_score.breakdown.items(), key=lambda x: x[1], reverse=True
        ):
            pct = int(cat_score / total * 100)
            cat_color = _score_color(cat_score)
            breakdown_table.add_row(
                category.capitalize(),
                f"[{cat_color}]{cat_score}[/{cat_color}]",
                f"{pct}%",
            )

        con.print(breakdown_table)
        con.print()

    if report.risk_score.findings_count > 0:
        con.print("[bold]Next steps:[/bold]")
        con.print(
            "  - Run with [bold]--explain[/bold] for finding-level "
            "rationale and remediation context."
        )
        con.print(
            "  - Use [bold]--output json --report-file <path>[/bold] "
            "to inspect/share full report details."
        )
        con.print("  - Rule catalog: [underline]https://docs.skillgate.io/rules[/underline]")
        con.print("  - Policy reference: [underline]https://docs.skillgate.io/policy[/underline]")
        con.print()

    if buf is not None:
        return buf.getvalue()
    return ""
