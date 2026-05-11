/**
 * simple-mind-map 编辑器 — 静态导入 + 完整功能
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showMessage } from "@/lib/toast";
import { ArrowLeft, Save, Plus, Trash2, Undo2, Redo2,
  ZoomIn, ZoomOut, Maximize, Search, FileImage, FileJson, FileText, Braces, ChevronDown } from "lucide-react";

// ═══ 静态导入：库主体 + 全部插件 + 样式 ═══
import MindMapMod from "simple-mind-map";
import "simple-mind-map/dist/simpleMindMap.esm.css";
import Drag from "simple-mind-map/src/plugins/Drag.js";
import Select from "simple-mind-map/src/plugins/Select.js";
import Scrollbar from "simple-mind-map/src/plugins/Scrollbar.js";
import SearchMod from "simple-mind-map/src/plugins/Search.js";
import MiniMap from "simple-mind-map/src/plugins/MiniMap.js";
import ExportMod from "simple-mind-map/src/plugins/Export.js";
import ExportPDF from "simple-mind-map/src/plugins/ExportPDF.js";
import ExportXMind from "simple-mind-map/src/plugins/ExportXMind.js";
import KeyboardNavigation from "simple-mind-map/src/plugins/KeyboardNavigation.js";
import RainbowLines from "simple-mind-map/src/plugins/RainbowLines.js";
import OuterFrame from "simple-mind-map/src/plugins/OuterFrame.js";
import Demonstrate from "simple-mind-map/src/plugins/Demonstrate.js";
import NodeImgAdjust from "simple-mind-map/src/plugins/NodeImgAdjust.js";
import Painter from "simple-mind-map/src/plugins/Painter.js";
import Formula from "simple-mind-map/src/plugins/Formula.js";
import RichText from "simple-mind-map/src/plugins/RichText.js";
import AssociativeLine from "simple-mind-map/src/plugins/AssociativeLine.js";

const MindMap: any = (MindMapMod as any).default || MindMapMod;

// 注册全部插件
MindMap.usePlugin((Drag as any).default || Drag)
  .usePlugin((Select as any).default || Select)
  .usePlugin((Scrollbar as any).default || Scrollbar)
  .usePlugin((SearchMod as any).default || SearchMod)
  .usePlugin((MiniMap as any).default || MiniMap)
  .usePlugin((ExportMod as any).default || ExportMod)
  .usePlugin((ExportPDF as any).default || ExportPDF)
  .usePlugin((ExportXMind as any).default || ExportXMind)
  .usePlugin((KeyboardNavigation as any).default || KeyboardNavigation)
  .usePlugin((RainbowLines as any).default || RainbowLines)
  .usePlugin((OuterFrame as any).default || OuterFrame)
  .usePlugin((Demonstrate as any).default || Demonstrate)
  .usePlugin((NodeImgAdjust as any).default || NodeImgAdjust)
  .usePlugin((Painter as any).default || Painter)
  .usePlugin((Formula as any).default || Formula)
  .usePlugin((RichText as any).default || RichText)
  .usePlugin((AssociativeLine as any).default || AssociativeLine);

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
  onBack?: () => void; onSaved?: () => void; readonly?: boolean;
}

const LAYOUTS = [
  { key: "logicalStructure", label: "逻辑结构图" },
  { key: "mindMap", label: "思维导图" },
  { key: "organizationStructure", label: "组织结构图" },
  { key: "catalogOrganization", label: "目录组织图" },
  { key: "timeline", label: "时间轴" },
  { key: "fishbone", label: "鱼骨图" },
];

const MindMapEditorLib: React.FC<Props> = ({ mindmapId, initialTitle, initialMarkdown, onBack, onSaved, readonly }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mmRef = useRef<any>(null);
  const [title, setTitle] = useState(initialTitle || "未命名导图");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [layout, setLayout] = useState("logicalStructure");
  const [showLayouts, setShowLayouts] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  // 初始化
  useEffect(() => {
    if (!containerRef.current || mmRef.current) return;
    const el = containerRef.current;

    const rootText = initialTitle || "中心主题";
    const md = initialMarkdown || `# ${rootText}`;

    const mm = new MindMap({
      el,
      data: mdToLibData(md, rootText),
      layout: "logicalStructure",
      theme: "classic4",
      readonly: readonly ?? false,
      enableFreeDrag: true,
      mouseScaleCenterUseMousePosition: true,
      customInnerElsAppendTo: el,
      mousewheelAction: "zoom",
      mousewheelZoomActionReverse: false,
      isEndNodeTextEditOnClickOuter: false,
    });

    mm.on("data_change", () => setDirty(true));
    mmRef.current = mm;

    return () => {
      mm.destroy();
      mmRef.current = null;
    };
  }, []); // eslint-disable-line

  const handleSave = useCallback(async () => {
    if (!mmRef.current || mindmapId == null) return;
    setSaving(true);
    try {
      const d: LibNode = mmRef.current.getData();
      const md = libDataToMd(d).replace(/^# /, "");
      const res = await fetch(`/api/v1/learning/mindmaps/${mindmapId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ title, content: { markdown: `# ${title}\n${md}` } }),
      });
      if (res.ok) { showMessage.success("导图已保存"); setDirty(false); onSaved?.(); }
      else showMessage.error("保存失败");
    } catch { showMessage.error("保存失败"); }
    setSaving(false);
  }, [title, mindmapId, onSaved]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleSave]);

  const tc = "text-[10px] leading-tight";

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* ── 工具栏 ── */}
      {!readonly && (
        <div className="flex shrink-0 flex-wrap items-end gap-1 border-b border-border bg-surface px-2 py-1.5">
          <div className="flex items-center gap-1 mr-1">
            <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0" title="返回"><ArrowLeft className="h-4 w-4" /></Button>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-7 w-28 text-xs font-medium border-0 bg-transparent focus-visible:ring-0 px-1" />
          </div>

          <span className="w-px h-10 bg-border mx-0.5 self-center" />

          <ToolGroup label="节点">
            <Tb icon={<Plus size={15} />} label="子节点" tip="Tab" onClick={() => { try { mmRef.current?.execCommand("INSERT_CHILD_NODE"); } catch {} }} />
            <Tb icon={<Braces size={14} />} label="兄弟" tip="Enter" onClick={() => { try { mmRef.current?.execCommand("INSERT_NODE"); } catch {} }} />
            <Tb icon={<Trash2 size={14} />} label="删除" tip="Del" onClick={() => { try { mmRef.current?.execCommand("REMOVE_NODE"); } catch {} }} />
          </ToolGroup>

          <span className="w-px h-10 bg-border mx-0.5 self-center" />

          <ToolGroup label="历史">
            <Tb icon={<Undo2 size={14} />} label="撤销" tip="Ctrl+Z" onClick={() => { try { mmRef.current?.execCommand("BACK"); } catch {} }} />
            <Tb icon={<Redo2 size={14} />} label="重做" tip="Ctrl+Y" onClick={() => { try { mmRef.current?.execCommand("FORWARD"); } catch {} }} />
          </ToolGroup>

          <span className="w-px h-10 bg-border mx-0.5 self-center" />

          <ToolGroup label="视图">
            <Tb icon={<ZoomIn size={14} />} label="放大" onClick={() => { try { mmRef.current?.view?.enlarge(); } catch {} }} />
            <Tb icon={<ZoomOut size={14} />} label="缩小" onClick={() => { try { mmRef.current?.view?.narrow(); } catch {} }} />
            <Tb icon={<Maximize size={14} />} label="适应" onClick={() => { try { mmRef.current?.view?.fit(); } catch {} }} />
          </ToolGroup>

          <span className="w-px h-10 bg-border mx-0.5 self-center" />

          <ToolGroup label="布局">
            <div className="relative">
              <Button size="sm" variant="ghost" className="flex flex-col items-center h-auto py-1 px-2 gap-0.5 min-w-[44px]"
                onClick={() => setShowLayouts(!showLayouts)}>
                <Braces size={14} /><span className={tc}>布局</span><ChevronDown size={9} />
              </Button>
              {showLayouts && (
                <div className="absolute bottom-full left-0 mb-1 z-50 rounded-md border border-border bg-surface shadow-xl py-2 w-40"
                  onMouseLeave={() => setShowLayouts(false)}>
                  {LAYOUTS.map((l) => (
                    <button key={l.key} className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-accent ${layout === l.key ? "font-bold text-primary" : ""}`}
                      onClick={() => { setLayout(l.key); try { mmRef.current?.setLayout(l.key); } catch {} setShowLayouts(false); }}>{l.label}</button>
                  ))}
                </div>
              )}
            </div>
          </ToolGroup>

          <span className="w-px h-10 bg-border mx-0.5 self-center" />

          <ToolGroup label="工具">
            <Tb icon={<Search size={14} />} label="搜索" tip="Ctrl+F" onClick={() => setSearchOpen(true)} />
            <Tb icon={<FileImage size={14} />} label="PNG" onClick={() => { try { mmRef.current?.export("png", { withTheme: true }); } catch {} }} />
            <Tb icon={<FileJson size={14} />} label="JSON" onClick={() => { try { mmRef.current?.export("json", { withTheme: true }); } catch {} }} />
            <Tb icon={<FileText size={14} />} label="MD" onClick={() => { try { mmRef.current?.export("md", { withTheme: true }); } catch {} }} />
          </ToolGroup>

          <div className="flex-1" />

          <Button size="sm" onClick={handleSave} disabled={saving}
            className="h-9 text-xs gap-1.5 px-3 bg-primary text-primary-foreground hover:bg-primary/90 self-center">
            <Save className="h-3.5 w-3.5" />{saving ? "..." : dirty ? "保存 *" : "保存"}
          </Button>
        </div>
      )}

      {/* 只读模式 */}
      {readonly && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-7 text-xs gap-1"><ArrowLeft className="h-3 w-3" />返回</Button>
          <span className="text-sm font-medium">{title}</span>
        </div>
      )}

      {/* 搜索栏 */}
      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 bg-surface-2">
          <Search size={14} className="text-text-tertiary shrink-0" />
          <input className="flex-1 bg-transparent text-xs outline-none" placeholder="搜索节点..."
            value={searchText} onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchText.trim()) { try { mmRef.current?.search?.search(searchText); setSearchOpen(false); } catch {} }
              if (e.key === "Escape") setSearchOpen(false);
            }} autoFocus />
          <Button size="sm" className="h-6 text-xs px-2" onClick={() => { try { mmRef.current?.search?.search(searchText); setSearchOpen(false); } catch {} }}>搜索</Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setSearchOpen(false)}>取消</Button>
        </div>
      )}

      {/* 导图画布 — 关键 CSS reset */}
      <div ref={containerRef} id="mindmap-editor-container" className="flex-1 min-h-0" style={{ position: "relative", overflow: "hidden" }} />

      {/* 底部提示 */}
      <div className="flex shrink-0 items-center gap-4 border-t border-border px-3 py-1 bg-surface-2">
        <span className="text-[10px] text-text-tertiary">双击编辑 · 拖拽移动 · 滚轮缩放 · 右键菜单 · Tab/Enter/Del 快捷键</span>
        {dirty && <span className="text-[10px] text-amber-500">● 未保存</span>}
      </div>

      {/* 容器 CSS reset（库需要） */}
      <style>{`
        #mindmap-editor-container * { margin: 0; padding: 0; box-sizing: border-box; }
        #mindmap-editor-container svg { display: block; }
      `}</style>
    </div>
  );
};

const ToolGroup: React.FC<{ label?: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col items-center gap-0.5">
    {label && <span className="text-[9px] text-text-tertiary leading-none">{label}</span>}
    <div className="flex items-center gap-0.5">{children}</div>
  </div>
);

const Tb: React.FC<{ icon: React.ReactNode; label: string; tip?: string; onClick: () => void }> = ({ icon, label, tip, onClick }) => (
  <Button size="sm" variant="ghost" className="flex flex-col items-center h-auto py-1 px-1.5 gap-0.5 min-w-[40px]"
    onClick={onClick} title={tip || label}>
    {icon}
    <span className="text-[10px] leading-tight">{label}</span>
  </Button>
);

export default MindMapEditorLib;
