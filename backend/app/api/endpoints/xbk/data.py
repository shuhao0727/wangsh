"""
XBK 数据管理端点 — 兼容性桥接

此文件已拆分为以下模块：
  - _common.py    : require_xbk_access, apply_common_filters
  - students.py   : 学生 CRUD
  - courses.py    : 课程 CRUD
  - selections.py : 选课 CRUD + 选课结果查询
  - bulk_ops.py   : 批量删除 + 元数据

保留此文件仅为向后兼容（旧导入路径）。
"""

# 向后兼容：保留旧导入路径
from app.api.endpoints.xbk._common import require_xbk_access, apply_common_filters  # noqa: F401

# 兼容旧名称
_apply_common_filters = apply_common_filters

__all__ = ["require_xbk_access", "apply_common_filters", "_apply_common_filters"]
