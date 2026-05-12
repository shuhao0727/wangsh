/**
 * 完整思维导图编辑器 — 嵌入官方 simple-mind-map Demo
 * 数据通过 localStorage 注入，保存通过 postMessage 回传
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showMessage } from "@/lib/toast";
import { ArrowLeft, Save, ExternalLink } from "lucide-react";

/* ═══════ 数据格式转换 ═══════ */
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

const LS_KEY = "_wangsh_mindmap_data";
const TOKEN_KEY = "ws_access_token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

const MindMapEditorLib: React.FC<Props> = ({ mindmapId, initialTitle, initialMarkdown, onBack, onSaved }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [title, setTitle] = useState(initialTitle || "未命名导图");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  // 用 ref 避免 stale closure
  const titleRef = useRef(title);
  titleRef.current = title;
  const mindmapIdRef = useRef(mindmapId);
  mindmapIdRef.current = mindmapId;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

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
    try { localStorage.setItem(LS_KEY, JSON.stringify(demoData)); } catch {}
  }, [initialTitle, initialMarkdown]);

  const handleSaveData = useCallback(async (data: LibNode, silent = false) => {
    const id = mindmapIdRef.current;
    const currentTitle = titleRef.current;
    if (!data || id == null) return;
    if (!silent) setSaving(true);
    try {
      const md = libDataToMd(data).replace(/^# /, "");
      const token = getToken();
      const headers: Record<string,string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/v1/learning/mindmaps/${id}`, {
        method: "PUT", headers, credentials: "include",
        body: JSON.stringify({ title: currentTitle, content: { markdown: `# ${currentTitle}\n${md}` } }),
      });
      if (res.ok) {
        if (!silent) showMessage.success("导图已保存");
        // 只有手动保存才触发 onSaved（不静默保存）
        if (!silent) onSavedRef.current?.();
      } else if (!silent) {
        if (res.status === 401) showMessage.error("未登录，请先登录后再保存");
        else showMessage.error(`保存失败 (${res.status})`);
      }
    } catch {
      if (!silent) showMessage.error("网络错误，保存失败");
    }
    if (!silent) setSaving(false);
  }, []);

  // 监听 postMessage 保存
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.data?.type === "mindmap:save" && e.data.data) {
        handleSaveData(e.data.data, true); // 静默保存，不退出编辑
      }
    };
    window.addEventListener("message", h);
    return () => window.removeEventListener("message", h);
  }, [handleSaveData]);

  // Ctrl+S
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const handleSave = useCallback(() => {
    try {
      const w = iframeRef.current?.contentWindow as any;
      if (w?._mmData) {
        handleSaveData(w._mmData.root || w._mmData);
      } else {
        // fallback: request data from iframe
        iframeRef.current?.contentWindow?.postMessage({ type: "mindmap:getData" }, "*");
      }
    } catch {}
  }, [handleSaveData]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "#fff", display: "flex", flexDirection: "column" }}>
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-1.5">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-7 text-xs gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />返回
        </Button>
        <Input value={title} onChange={(e) => setTitle(e.target.value)}
          className="h-7 w-36 text-xs font-medium border-0 bg-transparent focus-visible:ring-0 px-1" />
        <span className="text-[10px] text-text-tertiary">Ctrl+S 保存</span>
        <div className="ml-auto flex items-center gap-1">
          <a href="/mindmap-demo/index.html" target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <ExternalLink className="h-3 w-3" />新窗口
            </Button>
          </a>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1">
            <Save className="h-3 w-3" />{saving ? "..." : "保存"}
          </Button>
        </div>
      </div>
      <iframe ref={iframeRef} src="/mindmap-demo/index.html"
        style={{ flex: 1, width: "100%", border: "none", minHeight: 0 }}
        title="思维导图编辑器" onLoad={() => setLoading(false)} />
    </div>
  );
};

export default MindMapEditorLib;
