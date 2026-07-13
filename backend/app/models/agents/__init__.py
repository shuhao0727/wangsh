"""
AI智能体模型模块
"""

from .ai_agent import (
    AIAgent,
    ZntConversation,
    TaskAnalysis,
    HotQuestionAnalysis,
    StudentChainAnalysis,
    AgentAnalysisPromptTemplate,
)
from .group_discussion import GroupDiscussionAnalysis, GroupDiscussionMember, GroupDiscussionMessage, GroupDiscussionSession
from .optimization import OptimizeLog

__all__ = [
    "AIAgent",
    "ZntConversation",
    "GroupDiscussionSession",
    "GroupDiscussionMember",
    "GroupDiscussionMessage",
    "GroupDiscussionAnalysis",
    "OptimizeLog",
    "TaskAnalysis",
    "HotQuestionAnalysis",
    "StudentChainAnalysis",
    "AgentAnalysisPromptTemplate",
]
