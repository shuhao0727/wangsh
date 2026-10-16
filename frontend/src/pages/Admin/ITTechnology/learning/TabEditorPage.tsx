import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { showMessage } from "@/lib/toast";
import { ArrowLeft, Save, Plus, Trash2, Eye, Code, GripVertical } from "lucide-react";

type SectionKey = "roadmap" | "knowledge" | "experiments" | "tools" | "resources";

const SECTION_LABELS: Record<SectionKey, string> = {
  roadmap: "学习路线", knowledge: "知识体系", experiments: "动手实验",
  tools: "工具生态", resources: "学习资源",
};

interface TabItem {
  _dbId?: number;
  section_key: string;
  item_key: string;
  title: string;
  content: any;
  sort_order: number;
}

const TabEditorPage: React.FC = () => {
  const { moduleKey, section } = useParams<{ moduleKey: string; section: string }>();
  const mk = moduleKey ?? "ml";
  const sec = (section ?? "roadmap") as SectionKey;

  const [items, setItems] = useState<TabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [editJson, setEditJson] = useState("{}");
  const [jsonError, setJsonError] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [loadError, setLoadError] = useState("");
  const loadRequestRef = useRef(0);
  const scopeGenerationRef = useRef(0);

  // Load data
  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setLoadError("");
    try {
      const url = sec === "roadmap"
        ? `/api/v1/learning/content/${mk}?section=${sec}`
        : `/api/v1/learning/content/${mk}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`加载失败: ${res.status}`);
      }
      const data = await res.json();
      const filtered = (Array.isArray(data) ? data : []).filter((d: any) => d.section_key === sec);
      const sorted = filtered.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      if (requestId !== loadRequestRef.current) return;
      setItems(sorted.map((d: any) => ({
        _dbId: d.id, section_key: d.section_key, item_key: d.item_key,
        title: d.title, content: d.content, sort_order: d.sort_order ?? 0,
      })));
      setSelectedIdx(0);
      setEditJson(JSON.stringify(sorted[0]?.content ?? {}, null, 2));
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      const message = error instanceof Error ? error.message : "加载失败";
      setItems([]);
      setLoadError(message);
      showMessage.error(message);
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }, [mk, sec]);

  useEffect(() => {
    scopeGenerationRef.current += 1;
    void load();
    return () => {
      scopeGenerationRef.current += 1;
      loadRequestRef.current += 1;
    };
  }, [load]);

  // Switch item
  const selectItem = (idx: number) => {
    setSelectedIdx(idx);
    setEditJson(JSON.stringify(items[idx]?.content ?? {}, null, 2));
    setJsonError("");
  };

  // Validate JSON
  const handleJsonChange = (val: string) => {
    setEditJson(val);
    try { JSON.parse(val); setJsonError(""); } catch { setJsonError("JSON 格式错误"); }
  };

  // Save current item
  const saveItem = async () => {
    if (jsonError) { showMessage.error("请先修正 JSON 错误"); return; }
    const item = items[selectedIdx];
    if (!item) return;
    const scopeGeneration = scopeGenerationRef.current;
    setSaving(true);
    try {
      const content = JSON.parse(editJson);
      const res = await fetch(`/api/v1/learning/content/${mk}/${sec}/${encodeURIComponent(item.item_key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: content.name || content.label || content.title || item.item_key,
          summary: content.description || content.data || content.summary || "",
          content, tags: [], difficulty: content.difficulty || "",
          sort_order: item.sort_order, enabled: true, source_type: "admin",
          section_key: sec, item_key: item.item_key,
        }),
        credentials: "include",
      });
      if (res.ok) {
        showMessage.success("保存成功");
        if (scopeGeneration === scopeGenerationRef.current) {
          await load();
        }
      } else {
        showMessage.error(`保存失败: ${res.status}`);
      }
    } catch (e: any) {
      showMessage.error(`保存失败: ${e.message}`);
    }
    setSaving(false);
  };

  // Delete item
  const deleteItem = async (idx: number) => {
    const item = items[idx];
    if (!item?._dbId) return;
    if (!confirm(`确认删除 "${item.title}"？`)) return;
    const scopeGeneration = scopeGenerationRef.current;
    try {
      const res = await fetch(`/api/v1/learning/content/${mk}/${sec}/${encodeURIComponent(item.item_key)}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`删除失败: ${res.status}`);
      }
      showMessage.success("已删除");
      if (scopeGeneration === scopeGenerationRef.current) {
        await load();
      }
    } catch (error) {
      showMessage.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  // Add new item
  const addItem = () => {
    const key = prompt("输入 item_key（英文标识）：");
    if (!key) return;
    const title = prompt("输入标题：") || key;
    const newItems = [...items, {
      section_key: sec, item_key: key, title,
      content: { name: title }, sort_order: items.length,
    }];
    setItems(newItems);
    setSelectedIdx(newItems.length - 1);
    setEditJson(JSON.stringify({ name: title }, null, 2));
  };

  const sectionLabel = SECTION_LABELS[sec] || sec;
  const moduleLabel = mk === "ml" ? "机器学习" : mk === "ai" ? "人工智能" : "智能体";

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-1.5">
        <Button variant="ghost" size="sm" onClick={() => window.close()} className="h-7 text-xs gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />返回
        </Button>
        <span className="text-xs font-medium">{moduleLabel} · {sectionLabel} 管理</span>
        <span className="text-[10px] text-text-tertiary">{items.length} 项</span>

        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant={viewMode === "edit" ? "secondary" : "ghost"}
            onClick={() => setViewMode("edit")} className="h-7 text-xs gap-1"><Code className="h-3 w-3" />编辑</Button>
          <Button size="sm" variant={viewMode === "preview" ? "secondary" : "ghost"}
            onClick={() => setViewMode("preview")} className="h-7 text-xs gap-1"><Eye className="h-3 w-3" />预览</Button>
          <Button size="sm" onClick={saveItem} disabled={saving || !!jsonError} className="h-7 text-xs gap-1">
            <Save className="h-3 w-3" />{saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">加载中...</div>
      ) : loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-text-secondary">
          <p>{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>重新加载</Button>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Item list */}
          <aside className="w-[200px] shrink-0 border-r border-border flex flex-col bg-surface-2">
            <div className="shrink-0 border-b border-border p-2">
              <Button variant="ghost" size="sm" onClick={addItem} className="w-full h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />新建
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {items.map((item, i) => (
                <div key={item.item_key || i} role="button" tabIndex={0}
                  onClick={() => selectItem(i)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") selectItem(i);
                  }}
                  className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] transition-colors ${
                    i === selectedIdx ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent text-text-secondary"
                  }`}>
                  <GripVertical className="h-3 w-3 shrink-0 text-text-tertiary" />
                  <span className="truncate flex-1">{item.title}</span>
                  <button type="button" aria-label={`删除 ${item.title}`}
                    onClick={(e) => { e.stopPropagation(); void deleteItem(i); }}
                    className="shrink-0 rounded p-0.5 hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </ScrollArea>
          </aside>

          {/* Editor / Preview */}
          <div className="flex flex-1 min-w-0">
            {viewMode === "preview" ? (
              <div className="flex-1 overflow-auto p-4">
                <pre className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(items[selectedIdx]?.content ?? {}, null, 2)}</pre>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="shrink-0 border-b border-border px-3 py-1.5 flex items-center gap-2">
                  <span className="text-[10px] text-text-tertiary">item_key:</span>
                  <span className="text-xs font-mono">{items[selectedIdx]?.item_key || "—"}</span>
                  {jsonError && <span className="text-[10px] text-destructive ml-auto">{jsonError}</span>}
                </div>
                <textarea
                  value={editJson}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="flex-1 w-full resize-none border-0 bg-surface p-4 font-mono text-[13px] leading-relaxed outline-none text-text-base"
                  placeholder='{ "name": "项目名称", ... }'
                  spellCheck={false}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TabEditorPage;
