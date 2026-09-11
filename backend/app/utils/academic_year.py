"""Shared XBK academic-year normalization helpers."""

from __future__ import annotations

import re
from typing import Any

_ACADEMIC_YEAR_RE = re.compile(r"^(\d{4})-(\d{4})$")
_MIN_START_YEAR = 2000
_MAX_START_YEAR = 2099


def normalize_academic_year(value: Any) -> str:
    """Return canonical ``YYYY-YYYY`` form, accepting a legacy start year."""
    if value is None or isinstance(value, bool):
        raise ValueError("学年不能为空")

    text = str(value).strip()
    if re.fullmatch(r"\d{4}", text):
        start = int(text)
        text = f"{start:04d}-{start + 1:04d}"

    match = _ACADEMIC_YEAR_RE.fullmatch(text)
    if not match:
        raise ValueError("学年格式应为 YYYY-YYYY，例如 2026-2027")

    start, end = map(int, match.groups())
    if not _MIN_START_YEAR <= start <= _MAX_START_YEAR:
        raise ValueError("学年起始年份应在 2000 至 2099 之间")
    if end != start + 1:
        raise ValueError("学年结束年份必须等于起始年份加 1")
    return f"{start:04d}-{end:04d}"


def split_academic_year(value: Any) -> tuple[int, int]:
    normalized = normalize_academic_year(value)
    start, end = normalized.split("-", 1)
    return int(start), int(end)
