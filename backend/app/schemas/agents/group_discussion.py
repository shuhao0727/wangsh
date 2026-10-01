from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from app.utils.input_sanitizer import sanitize_html, check_prompt_injection


class GroupDiscussionJoinRequest(BaseModel):
    group_no: str = Field(..., min_length=1, max_length=16, description="组号（学生输入）")
    class_name: Optional[str] = Field(None, min_length=1, max_length=64, description="可选：班级（管理员可指定）")
    group_name: Optional[str] = Field(None, min_length=1, max_length=64, description="可选：组名（仅创建者可设置/修改）")

    @field_validator("group_name", mode="after")
    @classmethod
    def sanitize_group_name(cls, v):
        """转义组名中的 HTML"""
        if v:
            return sanitize_html(v)
        return v


class GroupDiscussionJoinResponse(BaseModel):
    session_id: int
    session_date: date
    class_name: str
    group_no: str
    group_name: Optional[str] = None
    display_name: str
    group_lock_seconds: int = Field(..., ge=0, description="组号锁定剩余秒数（用于限制频繁更改）")


class GroupDiscussionMessageOut(BaseModel):
    id: int
    session_id: int
    user_id: int
    user_display_name: str
    content: str
    created_at: datetime


class GroupDiscussionMessageListResponse(BaseModel):
    items: List[GroupDiscussionMessageOut]
    next_after_id: int


class GroupDiscussionSendRequest(BaseModel):
    session_id: int
    content: str = Field(..., min_length=1, max_length=500)

    @field_validator("content", mode="after")
    @classmethod
    def validate_content(cls, v):
        """验证消息内容无恶意注入"""
        if v and check_prompt_injection(v):
            raise ValueError("检测到潜在的恶意指令，请修改后重试")
        return v


class GroupDiscussionMuteRequest(BaseModel):
    session_id: int
    user_id: int
    minutes: int = Field(..., ge=1, le=1440, description="禁言分钟数")


class GroupDiscussionUnmuteRequest(BaseModel):
    session_id: int
    user_id: int


class GroupDiscussionAddMemberRequest(BaseModel):
    session_id: int
    user_id: int


class GroupDiscussionRemoveMemberRequest(BaseModel):
    session_id: int
    user_id: int


class GroupDiscussionAdminSessionOut(BaseModel):
    id: int
    session_date: date
    class_name: str
    group_no: str
    group_name: Optional[str] = None
    message_count: int
    created_at: datetime
    last_message_at: Optional[datetime] = None


class GroupDiscussionGroupOut(BaseModel):
    session_id: int
    session_date: date
    class_name: str
    group_no: str
    group_name: Optional[str] = None
    message_count: int
    member_count: int = Field(0, description="当前成员数")
    last_message_at: Optional[datetime] = None


class GroupDiscussionGroupListResponse(BaseModel):
    items: List[GroupDiscussionGroupOut]


class GroupDiscussionPublicConfig(BaseModel):
    enabled: bool = Field(..., description="前端小组讨论是否可见（学生端）")
    join_lock_seconds: int = Field(default=300, description="加入小组锁定时间（秒）")
    rate_limit_seconds: int = Field(default=2, description="消息发送频率限制（秒）")


class GroupDiscussionAdminSessionListResponse(BaseModel):
    items: List[GroupDiscussionAdminSessionOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class GroupDiscussionAdminMessageListResponse(BaseModel):
    items: List[GroupDiscussionMessageOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class GroupDiscussionAdminAnalyzeRequest(BaseModel):
    session_id: int
    agent_id: int
    analysis_type: str = Field("summary", min_length=1, max_length=32)
    prompt: Optional[str] = Field(None, description="可选：自定义prompt，未提供则使用默认模板")

    @field_validator("prompt", mode="after")
    @classmethod
    def validate_prompt(cls, v):
        """验证自定义提示词无恶意注入"""
        if v and check_prompt_injection(v):
            raise ValueError("检测到潜在的恶意指令，请修改后重试")
        return v


class GroupDiscussionAdminAnalyzeResponse(BaseModel):
    analysis_id: int
    result_text: str
    created_at: datetime


class GroupDiscussionAdminCompareAnalyzeRequest(BaseModel):
    session_ids: List[int] = Field(..., min_length=1, description="要对比分析的会话ID列表")
    agent_id: int
    bucket_seconds: int = Field(180, ge=60, le=3600, description="时间桶大小（秒）")
    analysis_type: str = Field("learning_compare", min_length=1, max_length=32)
    prompt: Optional[str] = Field(None, description="可选：自定义prompt，未提供则使用默认模板")
    use_cache: bool = Field(True, description="是否使用缓存（命中则直接返回历史分析）")

    @field_validator("prompt", mode="after")
    @classmethod
    def validate_prompt(cls, v):
        """验证自定义提示词无恶意注入"""
        if v and check_prompt_injection(v):
            raise ValueError("检测到潜在的恶意指令，请修改后重试")
        return v


class GroupDiscussionAdminAnalysisOut(BaseModel):
    id: int
    session_id: int
    agent_id: int
    analysis_type: str
    prompt: str
    result_text: str
    created_at: datetime
    compare_session_ids: Optional[str] = None


class GroupDiscussionAdminAnalysisListResponse(BaseModel):
    items: List[GroupDiscussionAdminAnalysisOut]


class GroupDiscussionMemberOut(BaseModel):
    user_id: int
    username: Optional[str] = None
    full_name: Optional[str] = None
    student_id: Optional[str] = None
    joined_at: datetime
    muted_until: Optional[datetime] = None


class GroupDiscussionAdminMemberListResponse(BaseModel):
    items: List[GroupDiscussionMemberOut]


class GroupDiscussionAdminDeleteSessionsRequest(BaseModel):
    session_ids: List[int] = Field(..., min_length=1, description="要删除的会话ID列表")


class GroupDiscussionStudentProfileRequest(BaseModel):
    session_id: int
    user_id: int
    agent_id: int


class GroupDiscussionCrossSystemRequest(BaseModel):
    session_ids: List[int] = Field(..., min_length=1, description="要分析的会话ID列表")
    agent_id: int
    date: Optional[str] = Field(None, description="可选：指定日期 YYYY-MM-DD")
    class_name: Optional[str] = Field(None, description="可选：指定班级")
