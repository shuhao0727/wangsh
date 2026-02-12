"""
XBK（校本课）模块模型
"""

from app.models.xbk.student import XbkStudent
from app.models.xbk.course import XbkCourse
from app.models.xbk.selection import XbkSelection

__all__ = ["XbkStudent", "XbkCourse", "XbkSelection"]

