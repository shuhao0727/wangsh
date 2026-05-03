"""学习内容配置 Schema。"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class LearningContentItemIn(BaseModel):
    """学习内容创建/更新输入。"""

    section_key: str = Field(
        ...,
        min_length=1,
        max_length=80,
        description="内容分区，例如 roadmap、knowledge、experiments；raw 表示前端整包覆盖入口。",
    )
    item_key: str = Field(
        ...,
        min_length=1,
        max_length=120,
        description="内容项唯一标识；Markdown 学习书约定使用 section_key=raw、item_key=book。",
    )
    title: str = Field(..., min_length=1, max_length=255, description="后台展示标题。")
    summary: Optional[str] = Field(None, description="内容摘要，供后台列表和编辑提示使用。")
    content: Dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "结构化 JSON 内容。普通分区按前端数据结构覆盖对应内容；"
            "Markdown 学习书使用 {\"book\": LearningBook}，其中章节 markdown 字段可由后台编辑。"
        ),
    )
    tags: List[str] = Field(default_factory=list, description="后台检索和归类标签。")
    difficulty: Optional[str] = Field(None, max_length=50, description="可选难度标识，例如 beginner、intermediate、advanced、expert。")
    sort_order: int = Field(0, description="同一模块和分区下的排序值，数值越小越靠前。")
    enabled: bool = Field(True, description="是否启用；禁用项不会进入学生端内容合并。")
    source_type: str = Field("admin", max_length=50, description="内容来源标识，默认 admin。")


class LearningContentItemOut(LearningContentItemIn):
    """学习内容响应。"""

    id: int
    module_key: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
