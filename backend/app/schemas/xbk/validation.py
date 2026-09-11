"""Shared write/import value contract (not a validator for historical output rows)."""
from decimal import Decimal, InvalidOperation
from typing import Annotated, Optional

from pydantic import BeforeValidator, Field


def normalize_text(value: object) -> object:
    if not isinstance(value, str):
        return value
    if "\x00" in value:
        raise ValueError("不能包含空字符")
    return value.strip()


def normalize_optional_text(value: object) -> object:
    value = normalize_text(value)
    return None if value == "" else value


def normalize_selection_code(value: object) -> object:
    value = normalize_optional_text(value)
    return "未选" if value is None else value


def normalize_quota(value: object) -> int:
    """Match spreadsheet integer notation without truncation or bool coercion."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return 0
    message = "限报人数格式不正确（应为非负整数且不超过2147483647）"
    if isinstance(value, bool):
        raise ValueError(message)
    try:
        number = Decimal(str(value).strip())
        if not number.is_finite() or not 0 <= number <= 2147483647 or number != number.to_integral_value():
            raise ValueError(message)
        return int(number)
    except (InvalidOperation, OverflowError) as exc:
        raise ValueError(message) from exc


Text10 = Annotated[str, BeforeValidator(normalize_text), Field(min_length=1, max_length=10)]
Text20 = Annotated[str, BeforeValidator(normalize_text), Field(min_length=1, max_length=20)]
Text50 = Annotated[str, BeforeValidator(normalize_text), Field(min_length=1, max_length=50)]
Text100 = Annotated[str, BeforeValidator(normalize_text), Field(min_length=1, max_length=100)]
Text200 = Annotated[str, BeforeValidator(normalize_text), Field(min_length=1, max_length=200)]
OptionalText10 = Annotated[Optional[Text10], BeforeValidator(normalize_optional_text)]
OptionalText20 = Annotated[Optional[Text20], BeforeValidator(normalize_optional_text)]
OptionalText50 = Annotated[Optional[Text50], BeforeValidator(normalize_optional_text)]
OptionalText100 = Annotated[Optional[Text100], BeforeValidator(normalize_optional_text)]
OptionalText200 = Annotated[Optional[Text200], BeforeValidator(normalize_optional_text)]
SelectionCode = Annotated[Text50, BeforeValidator(normalize_selection_code)]
Quota = Annotated[int, BeforeValidator(normalize_quota), Field(ge=0, le=2147483647)]
