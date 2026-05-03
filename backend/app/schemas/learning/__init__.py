"""
学习板块 Schema 模块
"""

from .progress import LearningProgressCreate, LearningProgressUpdate, LearningProgressOut
from .content import LearningContentItemIn, LearningContentItemOut

__all__ = [
    "LearningProgressCreate",
    "LearningProgressUpdate",
    "LearningProgressOut",
    "LearningContentItemIn",
    "LearningContentItemOut",
]
