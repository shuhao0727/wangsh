from __future__ import annotations

import json
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "backend" / "scripts" / "check_python_governance.py"


def _write_source(repo: Path, relative_path: str, content: str) -> Path:
    path = repo / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def _write_baseline(
    repo: Path,
    *,
    file_ceilings: dict[str, object] | None = None,
    complexity_ceilings: dict[str, object] | None = None,
    source_ref: str = "test-worktree",
) -> Path:
    path = repo / "backend" / "scripts" / "python-governance-baseline.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "source_ref": source_ref,
                "file_ceilings": file_ceilings or {},
                "complexity_ceilings": complexity_ceilings or {},
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    return path


def _run(
    repo: Path,
    command: str,
    *extra: str,
    baseline: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    args = [
        sys.executable,
        str(SCRIPT),
        command,
        "--repo-root",
        str(repo),
    ]
    if baseline is not None:
        args.extend(["--baseline", str(baseline)])
    args.extend(extra)
    return subprocess.run(args, text=True, capture_output=True, check=False)


def _branching_function(decisions: int, name: str = "target") -> str:
    branches = "\n".join(f"    if value == {index}:\n        pass" for index in range(decisions))
    return f"def {name}(value):\n{branches}\n"


def _match_function(
    name: str,
    literal_cases: int,
    *,
    wildcard_guard: str | None = None,
) -> str:
    cases = "\n".join(
        f"        case {index}:\n            pass"
        for index in range(literal_cases)
    )
    wildcard = ""
    if wildcard_guard == "unguarded":
        wildcard = "\n        case _:\n            pass"
    elif wildcard_guard == "guarded":
        wildcard = "\n        case _ if value > 0:\n            pass"
    return f"def {name}(value):\n    match value:\n{cases}{wildcard}\n"


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        text=True,
        capture_output=True,
        check=True,
    )


def _commit_baseline(repo: Path) -> None:
    _git(repo, "init", "-q")
    _git(repo, "config", "user.email", "governance-test@example.com")
    _git(repo, "config", "user.name", "Governance Test")
    _git(repo, "add", ".")
    _git(repo, "commit", "-qm", "base")


def test_check_warns_for_new_file_between_501_and_700_lines(tmp_path):
    _write_source(tmp_path, "backend/app/new_module.py", "# physical line\n" * 501)
    baseline = _write_baseline(tmp_path)

    result = _run(tmp_path, "check", baseline=baseline)

    assert result.returncode == 0
    assert "WARNING file-size backend/app/new_module.py" in result.stdout
    assert "501 physical lines" in result.stdout


def test_check_blocks_new_file_over_700_lines(tmp_path):
    _write_source(tmp_path, "backend/app/new_module.py", "# physical line\n" * 701)
    baseline = _write_baseline(tmp_path)

    result = _run(tmp_path, "check", baseline=baseline)

    assert result.returncode == 1
    assert "ERROR file-size backend/app/new_module.py" in result.stdout


def test_historical_file_uses_its_own_ceiling(tmp_path):
    path = "backend/app/legacy.py"
    _write_source(tmp_path, path, "# physical line\n" * 710)
    baseline = _write_baseline(tmp_path, file_ceilings={path: {"ceiling": 710}})

    passing = _run(tmp_path, "check", baseline=baseline)
    _write_source(tmp_path, path, "# physical line\n" * 711)
    failing = _run(tmp_path, "check", baseline=baseline)

    assert passing.returncode == 0
    assert failing.returncode == 1
    assert "711 physical lines exceeds historical ceiling 710" in failing.stdout


def test_check_warns_for_new_function_complexity_13_to_15(tmp_path):
    _write_source(tmp_path, "backend/app/new_module.py", _branching_function(12))
    baseline = _write_baseline(tmp_path)

    result = _run(tmp_path, "check", baseline=baseline)

    assert result.returncode == 0
    assert "WARNING complexity backend/app/new_module.py::target" in result.stdout
    assert "complexity 13" in result.stdout


def test_check_blocks_new_function_complexity_over_15(tmp_path):
    _write_source(tmp_path, "backend/app/new_module.py", _branching_function(15))
    baseline = _write_baseline(tmp_path)

    result = _run(tmp_path, "check", baseline=baseline)

    assert result.returncode == 1
    assert "ERROR complexity backend/app/new_module.py::target" in result.stdout
    assert "complexity 16" in result.stdout


def test_historical_function_uses_its_own_ceiling(tmp_path):
    path = "backend/app/legacy.py"
    key = f"{path}::target"
    _write_source(tmp_path, path, _branching_function(16))
    baseline = _write_baseline(
        tmp_path,
        complexity_ceilings={key: {"ceiling": 17}},
    )

    passing = _run(tmp_path, "check", baseline=baseline)
    _write_source(tmp_path, path, _branching_function(17))
    failing = _run(tmp_path, "check", baseline=baseline)

    assert passing.returncode == 0
    assert failing.returncode == 1
    assert "complexity 18 exceeds historical ceiling 17" in failing.stdout


def test_outer_function_complexity_excludes_methods_of_nested_class(tmp_path):
    source = """
def outer():
    class Nested:
        def method(self, value):
            if value == 1:
                pass
            if value == 2:
                pass
            if value == 3:
                pass
            if value == 4:
                pass
            if value == 5:
                pass
            if value == 6:
                pass
            if value == 7:
                pass
            if value == 8:
                pass
            if value == 9:
                pass
            if value == 10:
                pass
            if value == 11:
                pass
            if value == 12:
                pass
    return Nested
"""
    _write_source(tmp_path, "backend/app/nested.py", source)
    baseline = _write_baseline(
        tmp_path,
        complexity_ceilings={
            "backend/app/nested.py::outer.Nested.method": {"ceiling": 13},
        },
    )

    result = _run(tmp_path, "check", baseline=baseline)

    assert result.returncode == 0
    assert "backend/app/nested.py::outer:" not in result.stdout


def test_snapshot_records_only_current_debt_and_source_ref(tmp_path):
    _write_source(tmp_path, "backend/app/large.py", "# line\n" * 501)
    _write_source(tmp_path, "backend/app/small.py", "def simple():\n    return 1\n")
    _write_source(tmp_path, "backend/app/complex.py", _branching_function(12))
    output = tmp_path / "baseline.json"

    result = _run(
        tmp_path,
        "snapshot",
        *("--output", str(output), "--source-ref", "verified-tree"),
    )

    assert result.returncode == 0
    data = json.loads(output.read_text(encoding="utf-8"))
    assert data["source_ref"] == "verified-tree"
    assert data["file_ceilings"] == {
        "backend/app/large.py": {"ceiling": 501},
    }
    assert data["complexity_ceilings"] == {
        "backend/app/complex.py::target": {"ceiling": 13},
    }


def test_snapshot_distinguishes_conditional_same_name_functions_repeatably(tmp_path):
    source = (
        "if feature_enabled:\n"
        + "    "
        + _branching_function(12, name="repeated").replace("\n", "\n    ").rstrip()
        + "\nelse:\n"
        + "    "
        + _branching_function(13, name="repeated").replace("\n", "\n    ").rstrip()
        + "\n"
    )
    _write_source(tmp_path, "backend/app/conditional.py", source)
    first = tmp_path / "first.json"
    second = tmp_path / "second.json"

    first_result = _run(
        tmp_path,
        "snapshot",
        "--output",
        str(first),
        "--source-ref",
        "verified-tree",
    )
    second_result = _run(
        tmp_path,
        "snapshot",
        "--output",
        str(second),
        "--source-ref",
        "verified-tree",
    )

    assert first_result.returncode == 0
    assert second_result.returncode == 0
    assert first.read_bytes() == second.read_bytes()
    data = json.loads(first.read_text(encoding="utf-8"))
    assert data["complexity_ceilings"] == {
        "backend/app/conditional.py::repeated#1": {"ceiling": 13},
        "backend/app/conditional.py::repeated#2": {"ceiling": 14},
    }


def test_match_only_subtracts_for_unguarded_wildcard_case(tmp_path):
    source = "\n".join(
        [
            _match_function("no_wildcard", 12),
            _match_function("unguarded_wildcard", 12, wildcard_guard="unguarded"),
            _match_function("guarded_wildcard", 11, wildcard_guard="guarded"),
        ]
    )
    _write_source(tmp_path, "backend/app/matches.py", source)
    output = tmp_path / "baseline.json"

    result = _run(
        tmp_path,
        "snapshot",
        "--output",
        str(output),
        "--source-ref",
        "verified-tree",
    )

    assert result.returncode == 0
    data = json.loads(output.read_text(encoding="utf-8"))
    assert data["complexity_ceilings"] == {
        "backend/app/matches.py::guarded_wildcard": {"ceiling": 14},
        "backend/app/matches.py::no_wildcard": {"ceiling": 13},
        "backend/app/matches.py::unguarded_wildcard": {"ceiling": 13},
    }


def test_report_describes_errors_without_returning_gate_failure(tmp_path):
    _write_source(tmp_path, "backend/app/new_module.py", "# line\n" * 701)
    baseline = _write_baseline(tmp_path)

    result = _run(tmp_path, "report", baseline=baseline)

    assert result.returncode == 0
    assert "ERROR file-size backend/app/new_module.py" in result.stdout
    assert "SUMMARY errors=1 warnings=0" in result.stdout


def test_invalid_baseline_json_is_configuration_error(tmp_path):
    _write_source(tmp_path, "backend/app/module.py", "pass\n")
    baseline = tmp_path / "baseline.json"
    baseline.write_text("{not-json", encoding="utf-8")

    result = _run(tmp_path, "check", baseline=baseline)

    assert result.returncode == 2
    assert "CONFIG ERROR" in result.stderr


def test_exception_requires_owner_reason_and_expires_at(tmp_path):
    path = "backend/app/legacy.py"
    _write_source(tmp_path, path, "# line\n" * 501)
    baseline = _write_baseline(
        tmp_path,
        file_ceilings={
            path: {
                "ceiling": 501,
                "exception": {
                    "owner": "backend",
                    "expires_at": (date.today() + timedelta(days=30)).isoformat(),
                },
            }
        },
    )

    result = _run(tmp_path, "check", baseline=baseline)

    assert result.returncode == 2
    assert "exception requires owner, reason, expires_at" in result.stderr


def test_exception_cannot_expire_more_than_30_days_from_today(tmp_path):
    path = "backend/app/legacy.py"
    _write_source(tmp_path, path, "# line\n" * 501)
    baseline = _write_baseline(
        tmp_path,
        file_ceilings={
            path: {
                "ceiling": 501,
                "exception": {
                    "owner": "backend",
                    "reason": "temporary compatibility window",
                    "expires_at": (date.today() + timedelta(days=31)).isoformat(),
                },
            }
        },
    )

    result = _run(tmp_path, "check", baseline=baseline)

    assert result.returncode == 2
    assert "exception cannot exceed 30 days" in result.stderr


def test_exception_may_expire_exactly_30_days_from_today(tmp_path):
    path = "backend/app/legacy.py"
    _write_source(tmp_path, path, "# line\n" * 501)
    baseline = _write_baseline(
        tmp_path,
        file_ceilings={
            path: {
                "ceiling": 501,
                "exception": {
                    "owner": "backend",
                    "reason": "temporary compatibility window",
                    "expires_at": (date.today() + timedelta(days=30)).isoformat(),
                },
            }
        },
    )

    result = _run(tmp_path, "check", baseline=baseline)

    assert result.returncode == 0


def test_base_ref_rejects_ceiling_increase(tmp_path):
    path = "backend/app/legacy.py"
    _write_source(tmp_path, path, "# line\n" * 710)
    baseline = _write_baseline(tmp_path, file_ceilings={path: {"ceiling": 710}})
    _commit_baseline(tmp_path)
    _write_baseline(tmp_path, file_ceilings={path: {"ceiling": 711}})

    result = _run(tmp_path, "check", "--base-ref", "HEAD", baseline=baseline)

    assert result.returncode == 1
    assert "baseline ceiling increase" in result.stdout


def test_base_ref_rejects_file_metric_regression_below_historical_ceiling(tmp_path):
    path = "backend/app/legacy.py"
    _write_source(tmp_path, path, "# line\n" * 650)
    _commit_baseline(tmp_path)
    _write_source(tmp_path, path, "# line\n" * 680)
    baseline = _write_baseline(tmp_path, file_ceilings={path: {"ceiling": 710}})

    result = _run(tmp_path, "check", "--base-ref", "HEAD", baseline=baseline)

    assert result.returncode == 1
    assert "file-size metric regression 650 -> 680" in result.stdout


def test_base_ref_rejects_complexity_metric_regression_below_historical_ceiling(tmp_path):
    path = "backend/app/legacy.py"
    key = f"{path}::target"
    _write_source(tmp_path, path, _branching_function(12))
    _commit_baseline(tmp_path)
    _write_source(tmp_path, path, _branching_function(13))
    baseline = _write_baseline(tmp_path, complexity_ceilings={key: {"ceiling": 20}})

    result = _run(tmp_path, "check", "--base-ref", "HEAD", baseline=baseline)

    assert result.returncode == 1
    assert "complexity metric regression 13 -> 14" in result.stdout


def test_base_ref_allows_controlled_metric_regression_with_active_exception(tmp_path):
    path = "backend/app/legacy.py"
    _write_source(tmp_path, path, "# line\n" * 650)
    _commit_baseline(tmp_path)
    _write_source(tmp_path, path, "# line\n" * 680)
    baseline = _write_baseline(
        tmp_path,
        file_ceilings={
            path: {
                "ceiling": 710,
                "exception": {
                    "owner": "backend",
                    "reason": "temporary cleanup window",
                    "expires_at": (date.today() + timedelta(days=7)).isoformat(),
                },
            }
        },
    )

    result = _run(tmp_path, "check", "--base-ref", "HEAD", baseline=baseline)

    assert result.returncode == 0


def test_base_ref_rejects_extending_an_existing_exception(tmp_path):
    path = "backend/app/legacy.py"
    _write_source(tmp_path, path, "# line\n" * 650)
    baseline = _write_baseline(
        tmp_path,
        file_ceilings={
            path: {
                "ceiling": 710,
                "exception": {
                    "owner": "backend",
                    "reason": "temporary cleanup window",
                    "expires_at": (date.today() + timedelta(days=7)).isoformat(),
                },
            }
        },
    )
    _commit_baseline(tmp_path)
    _write_baseline(
        tmp_path,
        file_ceilings={
            path: {
                "ceiling": 710,
                "exception": {
                    "owner": "backend",
                    "reason": "temporary cleanup window",
                    "expires_at": (date.today() + timedelta(days=14)).isoformat(),
                },
            }
        },
    )

    result = _run(tmp_path, "check", "--base-ref", "HEAD", baseline=baseline)

    assert result.returncode == 1
    assert "exception expiry extension" in result.stdout


def test_active_exception_does_not_allow_metric_above_current_ceiling(tmp_path):
    path = "backend/app/legacy.py"
    _write_source(tmp_path, path, "# line\n" * 650)
    _commit_baseline(tmp_path)
    _write_source(tmp_path, path, "# line\n" * 711)
    baseline = _write_baseline(
        tmp_path,
        file_ceilings={
            path: {
                "ceiling": 710,
                "exception": {
                    "owner": "backend",
                    "reason": "temporary cleanup window",
                    "expires_at": (date.today() + timedelta(days=7)).isoformat(),
                },
            }
        },
    )

    result = _run(tmp_path, "check", "--base-ref", "HEAD", baseline=baseline)

    assert result.returncode == 1
    assert "exceeds historical ceiling 710" in result.stdout


def test_base_ref_without_base_baseline_rejects_debt_not_present_in_base_source(tmp_path):
    path = "backend/app/legacy.py"
    _write_source(tmp_path, path, "# line\n" * 500)
    _commit_baseline(tmp_path)
    _write_source(tmp_path, path, "# line\n" * 501)
    baseline = _write_baseline(tmp_path, file_ceilings={path: {"ceiling": 501}})

    result = _run(tmp_path, "check", "--base-ref", "HEAD", baseline=baseline)

    assert result.returncode == 1
    assert "new baseline debt was not present in base source" in result.stdout


def test_base_ref_without_base_baseline_allows_new_debt_with_active_exception(tmp_path):
    path = "backend/app/legacy.py"
    _write_source(tmp_path, path, "# line\n" * 500)
    _commit_baseline(tmp_path)
    _write_source(tmp_path, path, "# line\n" * 501)
    baseline = _write_baseline(
        tmp_path,
        file_ceilings={
            path: {
                "ceiling": 501,
                "exception": {
                    "owner": "project-governance",
                    "reason": "first baseline transition",
                    "expires_at": (date.today() + timedelta(days=30)).isoformat(),
                },
            }
        },
    )

    result = _run(tmp_path, "check", "--base-ref", "HEAD", baseline=baseline)

    assert result.returncode == 0


def test_base_ref_without_base_baseline_accepts_first_baseline_for_existing_debt(tmp_path):
    path = "backend/app/legacy.py"
    _write_source(tmp_path, path, "# line\n" * 501)
    _commit_baseline(tmp_path)
    baseline = _write_baseline(tmp_path, file_ceilings={path: {"ceiling": 501}})

    result = _run(tmp_path, "check", "--base-ref", "HEAD", baseline=baseline)

    assert result.returncode == 0


def test_base_ref_rejects_deleting_debt_entry_that_still_exists(tmp_path):
    path = "backend/app/legacy.py"
    _write_source(tmp_path, path, "# line\n" * 710)
    baseline = _write_baseline(tmp_path, file_ceilings={path: {"ceiling": 710}})
    _commit_baseline(tmp_path)
    _write_baseline(tmp_path)

    result = _run(tmp_path, "check", "--base-ref", "HEAD", baseline=baseline)

    assert result.returncode == 1
    assert "removed baseline debt still exists" in result.stdout


def test_base_ref_rejects_ceiling_transfer_without_moved_from(tmp_path):
    old_path = "backend/app/old.py"
    new_path = "backend/app/new.py"
    _write_source(tmp_path, old_path, "# line\n" * 710)
    baseline = _write_baseline(tmp_path, file_ceilings={old_path: {"ceiling": 710}})
    _commit_baseline(tmp_path)
    (tmp_path / old_path).unlink()
    _write_source(tmp_path, new_path, "# line\n" * 710)
    _write_baseline(tmp_path, file_ceilings={new_path: {"ceiling": 710}})

    result = _run(tmp_path, "check", "--base-ref", "HEAD", baseline=baseline)

    assert result.returncode == 1
    assert "new baseline debt requires moved_from" in result.stdout


def test_base_ref_allows_non_increasing_ceiling_transfer_with_moved_from(tmp_path):
    old_path = "backend/app/old.py"
    new_path = "backend/app/new.py"
    _write_source(tmp_path, old_path, "# line\n" * 710)
    baseline = _write_baseline(tmp_path, file_ceilings={old_path: {"ceiling": 710}})
    _commit_baseline(tmp_path)
    (tmp_path / old_path).unlink()
    _write_source(tmp_path, new_path, "# line\n" * 705)
    _write_baseline(
        tmp_path,
        file_ceilings={
            new_path: {
                "ceiling": 705,
                "moved_from": old_path,
            }
        },
    )

    result = _run(tmp_path, "check", "--base-ref", "HEAD", baseline=baseline)

    assert result.returncode == 0
    assert "errors=0" in result.stdout


def test_base_ref_rejects_transfer_when_original_debt_still_exists(tmp_path):
    old_path = "backend/app/old.py"
    new_path = "backend/app/new.py"
    _write_source(tmp_path, old_path, "# line\n" * 510)
    baseline = _write_baseline(tmp_path, file_ceilings={old_path: {"ceiling": 510}})
    _commit_baseline(tmp_path)
    _write_source(tmp_path, new_path, "# line\n" * 505)
    _write_baseline(
        tmp_path,
        file_ceilings={
            new_path: {
                "ceiling": 505,
                "moved_from": old_path,
            }
        },
    )

    result = _run(tmp_path, "check", "--base-ref", "HEAD", baseline=baseline)

    assert result.returncode == 1
    assert "moved_from debt still exists in the worktree" in result.stdout


def test_base_ref_rejects_reusing_one_moved_from_for_multiple_entries(tmp_path):
    old_path = "backend/app/old.py"
    first_path = "backend/app/first.py"
    second_path = "backend/app/second.py"
    _write_source(tmp_path, old_path, "# line\n" * 710)
    baseline = _write_baseline(tmp_path, file_ceilings={old_path: {"ceiling": 710}})
    _commit_baseline(tmp_path)
    (tmp_path / old_path).unlink()
    _write_source(tmp_path, first_path, "# line\n" * 705)
    _write_source(tmp_path, second_path, "# line\n" * 700)
    _write_baseline(
        tmp_path,
        file_ceilings={
            first_path: {
                "ceiling": 705,
                "moved_from": old_path,
            },
            second_path: {
                "ceiling": 700,
                "moved_from": old_path,
            },
        },
    )

    result = _run(tmp_path, "check", "--base-ref", "HEAD", baseline=baseline)

    assert result.returncode == 1
    assert "moved_from must be one-to-one" in result.stdout
