import pytest
from fastapi import HTTPException

from app.api.endpoints.debug.flow import (
    _ensure_conservative_code_optimization,
    _normalize_optimized_python_code,
    _strip_markdown_fence,
)


def test_strip_markdown_fence_removes_code_block_wrapper():
    raw = "```python\nprint('ok')\n```"
    assert _strip_markdown_fence(raw) == "print('ok')"


def test_normalize_optimized_python_code_accepts_valid_python():
    raw = "```python\nx = 1\nprint(x)\n```"
    out = _normalize_optimized_python_code(raw)
    assert out == "x = 1\nprint(x)"


def test_normalize_optimized_python_code_rejects_invalid_python():
    with pytest.raises(HTTPException) as exc:
        _normalize_optimized_python_code("```python\nfor i in range(3) print(i)\n```")
    assert exc.value.status_code == 502


def test_ensure_conservative_code_optimization_keeps_function_names():
    original = "def calc(a):\n    return a + 1\n"
    optimized = "def calc(a):\n    # 关键步骤\n    return a + 1\n"
    out = _ensure_conservative_code_optimization(original, optimized)
    assert out == optimized


def test_ensure_conservative_code_optimization_rejects_function_rename():
    original = "def calc(a):\n    return a + 1\n"
    optimized = "def calculate(a):\n    return a + 1\n"
    with pytest.raises(HTTPException) as exc:
        _ensure_conservative_code_optimization(original, optimized)
    assert exc.value.status_code == 502

