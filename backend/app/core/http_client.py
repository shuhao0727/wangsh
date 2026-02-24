import httpx
from typing import Optional
from app.core.config import settings

class HttpClientManager:
    _instance: Optional[httpx.AsyncClient] = None

    @classmethod
    def get_client(cls) -> httpx.AsyncClient:
        if cls._instance is None:
            # Configure limits for high concurrency
            # max_connections: Total number of simultaneous connections (default 100)
            # max_keepalive_connections: Number of connections to keep open in the pool (default 20)
            # timeout: Default timeout for requests
            limits = httpx.Limits(
                max_keepalive_connections=settings.HTTPX_MAX_KEEPALIVE_CONNECTIONS, 
                max_connections=settings.HTTPX_MAX_CONNECTIONS
            )
            timeout = httpx.Timeout(
                settings.HTTPX_TIMEOUT, 
                connect=settings.HTTPX_CONNECT_TIMEOUT
            )
            
            cls._instance = httpx.AsyncClient(
                limits=limits,
                timeout=timeout,
                follow_redirects=True
            )
        return cls._instance

    @classmethod
    async def close(cls):
        if cls._instance:
            await cls._instance.aclose()
            cls._instance = None

def get_http_client() -> httpx.AsyncClient:
    return HttpClientManager.get_client()
