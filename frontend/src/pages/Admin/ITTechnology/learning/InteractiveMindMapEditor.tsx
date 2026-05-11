/**
 * 交互式思维导图编辑器 — 大纲模式 + 可视化导图模式
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showMessage } from "@/lib/toast";
import {
  ArrowLeft, Save, Plus, X, ChevronRight, ChevronDown,
  ListTree, GitFork, Undo2, Redo2,
} from "lucide-react";

/* ═══════════════════════ 数据模型 ═══════════════════════ */
type MindMapNode = {
  id: string;
  text: string;
  children: MindMapNode[];
  collapsed?: boolean;
  color?: string;
};

let nodeCounter = 0;
const newNodeId = () => `n${++nodeCounter}`;
function cloneTree(n: MindMapNode): MindMapNode { return { ...n, children: n.children.map(cloneTree) }; }

const PALETTE = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#06B6D4","#F97316"];

/* ── Markdown ↔ Tree ── */
function markdownToTree(md: string, rootText: string): MindMapNode {
  const lines = md.split("\n").filter((l) => l.trim());
  const root: MindMapNode = { id: newNodeId(), text: rootText, children: [], color: PALETTE[0] };
  const stack: { level: number; node: MindMapNode }[] = [{ level: 0, node: root }];
  for (const line of lines) {
    const match = line.match(/^(#+)\s+(.+)/);
    if (!match) continue;
    const child: MindMapNode = { id: newNodeId(), text: match[2].trim(), children: [], color: PALETTE[Math.min(match[1].length, PALETTE.length - 1)] };
    while (stack.length > 0 && stack[stack.length - 1].level >= match[1].length) stack.pop();
    if (stack.length > 0) stack[stack.length - 1].node.children.push(child);
    stack.push({ level: match[1].length, node: child });
  }
  return root;
}

function treeToMarkdown(node: MindMapNode, level = 1): string {
  let md = `${"#".repeat(level)} ${node.text}\n`;
  for (const child of node.children) md += treeToMarkdown(child, level + 1);
  return md;
}

function countNodes(n: MindMapNode): number { return 1 + n.children.reduce((s, c) => s + countNodes(c), 0); }

function findNode(root: MindMapNode, id: string): MindMapNode | null {
  if (root.id === id) return root;
  for (const c of root.children) { const f = findNode(c, id); if (f) return f; }
  return null;
}

function updateNode(root: MindMapNode, id: string, fn: (n: MindMapNode) => MindMapNode): MindMapNode {
  if (root.id === id) return fn(root);
  return { ...root, children: root.children.map((c) => updateNode(c, id, fn)) };
}

function deleteNode(root: MindMapNode, id: string): MindMapNode | null {
  if (root.id === id) return null;
  return { ...root, children: root.children.map((c) => deleteNode(c, id)).filter((c): c is MindMapNode => c !== null) };
}

/* ═══════════════════════ 布局引擎 ═══════════════════════ */
const NODE_W = 150, NODE_H = 40, H_GAP = 22, V_GAP = 12;

type LayoutNode = { node: MindMapNode; x: number; y: number; w: number; h: number; children: LayoutNode[] };

function layoutTree(tree: MindMapNode): LayoutNode {
  function lay(n: MindMapNode, depth: number): LayoutNode {
    const kids = n.children.map((c) => lay(c, depth + 1));
    const x = depth * (NODE_W + H_GAP);

    if (kids.length === 0) return { node: n, x, y: 0, w: NODE_W, h: NODE_H, children: kids };

    // 子树排布
    let cy = 0;
    for (const k of kids) { k.y = cy; cy += k.h + V_GAP; }
    const totalH = cy - V_GAP;
    const mid = totalH / 2 - NODE_H / 2;
    // 重新居中
    for (const k of kids) k.y -= mid;
    return { node: n, x, y: 0, w: NODE_W, h: Math.max(NODE_H, totalH), children: kids };
  }
  return lay(tree, 0);
}

function flattenLayout(ln: LayoutNode): LayoutNode[] {
  return [ln, ...ln.children.flatMap(flattenLayout)];
}

type Point = { x: number; y: number };
function getCenter(ln: LayoutNode): Point {
  return { x: ln.x + ln.w, y: ln.y + ln.h / 2 };
}

/* ═══════════════════════ Props ═══════════════════════ */
interface Props {
  mindmapId?: number;
  initialTitle?: string;
  initialMarkdown?: string;
  onBack?: () => void;
  onSaved?: () => void;
}

/* ═══════════════════════ 主组件 ═══════════════════════ */
const InteractiveMindMapEditor: React.FC<Props> = ({ mindmapId, initialTitle, initialMarkdown, onBack, onSaved }) => {
  const [title, setTitle] = useState(initialTitle || "未命名导图");
  const [tree, setTree] = useState<MindMapNode>(() =>
    markdownToTree(initialMarkdown || "# 中心主题", title));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"mindmap" | "outline">("mindmap");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [history, setHistory] = useState<MindMapNode[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (initialMarkdown && initialTitle) {
      setTree(markdownToTree(initialMarkdown, initialTitle));
      setTitle(initialTitle);
    }
  }, [initialMarkdown, initialTitle]);

  const pushHistory = useCallback((newTree: MindMapNode) => {
    const h = history.slice(0, historyIdx + 1);
    h.push(cloneTree(newTree));
    if (h.length > 50) h.shift();
    setHistory(h);
    setHistoryIdx(h.length - 1);
  }, [history, historyIdx]);

  const update = useCallback((fn: (t: MindMapNode) => MindMapNode) => {
    setTree((prev) => { const next = fn(prev); pushHistory(next); return next; });
  }, [pushHistory]);

  const handleAddChild = (parentId: string) => {
    update((t) => updateNode(t, parentId, (n) => ({
      ...n, collapsed: false,
      children: [...n.children, { id: newNodeId(), text: "新节点", children: [], color: PALETTE[Math.floor(Math.random() * PALETTE.length)] }],
    })));
    setEditingId(null);
  };

  const handleAddSibling = (id: string) => {
    if (id === tree.id) return; // root can't have sibling
    update((t) => {
      // Find parent of id
      function addSibling(root: MindMapNode): MindMapNode {
        const idx = root.children.findIndex((c) => c.id === id);
        if (idx >= 0) {
          const nc = [...root.children];
          nc.splice(idx + 1, 0, { id: newNodeId(), text: "新节点", children: [], color: PALETTE[Math.floor(Math.random() * PALETTE.length)] });
          return { ...root, children: nc };
        }
        return { ...root, children: root.children.map(addSibling) };
      }
      return addSibling(t);
    });
  };

  const handleDelete = (id: string) => {
    if (id === tree.id) return;
    update((t) => deleteNode(t, id) ?? t);
    if (selectedId === id) setSelectedId(null);
  };

  const handleRename = (id: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    update((t) => updateNode(t, id, (n) => ({ ...n, text: trimmed })));
    setEditingId(null);
  };

  const handleToggleCollapse = (id: string) => {
    update((t) => updateNode(t, id, (n) => ({ ...n, collapsed: !n.collapsed })));
  };

  const handleUndo = () => {
    if (historyIdx > 0) { const idx = historyIdx - 1; setHistoryIdx(idx); setTree(cloneTree(history[idx])); }
  };
  const handleRedo = () => {
    if (historyIdx < history.length - 1) { const idx = historyIdx + 1; setHistoryIdx(idx); setTree(cloneTree(history[idx])); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const md = treeToMarkdown(tree).replace(/^# /, "");
      const url = `/api/v1/learning/mindmaps/${mindmapId}`;
      const body = { title, content: { markdown: `# ${title}\n${md}` } };
      const res = await fetch(url, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(body),
      });
      if (res.ok) { showMessage.success("保存成功"); onSaved?.(); }
      else showMessage.error(`保存失败: ${res.status}`);
    } catch (e: any) { showMessage.error(e.message); }
    setSaving(false);
  };

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); handleRedo(); }
      if (e.key === "Tab" && selectedId) { e.preventDefault(); handleAddChild(selectedId); }
      if (e.key === "Enter" && selectedId && selectedId !== tree.id) { e.preventDefault(); handleAddSibling(selectedId); }
      if (e.key === "Delete" && selectedId && selectedId !== tree.id) { e.preventDefault(); handleDelete(selectedId); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selectedId, tree.id]);

  /* ── 布局 ── */
  const layout = useMemo(() => layoutTree(tree), [tree]);
  const flat = useMemo(() => flattenLayout(layout), [layout]);
  const nodeMap = useMemo(() => new Map(flat.map((l) => [l.node.id, l])), [flat]);

  /* ── 贝塞尔连线 ── */
  const paths: { d: string; color: string; collapsed: boolean }[] = useMemo(() => {
    const result: { d: string; color: string; collapsed: boolean }[] = [];
    function walk(ln: LayoutNode) {
      if (ln.node.collapsed) return;
      const pc = getCenter(ln);
      for (const ch of ln.children) {
        const cc = getCenter(ch);
        const cx1 = pc.x + Math.abs(cc.x - pc.x) * 0.5;
        const d = `M ${pc.x} ${pc.y} C ${cx1} ${pc.y}, ${cx1} ${cc.y}, ${cc.x} ${cc.y}`;
        result.push({ d, color: ch.node.color || PALETTE[0], collapsed: false });
        walk(ch);
      }
    }
    walk(layout);
    return result;
  }, [layout]);

  /* ── 双击重命名 ── */
  const startEdit = (id: string, text: string) => {
    setEditingId(id);
    setEditText(text);
  };

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* ── 工具栏 ── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-1.5">
        <Button variant="ghost" size="sm" onClick={() => (onBack ? onBack() : window.close())} className="h-7 text-xs gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />返回
        </Button>
        <Input value={title} onChange={(e) => setTitle(e.target.value)}
          className="h-7 w-36 text-xs font-medium border-0 bg-transparent focus-visible:ring-0 px-1" placeholder="标题" />

        <div className="flex items-center gap-0.5 ml-2 border border-border rounded-md p-0.5">
          <Button size="sm" variant={mode === "mindmap" ? "secondary" : "ghost"}
            onClick={() => setMode("mindmap")} className="h-6 text-[11px] gap-1 px-2">
            <GitFork className="h-3 w-3" />导图
          </Button>
          <Button size="sm" variant={mode === "outline" ? "secondary" : "ghost"}
            onClick={() => setMode("outline")} className="h-6 text-[11px] gap-1 px-2">
            <ListTree className="h-3 w-3" />大纲
          </Button>
        </div>

        <span className="text-[11px] text-text-tertiary hidden sm:inline">
          节点 {countNodes(tree)} · Tab 加子 · Enter 加兄 · Del 删 · 双击改名
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          <Button size="sm" variant="ghost" onClick={handleUndo} disabled={historyIdx <= 0} className="h-6 w-6 p-0" title="撤销 Ctrl+Z"><Undo2 className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={handleRedo} disabled={historyIdx >= history.length - 1} className="h-6 w-6 p-0" title="重做 Ctrl+Shift+Z"><Redo2 className="h-3.5 w-3.5" /></Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1 ml-1">
            <Save className="h-3 w-3" />{saving ? "..." : "保存"}
          </Button>
        </div>
      </div>

      {/* ── 导图模式 ── */}
      {mode === "mindmap" && (
        <div className="flex-1 overflow-auto relative" style={{ minHeight: Math.max(400, layout.h + 80) }}>
          <div className="absolute" style={{ left: 40, top: 40 + Math.max(0, -layout.y), width: layout.w + 100, height: layout.h + 80 }}>
            {/* SVG 连线层 */}
            <svg className="absolute inset-0 pointer-events-none" style={{ overflow: "visible", zIndex: 0 }}>
              {paths.map((p, i) => (
                <path key={i} d={p.d} stroke={p.color} strokeWidth={2.5} fill="none" opacity={0.4}
                  style={{ transition: "d 0.35s ease" }} />
              ))}
            </svg>

            {/* 节点层 */}
            {flat.map((ln) => (
              <div
                key={ln.node.id}
                className={`mindmap-visual-node ${selectedId === ln.node.id ? "selected" : ""} ${ln.node.collapsed ? "collapsed" : ""}`}
                style={{
                  position: "absolute", left: ln.x, top: ln.y,
                  width: ln.w, minHeight: ln.h,
                  borderColor: ln.node.color || PALETTE[0],
                  transition: "left 0.35s ease, top 0.35s ease, border-color 0.2s, box-shadow 0.2s, opacity 0.2s",
                }}
                onClick={(e) => { e.stopPropagation(); setSelectedId(ln.node.id); }}
                onDoubleClick={() => startEdit(ln.node.id, ln.node.text)}
              >
                <div className="mindmap-visual-node-inner">
                  {editingId === ln.node.id ? (
                    <input
                      className="mindmap-inline-input"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={() => handleRename(ln.node.id, editText)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") handleRename(ln.node.id, editText);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="mindmap-visual-text">{ln.node.text}</span>
                  )}

                  <span className="mindmap-visual-actions">
                    <button className="mm-btn add" title="添加子节点 (Tab)"
                      onClick={(e) => { e.stopPropagation(); handleAddChild(ln.node.id); }}><Plus size={12} /></button>
                    {ln.node.id !== tree.id && (
                      <button className="mm-btn add" title="添加兄弟节点 (Enter)"
                        onClick={(e) => { e.stopPropagation(); handleAddSibling(ln.node.id); }}><ChevronRight size={12} /></button>
                    )}
                    {ln.node.id !== tree.id && (
                      <button className="mm-btn del" title="删除 (Delete)"
                        onClick={(e) => { e.stopPropagation(); handleDelete(ln.node.id); }}><X size={12} /></button>
                    )}
                  </span>
                </div>
                {ln.node.children.length > 0 && (
                  <span className="mindmap-collapse-dot"
                    onClick={(e) => { e.stopPropagation(); handleToggleCollapse(ln.node.id); }}>
                    {ln.node.collapsed ? "+" : "−"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 大纲模式 ── */}
      {mode === "outline" && (
        <div className="flex-1 overflow-auto p-6" onClick={() => setSelectedId(null)}>
          <OutlineNode node={tree} depth={0} selectedId={selectedId} editingId={editingId} editText={editText}
            onSelect={setSelectedId} onAddChild={handleAddChild} onAddSibling={handleAddSibling}
            onDelete={handleDelete} onRename={handleRename} onToggleCollapse={handleToggleCollapse}
            onStartEdit={startEdit} onEditText={setEditText}
            tree={tree} />
        </div>
      )}

      <style>{`
        /* 导图节点 */
        .mindmap-visual-node {
          border: 2px solid; border-radius: 10px;
          background: var(--ws-color-surface, #fff);
          cursor: pointer; padding: 4px 2px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .mindmap-visual-node:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .mindmap-visual-node.selected { box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 30%, transparent), 0 4px 12px rgba(0,0,0,0.1); }
        .mindmap-visual-node.collapsed { opacity: 0.5; }
        .mindmap-visual-node-inner {
          display: flex; align-items: center; justify-content: center;
          min-height: 32px; padding: 4px 8px; position: relative;
        }
        .mindmap-visual-text { font-size: 13px; font-weight: 500; text-align: center; line-height: 1.3; word-break: break-word; }
        .mindmap-inline-input {
          border: none; outline: none; background: transparent; text-align: center;
          font-size: 13px; font-weight: 500; width: 120px;
          border-bottom: 2px solid var(--ws-color-primary, #3B82F6);
        }
        .mindmap-visual-actions {
          display: flex; gap: 1px; opacity: 0; transition: opacity 0.12s;
          position: absolute; top: -18px; left: 50%; transform: translateX(-50%);
          background: var(--ws-color-surface, #fff); border-radius: 6px; padding: 1px 2px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }
        .mindmap-visual-node:hover .mindmap-visual-actions { opacity: 1; }
        .mm-btn {
          display: flex; align-items: center; justify-content: center;
          width: 18px; height: 18px; border: none; border-radius: 4px;
          cursor: pointer; background: transparent; color: var(--ws-color-text-tertiary, #9ca3af);
          transition: all 0.12s;
        }
        .mm-btn.add:hover { background: #22c55e20; color: #16a34a; }
        .mm-btn.del:hover { background: #ef444420; color: #dc2626; }
        .mindmap-collapse-dot {
          position: absolute; right: -9px; top: 50%; transform: translateY(-50%);
          width: 18px; height: 18px; border-radius: 50%; font-size: 10px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          background: var(--ws-color-surface, #fff); border: 1.5px solid currentColor;
          opacity: 0.5; cursor: pointer; transition: opacity 0.15s;
        }
        .mindmap-collapse-dot:hover { opacity: 1; }

        /* 大纲模式 */
        .mm-outline-node { position: relative; }
        .mm-outline-row {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 10px; margin: 1px 0; border-radius: 6px; cursor: pointer;
          border: 1.5px solid transparent; font-size: 13px; line-height: 1.5;
          transition: all 0.12s ease;
        }
        .mm-outline-row:hover { border-color: var(--ws-color-border, #e5e7eb); }
        .mm-outline-row.selected { border-color: var(--ws-color-primary, #3B82F6); background: color-mix(in srgb, var(--ws-color-primary) 6%, transparent); }
        .mm-outline-collapse { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 3px; flex-shrink: 0; }
        .mm-outline-text { min-width: 20px; font-weight: 450; }
        .mm-outline-actions { display: flex; gap: 1px; opacity: 0; transition: opacity 0.12s; }
        .mm-outline-row:hover .mm-outline-actions { opacity: 1; }
        .mm-outline-kids { border-left: 2px solid var(--ws-color-border-secondary, #e5e7eb); margin-left: 11px; padding-left: 13px; }
      `}</style>
    </div>
  );
};

/* ═══════════════════════ 大纲子组件 ═══════════════════════ */
const OutlineNode: React.FC<{
  node: MindMapNode; depth: number; tree: MindMapNode;
  selectedId: string | null; editingId: string | null; editText: string;
  onSelect: (id: string) => void; onAddChild: (id: string) => void; onAddSibling: (id: string) => void;
  onDelete: (id: string) => void; onRename: (id: string, t: string) => void;
  onToggleCollapse: (id: string) => void; onStartEdit: (id: string, t: string) => void; onEditText: (t: string) => void;
}> = ({ node, depth, tree, selectedId, editingId, editText, onSelect, onAddChild, onAddSibling, onDelete, onRename, onToggleCollapse, onStartEdit, onEditText }) => {
  const isSel = selectedId === node.id;
  const isEdit = editingId === node.id;
  const hasKids = node.children.length > 0;
  const collapsed = node.collapsed ?? false;
  return (
    <div className="mm-outline-node" style={{ marginLeft: depth === 0 ? 0 : 0 }}>
      <div className={`mm-outline-row ${isSel ? "selected" : ""}`}
        onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
        onDoubleClick={() => onStartEdit(node.id, node.text)}>
        <span className="mm-outline-collapse" onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}>
          {hasKids ? (collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />) : <span style={{ width: 14 }} />}
        </span>
        {isEdit ? (
          <input className="mindmap-inline-input" value={editText} onChange={(e) => onEditText(e.target.value)}
            onBlur={() => onRename(node.id, editText)}
            onKeyDown={(e) => { if (e.key === "Enter") onRename(node.id, editText); if (e.key === "Escape") onRename(node.id, node.text); }}
            autoFocus onClick={(e) => e.stopPropagation()} style={{ width: Math.max(60, editText.length * 10 + 20) }} />
        ) : (
          <span className="mm-outline-text">{node.text}</span>
        )}
        <span className="mm-outline-actions">
          <button className="mm-btn add" title="子节点 (Tab)" onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}><Plus size={13} /></button>
          {node.id !== tree.id && (
            <button className="mm-btn add" title="兄弟节点 (Enter)" onClick={(e) => { e.stopPropagation(); onAddSibling(node.id); }}><ChevronRight size={13} /></button>
          )}
          {node.id !== tree.id && (
            <button className="mm-btn del" title="删除 (Del)" onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}><X size={13} /></button>
          )}
        </span>
      </div>
      {!collapsed && hasKids && (
        <div className="mm-outline-kids">
          {node.children.map((c) => (
            <OutlineNode key={c.id} {...{ node: c, depth: depth + 1, tree, selectedId, editingId, editText, onSelect, onAddChild, onAddSibling, onDelete, onRename, onToggleCollapse, onStartEdit, onEditText }} />
          ))}
        </div>
      )}
    </div>
  );
};

export default InteractiveMindMapEditor;
