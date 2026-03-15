from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class GithubSyncSettingsUpdate(BaseModel):
    repo_url: str = Field(..., min_length=1, max_length=500)
    branch: str = Field(default="main", min_length=1, max_length=100)
    token: Optional[str] = Field(default=None, max_length=2000)
    enabled: bool = False
    interval_hours: int = Field(default=48, ge=1, le=24 * 30)
    delete_mode: str = Field(default="unpublish", pattern="^(unpublish|soft_delete)$")


class GithubSyncSettingsResponse(BaseModel):
    repo_url: str = ""
    repo_owner: str = ""
    repo_name: str = ""
    branch: str = "main"
    token_masked: str = ""
    token_configured: bool = False
    enabled: bool = False
    interval_hours: int = 48
    delete_mode: str = "unpublish"
    last_test_status: Optional[str] = None
    last_test_message: Optional[str] = None
    last_test_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class GithubSyncTestRequest(BaseModel):
    repo_url: str = Field(..., min_length=1, max_length=500)
    branch: str = Field(default="main", min_length=1, max_length=100)
    token: Optional[str] = Field(default=None, max_length=2000)


class GithubSyncTestResponse(BaseModel):
    ok: bool
    message: str
    repo_owner: Optional[str] = None
    repo_name: Optional[str] = None
    branch: Optional[str] = None


class GithubSyncTriggerRequest(BaseModel):
    dry_run: bool = False
    force_recompile: bool = False


class GithubSyncRunItem(BaseModel):
    id: int
    trigger_type: str
    status: str
    repo_owner: str
    repo_name: str
    branch: str
    created_count: int
    updated_count: int
    deleted_count: int
    skipped_count: int
    error_summary: Optional[str] = None
    started_at: datetime
    finished_at: Optional[datetime] = None
    task_id: Optional[str] = None


class GithubSyncTaskStatusResponse(BaseModel):
    task_id: str
    state: str
    ready: bool
    successful: bool
    progress_percent: int = 0
    progress_done: int = 0
    progress_total: int = 0
    progress_phase: str = ""
    progress_current: str = ""
    created_paths: list[str] = []
    updated_paths: list[str] = []
    deleted_paths: list[str] = []
    compiled_note_ids: list[int] = []
    compile_failed: list[dict] = []
    error: Optional[str] = None
