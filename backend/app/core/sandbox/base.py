import abc
from typing import Dict, Any, List, Optional
from pathlib import Path

class SandboxProvider(abc.ABC):
    """
    Abstract base class for sandbox providers.
    
    This interface abstracts the underlying container runtime (Docker, gVisor, K8s, Nomad).
    """

    @abc.abstractmethod
    async def start_session(self, session_id: str, code: str, meta: Dict[str, Any]) -> Dict[str, Any]:
        """
        Start a sandbox session.
        
        Args:
            session_id: Unique session ID.
            code: The user code to run.
            meta: Session metadata (limits, owner, etc.).
            
        Returns:
            Updated meta dictionary (e.g. with container ID, host, port).
        """
        pass

    @abc.abstractmethod
    async def stop_session(self, session_id: str, meta: Dict[str, Any]) -> None:
        """
        Stop a sandbox session and cleanup resources.
        
        Args:
            session_id: Unique session ID.
            meta: Session metadata.
        """
        pass

    @abc.abstractmethod
    async def list_active_sessions(self) -> List[str]:
        """
        List all active session IDs known to the provider.
        """
        pass
    
    @abc.abstractmethod
    async def is_healthy(self, session_id: str, meta: Dict[str, Any]) -> bool:
        """
        Check if the session sandbox is healthy.
        """
        pass

def get_sitecustomize_content() -> str:
    return """import socket

_real_connect = socket.socket.connect

def _is_loopback(host):
    if host is None:
        return False
    if isinstance(host, bytes):
        try:
            host = host.decode('utf-8', errors='ignore')
        except Exception:
            return False
    if not isinstance(host, str):
        return False
    h = host.strip().lower()
    return h == 'localhost' or h.startswith('127.') or h == '::1' or h == '0:0:0:0:0:0:0:1'

def _blocked_connect(self, address):
    try:
        host = address[0] if isinstance(address, tuple) and len(address) >= 1 else None
    except Exception:
        host = None
    if not _is_loopback(host):
        raise OSError('Network access disabled')
    return _real_connect(self, address)

socket.socket.connect = _blocked_connect

_real_create_connection = socket.create_connection

def _blocked_create_connection(address, *args, **kwargs):
    try:
        host = address[0] if isinstance(address, tuple) and len(address) >= 1 else address
    except Exception:
        host = address
    if not _is_loopback(host):
        raise OSError('Network access disabled')
    return _real_create_connection(address, *args, **kwargs)

socket.create_connection = _blocked_create_connection
"""
