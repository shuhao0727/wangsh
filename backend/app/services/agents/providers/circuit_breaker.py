"""简单熔断器 — 连续失败 N 次后暂时拒绝请求"""

import time
from typing import Dict


class CircuitBreaker:
    """Per-provider circuit breaker (in-memory, process-level)"""

    def __init__(self, failure_threshold: int = 3, recovery_seconds: float = 30.0):
        self._threshold = failure_threshold
        self._recovery = recovery_seconds
        self._failures: Dict[str, int] = {}
        self._open_since: Dict[str, float] = {}

    def _key(self, provider_name: str) -> str:
        return provider_name.lower()

    def is_open(self, provider_name: str) -> bool:
        k = self._key(provider_name)
        if k not in self._open_since:
            return False
        elapsed = time.monotonic() - self._open_since[k]
        if elapsed >= self._recovery:
            # 半开：允许一次尝试
            del self._open_since[k]
            self._failures[k] = 0
            return False
        return True

    def record_success(self, provider_name: str) -> None:
        k = self._key(provider_name)
        self._failures.pop(k, None)
        self._open_since.pop(k, None)

    def record_failure(self, provider_name: str) -> None:
        k = self._key(provider_name)
        count = self._failures.get(k, 0) + 1
        self._failures[k] = count
        if count >= self._threshold:
            self._open_since[k] = time.monotonic()


# 全局单例
breaker = CircuitBreaker(failure_threshold=3, recovery_seconds=30.0)
