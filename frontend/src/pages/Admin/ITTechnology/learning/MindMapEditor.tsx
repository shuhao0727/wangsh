/**
 * 思维导图编辑器 — 支持模块模式和个人模式
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showMessage } from "@/lib/toast";
import { ArrowLeft, Save, Eye, Edit3 } from "lucide-react";

interface Props {
  /** 个人导图 ID（新模式） */
  mindmapId?: number;
  initialTitle?: string;
  initialMarkdown?: string;
  onBack?: () => void;
  onSaved?: () => void;
}

const MindMapEditor: React.FC<Props> = ({ mindmapId, initialTitle, initialMarkdown, onBack, onSaved }) => {
  const { moduleKey } = useParams<{ moduleKey: string }>();
  const isPersonal = mindmapId != null;

  const containerRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(initialTitle || "");
  const [markdown, setMarkdown] = useState(initialMarkdown || "");
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isPersonal);

  // 模块模式：从 DB 加载
  useEffect(() => {
    if (isPersonal) { setLoading(false); return; }
    const mk = moduleKey ?? "ml";
    (async () => {
      try {
        const res = await fetch(`/api/v1/learning/content/${mk}`);
        if (res.ok) {
          const items = await res.json();
          const mm = (items || []).find((d: any) => d.section_key === "mindmap" && d.item_key === "overview");
          if (mm?.content?.markdown) {
            setMarkdown(mm.content.markdown);
            setTitle(mm.title || "");
          }
        }
      } catch {}
      setLoading(false);
    })();
  }, [moduleKey, isPersonal]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const content = { markdown };
      if (isPersonal) {
        const res = await fetch(`/api/v1/learning/mindmaps/${mindmapId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ title, content }),
        });
        if (res.ok) { showMessage.success("保存成功"); onSaved?.(); }
        else showMessage.error(`保存失败: ${res.status}`);
      } else {
        const mk = moduleKey ?? "ml";
        const res = await fetch(`/api/v1/learning/content/${mk}/mindmap/overview`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: title || "知识地图",
            summary: "学习地图思维导图",
            content,
            tags: [], difficulty: "", sort_order: 0, enabled: true,
            source_type: "admin", section_key: "mindmap", item_key: "overview",
          }),
        });
        if (res.ok) showMessage.success("保存成功");
        else showMessage.error(`保存失败: ${res.status}`);
      }
    } catch (e: any) { showMessage.error(e.message); }
    setSaving(false);
  };

  // Preview with markmap
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (viewMode !== "preview" || !previewRef.current || !markdown) return;
    const container = previewRef.current;
    container.innerHTML = "";
    const tryRender = () => {
      const m = (window as any).markmap;
      if (!m?.Transformer || !m?.Markmap) { setTimeout(tryRender, 200); return; }
      const { root } = new m.Transformer().transform(markdown);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%");
      container.appendChild(svg);
      m.Markmap.create(svg, {}, root);
    };
    tryRender();
  }, [viewMode, markdown]);

  if (loading) return <div className="flex h-full items-center justify-center text-sm">加载中...</div>;

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-1.5">
        <Button variant="ghost" size="sm"
          onClick={() => (onBack ? onBack() : window.close())}
          className="h-7 text-xs gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />返回
        </Button>

        {isPersonal && (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-7 w-48 text-xs font-medium border-0 bg-transparent focus-visible:ring-0 px-1"
            placeholder="导图标题"
          />
        )}
        <span className="text-xs font-medium text-text-secondary">
          {isPersonal ? "" : `${moduleKey === "ml" ? "机器学习" : moduleKey === "ai" ? "人工智能" : "智能体"} · 思维导图`}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant={viewMode === "edit" ? "secondary" : "ghost"}
            onClick={() => setViewMode("edit")} className="h-7 text-xs gap-1"><Edit3 className="h-3 w-3" />编辑</Button>
          <Button size="sm" variant={viewMode === "preview" ? "secondary" : "ghost"}
            onClick={() => setViewMode("preview")} className="h-7 text-xs gap-1"><Eye className="h-3 w-3" />预览</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1">
            <Save className="h-3 w-3" />{saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "edit" ? (
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          className="flex-1 w-full resize-none border-0 bg-surface p-5 font-mono text-sm leading-relaxed outline-none"
          placeholder={`# 标题\n## 子主题\n### 细节\n...`}
          spellCheck={false}
        />
      ) : (
        <div ref={previewRef} className="flex-1 min-h-0" />
      )}
    </div>
  );
};

export default MindMapEditor;
