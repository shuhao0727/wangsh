"""Shared CPU concurrency limiter for PythonLab parsing endpoints."""

import threading
from typing import Callable, TypeVar

T = TypeVar("T")

_CPU_SEMAPHORE = threading.BoundedSemaphore(2)


def run_cpu(func: Callable[..., T], *args, **kwargs) -> T:
    """Run one AST/CFG job while bounding concurrent CPU and memory use."""
    with _CPU_SEMAPHORE:
        return func(*args, **kwargs)
