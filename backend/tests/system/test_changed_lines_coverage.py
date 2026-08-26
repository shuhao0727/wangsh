from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "backend" / "scripts" / "check_changed_lines_coverage.py"


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        text=True,
        capture_output=True,
        check=False,
    )


def _init_repo(repo: Path, files: dict[str, str]) -> None:
    repo.mkdir(parents=True, exist_ok=True)
    _git(repo, "init", "-q")
    _git(repo, "config", "user.email", "coverage-gate-test@example.com")
    _git(repo, "config", "user.name", "Coverage Gate Test")
    for relative_path, content in files.items():
        path = repo / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    _git(repo, "add", ".")
    _git(repo, "commit", "-qm", "base")


def _write_coverage(repo: Path, files: dict[str, list[int]]) -> Path:
    path = repo / "backend" / "coverage.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "meta": {"format": 4},
                "files": {
                    key: {
                        "executed_lines": lines,
                        "summary": {"covered_lines": len(lines)},
                    }
                    for key, lines in files.items()
                },
            },
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    return path


def _run(repo: Path, *extra: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(repo), *extra],
        text=True,
        capture_output=True,
        check=False,
    )


def test_worktree_all_changed_lines_covered_passes(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    _init_repo(
        repo,
        {"backend/app/foo.py": "".join(f"def f{i}():\n    return {i}\n" for i in range(4))},
    )
    target = repo / "backend" / "app" / "foo.py"
    target.write_text(target.read_text(encoding="utf-8") + "def extra():\n    return 1\n", encoding="utf-8")
    coverage = _write_coverage(repo, {"app/foo.py": list(range(1, 12))})

    result = _run(repo, "--worktree", "--coverage", str(coverage))

    assert result.returncode == 0, result.stdout + result.stderr
    assert "rate=100.0%" in result.stdout, result.stdout
    assert "PASS" in result.stdout, result.stdout


def test_worktree_uncovered_changed_line_fails(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    _init_repo(
        repo,
        {"backend/app/foo.py": "".join(f"def f{i}():\n    return {i}\n" for i in range(4))},
    )
    target = repo / "backend" / "app" / "foo.py"
    target.write_text(target.read_text(encoding="utf-8") + "def extra():\n    return 1\n", encoding="utf-8")
    # executed_lines 覆盖 1-10（基础 + 第一行新增），第 11 行（新增 return）未覆盖
    coverage = _write_coverage(repo, {"app/foo.py": list(range(1, 10))})

    result = _run(repo, "--worktree", "--coverage", str(coverage))

    assert result.returncode == 1, result.stdout + result.stderr
    assert "rate=50.0%" in result.stdout, result.stdout
    assert "FAIL" in result.stdout, result.stdout


def test_key_path_low_coverage_fails(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    _init_repo(
        repo,
        {"backend/app/core/deps.py": "".join(f"def f{i}():\n    return {i}\n" for i in range(4))},
    )
    target = repo / "backend" / "app" / "core" / "deps.py"
    target.write_text(target.read_text(encoding="utf-8") + "def extra():\n    return 1\n", encoding="utf-8")
    # 整体命中率 91% 高于 85%，但关键路径 50% 低于 95% → 仍失败
    coverage = _write_coverage(repo, {"app/core/deps.py": list(range(1, 10))})

    result = _run(repo, "--worktree", "--coverage", str(coverage))

    assert result.returncode == 1, result.stdout + result.stderr
    assert "FAIL" in result.stdout, result.stdout
    assert "deps.py" in result.stdout, result.stdout


def test_base_ref_committed_diff(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    _init_repo(
        repo,
        {"backend/app/foo.py": "".join(f"def f{i}():\n    return {i}\n" for i in range(4))},
    )
    target = repo / "backend" / "app" / "foo.py"
    target.write_text(target.read_text(encoding="utf-8") + "def extra():\n    return 1\n", encoding="utf-8")
    _git(repo, "add", ".")
    _git(repo, "commit", "-qm", "add lines")
    coverage = _write_coverage(repo, {"app/foo.py": list(range(1, 12))})

    result = _run(repo, "--base-ref", "HEAD~1", "--coverage", str(coverage))

    assert result.returncode == 0, result.stdout + result.stderr
    assert "rate=100.0%" in result.stdout, result.stdout


def test_absent_file_reported_not_measured(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    _init_repo(
        repo,
        {"backend/app/foo.py": "def f():\n    return 1\n"},
    )
    target = repo / "backend" / "alembic" / "versions" / "x.py"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("def upgrade():\n    pass\n", encoding="utf-8")
    _git(repo, "add", ".")
    _git(repo, "commit", "-qm", "add migration")
    coverage = _write_coverage(repo, {})

    result = _run(repo, "--base-ref", "HEAD~1", "--coverage", str(coverage))

    assert result.returncode == 0, result.stdout + result.stderr
    assert "NO DATA" in result.stdout, result.stdout
    assert "WARNING key-path file not measured" in result.stdout, result.stdout


def test_missing_coverage_report_is_config_error(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    _init_repo(repo, {"backend/app/foo.py": "def f():\n    return 1\n"})

    result = _run(repo, "--worktree")

    assert result.returncode == 2, result.stdout + result.stderr
    assert "CONFIG ERROR" in result.stderr, result.stderr
