"""Strict, bounded contracts shared by public and staff KNN endpoints."""
import re
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, field_validator, model_validator

Label = Literal["球类对抗", "力量类", "耐力类", "技巧类"]
StudentNo = Annotated[str, Field(min_length=1, max_length=24)]


def student_key(value: str) -> str:
    number = value.strip()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,23}", number):
        raise ValueError("学号应为 1～24 位字母、数字、下划线或短横线")
    return (number.lstrip("0") or "0") if number.isdigit() else number.upper()


def validate_roster(numbers: list[str]) -> list[str]:
    keys = [student_key(n) for n in numbers]
    if len(set(keys)) != len(keys):
        raise ValueError("名单存在重复学号（数字前导零和字母大小写视为同一学号）")
    return [n.strip() for n in numbers]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class BatchCreate(Contract):
    title: str = Field(min_length=1, max_length=120)
    starts_at: datetime
    ends_at: datetime
    student_numbers: list[StudentNo] = Field(default_factory=lambda: [str(n) for n in range(1, 66)], min_length=1, max_length=1000)
    _roster = field_validator("student_numbers")(validate_roster)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value):
        if not value.strip():
            raise ValueError("请填写批次名称")
        return value.strip()

    @field_validator("starts_at", "ends_at")
    @classmethod
    def aware_time(cls, value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("开始和截止时间必须包含时区")
        return value

    @model_validator(mode="after")
    def time_window(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("截止时间必须晚于开始时间")
        return self


class BatchUpdate(BatchCreate):
    """Full configuration update; roster changes cannot discard submitted students."""


class BatchAction(Contract):
    action: Literal["start", "schedule", "close"]


class StudentCheck(Contract):
    student_no: StudentNo


class Submit(Contract):
    student_no: StudentNo
    request_id: UUID
    expected_revision: StrictInt = Field(ge=0)
    # 按教学设计只采集六类运动的每周参与天数，不再采集喜欢程度。
    features: list[StrictInt] = Field(min_length=6, max_length=6)
    label: Label
    display_consent: StrictBool = False

    @field_validator("student_no")
    @classmethod
    def valid_number(cls, value):
        student_key(value)
        return value.strip()

    @field_validator("features")
    @classmethod
    def valid_features(cls, values):
        for value in values:
            if value < 0 or value > 7:
                raise ValueError("每周参与天数应为 0～7 的整数")
        return values


class Refill(Contract):
    student_numbers: list[StudentNo] = Field(min_length=1, max_length=1000)
    allowed: StrictBool = True
    _roster = field_validator("student_numbers")(validate_roster)


class Freeze(Contract):
    a_student_no: StudentNo | None = None
