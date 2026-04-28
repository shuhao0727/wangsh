"""
PythonLab 沙箱调试环境配置
"""

from typing import Optional
from pydantic import Field


class PythonLabSettingsMixin:
    """PythonLab Docker 沙箱调试环境相关配置"""

    # ==================== PythonLab 调试（V2：Docker + debugpy + Redis） ====================
    DAP_HOST_IP: Optional[str] = Field(default=None)
    PYTHONLAB_SANDBOX_IMAGE: str = Field(default="pythonlab-sandbox:py311")
    PYTHONLAB_WORKSPACE_ROOT: str = Field(default="/tmp/pythonlab/workspaces")
    PYTHONLAB_SESSION_TTL_SECONDS: int = Field(default=1800)
    PYTHONLAB_UNATTACHED_TTL_SECONDS: int = Field(default=300)
    PYTHONLAB_MAX_SESSIONS_PER_USER: int = Field(default=2)
    PYTHONLAB_DEBUGPY_PORT: int = Field(default=5678)
    PYTHONLAB_DEBUG_WS_OWNER_MODE: str = Field(default="steal")
    PYTHONLAB_ORPHAN_CLEANUP_ENABLED: bool = Field(default=True)
    PYTHONLAB_ORPHAN_CLEANUP_INTERVAL_SECONDS: int = Field(default=300)
    PYTHONLAB_HEARTBEAT_TIMEOUT_SECONDS: int = Field(default=60)
    PYTHONLAB_IDLE_TIMEOUT_SECONDS: int = Field(default=1800)

    # Phase 3: Sandbox Upgrade
    PYTHONLAB_SANDBOX_PROVIDER: str = Field(default="docker")  # docker, k8s, nomad
    PYTHONLAB_DOCKER_RUNTIME: str = Field(default="runc")  # runc, runsc (gVisor), kata-runtime

    # Phase 3.1: Resource Limits
    PYTHONLAB_DEFAULT_CPU_QUOTA: int = Field(default=50000)
    PYTHONLAB_DEFAULT_MEMORY_MB: int = Field(default=512)
    PYTHONLAB_CONTAINER_PIDS_LIMIT: int = Field(default=128)
    PYTHONLAB_LOG_MAX_SIZE: str = Field(default="10m")
    PYTHONLAB_LOG_MAX_FILE: str = Field(default="3")
    PYTHONLAB_WORKSPACE_DISK_QUOTA_MB: int = Field(default=512)
