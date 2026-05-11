/**
 * simple-mind-map React 封装 — 成熟的交互式思维导图
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showMessage } from "@/lib/toast";
import { ArrowLeft, Save, Download } from "lucide-react";

/* ═══════ 数据格式转换 ═══════ */
interface LibNode {
  data: { text: string; uid?: string; [key: string]: unknown };
  children: LibNode[];
}

function mdToLibData(md: string, rootText: string): LibNode {
  let uid = 0;
  const nextUid = () => `n${++uid}`;
  const lines = md.split("\n").filter((l) => l.trim());
  const root: LibNode = { data: { text: rootText, uid: nextUid() }, children: [] };
  const stack: { level: number; node: LibNode }[] = [{ level: 0, node: root }];

  for (const line of lines) {
    const m = line.match(/^(#+)\s+(.+)/);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].trim();
    const child: LibNode = { data: { text, uid: nextUid() }, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
    if (stack.length > 0) stack[stack.length - 1].node.children.push(child);
    stack.push({ level, node: child });
  }
  return root;
}

function libDataToMd(node: LibNode, level = 1): string {
  let md = `${"#".repeat(level)} ${node.data.text}\n`;
  for (const c of node.children) md += libDataToMd(c, level + 1);
  return md;
}

/* ═══════ Props ═══════ */
interface Props {
  mindmapId?: number;
  initialTitle?: string;
  initialMarkdown?: string;
  onBack?: () => void;
  onSaved?: () => void;
}

/* ═══════ 组件 ═══════ */
const MindMapEditorLib: React.FC<Props> = ({ mindmapId, initialTitle, initialMarkdown, onBack, onSaved }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mmRef = useRef<any>(null);
  const [title, setTitle] = useState(initialTitle || "未命名导图");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // 初始化
  useEffect(() => {
    if (!containerRef.current) return;

    const init = async () => {
      const MindMap = (await import("simple-mind-map")).default;
      const rootText = initialTitle || "中心主题";
      const md = initialMarkdown || `# ${rootText}`;
      const data = mdToLibData(md, rootText);

      mmRef.current = new (MindMap as any)({
        el: containerRef.current,
        data,
        layout: "logicalStructure",
        theme: "classic4",
        enableFreeDrag: true,
        mouseScaleCenterUseMousePosition: true,
        customInnerElsAppendTo: containerRef.current,
      });

      // 监听数据变更
      mmRef.current.on("data_change", () => {
        setDirty(true);
      });
    };

    init();

    return () => {
      mmRef.current?.destroy?.();
      mmRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!mmRef.current || mindmapId == null) return;
    setSaving(true);
    try {
      const data: LibNode = mmRef.current.getData();
      const md = libDataToMd(data).replace(/^# /, "");
      const body = { title, content: { markdown: `# ${title}\n${md}` } };
      const res = await fetch(`/api/v1/learning/mindmaps/${mindmapId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(body),
      });
      if (res.ok) { showMessage.success("保存成功"); setDirty(false); onSaved?.(); }
      else showMessage.error(`保存失败: ${res.status}`);
    } catch (e: any) { showMessage.error(e.message); }
    setSaving(false);
  };

  const handleExportPng = async () => {
    if (!mmRef.current) return;
    try {
      await mmRef.current.export("png", { withTheme: true });
    } catch (e: any) { showMessage.error("导出失败: " + e.message); }
  };

  // Ctrl+S 保存
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirty) handleSave();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [dirty]);

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* 工具栏 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-1.5">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-7 text-xs gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />返回
        </Button>
        <Input value={title} onChange={(e) => setTitle(e.target.value)}
          className="h-7 w-36 text-xs font-medium border-0 bg-transparent focus-visible:ring-0 px-1" placeholder="标题" />

        <span className="text-[11px] text-text-tertiary hidden sm:inline">
          Tab 加子 · Enter 加兄 · Del 删 · F2 改名 · 拖拽排序 · 滚轮缩放
          {dirty && <span className="ml-1 text-amber-500">● 未保存</span>}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={handleExportPng} className="h-7 text-xs gap-1">
            <Download className="h-3 w-3" />导出 PNG
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty} className="h-7 text-xs gap-1">
            <Save className="h-3 w-3" />{saving ? "..." : "保存"}
          </Button>
        </div>
      </div>

      {/* 导图容器 */}
      <div ref={containerRef} className="flex-1 min-h-0" style={{ background: "#fafbfc" }} />
    </div>
  );
};

export default MindMapEditorLib;
