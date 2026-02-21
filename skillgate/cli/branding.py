# skillgate/cli/branding.py
"""SkillGate CLI branding — clean, instant banner (no animation)."""

from __future__ import annotations

import os
import shutil
import sys

ESC = "\x1b"
RESET = f"{ESC}[0m"

# Grey + blue palette
GREY = f"{ESC}[38;2;195;205;220m"
DARK_GREY = f"{ESC}[38;2;125;135;150m"
BLUE = f"{ESC}[38;2;80;160;255m"
DIM = f"{ESC}[2m"

# Big brand banner
SKILLGATE_BIG = [
    r"  ███████╗██╗  ██╗██╗██╗     ██╗      ██████╗  █████╗ ████████╗███████╗ ",
    r"  ██╔════╝██║ ██╔╝██║██║     ██║     ██╔════╝ ██╔══██╗╚══██╔══╝██╔════╝ ",
    r"  ███████╗█████╔╝ ██║██║     ██║     ██║  ███╗███████║   ██║   █████╗   ",
    r"  ╚════██║██╔═██╗ ██║██║     ██║     ██║   ██║██╔══██║   ██║   ██╔══╝   ",
    r"  ███████║██║  ██╗██║███████╗███████╗╚██████╔╝██║  ██║   ██║   ███████╗ ",
    r"  ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝ ",
]


# ---------------------------
# Terminal / ANSI utilities
# ---------------------------


def _is_tty() -> bool:
    """Check if stdout is a terminal."""
    return sys.stdout.isatty()


def _term_width(default: int = 120) -> int:
    """Get terminal width, falling back to default."""
    try:
        return shutil.get_terminal_size().columns
    except Exception:
        return default


def _strip_ansi(s: str) -> str:
    """Remove ANSI SGR sequences (best-effort)."""
    out: list[str] = []
    i = 0
    while i < len(s):
        if s[i] == "\x1b" and i + 1 < len(s) and s[i + 1] == "[":
            j = i + 2
            while j < len(s) and s[j] != "m":
                j += 1
            i = min(j + 1, len(s))
        else:
            out.append(s[i])
            i += 1
    return "".join(out)


def _visible_len(s: str) -> int:
    """Return visible (non-ANSI) character count."""
    return len(_strip_ansi(s))


def _ansi_safe_trim(s: str, max_visible: int) -> str:
    """Trim to max_visible visible characters without cutting ANSI sequences."""
    if max_visible <= 0:
        return ""

    out: list[str] = []
    vis = 0
    i = 0
    while i < len(s) and vis < max_visible:
        ch = s[i]
        if ch == "\x1b" and i + 1 < len(s) and s[i + 1] == "[":
            j = i + 2
            while j < len(s) and s[j] != "m":
                j += 1
            j = min(j + 1, len(s))
            out.append(s[i:j])
            i = j
        else:
            out.append(ch)
            i += 1
            vis += 1
    return "".join(out)


def _center_ansi(line: str, cols: int) -> str:
    """Center a line accounting for ANSI escape sequences."""
    pad = max(0, (cols - _visible_len(line)) // 2)
    return (" " * pad) + line


def _colorize_skillgate_line(line: str) -> str:
    """Color left half grey, right half blue."""
    mid = len(line) // 2
    return f"{GREY}{line[:mid]}{BLUE}{line[mid:]}{RESET}"


# ---------------------------
# Banner gating logic
# ---------------------------


def should_show_brand(argv: list[str] | None = None) -> bool:
    """Return True only when user runs `skillgate` with no args.

    Args:
        argv: Command-line arguments (defaults to sys.argv).

    Returns:
        Whether to display the brand banner.
    """
    if argv is None:
        argv = sys.argv

    if os.environ.get("SKILLGATE_NO_BANNER") == "1":
        return False

    if os.environ.get("NO_COLOR") is not None:
        return False

    return len(argv) == 1


def maybe_print_brand(version: str | None = None, argv: list[str] | None = None) -> None:
    """Print the banner only when `skillgate` is run with no args.

    Args:
        version: Version string to display below the banner.
        argv: Command-line arguments for gating logic.
    """
    if not _is_tty():
        return
    if not should_show_brand(argv):
        return

    print_skillgate_brand(version=version)


# ---------------------------
# Instant banner (no animation)
# ---------------------------


def print_skillgate_brand(version: str | None = None) -> None:
    """Print the SkillGate banner — clean instant render, no animation.

    Args:
        version: Optional version string shown below the banner.
    """
    if not _is_tty():
        return

    cols = _term_width()
    buf: list[str] = [""]  # leading blank line

    for line in SKILLGATE_BIG:
        colored = _colorize_skillgate_line(line)
        centered = _center_ansi(colored, cols)
        buf.append(_ansi_safe_trim(centered, cols - 1))

    if version:
        vtag = f"{DIM}v{version}{RESET}"
        buf.append(_center_ansi(vtag, cols))

    buf.append("")  # trailing blank line

    sys.stdout.write("\n".join(buf) + "\n")
    sys.stdout.flush()
