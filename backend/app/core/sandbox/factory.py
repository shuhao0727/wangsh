from typing import Dict, Type
from app.core.config import settings
from app.core.sandbox.base import SandboxProvider
from app.core.sandbox.docker import DockerProvider

_PROVIDERS: Dict[str, Type[SandboxProvider]] = {
    "docker": DockerProvider,
}

_instance: SandboxProvider = None

def get_sandbox_provider() -> SandboxProvider:
    global _instance
    if _instance is None:
        provider_name = getattr(settings, "PYTHONLAB_SANDBOX_PROVIDER", "docker")
        provider_cls = _PROVIDERS.get(provider_name)
        if provider_cls is None:
            raise ValueError(f"未知的 PYTHONLAB_SANDBOX_PROVIDER: {provider_name!r}，当前仅支持 docker")
        _instance = provider_cls()
    return _instance
