"""
数据库模型定义 - 模块化结构
支持新的表名前缀方案：sys_ (系统表), wz_ (文章表), znt_ (智能体表)
"""

from app.db.database import Base

# 从模块化结构导入模型
# 核心系统模型 (sys_ 前缀)
from .core import User, RefreshToken, FeatureFlag

# 文章系统模型 (wz_ 前缀)
from .articles import Article, Category, MarkdownStyle

# 智能体模型 (znt_ 前缀)
from .agents import AIAgent, ZntConversation, GroupDiscussionSession, GroupDiscussionMessage, GroupDiscussionAnalysis

# 校本课模型 (xbk_ 前缀)
from .xbk import XbkStudent, XbkCourse, XbkSelection

# 信息学/笔记模型 (inf_ 前缀)
from .informatics import TypstNote, TypstAsset, TypstStyle, TypstCategory

# 信息技术模型 (xxjs_ 前缀)
from .xxjs.dianming import XxjsDianming

__all__ = [
    "Base", 
    "User", 
    "RefreshToken",
    "FeatureFlag",
    "Article",
    "Category",
    "MarkdownStyle",
    "AIAgent",
    "ZntConversation",
    "GroupDiscussionSession",
    "GroupDiscussionMessage",
    "GroupDiscussionAnalysis",
    "XbkStudent",
    "XbkCourse",
    "XbkSelection",
    "TypstNote",
    "TypstAsset",
    "TypstStyle",
    "TypstCategory",
    "XxjsDianming",
]
