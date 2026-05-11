/**
 * 交互式思维导图编辑器 — 可视化节点树，点击增删枝干
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showMessage } from "@/lib/toast";
import { ArrowLeft, Save, Plus, X, ChevronRight, ChevronDown, GripVertical } from "lucide-react";

/* ── 数据模型 ── */
type MindMapNode = {
  id: string;
  text: string;
  children: MindMapNode[];
  collapsed?: boolean;
};

let nodeCounter = 0;
const newNodeId = () => `n${++nodeCounter}`;

function cloneTree(node: MindMapNode): MindMapNode {
  return { ...node, children: node.children.map(cloneTree) };
}

/* ── 将 markdown 文本解析为树 ── */
function markdownToTree(md: string, rootText: string): MindMapNode {
  const lines = md.split("\n").filter((l) => l.trim());
  const root: MindMapNode = { id: newNodeId(), text: rootText, children: [] };
  const stack: { level: number; node: MindMapNode }[] = [{ level: 0, node: root }];

  for (const line of lines) {
    const match = line.match(/^(#+)\s+(.+)/);
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].trim();
    const child: MindMapNode = { id: newNodeId(), text, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    if (stack.length > 0) {
      stack[stack.length - 1].node.children.push(child);
    }
    stack.push({ level, node: child });
  }
  return root;
}

/* ── 将树序列化为 markdown ── */
function treeToMarkdown(node: MindMapNode, level = 1): string {
  const prefix = "#".repeat(level);
  let md = `${prefix} ${node.text}\n`;
  for (const child of node.children) {
    md += treeToMarkdown(child, level + 1);
  }
  return md;
}

/* ── 在树中查找/更新节点 ── */
function findNode(root: MindMapNode, id: string): MindMapNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function updateNode(root: MindMapNode, id: string, fn: (n: MindMapNode) => MindMapNode): MindMapNode {
  if (root.id === id) return fn(root);
  return { ...root, children: root.children.map((c) => updateNode(c, id, fn)) };
}

function deleteNode(root: MindMapNode, id: string): MindMapNode | null {
  if (root.id === id) return null;
  return {
    ...root,
    children: root.children.map((c) => deleteNode(c, id)).filter((c): c is MindMapNode => c !== null),
  };
}

/* ── Props ── */
interface Props {
  mindmapId?: number;
  initialTitle?: string;
  initialMarkdown?: string;
  onBack?: () => void;
  onSaved?: () => void;
  saveUrl?: string; // 自定义保存 URL
  saveMethod?: string; // PUT or POST
  saveBody?: (markdown: string) => Record<string, unknown>;
}

/* ── 单节点组件 ── */
const TreeNode: React.FC<{
  node: MindMapNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, text: string) => void;
  onToggleCollapse: (id: string) => void;
}> = ({ node, depth, selectedId, onSelect, onAddChild, onDelete, onRename, onToggleCollapse }) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(node.text);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children.length > 0;
  const isCollapsed = node.collapsed ?? false;

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditText(node.text);
    setEditing(true);
  };

  const handleRenameSubmit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== node.text) {
      onRename(node.id, trimmed);
    }
    setEditing(false);
  };

  return (
    <div className="mindmap-tree-node" style={{ marginLeft: depth === 0 ? 0 : 24 }}>
      <div
        className={`mindmap-node-row ${isSelected ? "selected" : ""}`}
        onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
        onDoubleClick={handleDoubleClick}
      >
        {/* 折叠按钮 */}
        <span
          className="mindmap-collapse-btn"
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
        >
          {hasChildren ? (
            isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />
          ) : (
            <span style={{ width: 14, display: "inline-block" }} />
          )}
        </span>

        {/* 节点文本 */}
        {editing ? (
          <input
            className="mindmap-inline-input"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => { if (e.key === "Enter") handleRenameSubmit(); if (e.key === "Escape") setEditing(false); }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            style={{ width: Math.max(60, editText.length * 10 + 20) }}
          />
        ) : (
          <span className="mindmap-node-text" title="双击编辑">
            {node.text}
          </span>
        )}

        {/* 操作按钮 — hover 显示 */}
        <span className="mindmap-node-actions">
          <button
            className="mindmap-action-btn add"
            title="添加子节点"
            onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
          >
            <Plus size={13} />
          </button>
          {depth > 0 && (
            <button
              className="mindmap-action-btn del"
              title="删除节点"
              onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            >
              <X size={13} />
            </button>
          )}
        </span>
      </div>

      {/* 子节点 */}
      {!isCollapsed && hasChildren && (
        <div className="mindmap-children animate-in">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onRename={onRename}
              onToggleCollapse={onToggleCollapse}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ── 主编辑器组件 ── */
const InteractiveMindMapEditor: React.FC<Props> = ({
  mindmapId, initialTitle, initialMarkdown,
  onBack, onSaved, saveUrl, saveMethod, saveBody,
}) => {
  const [title, setTitle] = useState(initialTitle || "未命名导图");
  const [tree, setTree] = useState<MindMapNode>(() => {
    const md = initialMarkdown || "# 中心主题";
    return markdownToTree(md, title || "中心主题");
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<MindMapNode[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  useEffect(() => {
    if (initialMarkdown && initialTitle) {
      setTree(markdownToTree(initialMarkdown, initialTitle));
      setTitle(initialTitle);
    }
  }, [initialMarkdown, initialTitle]);

  const pushHistory = useCallback((newTree: MindMapNode) => {
    const newHistory = history.slice(0, historyIdx + 1);
    newHistory.push(cloneTree(newTree));
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIdx(newHistory.length - 1);
  }, [history, historyIdx]);

  const updateTree = useCallback((fn: (t: MindMapNode) => MindMapNode) => {
    setTree((prev) => {
      const next = fn(prev);
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const handleAddChild = (parentId: string) => {
    updateTree((t) =>
      updateNode(t, parentId, (n) => ({
        ...n,
        collapsed: false,
        children: [...n.children, { id: newNodeId(), text: "新节点", children: [] }],
      }))
    );
  };

  const handleDelete = (id: string) => {
    updateTree((t) => deleteNode(t, id) ?? t);
    if (selectedId === id) setSelectedId(null);
  };

  const handleRename = (id: string, text: string) => {
    updateTree((t) => updateNode(t, id, (n) => ({ ...n, text })));
  };

  const handleToggleCollapse = (id: string) => {
    updateTree((t) =>
      updateNode(t, id, (n) => ({ ...n, collapsed: !n.collapsed }))
    );
  };

  const handleUndo = () => {
    if (historyIdx > 0) {
      const idx = historyIdx - 1;
      setHistoryIdx(idx);
      setTree(cloneTree(history[idx]));
    }
  };

  const handleRedo = () => {
    if (historyIdx < history.length - 1) {
      const idx = historyIdx + 1;
      setHistoryIdx(idx);
      setTree(cloneTree(history[idx]));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const md = treeToMarkdown(tree).replace(/^# /, "");
      if (mindmapId != null) {
        const url = saveUrl || `/api/v1/learning/mindmaps/${mindmapId}`;
        const method = saveMethod || "PUT";
        const body = saveBody ? saveBody(md) : { title, content: { markdown: `# ${title}\n${md}` } };
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (res.ok) { showMessage.success("保存成功"); onSaved?.(); }
        else showMessage.error(`保存失败: ${res.status}`);
      }
    } catch (e: any) { showMessage.error(e.message); }
    setSaving(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); handleRedo(); }
      if (e.key === "Tab" && selectedId) {
        e.preventDefault();
        handleAddChild(selectedId);
      }
      if (e.key === "Delete" && selectedId && tree.id !== selectedId) {
        e.preventDefault();
        handleDelete(selectedId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, tree.id, handleAddChild, handleDelete]);

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* 工具栏 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-1.5">
        <Button variant="ghost" size="sm" onClick={() => (onBack ? onBack() : window.close())}
          className="h-7 text-xs gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />返回
        </Button>

        <Input value={title} onChange={(e) => setTitle(e.target.value)}
          className="h-7 w-48 text-xs font-medium border-0 bg-transparent focus-visible:ring-0 px-1"
          placeholder="导图标题" />

        <span className="text-xs text-text-tertiary">
          节点: {countNodes(tree)} · Tab 添加子节点 · Delete 删除 · 双击重命名
        </span>

        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={handleUndo}
            disabled={historyIdx <= 0} className="h-7 text-xs" title="撤销 (Ctrl+Z)">↩</Button>
          <Button size="sm" variant="ghost" onClick={handleRedo}
            disabled={historyIdx >= history.length - 1} className="h-7 text-xs" title="重做 (Ctrl+Shift+Z)">↪</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1">
            <Save className="h-3 w-3" />{saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      {/* 导图区域 */}
      <div className="flex-1 overflow-auto p-6" onClick={() => setSelectedId(null)}>
        <TreeNode
          node={tree}
          depth={0}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAddChild={handleAddChild}
          onDelete={handleDelete}
          onRename={handleRename}
          onToggleCollapse={handleToggleCollapse}
        />
      </div>

      <style>{`
        .mindmap-tree-node { position: relative; }
        .mindmap-node-row {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 10px; margin: 2px 0;
          border-radius: 8px; cursor: pointer;
          border: 1.5px solid transparent;
          background: var(--ws-color-surface, #fff);
          transition: all 0.15s ease;
          font-size: 14px; line-height: 1.5;
        }
        .mindmap-node-row:hover {
          border-color: var(--ws-color-border, #e5e7eb);
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .mindmap-node-row.selected {
          border-color: var(--ws-color-primary, #3b82f6);
          background: color-mix(in srgb, var(--ws-color-primary, #3b82f6) 8%, transparent);
        }
        .mindmap-collapse-btn {
          display: flex; align-items: center; justify-content: center;
          width: 18px; height: 18px; border-radius: 4px;
          color: var(--ws-color-text-tertiary, #9ca3af);
        }
        .mindmap-collapse-btn:hover { background: var(--ws-color-surface-2, #f3f4f6); }
        .mindmap-node-text { font-weight: 500; min-width: 20px; }
        .mindmap-inline-input {
          border: none; outline: none; background: transparent;
          font-size: 14px; font-weight: 500; border-bottom: 2px solid var(--ws-color-primary, #3b82f6);
          padding: 1px 2px;
        }
        .mindmap-node-actions {
          display: flex; gap: 1px; opacity: 0; transition: opacity 0.12s;
        }
        .mindmap-node-row:hover .mindmap-node-actions { opacity: 1; }
        .mindmap-action-btn {
          display: flex; align-items: center; justify-content: center;
          width: 20px; height: 20px; border: none; border-radius: 4px;
          cursor: pointer; background: transparent; color: var(--ws-color-text-tertiary, #9ca3af);
          transition: all 0.12s;
        }
        .mindmap-action-btn.add:hover { background: #22c55e20; color: #16a34a; }
        .mindmap-action-btn.del:hover { background: #ef444420; color: #dc2626; }
        .mindmap-children {
          border-left: 2px solid var(--ws-color-border-secondary, #e5e7eb);
          margin-left: 11px; padding-left: 13px;
        }
        .animate-in { animation: mmFadeIn 0.2s ease; }
        @keyframes mmFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

function countNodes(node: MindMapNode): number {
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
}

export default InteractiveMindMapEditor;
