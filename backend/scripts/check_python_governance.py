#!/usr/bin/env python3
"""Ratchet Python file size and cyclomatic complexity without third-party tools."""

from __future__ import annotations

import argparse
import ast
import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Iterable


SCHEMA_VERSION = 1
FILE_WARNING_MIN = 501
FILE_ERROR_MIN = 701
COMPLEXITY_WARNING_MIN = 13
COMPLEXITY_ERROR_MIN = 16


class ConfigurationError(RuntimeError):
    """Raised when source or baseline configuration cannot be checked safely."""


@dataclass(frozen=True)
class CeilingEntry:
    ceiling: int
    moved_from: str | None = None
    exception: dict[str, str] | None = None


@dataclass(frozen=True)
class Baseline:
    source_ref: str
    file_ceilings: dict[str, CeilingEntry]
    complexity_ceilings: dict[str, CeilingEntry]


@dataclass(frozen=True)
class FunctionMetric:
    key: str
    complexity: int
    line: int


@dataclass(frozen=True)
class ScanResult:
    files: dict[str, int]
    functions: dict[str, FunctionMetric]


@dataclass(frozen=True)
class Finding:
    severity: str
    category: str
    location: str
    message: str

    def render(self) -> str:
        return f"{self.severity} {self.category} {self.location}: {self.message}"


class ComplexityVisitor(ast.NodeVisitor):
    """Compute a deterministic McCabe-style score for one function body."""

    def __init__(self) -> None:
        self.score = 1

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        return

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        return

    def visit_Lambda(self, node: ast.Lambda) -> None:
        return

    def visit_If(self, node: ast.If) -> None:
        self.score += 1
        self.generic_visit(node)

    def visit_IfExp(self, node: ast.IfExp) -> None:
        self.score += 1
        self.generic_visit(node)

    def visit_For(self, node: ast.For) -> None:
        self.score += 1
        self.generic_visit(node)

    def visit_AsyncFor(self, node: ast.AsyncFor) -> None:
        self.score += 1
        self.generic_visit(node)

    def visit_While(self, node: ast.While) -> None:
        self.score += 1
        self.generic_visit(node)

    def visit_ExceptHandler(self, node: ast.ExceptHandler) -> None:
        self.score += 1
        self.generic_visit(node)

    def visit_BoolOp(self, node: ast.BoolOp) -> None:
        self.score += max(0, len(node.values) - 1)
        self.generic_visit(node)

    def visit_Assert(self, node: ast.Assert) -> None:
        self.score += 1
        self.generic_visit(node)

    def visit_comprehension(self, node: ast.comprehension) -> None:
        self.score += 1 + len(node.ifs)
        self.generic_visit(node)

    def visit_Match(self, node: ast.Match) -> None:
        has_unguarded_wildcard = any(
            case.guard is None
            and isinstance(case.pattern, ast.MatchAs)
            and case.pattern.pattern is None
            and case.pattern.name is None
            for case in node.cases
        )
        self.score += len(node.cases) - int(has_unguarded_wildcard)
        self.score += sum(1 for case in node.cases if case.guard is not None)
        self.generic_visit(node)


class FunctionCollector(ast.NodeVisitor):
    def __init__(self, relative_path: str) -> None:
        self.relative_path = relative_path
        self.scope: list[str] = []
        self._metrics: list[FunctionMetric] = []

    def _visit_function(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        qualified_name = ".".join([*self.scope, node.name])
        key = f"{self.relative_path}::{qualified_name}"
        complexity = function_complexity(node)
        self._metrics.append(FunctionMetric(key=key, complexity=complexity, line=node.lineno))
        self.scope.append(node.name)
        for child in node.body:
            self.visit(child)
        self.scope.pop()

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._visit_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self._visit_function(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        self.scope.append(node.name)
        for child in node.body:
            self.visit(child)
        self.scope.pop()

    @property
    def metrics(self) -> dict[str, FunctionMetric]:
        totals: dict[str, int] = {}
        for metric in self._metrics:
            totals[metric.key] = totals.get(metric.key, 0) + 1

        occurrences: dict[str, int] = {}
        metrics: dict[str, FunctionMetric] = {}
        for metric in self._metrics:
            key = metric.key
            if totals[key] > 1:
                occurrences[key] = occurrences.get(key, 0) + 1
                key = f"{key}#{occurrences[key]}"
            metrics[key] = FunctionMetric(
                key=key,
                complexity=metric.complexity,
                line=metric.line,
            )
        return metrics


def function_complexity(node: ast.FunctionDef | ast.AsyncFunctionDef) -> int:
    visitor = ComplexityVisitor()
    for statement in node.body:
        visitor.visit(statement)
    return visitor.score


def scan_python(repo_root: Path) -> ScanResult:
    app_root = repo_root / "backend" / "app"
    if not app_root.is_dir():
        raise ConfigurationError(f"scan root does not exist: {app_root}")

    sources: list[tuple[str, str]] = []
    for path in sorted(app_root.rglob("*.py")):
        if not path.is_file():
            continue
        relative_path = path.relative_to(repo_root).as_posix()
        try:
            source = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            raise ConfigurationError(f"cannot read {relative_path}: {exc}") from exc
        sources.append((relative_path, source))
    return scan_python_sources(sources)


def scan_python_sources(sources: Iterable[tuple[str, str]]) -> ScanResult:
    files: dict[str, int] = {}
    functions: dict[str, FunctionMetric] = {}
    for relative_path, source in sources:
        files[relative_path] = len(source.splitlines())
        try:
            tree = ast.parse(source, filename=relative_path)
        except SyntaxError as exc:
            raise ConfigurationError(
                f"cannot parse {relative_path}:{exc.lineno}: {exc.msg}"
            ) from exc
        collector = FunctionCollector(relative_path)
        collector.visit(tree)
        functions.update(collector.metrics)
    return ScanResult(files=files, functions=functions)


def _load_entry(raw: object, *, key: str, kind: str) -> CeilingEntry:
    if not isinstance(raw, dict):
        raise ConfigurationError(f"{kind} entry {key!r} must be an object")
    unknown = set(raw) - {"ceiling", "moved_from", "exception"}
    if unknown:
        raise ConfigurationError(f"{kind} entry {key!r} has unknown fields: {sorted(unknown)}")

    ceiling = raw.get("ceiling")
    if isinstance(ceiling, bool) or not isinstance(ceiling, int) or ceiling < 1:
        raise ConfigurationError(f"{kind} entry {key!r} ceiling must be a positive integer")

    moved_from = raw.get("moved_from")
    if moved_from is not None and (not isinstance(moved_from, str) or not moved_from.strip()):
        raise ConfigurationError(f"{kind} entry {key!r} moved_from must be a non-empty string")

    exception = raw.get("exception")
    normalized_exception: dict[str, str] | None = None
    if exception is not None:
        if not isinstance(exception, dict):
            raise ConfigurationError(f"{kind} entry {key!r} exception must be an object")
        required = {"owner", "reason", "expires_at"}
        if set(exception) != required or any(
            not isinstance(exception.get(field), str) or not exception[field].strip()
            for field in required
        ):
            raise ConfigurationError(
                f"{kind} entry {key!r} exception requires owner, reason, expires_at"
            )
        try:
            expires_at = date.fromisoformat(exception["expires_at"])
        except ValueError as exc:
            raise ConfigurationError(
                f"{kind} entry {key!r} expires_at must use YYYY-MM-DD"
            ) from exc
        if expires_at > date.today() + timedelta(days=30):
            raise ConfigurationError(
                f"{kind} entry {key!r} exception cannot exceed 30 days"
            )
        normalized_exception = {field: exception[field] for field in sorted(required)}

    return CeilingEntry(
        ceiling=ceiling,
        moved_from=moved_from,
        exception=normalized_exception,
    )


def parse_baseline(raw: object, *, source: str) -> Baseline:
    if not isinstance(raw, dict):
        raise ConfigurationError(f"baseline {source} must be a JSON object")
    expected = {"schema_version", "source_ref", "file_ceilings", "complexity_ceilings"}
    unknown = set(raw) - expected
    missing = expected - set(raw)
    if missing or unknown:
        raise ConfigurationError(
            f"baseline {source} fields invalid; missing={sorted(missing)} unknown={sorted(unknown)}"
        )
    if raw["schema_version"] != SCHEMA_VERSION:
        raise ConfigurationError(
            f"baseline {source} schema_version must be {SCHEMA_VERSION}"
        )
    source_ref = raw["source_ref"]
    if not isinstance(source_ref, str) or not source_ref.strip():
        raise ConfigurationError(f"baseline {source} source_ref must be a non-empty string")

    collections: dict[str, dict[str, CeilingEntry]] = {}
    for field in ("file_ceilings", "complexity_ceilings"):
        raw_entries = raw[field]
        if not isinstance(raw_entries, dict):
            raise ConfigurationError(f"baseline {source} {field} must be an object")
        parsed_entries: dict[str, CeilingEntry] = {}
        for key, value in raw_entries.items():
            if not isinstance(key, str) or not key:
                raise ConfigurationError(f"baseline {source} {field} keys must be strings")
            if field == "file_ceilings" and not key.startswith("backend/app/"):
                raise ConfigurationError(f"file ceiling path is outside backend/app: {key}")
            if field == "complexity_ceilings" and (
                not key.startswith("backend/app/") or "::" not in key
            ):
                raise ConfigurationError(f"invalid complexity ceiling key: {key}")
            parsed_entries[key] = _load_entry(value, key=key, kind=field)
        collections[field] = parsed_entries

    return Baseline(
        source_ref=source_ref,
        file_ceilings=collections["file_ceilings"],
        complexity_ceilings=collections["complexity_ceilings"],
    )


def load_baseline(path: Path) -> Baseline:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ConfigurationError(f"baseline does not exist: {path}") from exc
    except (OSError, UnicodeError) as exc:
        raise ConfigurationError(f"cannot read baseline {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise ConfigurationError(
            f"invalid JSON in baseline {path}:{exc.lineno}:{exc.colno}: {exc.msg}"
        ) from exc
    return parse_baseline(raw, source=str(path))


def _expired_exception_findings(baseline: Baseline) -> list[Finding]:
    findings: list[Finding] = []
    today = date.today()
    for category, entries in (
        ("file-size", baseline.file_ceilings),
        ("complexity", baseline.complexity_ceilings),
    ):
        for key, entry in entries.items():
            if entry.exception is None:
                continue
            expires_at = date.fromisoformat(entry.exception["expires_at"])
            if expires_at < today:
                findings.append(
                    Finding(
                        "ERROR",
                        "baseline",
                        key,
                        f"{category} exception expired on {expires_at.isoformat()}",
                    )
                )
    return findings


def evaluate_scan(scan: ScanResult, baseline: Baseline) -> list[Finding]:
    findings = _expired_exception_findings(baseline)
    for path, physical_lines in scan.files.items():
        entry = baseline.file_ceilings.get(path)
        if entry is not None:
            if physical_lines > entry.ceiling:
                findings.append(
                    Finding(
                        "ERROR",
                        "file-size",
                        path,
                        f"{physical_lines} physical lines exceeds historical ceiling {entry.ceiling}",
                    )
                )
        elif physical_lines >= FILE_ERROR_MIN:
            findings.append(
                Finding(
                    "ERROR",
                    "file-size",
                    path,
                    f"{physical_lines} physical lines exceeds new-file limit 700",
                )
            )
        elif physical_lines >= FILE_WARNING_MIN:
            findings.append(
                Finding(
                    "WARNING",
                    "file-size",
                    path,
                    f"{physical_lines} physical lines is within warning range 501-700",
                )
            )

    for key, metric in scan.functions.items():
        entry = baseline.complexity_ceilings.get(key)
        if entry is not None:
            if metric.complexity > entry.ceiling:
                findings.append(
                    Finding(
                        "ERROR",
                        "complexity",
                        key,
                        f"complexity {metric.complexity} exceeds historical ceiling {entry.ceiling}",
                    )
                )
        elif metric.complexity >= COMPLEXITY_ERROR_MIN:
            findings.append(
                Finding(
                    "ERROR",
                    "complexity",
                    key,
                    f"complexity {metric.complexity} exceeds new-function limit 15",
                )
            )
        elif metric.complexity >= COMPLEXITY_WARNING_MIN:
            findings.append(
                Finding(
                    "WARNING",
                    "complexity",
                    key,
                    f"complexity {metric.complexity} is within warning range 13-15",
                )
            )
    return findings


def _git(repo_root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(repo_root), *args],
        text=True,
        capture_output=True,
        check=False,
    )


def load_base_baseline(
    repo_root: Path,
    baseline_path: Path,
    base_ref: str,
) -> Baseline | None:
    revision = _git(repo_root, "rev-parse", "--verify", f"{base_ref}^{{commit}}")
    if revision.returncode != 0:
        raise ConfigurationError(
            f"invalid --base-ref {base_ref!r}: {revision.stderr.strip() or revision.stdout.strip()}"
        )
    try:
        relative_path = baseline_path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError as exc:
        raise ConfigurationError("--base-ref requires --baseline to be inside --repo-root") from exc

    result = _git(repo_root, "show", f"{base_ref}:{relative_path}")
    if result.returncode != 0:
        return None
    try:
        raw = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise ConfigurationError(
            f"invalid JSON in {base_ref}:{relative_path}:{exc.lineno}:{exc.colno}: {exc.msg}"
        ) from exc
    return parse_baseline(raw, source=f"{base_ref}:{relative_path}")


def scan_python_revision(repo_root: Path, base_ref: str) -> ScanResult:
    listing = _git(repo_root, "ls-tree", "-r", "--name-only", base_ref, "--", "backend/app")
    if listing.returncode != 0:
        raise ConfigurationError(
            f"cannot list Python sources in {base_ref}: "
            f"{listing.stderr.strip() or listing.stdout.strip()}"
        )

    sources: list[tuple[str, str]] = []
    for relative_path in listing.stdout.splitlines():
        if not relative_path.endswith(".py"):
            continue
        result = _git(repo_root, "show", f"{base_ref}:{relative_path}")
        if result.returncode != 0:
            raise ConfigurationError(
                f"cannot read {base_ref}:{relative_path}: "
                f"{result.stderr.strip() or result.stdout.strip()}"
            )
        sources.append((relative_path, result.stdout))
    return scan_python_sources(sources)


def _debt_still_exists(
    *,
    kind: str,
    key: str,
    scan: ScanResult,
) -> bool:
    if kind == "file-size":
        return scan.files.get(key, 0) >= FILE_WARNING_MIN
    metric = scan.functions.get(key)
    return metric is not None and metric.complexity >= COMPLEXITY_WARNING_MIN


def _has_active_exception(entry: CeilingEntry | None) -> bool:
    if entry is None or entry.exception is None:
        return False
    expires_at = date.fromisoformat(entry.exception["expires_at"])
    return expires_at >= date.today()


def _active_exception_allows_regression(
    entry: CeilingEntry | None,
    current_metric: int,
) -> bool:
    return (
        _has_active_exception(entry)
        and entry is not None
        and current_metric <= entry.ceiling
    )


def _compare_metric_regressions(
    *,
    kind: str,
    current: dict[str, int],
    base: dict[str, int],
    baseline: dict[str, CeilingEntry],
) -> list[Finding]:
    threshold = FILE_WARNING_MIN if kind == "file-size" else COMPLEXITY_WARNING_MIN
    findings: list[Finding] = []
    for key in sorted(set(current) & set(base)):
        base_metric = base[key]
        current_metric = current[key]
        if base_metric < threshold or current_metric <= base_metric:
            continue
        if _active_exception_allows_regression(baseline.get(key), current_metric):
            continue
        findings.append(
            Finding(
                "ERROR",
                "baseline",
                key,
                f"{kind} metric regression {base_metric} -> {current_metric}",
            )
        )
    return findings


def _compare_first_baseline_entries(
    *,
    kind: str,
    current: dict[str, CeilingEntry],
    base: dict[str, int],
) -> list[Finding]:
    threshold = FILE_WARNING_MIN if kind == "file-size" else COMPLEXITY_WARNING_MIN
    findings: list[Finding] = []
    for key, entry in sorted(current.items()):
        if base.get(key, 0) < threshold and not _has_active_exception(entry):
            findings.append(
                Finding(
                    "ERROR",
                    "baseline",
                    key,
                    "new baseline debt was not present in base source",
                )
            )
    return findings


def _compare_ceiling_collection(
    *,
    kind: str,
    current: dict[str, CeilingEntry],
    base: dict[str, CeilingEntry],
    scan: ScanResult,
) -> list[Finding]:
    findings: list[Finding] = []
    moved_destinations: dict[str, list[str]] = {}
    for key, entry in current.items():
        if key not in base and entry.moved_from is not None:
            moved_destinations.setdefault(entry.moved_from, []).append(key)
    for source, destinations in sorted(moved_destinations.items()):
        if len(destinations) > 1:
            findings.append(
                Finding(
                    "ERROR",
                    "baseline",
                    source,
                    "moved_from must be one-to-one; reused by "
                    + ", ".join(sorted(destinations)),
                )
            )
    moved_sources = {
        source
        for source in moved_destinations
    }

    for key in sorted(set(current) & set(base)):
        if current[key].ceiling > base[key].ceiling:
            findings.append(
                Finding(
                    "ERROR",
                    "baseline",
                    key,
                    f"baseline ceiling increase {base[key].ceiling} -> {current[key].ceiling}",
                )
            )
        current_exception = current[key].exception
        base_exception = base[key].exception
        if current_exception is not None and base_exception is not None:
            current_expiry = date.fromisoformat(current_exception["expires_at"])
            base_expiry = date.fromisoformat(base_exception["expires_at"])
            if current_expiry > base_expiry:
                findings.append(
                    Finding(
                        "ERROR",
                        "baseline",
                        key,
                        "exception expiry extension "
                        f"{base_exception['expires_at']} -> "
                        f"{current_exception['expires_at']}",
                    )
                )

    for key in sorted(set(current) - set(base)):
        entry = current[key]
        if entry.moved_from is None:
            findings.append(
                Finding(
                    "ERROR",
                    "baseline",
                    key,
                    "new baseline debt requires moved_from",
                )
            )
            continue
        old_entry = base.get(entry.moved_from)
        if old_entry is None:
            findings.append(
                Finding(
                    "ERROR",
                    "baseline",
                    key,
                    f"moved_from does not reference base {kind} debt: {entry.moved_from}",
                )
            )
            continue
        if entry.moved_from in current:
            findings.append(
                Finding(
                    "ERROR",
                    "baseline",
                    key,
                    f"moved_from entry still exists in current baseline: {entry.moved_from}",
                )
            )
        if _debt_still_exists(kind=kind, key=entry.moved_from, scan=scan):
            findings.append(
                Finding(
                    "ERROR",
                    "baseline",
                    key,
                    f"moved_from debt still exists in the worktree: {entry.moved_from}",
                )
            )
        if entry.ceiling > old_entry.ceiling:
            findings.append(
                Finding(
                    "ERROR",
                    "baseline",
                    key,
                    f"transferred ceiling increase {old_entry.ceiling} -> {entry.ceiling}",
                )
            )

    for key in sorted(set(base) - set(current)):
        if key in moved_sources:
            continue
        if _debt_still_exists(kind=kind, key=key, scan=scan):
            findings.append(
                Finding(
                    "ERROR",
                    "baseline",
                    key,
                    "removed baseline debt still exists in the worktree",
                )
            )
    return findings


def compare_with_base(
    current: Baseline,
    base: Baseline,
    scan: ScanResult,
    base_scan: ScanResult,
) -> list[Finding]:
    return [
        *_compare_metric_regressions(
            kind="file-size",
            current=scan.files,
            base=base_scan.files,
            baseline=current.file_ceilings,
        ),
        *_compare_metric_regressions(
            kind="complexity",
            current={
                key: metric.complexity for key, metric in scan.functions.items()
            },
            base={
                key: metric.complexity for key, metric in base_scan.functions.items()
            },
            baseline=current.complexity_ceilings,
        ),
        *_compare_ceiling_collection(
            kind="file-size",
            current=current.file_ceilings,
            base=base.file_ceilings,
            scan=scan,
        ),
        *_compare_ceiling_collection(
            kind="complexity",
            current=current.complexity_ceilings,
            base=base.complexity_ceilings,
            scan=scan,
        ),
    ]


def compare_first_baseline(
    current: Baseline,
    base_scan: ScanResult,
    scan: ScanResult,
) -> list[Finding]:
    return [
        *_compare_first_baseline_entries(
            kind="file-size",
            current=current.file_ceilings,
            base=base_scan.files,
        ),
        *_compare_first_baseline_entries(
            kind="complexity",
            current=current.complexity_ceilings,
            base={
                key: metric.complexity for key, metric in base_scan.functions.items()
            },
        ),
        *_compare_metric_regressions(
            kind="file-size",
            current=scan.files,
            base=base_scan.files,
            baseline=current.file_ceilings,
        ),
        *_compare_metric_regressions(
            kind="complexity",
            current={
                key: metric.complexity for key, metric in scan.functions.items()
            },
            base={
                key: metric.complexity for key, metric in base_scan.functions.items()
            },
            baseline=current.complexity_ceilings,
        ),
    ]


def baseline_snapshot(scan: ScanResult, source_ref: str) -> dict[str, object]:
    return {
        "schema_version": SCHEMA_VERSION,
        "source_ref": source_ref,
        "file_ceilings": {
            path: {"ceiling": physical_lines}
            for path, physical_lines in sorted(scan.files.items())
            if physical_lines >= FILE_WARNING_MIN
        },
        "complexity_ceilings": {
            key: {"ceiling": metric.complexity}
            for key, metric in sorted(scan.functions.items())
            if metric.complexity >= COMPLEXITY_WARNING_MIN
        },
    }


def _print_report(findings: Iterable[Finding], scan: ScanResult) -> tuple[int, int]:
    ordered = sorted(findings, key=lambda item: (item.severity != "ERROR", item.category, item.location))
    for finding in ordered:
        print(finding.render())
    errors = sum(finding.severity == "ERROR" for finding in ordered)
    warnings = sum(finding.severity == "WARNING" for finding in ordered)
    print(
        f"SUMMARY errors={errors} warnings={warnings} "
        f"files={len(scan.files)} functions={len(scan.functions)}"
    )
    return errors, warnings


def _add_common_arguments(parser: argparse.ArgumentParser) -> None:
    default_repo_root = Path(__file__).resolve().parents[2]
    parser.add_argument("--repo-root", type=Path, default=default_repo_root)
    parser.add_argument("--baseline", type=Path)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    check = subparsers.add_parser("check", help="enforce governance and return 1 on errors")
    _add_common_arguments(check)
    check.add_argument("--base-ref", help="compare baseline against the Git base revision")

    report = subparsers.add_parser("report", help="print findings without gate failure")
    _add_common_arguments(report)
    report.add_argument("--base-ref", help="compare baseline against the Git base revision")

    snapshot = subparsers.add_parser("snapshot", help="write current debt ceilings")
    snapshot.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
    )
    snapshot.add_argument("--output", type=Path)
    snapshot.add_argument("--source-ref", required=True)
    return parser


def _resolve_baseline_path(repo_root: Path, path: Path | None) -> Path:
    if path is not None:
        return path.resolve()
    return repo_root / "backend" / "scripts" / "python-governance-baseline.json"


def run(args: argparse.Namespace) -> int:
    repo_root = args.repo_root.resolve()
    scan = scan_python(repo_root)

    if args.command == "snapshot":
        output = (
            args.output.resolve()
            if args.output is not None
            else repo_root / "backend" / "scripts" / "python-governance-baseline.json"
        )
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            json.dumps(
                baseline_snapshot(scan, args.source_ref),
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )
        print(
            f"SNAPSHOT {output} files={len(scan.files)} functions={len(scan.functions)} "
            f"source_ref={args.source_ref}"
        )
        return 0

    baseline_path = _resolve_baseline_path(repo_root, args.baseline)
    baseline = load_baseline(baseline_path)
    findings = evaluate_scan(scan, baseline)
    if args.base_ref:
        base_scan = scan_python_revision(repo_root, args.base_ref)
        base_baseline = load_base_baseline(repo_root, baseline_path, args.base_ref)
        if base_baseline is not None:
            findings.extend(compare_with_base(baseline, base_baseline, scan, base_scan))
        else:
            findings.extend(compare_first_baseline(baseline, base_scan, scan))
    errors, _warnings = _print_report(findings, scan)
    if args.command == "report":
        return 0
    return 1 if errors else 0


def main() -> int:
    parser = build_parser()
    try:
        return run(parser.parse_args())
    except ConfigurationError as exc:
        print(f"CONFIG ERROR: {exc}", file=sys.stderr)
        return 2
    except OSError as exc:
        print(f"CONFIG ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
