#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from scripts.xbk.common import get_settings


def _run(cmd: list[str]) -> None:
    print(f"[xbk-run-all] running: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="One-click XBK reset + seed + import-samples + smoke.")
    parser.add_argument(
        "--no-reset",
        action="store_true",
        help="Pass --no-reset to seed.py",
    )
    args = parser.parse_args()

    python_bin = sys.executable
    root = Path(__file__).resolve().parents[2]
    seed_script = root / "scripts" / "xbk" / "seed.py"
    import_script = root / "scripts" / "xbk" / "import_samples.py"
    smoke_script = root / "scripts" / "xbk" / "smoke.py"

    seed_cmd = [python_bin, str(seed_script)]
    if args.no_reset:
        seed_cmd.append("--no-reset")

    _run(seed_cmd)
    _run([python_bin, str(import_script)])

    settings = get_settings()
    manifest = settings.sample_dir / "manifest.json"
    _run([python_bin, str(smoke_script), "--manifest", str(manifest)])

    print("[xbk-run-all] all checks passed")
    print(f"[xbk-run-all] report: {settings.test_result_dir / 'xbk-smoke-report.json'}")
    print(f"[xbk-run-all] report (compat): {settings.test_result_dir.parent / 'xbk-smoke-report.json'}")


if __name__ == "__main__":
    main()
