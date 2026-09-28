"""Server-evaluated classroom design scores and short-lived leaderboard receipts."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


class LeaderboardSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid")

    round_id: Annotated[str, StringConstraints(strict=True, min_length=1, max_length=128)]
    expected_user_id: Annotated[int, Field(strict=True, gt=0)]
    ai_name: Annotated[
        str, StringConstraints(strict=True, strip_whitespace=True, min_length=1, max_length=80)
    ]
    evaluation_id: Annotated[str, StringConstraints(strict=True, pattern=r"^[a-f0-9]{64}$")]


class LeaderboardRow(BaseModel):
    rank: int
    student_name: str
    ai_name: str
    score: int
    is_me: bool


class LeaderboardResponse(BaseModel):
    round_id: str
    status: Literal["waiting", "open", "ended"]
    expires_at: str | None
    rows: list[LeaderboardRow]


ShortText = Annotated[str, StringConstraints(strict=True, strip_whitespace=True, min_length=1, max_length=80)]
Evidence = Annotated[str, StringConstraints(strict=True, max_length=2000)]
TaskId = Literal["question", "homework", "organize", "voice", "vision", "action", "sense"]


class EvaluationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    round_id: Annotated[str, StringConstraints(strict=True, min_length=1, max_length=128)] | None = None
    expected_user_id: Annotated[int, Field(strict=True, gt=0)]
    ai_name: ShortText
    selected_ids: Annotated[list[ShortText], Field(min_length=1, max_length=40)]
    primary_feature: TaskId
    features: Annotated[list[TaskId], Field(max_length=7)]
    budget: Annotated[float, Field(strict=True, ge=0, le=1000000000, allow_inf_nan=False)] | None
    reason: Annotated[str, StringConstraints(strict=True, max_length=4000)]
    test_plan: Annotated[str, StringConstraints(strict=True, max_length=1000)]
    risk: Evidence
    paper_recorded: Annotated[bool, Field(strict=True)]
    tested_core: Annotated[bool, Field(strict=True)]


class Dimension(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: Literal["value", "completion", "suitability", "validation"]
    label: ShortText
    score: Annotated[int, Field(strict=True, ge=0, le=25)]
    max: Literal[25]
    note: Annotated[str, StringConstraints(strict=True, strip_whitespace=True, min_length=1, max_length=1200)]


class ModelEvaluation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    dimensions: Annotated[list[Dimension], Field(min_length=4, max_length=4)]
    suggestions: Annotated[list[Annotated[str, StringConstraints(strict=True, strip_whitespace=True, min_length=1, max_length=600)]], Field(min_length=1, max_length=6)]


class EvaluationResponse(ModelEvaluation):
    evaluation_id: str
    round_id: str
    total: int
    level: str
