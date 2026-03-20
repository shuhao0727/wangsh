"""
自主检测 Schema 模块
"""

from .config import (
    AssessmentConfigCreate,
    AssessmentConfigUpdate,
    AssessmentConfigResponse,
    AssessmentConfigListResponse,
    AssessmentConfigAgentResponse,
)
from .question import (
    QuestionCreate,
    QuestionUpdate,
    QuestionResponse,
    QuestionListResponse,
    GenerateQuestionsRequest,
)
from .session import (
    SessionStartRequest,
    SessionStartResponse,
    AnswerSubmitRequest,
    AnswerResult,
    SessionSubmitResponse,
    SessionResultResponse,
    SessionListItem,
    SessionListResponse,
    QuestionForStudent,
    AnswerDetailResponse,
    StatisticsResponse,
)
from .profile import (
    BasicProfileResponse,
    ProfileGenerateRequest,
    ProfileBatchGenerateRequest,
    ProfileResponse,
    ProfileListResponse,
)

__all__ = [
    "AssessmentConfigCreate",
    "AssessmentConfigUpdate",
    "AssessmentConfigResponse",
    "AssessmentConfigListResponse",
    "AssessmentConfigAgentResponse",
    "QuestionCreate",
    "QuestionUpdate",
    "QuestionResponse",
    "QuestionListResponse",
    "GenerateQuestionsRequest",
    "SessionStartRequest",
    "SessionStartResponse",
    "AnswerSubmitRequest",
    "AnswerResult",
    "SessionSubmitResponse",
    "SessionResultResponse",
    "SessionListItem",
    "SessionListResponse",
    "QuestionForStudent",
    "AnswerDetailResponse",
    "StatisticsResponse",
    "BasicProfileResponse",
    "ProfileGenerateRequest",
    "ProfileBatchGenerateRequest",
    "ProfileResponse",
    "ProfileListResponse",
]
