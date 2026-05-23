"""AI智能体 Schemas 模块"""

# Agent CRUD
from .ai_agent import (
    AIAgentBase, AIAgentCreate, AIAgentUpdate, AIAgentInDB,
    AIAgentResponse, AIAgentListResponse,
    AgentTestRequest, AgentChatRequest, ChatMessage,
    AgentTestResponse, AgentRevealKeyRequest, AgentRevealKeyResponse,
    AgentStatisticsData,
)

# Analysis (hot questions + student chains)
from .analysis import (
    HotQuestionExample, HotQuestionBucket, TimelineBucket,
    TeacherQuestionMark, TaskComparisonItem, KeywordItem,
    MainQuestionChainItem, TaskAnalysisRequest, TaskAnalysisResponse,
    BaseAnalysisSaveRequest, BaseAnalysisRecord, AnalysisListItem,
    TaskAnalysisSaveRequest, TaskAnalysisRecord,
    HotQuestionAnalysisSaveRequest, HotQuestionAnalysisRecord,
    StudentChainAnalysisSaveRequest, StudentChainAnalysisRecord,
)

# 兼容别名（API 层仍引用旧名称，逐步迁移到 AnalysisListItem）
HotQuestionAnalysisListItem = AnalysisListItem
StudentChainAnalysisListItem = AnalysisListItem
TaskAnalysisListItem = AnalysisListItem

# Conversation
from .conversation import (
    ConversationSummary, ConversationMessage,
    StudentChainMessage, StudentChainSession,
    ConversationExportRequest, UsageFilterOptions,
)

# Usage
from .usage import (
    AgentUsageCreate, AgentUsageResponse, AgentUsageListResponse,
    AgentUsageStatistics,
)

from .model_discovery import (
    AIServiceProvider, AIModelInfo, ServiceProviderConfig,
    ModelDiscoveryRequest, ModelDiscoveryResponse, ProviderDetectionResult,
    COMMON_MODEL_PRESETS,
)

from .group_discussion import (
    GroupDiscussionJoinRequest, GroupDiscussionJoinResponse,
    GroupDiscussionMuteRequest, GroupDiscussionUnmuteRequest,
    GroupDiscussionAddMemberRequest, GroupDiscussionRemoveMemberRequest,
    GroupDiscussionMessageOut, GroupDiscussionMessageListResponse,
    GroupDiscussionSendRequest, GroupDiscussionGroupOut,
    GroupDiscussionGroupListResponse, GroupDiscussionPublicConfig,
    GroupDiscussionAdminSessionOut, GroupDiscussionAdminSessionListResponse,
    GroupDiscussionAdminMessageListResponse,
    GroupDiscussionAdminAnalyzeRequest, GroupDiscussionAdminAnalyzeResponse,
    GroupDiscussionAdminCompareAnalyzeRequest,
    GroupDiscussionAdminAnalysisOut, GroupDiscussionAdminAnalysisListResponse,
    GroupDiscussionMemberOut, GroupDiscussionAdminMemberListResponse,
    GroupDiscussionAdminDeleteSessionsRequest,
    GroupDiscussionStudentProfileRequest, GroupDiscussionCrossSystemRequest,
)


# 公开类型列表（IDE 自动补全 / 类型检查）
__all__ = [
    # Agent
    "AIAgentBase", "AIAgentCreate", "AIAgentUpdate", "AIAgentInDB",
    "AIAgentResponse", "AIAgentListResponse",
    "AgentTestRequest", "AgentChatRequest", "ChatMessage",
    "AgentTestResponse", "AgentRevealKeyRequest", "AgentRevealKeyResponse",
    "AgentStatisticsData",
    # Analysis
    "HotQuestionExample", "HotQuestionBucket", "TimelineBucket",
    "TeacherQuestionMark", "TaskComparisonItem", "KeywordItem",
    "MainQuestionChainItem", "TaskAnalysisRequest", "TaskAnalysisResponse",
    "BaseAnalysisSaveRequest", "BaseAnalysisRecord", "AnalysisListItem",
    "TaskAnalysisSaveRequest", "TaskAnalysisRecord",
    "HotQuestionAnalysisSaveRequest", "HotQuestionAnalysisRecord",
    "StudentChainAnalysisSaveRequest", "StudentChainAnalysisRecord",
    # Conversation
    "ConversationSummary", "ConversationMessage",
    "StudentChainMessage", "StudentChainSession",
    "ConversationExportRequest", "UsageFilterOptions",
    # Usage
    "AgentUsageCreate", "AgentUsageResponse", "AgentUsageListResponse",
    "AgentUsageStatistics",
    # Model Discovery
    "AIServiceProvider", "AIModelInfo", "ServiceProviderConfig",
    "ModelDiscoveryRequest", "ModelDiscoveryResponse", "ProviderDetectionResult",
    "COMMON_MODEL_PRESETS",
    # Group Discussion
    "GroupDiscussionJoinRequest", "GroupDiscussionJoinResponse",
    "GroupDiscussionMuteRequest", "GroupDiscussionUnmuteRequest",
    "GroupDiscussionAddMemberRequest", "GroupDiscussionRemoveMemberRequest",
    "GroupDiscussionMessageOut", "GroupDiscussionMessageListResponse",
    "GroupDiscussionSendRequest", "GroupDiscussionGroupOut",
    "GroupDiscussionGroupListResponse", "GroupDiscussionPublicConfig",
    "GroupDiscussionAdminSessionOut", "GroupDiscussionAdminSessionListResponse",
    "GroupDiscussionAdminMessageListResponse",
    "GroupDiscussionAdminAnalyzeRequest", "GroupDiscussionAdminAnalyzeResponse",
    "GroupDiscussionAdminCompareAnalyzeRequest",
    "GroupDiscussionAdminAnalysisOut", "GroupDiscussionAdminAnalysisListResponse",
    "GroupDiscussionMemberOut", "GroupDiscussionAdminMemberListResponse",
    "GroupDiscussionAdminDeleteSessionsRequest",
    "GroupDiscussionStudentProfileRequest", "GroupDiscussionCrossSystemRequest",
]
