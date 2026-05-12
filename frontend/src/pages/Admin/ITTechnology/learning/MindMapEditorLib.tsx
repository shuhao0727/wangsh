/**
 * 完整思维导图编辑器 — 嵌入官方 simple-mind-map Demo
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
  const [openExt, setOpenExt] = useState(false);

  // 构建 iframe URL（带初始数据）
  const iframeSrc = `/mindmap-demo/index.html`;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setLoading(false);
      // 通过 postMessage 传递初始数据
      const rootText = initialTitle || "中心主题";
      const md = initialMarkdown || `# ${rootText}`;
      const data = mdToLibData(md, rootText);
      iframe.contentWindow?.postMessage({
        type: "mindmap:load",
        data,
        title: rootText,
      }, "*");
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [initialTitle, initialMarkdown]);

  // 监听来自 iframe 的消息
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "mindmap:save") {
        handleSaveFromIframe(e.data.data);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []); // eslint-disable-line

  const handleSave = async () => {
    // 请求 iframe 发送数据
    iframeRef.current?.contentWindow?.postMessage({ type: "mindmap:getData" }, "*");
  };

  const handleSaveFromIframe = async (data: LibNode) => {
    if (mindmapId == null) return;
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
      {/* 顶部栏 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-1.5">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-7 text-xs gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />返回
        </Button>
        <Input value={title} onChange={(e) => setTitle(e.target.value)}
          className="h-7 w-36 text-xs font-medium border-0 bg-transparent focus-visible:ring-0 px-1" />
        <span className="text-[10px] text-text-tertiary">官方完整版思维导图编辑器</span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setOpenExt(true)}
            className="h-7 text-xs gap-1"><ExternalLink className="h-3 w-3" />新窗口</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1">
            <Save className="h-3 w-3" />{saving ? "..." : "保存"}
          </Button>
        </div>
      </div>

      {/* 加载提示 */}
      {loading && (
        <div className="flex items-center justify-center py-4 text-xs text-text-tertiary bg-surface-2 border-b border-border">
          正在加载思维导图编辑器...
        </div>
      )}

      {/* iframe */}
      <iframe ref={iframeRef} src={iframeSrc} className="flex-1 w-full border-0"
        title="思维导图编辑器" allow="clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />

      {/* 新窗口模式 */}
      {openExt && (
        <div className="flex items-center justify-center gap-2 py-2 bg-surface-2 border-t border-border">
          <a href={iframeSrc} target="_blank" rel="noopener noreferrer"
            className="text-xs text-primary underline"
            onClick={() => setOpenExt(false)}>在新窗口中打开编辑器</a>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setOpenExt(false)}>关闭</Button>
        </div>
      )}
    </div>
  );
};

export default MindMapEditorLib;
