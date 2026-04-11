"""
Flow 构建上下文模块

包含 _BuildCtx 类和相关的构建逻辑。
"""

from typing import Any, Dict, List, Optional

from app.api.pythonlab.utils import stable_id


class _BuildCtx:
    def __init__(self, code: str, max_nodes: int, max_edges: int):
        self.code = code
        self.max_nodes = max_nodes
        self.max_edges = max_edges
        self.nodes: List[Dict[str, Any]] = []
        self.edges: List[Dict[str, Any]] = []
        self.diagnostics: List[Dict[str, Any]] = []
        self.truncated = False
        self.func_name_to_id: Dict[str, str] = {}
        self.module_id: str = stable_id("Module", "1")

    def add_node(self, node: Dict[str, Any]) -> Optional[str]:
        if self.truncated:
            return None
        if len(self.nodes) >= self.max_nodes:
            self.truncated = True
            self.diagnostics.append({"level": "warn", "code": "W_TRUNCATED", "message": "流程图过大，已进行折叠/截断"})
            return None
        self.nodes.append(node)
        return node["id"]

    def add_edge(self, edge: Dict[str, Any]) -> None:
        if self.truncated:
            return
        if len(self.edges) >= self.max_edges:
            self.truncated = True
            self.diagnostics.append({"level": "warn", "code": "W_TRUNCATED", "message": "流程图过大，已进行折叠/截断"})
            return
        self.edges.append(edge)