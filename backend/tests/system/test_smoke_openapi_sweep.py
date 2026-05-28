import importlib.util
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[2] / "scripts" / "smoke_openapi_sweep.py"
SPEC = importlib.util.spec_from_file_location("smoke_openapi_sweep", SCRIPT_PATH)
assert SPEC and SPEC.loader
smoke_openapi_sweep = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(smoke_openapi_sweep)

_substitute_path = smoke_openapi_sweep._substitute_path


def test_substitute_path_uses_valid_learning_module_key():
    assert _substitute_path("/api/v1/ml/book/{module_key}") == "/api/v1/ml/book/ml"
    assert _substitute_path("/api/v1/learning/progress/{module_key}") == "/api/v1/learning/progress/ml"


def test_substitute_path_keeps_generic_fallback_for_unknown_path_params():
    assert _substitute_path("/api/v1/items/{item_id}/parts/{slug}") == "/api/v1/items/1/parts/sample"
