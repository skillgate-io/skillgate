#!/usr/bin/env python3
"""Backwards-compatible Phase 2 ship gate checker wrapper."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scripts.quality.check_phase_ship_gates import main  # noqa: E402

if __name__ == "__main__":
    argv = sys.argv[1:]
    if "--phase" not in argv:
        argv = ["--phase", "phase2", *argv]
    sys.argv = [sys.argv[0], *argv]
    raise SystemExit(main())
