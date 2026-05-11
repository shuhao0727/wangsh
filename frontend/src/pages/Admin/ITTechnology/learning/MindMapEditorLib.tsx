/**
 * simple-mind-map 编辑器 — 完整工具栏 + 中文说明
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showMessage } from "@/lib/toast";
import { ArrowLeft, Save, Plus, Trash2, Undo2, Redo2,
  ZoomIn, ZoomOut, Maximize, Search, FileImage, FileJson, FileText, Braces, ChevronDown } from "lucide-react";

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
  { key: "logicalStructure", label: "逻辑结构图", desc: "根节点在左侧，向右展开" },
  { key: "mindMap", label: "思维导图", desc: "根节点居中，向四周发散" },
  { key: "organizationStructure", label: "组织结构图", desc: "自上而下层级结构" },
  { key: "catalogOrganization", label: "目录组织图", desc: "缩进式目录结构" },
  { key: "timeline", label: "时间轴", desc: "水平/垂直时间线" },
  { key: "fishbone", label: "鱼骨图", desc: "因果分析鱼骨图" },
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
  const [ready, setReady] = useState(false);

  const cmdLog = useCallback((command: string, ...args: any[]) => {
    const mm = mmRef.current;
    if (!mm) return false;
    try {
      mm.execCommand(command, ...args);
      return true;
    } catch (e: any) {
      console.warn(`[mindmap] execCommand "${command}" failed:`, e.message);
      return false;
    }
  }, []);

  // 初始化
  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    (async () => {
      const [MindMapMod, Drag, Select, Scrollbar, SearchMod, MiniMap, Watermark,
        Export, ExportPDF, ExportXMind, KeyboardNavigation, RainbowLines,
        OuterFrame, Demonstrate, NodeImgAdjust, Painter, Formula, RichText, AssociativeLine] =
        await Promise.all([
          import("simple-mind-map"),
          import("simple-mind-map/src/plugins/Drag.js"),
          import("simple-mind-map/src/plugins/Select.js"),
          import("simple-mind-map/src/plugins/Scrollbar.js"),
          import("simple-mind-map/src/plugins/Search.js"),
          import("simple-mind-map/src/plugins/MiniMap.js"),
          import("simple-mind-map/src/plugins/Watermark.js"),
          import("simple-mind-map/src/plugins/Export.js"),
          import("simple-mind-map/src/plugins/ExportPDF.js"),
          import("simple-mind-map/src/plugins/ExportXMind.js"),
          import("simple-mind-map/src/plugins/KeyboardNavigation.js"),
          import("simple-mind-map/src/plugins/RainbowLines.js"),
          import("simple-mind-map/src/plugins/OuterFrame.js"),
          import("simple-mind-map/src/plugins/Demonstrate.js"),
          import("simple-mind-map/src/plugins/NodeImgAdjust.js"),
          import("simple-mind-map/src/plugins/Painter.js"),
          import("simple-mind-map/src/plugins/Formula.js"),
          import("simple-mind-map/src/plugins/RichText.js"),
          import("simple-mind-map/src/plugins/AssociativeLine.js"),
        ]);

      if (destroyed) return;
      const MindMap: any = MindMapMod.default || MindMapMod;

      MindMap.usePlugin(Drag.default || Drag)
        .usePlugin(Select.default || Select)
        .usePlugin(Scrollbar.default || Scrollbar)
        .usePlugin(SearchMod.default || SearchMod)
        .usePlugin(MiniMap.default || MiniMap)
        .usePlugin(Export.default || Export)
        .usePlugin(ExportPDF.default || ExportPDF)
        .usePlugin(ExportXMind.default || ExportXMind)
        .usePlugin(KeyboardNavigation.default || KeyboardNavigation)
        .usePlugin(RainbowLines.default || RainbowLines)
        .usePlugin(OuterFrame.default || OuterFrame)
        .usePlugin(Demonstrate.default || Demonstrate)
        .usePlugin(NodeImgAdjust.default || NodeImgAdjust)
        .usePlugin(Painter.default || Painter)
        .usePlugin(Formula.default || Formula)
        .usePlugin(RichText.default || RichText)
        .usePlugin(AssociativeLine.default || AssociativeLine);

      const rootText = initialTitle || "中心主题";
      const md = initialMarkdown || `# ${rootText}`;

      mmRef.current = new MindMap({
        el: containerRef.current,
        data: mdToLibData(md, rootText),
        layout: "logicalStructure",
        theme: "classic4",
        readonly: readonly ?? false,
        enableFreeDrag: true,
        mouseScaleCenterUseMousePosition: true,
        customInnerElsAppendTo: containerRef.current,
        mousewheelAction: "zoom",
        mousewheelZoomActionReverse: false,
      });

      mmRef.current.on("data_change", () => setDirty(true));
      if (!destroyed) setReady(true);
    })().catch(console.error);

    return () => { destroyed = true; mmRef.current?.destroy?.(); mmRef.current = null; };
  }, []); // eslint-disable-line

  // Ctrl+S / Ctrl+F
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []); // eslint-disable-line

  const handleSave = async () => {
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
      else showMessage.error(`保存失败 (${res.status})`);
    } catch { showMessage.error("保存失败"); }
    setSaving(false);
  };

  const tooltipClass = "text-[10px] leading-tight";

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* ── 工具栏 ── */}
      {!readonly && ready && (
        <div className="flex shrink-0 flex-wrap items-end gap-1 border-b border-border bg-surface px-2 py-1.5">
          {/* 返回 */}
          <ToolGroup>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0" title="返回列表"><ArrowLeft className="h-4 w-4" /></Button>
              <Input value={title} onChange={(e) => setTitle(e.target.value)}
                className="h-7 w-28 text-xs font-medium border-0 bg-transparent focus-visible:ring-0 px-1" />
            </div>
          </ToolGroup>

          <Divider />

          {/* 节点操作 */}
          <ToolGroup label="节点">
            <ToolBtn icon={<Plus size={15} />} label="子节点" desc="Tab 键" onClick={() => cmdLog("INSERT_CHILD_NODE")} />
            <ToolBtn icon={<Braces size={14} />} label="兄弟节点" desc="Enter 键" onClick={() => cmdLog("INSERT_NODE")} />
            <ToolBtn icon={<Trash2 size={14} />} label="删除" desc="Delete 键" onClick={() => cmdLog("REMOVE_NODE")} />
          </ToolGroup>

          <Divider />

          {/* 撤销 */}
          <ToolGroup label="历史">
            <ToolBtn icon={<Undo2 size={14} />} label="撤销" desc="Ctrl+Z" onClick={() => cmdLog("BACK")} />
            <ToolBtn icon={<Redo2 size={14} />} label="重做" desc="Ctrl+Y" onClick={() => cmdLog("FORWARD")} />
          </ToolGroup>

          <Divider />

          {/* 视图 */}
          <ToolGroup label="视图">
            <ToolBtn icon={<ZoomIn size={14} />} label="放大" desc="滚轮" onClick={() => mmRef.current?.view?.enlarge()} />
            <ToolBtn icon={<ZoomOut size={14} />} label="缩小" desc="滚轮" onClick={() => mmRef.current?.view?.narrow()} />
            <ToolBtn icon={<Maximize size={14} />} label="适应画布" onClick={() => mmRef.current?.view?.fit()} />
          </ToolGroup>

          <Divider />

          {/* 布局 */}
          <ToolGroup label="布局">
            <div className="relative">
              <Button size="sm" variant="ghost"
                className="flex flex-col items-center h-auto py-1 px-2 gap-0.5 min-w-[44px]"
                onClick={() => setShowLayouts(!showLayouts)} title="切换布局结构">
                <Braces size={14} /><span className={tooltipClass}>布局</span><ChevronDown size={9} />
              </Button>
              {showLayouts && (
                <div className="absolute top-full left-0 mt-1 z-50 rounded-md border border-border bg-surface shadow-xl py-2 w-44"
                  onMouseLeave={() => setShowLayouts(false)}>
                  {LAYOUTS.map((l) => (
                    <button key={l.key} className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-accent ${layout === l.key ? "font-bold text-primary bg-primary/5" : ""}`}
                      onClick={() => { setLayout(l.key); mmRef.current?.setLayout(l.key); setShowLayouts(false); }}
                      title={l.desc}>{l.label}</button>
                  ))}
                </div>
              )}
            </div>
          </ToolGroup>

          <Divider />

          {/* 搜索 & 导出 */}
          <ToolGroup label="工具">
            <ToolBtn icon={<Search size={14} />} label="搜索" desc="Ctrl+F" onClick={() => setSearchOpen(true)} />
            <ToolBtn icon={<FileImage size={14} />} label="PNG" desc="导出" onClick={() => mmRef.current?.export("png", { withTheme: true }).catch(() => {})} />
            <ToolBtn icon={<FileJson size={14} />} label="JSON" desc="导出" onClick={() => mmRef.current?.export("json", { withTheme: true }).catch(() => {})} />
            <ToolBtn icon={<FileText size={14} />} label="MD" desc="导出" onClick={() => mmRef.current?.export("md", { withTheme: true }).catch(() => {})} />
          </ToolGroup>

          <div className="flex-1" />

          {/* 保存 */}
          <Button size="sm" onClick={handleSave} disabled={saving}
            className="h-9 text-xs gap-1.5 px-3 bg-primary text-primary-foreground hover:bg-primary/90">
            <Save className="h-3.5 w-3.5" />{saving ? "保存中..." : dirty ? "保存 *" : "保存"}
          </Button>
        </div>
      )}

      {/* 只读模式顶部栏 */}
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
          <input className="flex-1 bg-transparent text-xs outline-none" placeholder="输入关键词搜索节点..."
            value={searchText} onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchText.trim()) { mmRef.current?.search?.search(searchText); setSearchOpen(false); }
              if (e.key === "Escape") setSearchOpen(false);
            }} autoFocus />
          <Button size="sm" className="h-6 text-xs" onClick={() => { if (searchText.trim()) { mmRef.current?.search?.search(searchText); setSearchOpen(false); } }}>搜索</Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setSearchOpen(false)}>取消</Button>
        </div>
      )}

      {/* 导图画布 */}
      <div ref={containerRef} className="flex-1 min-h-0" style={{ overflow: "hidden" }} />

      {/* 底部提示栏 */}
      <div className="flex shrink-0 items-center gap-4 border-t border-border px-3 py-1 bg-surface-2">
        <span className="text-[10px] text-text-tertiary">双击节点编辑文字 · 鼠标拖拽移动节点 · 滚轮缩放画布 · 右键查看更多操作</span>
        {dirty && <span className="text-[10px] text-amber-500">● 有未保存的更改</span>}
      </div>
    </div>
  );
};

/* 小工具组件 */
const ToolGroup: React.FC<{ label?: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col items-center gap-0.5">
    {label && <span className="text-[9px] text-text-tertiary leading-none">{label}</span>}
    <div className="flex items-center gap-0.5">{children}</div>
  </div>
);

const ToolBtn: React.FC<{ icon: React.ReactNode; label: string; desc?: string; onClick: () => void }> = ({ icon, label, desc, onClick }) => (
  <Button size="sm" variant="ghost"
    className="flex flex-col items-center h-auto py-1 px-1.5 gap-0.5 min-w-[40px]"
    onClick={onClick} title={desc ? `${label} (${desc})` : label}>
    {icon}
    <span className="text-[10px] leading-tight">{label}</span>
  </Button>
);

const Divider = () => <span className="w-px h-10 bg-border mx-0.5 self-center" />;

export default MindMapEditorLib;
