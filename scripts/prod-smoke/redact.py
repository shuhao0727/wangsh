#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys
from collections import deque
from pathlib import Path

from run import collect_sensitive_values, redact_sensitive_output


def _read_text(path: str, tail: int | None) -> str:
    if path == "-":
        if tail is None:
            return sys.stdin.read()
        return "".join(deque(sys.stdin, maxlen=tail))
    file_path = Path(path)
    with file_path.open("r", encoding="utf-8", errors="replace") as handle:
        if tail is None:
            return handle.read()
        return "".join(deque(handle, maxlen=tail))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Redact token-shaped secrets before publishing runtime logs.",
    )
    parser.add_argument("path", help="Log file to read, or - for stdin")
    parser.add_argument("--tail", type=int, help="Only emit the final N lines")
    args = parser.parse_args()

    if args.tail is not None and args.tail <= 0:
        parser.error("--tail must be greater than zero")

    try:
        content = _read_text(args.path, args.tail)
    except OSError as exc:
        print(f"unable to read {args.path}: {exc}", file=sys.stderr)
        return 1

    sensitive_values = collect_sensitive_values(dict(os.environ))
    sys.stdout.write(redact_sensitive_output(content, sensitive_values))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
