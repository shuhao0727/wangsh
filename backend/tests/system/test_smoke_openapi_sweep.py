import importlib.util
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[2] / "scripts" / "smoke_openapi_sweep.py"
SPEC = importlib.util.spec_from_file_location("smoke_openapi_sweep", SCRIPT_PATH)
assert SPEC and SPEC.loader
smoke_openapi_sweep = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(smoke_openapi_sweep)

_substitute_path = smoke_openapi_sweep._substitute_path
_expected_skip_status = smoke_openapi_sweep._expected_skip_status


def test_substitute_path_uses_valid_learning_module_key():
    assert _substitute_path("/api/v1/ml/book/{module_key}") == "/api/v1/ml/book/ml"
    assert _substitute_path("/api/v1/learning/progress/{module_key}") == "/api/v1/learning/progress/ml"


def test_substitute_path_keeps_generic_fallback_for_unknown_path_params():
    assert _substitute_path("/api/v1/items/{item_id}/parts/{slug}") == "/api/v1/items/1/parts/sample"


def test_student_only_classroom_reads_treat_admin_forbidden_as_expected_skip():
    for raw_path in smoke_openapi_sweep.STUDENT_ONLY_GET_PATHS:
        path = _substitute_path(raw_path)
        should_skip, reason = _expected_skip_status(raw_path, path, 403, {"detail": "学生权限"})

        assert should_skip is True
        assert reason == "student-only endpoint rejected the admin smoke identity"


def test_student_only_classroom_reads_do_not_hide_server_errors():
    raw_path = "/api/v1/classroom/active"

    should_skip, reason = _expected_skip_status(raw_path, raw_path, 500, {})

    assert should_skip is False
    assert reason == ""


def test_stateful_download_gets_are_excluded_from_readonly_sweep():
    assert smoke_openapi_sweep._should_skip_path("/api/v1/it/games/1/download") is True
