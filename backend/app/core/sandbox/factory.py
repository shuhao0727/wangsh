from typing import Dict, Type
from app.core.config import settings
from app.core.sandbox.base import SandboxProvider
from app.core.sandbox.docker import DockerProvider
from app.core.sandbox.k8s import K8sProvider

_PROVIDERS: Dict[str, Type[SandboxProvider]] = {
    "docker": DockerProvider,
    "k8s": K8sProvider,
}

_instance: SandboxProvider = None

def get_sandbox_provider() -> SandboxProvider:
    global _instance
    if _instance is None:
        provider_name = getattr(settings, "PYTHONLAB_SANDBOX_PROVIDER", "docker")
        provider_cls = _PROVIDERS.get(provider_name, DockerProvider)
        _instance = provider_cls()
    return _instance
