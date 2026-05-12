/**
 * 完整思维导图编辑器 — 嵌入官方 simple-mind-map Demo
 * 数据通过 localStorage 注入，保存通过 postMessage 回传
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showMessage } from "@/lib/toast";
import { ArrowLeft, Save, ExternalLink } from "lucide-react";

interface LibNode { data: { text: string; uid?: string; [key: string]: unknown }; children: LibNode[]; }
function mdToLibData(md: string, rootText: string): LibNode {
  let uid = 0; const nextUid = () => `n${++uid}`;
  const lines = md.split("\n").filter((l) => l.trim());
  const root: LibNode = { data: { text: rootText, uid: nextUid() }, children: [] };
  const stack: { level: number; node: LibNode }[] = [{ level: 0, node: root }];
  for (const line of lines) {
    const m = line.match(/^(#+)\s+(.+)/); if (!m) continue;
    const child: LibNode = { data: { text: m[2].trim(), uid: nextUid() }, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= m[1].length) stack.pop();
    if (stack.length > 0) stack[stack.length - 1].node.children.push(child);
    stack.push({ level: m[1].length, node: child });
  }
  return root;
}
function libDataToMd(node: LibNode, level = 1): string {
  let md = `${"#".repeat(level)} ${node.data.text}\n`;
  for (const c of node.children) md += libDataToMd(c, level + 1);
  return md;
}

interface Props {
  mindmapId?: number; initialTitle?: string; initialMarkdown?: string;
  onBack?: () => void; onSaved?: () => void;
}

const MindMapEditorLib: React.FC<Props> = ({ mindmapId, initialTitle, initialMarkdown, onBack, onSaved }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [title, setTitle] = useState(initialTitle || "未命名导图");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // 通过 localStorage 把初始数据传给 iframe
  useEffect(() => {
    const rootText = initialTitle || "中心主题";
    const md = initialMarkdown || `# ${rootText}`;
    const tree = mdToLibData(md, rootText);
    const demoData = {
      root: tree,
      theme: { template: "classic4", config: {} },
      layout: "logicalStructure",
      config: {},
      view: null,
    };
    try { localStorage.setItem("_wangsh_mindmap_data", JSON.stringify(demoData)); } catch {}
  }, [initialTitle, initialMarkdown]);

  // 监听保存
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.data?.type === "mindmap:save") {
        handleSaveData(e.data.data);
      }
    };
    window.addEventListener("message", h);
    return () => window.removeEventListener("message", h);
  }, []); // eslint-disable-line

  // Ctrl+S
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []); // eslint-disable-line

  const handleSave = () => {
    // Demo 在 takeOverApp 模式下，Ctrl+S 会自动调用 saveMindMapData
    // 我们额外触发一次主动获取
    try {
      const w = iframeRef.current?.contentWindow as any;
      if (w?._mmData) {
        handleSaveData(w._mmData.root || w._mmData);
      }
    } catch {}
  };

  const handleSaveData = async (data: LibNode) => {
    if (!data || mindmapId == null) return;
    setSaving(true);
    try {
      const md = libDataToMd(data).replace(/^# /, "");
      const res = await fetch(`/api/v1/learning/mindmaps/${mindmapId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ title, content: { markdown: `# ${title}\n${md}` } }),
      });
      if (res.ok) { showMessage.success("导图已保存"); onSaved?.(); }
      else showMessage.error("保存失败");
    } catch { showMessage.error("保存失败"); }
    setSaving(false);
  };

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-1.5">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-7 text-xs gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />返回
        </Button>
        <Input value={title} onChange={(e) => setTitle(e.target.value)}
          className="h-7 w-36 text-xs font-medium border-0 bg-transparent focus-visible:ring-0 px-1" />
        <span className="text-[10px] text-text-tertiary">Ctrl+S 保存 · 数据自动同步</span>
        <div className="ml-auto flex items-center gap-1">
          <a href="/mindmap-demo/index.html" target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" asChild>
              <span><ExternalLink className="h-3 w-3" />新窗口</span>
            </Button>
          </a>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1">
            <Save className="h-3 w-3" />{saving ? "..." : "保存"}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4 text-xs text-text-tertiary bg-surface-2 border-b border-border">
          正在加载...
        </div>
      )}

      <iframe ref={iframeRef} src="/mindmap-demo/index.html" className="flex-1 w-full border-0"
        title="思维导图编辑器" onLoad={() => setLoading(false)} />
    </div>
  );
};

export default MindMapEditorLib;
