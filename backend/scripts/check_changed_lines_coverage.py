#!/usr/bin/env python3
"""changed-lines coverage gate (audit T-2, governance §4.3).

Reads a pytest-cov JSON report and the Git diff of a change set, then computes
the share of *changed* lines that are executed by the backend test run.

Thresholds: 85% overall, 95% for auth/permission/migration critical paths
(backend/app/core/deps.py, app/api/endpoints/auth, app/core/security,
alembic/versions).  Exits 1 when the gate fails, 2 on configuration errors.

Change-set selection (exactly one):
  --base-ref REF   committed diff  `git diff --unified=0 REF...HEAD`
                   (default origin/main; CI passes PR base SHA / push before SHA)
  --worktree       uncommitted tracked changes `git diff --unified=0 HEAD`
  --cached         staged changes `git diff --cached --unified=0`

Files outside the Python source tree (non-.py, tests/*) are ignored.  Changed
files absent from the coverage report (e.g. alembic versions omitted by
.coveragerc) are reported as NOT MEASURED and excluded from the numeric gate.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

STANDARD_THRESHOLD = 85.0
KEY_THRESHOLD = 95.0

# Critical paths from governance §4.3; normalized paths (no leading backend/).
KEY_PATH_PREFIXES = (
    "app/api/endpoints/auth/",
    "app/api/endpoints/auth.py",
    "app/core/security",
)
KEY_PATH_EXACT = ("app/core/deps.py",)
KEY_PATH_PREFIXES += ("alembic/versions/",)


class ConfigurationError(RuntimeError):
    """Raised when inputs cannot be checked safely."""


def normalize_path(path: str) -> str:
    normalized = path.replace("\\", "/").lstrip("./")
    if normalized.startswith("backend/"):
        normalized = normalized[len("backend/") :]
    return normalized


def is_key_path(normalized: str) -> bool:
    return normalized in KEY_PATH_EXACT or normalized.startswith(KEY_PATH_PREFIXES)


def parse_diff(diff_text: str) -> dict[str, set[int]]:
    """Map `git diff --unified=0` output to {normalized_path: changed new-side lines}."""
    changed: dict[str, set[int]] = {}
    current_path: str | None = None
    new_line = 0
    for raw_line in diff_text.splitlines():
        if raw_line.startswith("+++ b/"):
            current_path = normalize_path(raw_line[len("+++ b/") :])
            changed.setdefault(current_path, set())
            continue
        if current_path is None or raw_line.startswith("+++ ") or raw_line.startswith("--- "):
            continue
        if raw_line.startswith("@@"):
            # hunk header: @@ -a,b +c,d @@
            try:
                new_side = raw_line.split("+")[1].split(" ")[0]
            except IndexError as exc:
                raise ConfigurationError(f"cannot parse hunk header: {raw_line!r}") from exc
            if new_side.startswith("0,0"):
                new_line = 0  # new file: no valid new-side lines
            else:
                new_line = int(new_side.split(",")[0])
            continue
        if raw_line.startswith("\\"):  # "\ No newline at end of file"
            continue
        if raw_line.startswith("+"):
            if new_line > 0:
                changed[current_path].add(new_line)
            new_line += 1
        elif raw_line.startswith(" "):
            new_line += 1
        # "-" lines consume old-side positions only; no effect on new-side counter
    return changed


def load_coverage(path: Path) -> dict[str, set[int]]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ConfigurationError(f"coverage report does not exist: {path}") from exc
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ConfigurationError(f"cannot read coverage report {path}: {exc}") from exc
    files = raw.get("files")
    if not isinstance(files, dict):
        raise ConfigurationError(f"coverage report {path} has no files object")
    executed: dict[str, set[int]] = {}
    for key, entry in files.items():
        if not isinstance(entry, dict):
            continue
        lines = entry.get("executed_lines")
        if not isinstance(lines, list):
            continue
        executed[normalize_path(key)] = {int(line) for line in lines}
    return executed


def git(repo_root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(repo_root), *args],
        text=True,
        capture_output=True,
        check=False,
    )


def collect_changed_lines(
    repo_root: Path,
    *,
    base_ref: str | None,
    worktree: bool,
    cached: bool,
) -> dict[str, set[int]]:
    modes = sum(1 for flag in (worktree, cached, base_ref is not None) if flag)
    if modes > 1:
        raise ConfigurationError("choose exactly one of --base-ref, --worktree, --cached")
    if worktree:
        args = ["diff", "--unified=0", "HEAD"]
    elif cached:
        args = ["diff", "--cached", "--unified=0"]
    else:
        args = ["diff", "--unified=0", f"{base_ref or 'origin/main'}...HEAD"]
    result = git(repo_root, *args)
    if result.returncode != 0:
        raise ConfigurationError(
            "git " + " ".join(args) + " failed: " + (result.stderr.strip() or result.stdout.strip())
        )
    return parse_diff(result.stdout)


def run(
    repo_root: Path,
    coverage_path: Path,
    *,
    base_ref: str | None,
    worktree: bool,
    cached: bool,
    standard_threshold: float,
    key_threshold: float,
) -> int:
    coverage = load_coverage(coverage_path)
    changed = collect_changed_lines(repo_root, base_ref=base_ref, worktree=worktree, cached=cached)

    if worktree:
        source_desc = "worktree vs HEAD"
    elif cached:
        source_desc = "staged (git diff --cached)"
    else:
        source_desc = f"git diff {base_ref or 'origin/main'}...HEAD"

    python_changed = {
        path: lines
        for path, lines in changed.items()
        if path.endswith(".py") and not path.startswith(("tests/", "backend/tests/"))
    }

    rows: list[tuple[str, set[int], set[int], bool]] = []
    not_measured: list[tuple[str, bool]] = []
    for path in sorted(python_changed):
        lines = python_changed[path]
        if not lines:  # 纯删除文件没有可覆盖的新侧行
            continue
        executed = coverage.get(path)
        if executed is None:
            not_measured.append((path, is_key_path(path)))
            continue
        rows.append((path, lines, executed, is_key_path(path)))

    total_changed = sum(len(lines) for _, lines, _, _ in rows)
    total_covered = sum(len(lines & executed) for _, lines, executed, _ in rows)
    aggregate = (total_covered / total_changed * 100.0) if total_changed else 100.0

    print("== changed-lines coverage gate ==")
    print(f"source: {source_desc}")
    print(f"report: {coverage_path}")
    print(f"changed python files: {len(python_changed)}  changed lines: {total_changed}")
    for path, lines, executed, key in rows:
        covered = lines & executed
        rate = len(covered) / len(lines) * 100.0
        flag = "key" if key else ""
        marker = "FAIL" if rate < (key_threshold if key else standard_threshold) else ""
        print(
            f"  {rate:6.1f}%  {len(covered):>4}/{len(lines):<4} {flag:>4} {path} {marker}"
        )
    for path, key in not_measured:
        print(f"  NO DATA  {'key' if key else '':>4} {path}  (not in coverage report)")

    failed = aggregate < standard_threshold
    key_rows = [row for row in rows if row[3]]
    key_failed = any(
        len(row[1] & row[2]) / len(row[1]) * 100.0 < key_threshold for row in key_rows
    )
    if key_failed:
        failed = True
    threshold = key_threshold if failed and key_rows else standard_threshold

    print(
        f"SUMMARY changed={total_changed} covered={total_covered} "
        f"rate={aggregate:.1f}% threshold={threshold:.1f}% "
        f"({('PASS' if not failed else 'FAIL')})"
    )
    for path, key in not_measured:
        if key:
            print(
                f"WARNING key-path file not measured: {path} "
                f"(omitted by .coveragerc; add migration tests or remove the omit)"
            )
    return 1 if failed else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="repository root (default: repo root of this script)",
    )
    parser.add_argument(
        "--coverage",
        type=Path,
        help="pytest-cov JSON report (default: <repo-root>/backend/coverage.json)",
    )
    parser.add_argument("--base-ref", help="committed diff base (default origin/main)")
    parser.add_argument("--worktree", action="store_true", help="diff uncommitted changes vs HEAD")
    parser.add_argument("--cached", action="store_true", help="diff staged changes only")
    parser.add_argument("--standard-threshold", type=float, default=STANDARD_THRESHOLD)
    parser.add_argument("--key-threshold", type=float, default=KEY_THRESHOLD)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    repo_root = args.repo_root.resolve()
    coverage_path = (
        args.coverage.resolve()
        if args.coverage is not None
        else repo_root / "backend" / "coverage.json"
    )
    try:
        return run(
            repo_root,
            coverage_path,
            base_ref=args.base_ref,
            worktree=args.worktree,
            cached=args.cached,
            standard_threshold=args.standard_threshold,
            key_threshold=args.key_threshold,
        )
    except ConfigurationError as exc:
        print(f"CONFIG ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
