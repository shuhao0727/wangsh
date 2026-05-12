/**
 * simple-mind-map 全功能编辑器 — 工具栏 + 侧边栏 + 底部状态栏
 * 对标 wanglin2/mind-map 官方 Demo 的完整功能
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showMessage } from "@/lib/toast";
import {
  ArrowLeft, Save, Plus, Trash2, Undo2, Redo2,
  ZoomIn, ZoomOut, Maximize, Search, FileImage, FileJson, FileText,
  Braces, ChevronDown, Palette, Layers, PanelRight, X,
} from "lucide-react";

// ═══ 静态导入 ═══
import MindMapMod from "simple-mind-map";
import "simple-mind-map/dist/simpleMindMap.esm.css";
import Drag from "simple-mind-map/src/plugins/Drag.js";
import SelectMod from "simple-mind-map/src/plugins/Select.js";
import ScrollbarMod from "simple-mind-map/src/plugins/Scrollbar.js";
import SearchMod from "simple-mind-map/src/plugins/Search.js";
import MiniMapMod from "simple-mind-map/src/plugins/MiniMap.js";
import ExportMod from "simple-mind-map/src/plugins/Export.js";
import ExportPDFMod from "simple-mind-map/src/plugins/ExportPDF.js";
import ExportXMindMod from "simple-mind-map/src/plugins/ExportXMind.js";
import KeyboardNavMod from "simple-mind-map/src/plugins/KeyboardNavigation.js";
import RainbowLinesMod from "simple-mind-map/src/plugins/RainbowLines.js";
import OuterFrameMod from "simple-mind-map/src/plugins/OuterFrame.js";
import DemonstrateMod from "simple-mind-map/src/plugins/Demonstrate.js";
import NodeImgAdjustMod from "simple-mind-map/src/plugins/NodeImgAdjust.js";
import PainterMod from "simple-mind-map/src/plugins/Painter.js";
import FormulaMod from "simple-mind-map/src/plugins/Formula.js";
import RichTextMod from "simple-mind-map/src/plugins/RichText.js";
import AssociativeLineMod from "simple-mind-map/src/plugins/AssociativeLine.js";
import WatermarkMod from "simple-mind-map/src/plugins/Watermark.js";

const MindMap: any = (MindMapMod as any).default || MindMapMod;
const toPlugin = (m: any) => m.default || m;

MindMap.usePlugin(toPlugin(Drag)).usePlugin(toPlugin(SelectMod))
  .usePlugin(toPlugin(ScrollbarMod)).usePlugin(toPlugin(SearchMod))
  .usePlugin(toPlugin(MiniMapMod)).usePlugin(toPlugin(ExportMod))
  .usePlugin(toPlugin(ExportPDFMod)).usePlugin(toPlugin(ExportXMindMod))
  .usePlugin(toPlugin(KeyboardNavMod)).usePlugin(toPlugin(RainbowLinesMod))
  .usePlugin(toPlugin(OuterFrameMod)).usePlugin(toPlugin(DemonstrateMod))
  .usePlugin(toPlugin(NodeImgAdjustMod)).usePlugin(toPlugin(PainterMod))
  .usePlugin(toPlugin(FormulaMod)).usePlugin(toPlugin(RichTextMod))
  .usePlugin(toPlugin(AssociativeLineMod)).usePlugin(toPlugin(WatermarkMod));

// ═══ 常量 ═══
const THEMES = ["classic","classic2","classic3","classic4","classicGreen","classicBlue","dark","dark2","blueSky","brainImpairedPink","earthYellow","freshGreen","freshRed","romanticPurple","pinkGrape","mint","gold","vitalityOrange","greenLeaf","skyGreen","minions","default"];
const LAYOUTS = [
  { key: "logicalStructure", label: "逻辑结构图" },
  { key: "mindMap", label: "思维导图" },
  { key: "organizationStructure", label: "组织结构图" },
  { key: "catalogOrganization", label: "目录组织图" },
  { key: "timeline", label: "时间轴" },
  { key: "fishbone", label: "鱼骨图" },
];

interface Props {
  mindmapId?: number; initialTitle?: string; initialMarkdown?: string;
  onBack?: () => void; onSaved?: () => void; readonly?: boolean;
}

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

const MindMapEditorLib: React.FC<Props> = ({ mindmapId, initialTitle, initialMarkdown, onBack, onSaved, readonly }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mmRef = useRef<any>(null);
  const [title, setTitle] = useState(initialTitle || "未命名导图");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [layout, setLayout] = useState("logicalStructure");
  const [theme, setTheme] = useState("classic4");
  const [showLayouts, setShowLayouts] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  // 初始化
  useEffect(() => {
    if (!containerRef.current || mmRef.current) return;
    const el = containerRef.current;
    const rootText = initialTitle || "中心主题";
    const md = initialMarkdown || `# ${rootText}`;

    const mm = new MindMap({
      el, data: mdToLibData(md, rootText),
      layout: "logicalStructure", theme: "classic4",
      readonly: readonly ?? false,
      enableFreeDrag: true,
      mouseScaleCenterUseMousePosition: true,
      customInnerElsAppendTo: el,
      mousewheelAction: "zoom",
      mousewheelZoomActionReverse: false,
      isEndNodeTextEditOnClickOuter: true,
    });

    mm.on("data_change", () => setDirty(true));
    mm.on("node_click", () => { /* sidebar could update here */ });
    mmRef.current = mm;

    return () => { mm.destroy(); mmRef.current = null; };
  }, []);

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

  const mm = mmRef.current;
  const cmd = (name: string, ...args: any[]) => { try { mm?.execCommand(name, ...args); } catch {} };

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* ═══ 工具栏 ═══ */}
      {!readonly && (
        <div className="flex shrink-0 flex-wrap items-end gap-1 border-b border-border bg-surface px-2 py-1.5">
          <div className="flex items-center gap-1 mr-1">
            <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0" title="返回"><ArrowLeft className="h-4 w-4" /></Button>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-7 w-28 text-xs font-medium border-0 bg-transparent focus-visible:ring-0 px-1" />
          </div>
          <Div />
          <TGroup label="节点">
            <TB icon={<Plus size={15} />} label="子节点" tip="Tab" onClick={() => cmd("INSERT_CHILD_NODE")} />
            <TB icon={<Braces size={14} />} label="兄弟" tip="Enter" onClick={() => cmd("INSERT_NODE")} />
            <TB icon={<Trash2 size={14} />} label="删除" tip="Del" onClick={() => cmd("REMOVE_NODE")} />
          </TGroup>
          <Div />
          <TGroup label="历史">
            <TB icon={<Undo2 size={14} />} label="撤销" tip="Ctrl+Z" onClick={() => cmd("BACK")} />
            <TB icon={<Redo2 size={14} />} label="重做" tip="Ctrl+Y" onClick={() => cmd("FORWARD")} />
          </TGroup>
          <Div />
          <TGroup label="视图">
            <TB icon={<ZoomIn size={14} />} label="放大" onClick={() => { try { mm?.view?.enlarge(); } catch {} }} />
            <TB icon={<ZoomOut size={14} />} label="缩小" onClick={() => { try { mm?.view?.narrow(); } catch {} }} />
            <TB icon={<Maximize size={14} />} label="适应" onClick={() => { try { mm?.view?.fit(); } catch {} }} />
          </TGroup>
          <Div />
          <TGroup label="结构">
            <PopBtn icon={<Braces size={14} />} label="结构" open={showLayouts} setOpen={setShowLayouts}
              items={LAYOUTS} active={layout}
              onSelect={(k: string) => { setLayout(k); try { mm?.setLayout(k); } catch {} }} />
          </TGroup>
          <Div />
          <TGroup label="主题">
            <PopBtn icon={<Palette size={14} />} label="主题" open={showThemes} setOpen={setShowThemes}
              items={THEMES.map(t => ({ key: t, label: t }))} active={theme}
              onSelect={(k: string) => { setTheme(k); try { mm?.setTheme(k); } catch {} }} />
          </TGroup>
          <Div />
          <TGroup label="工具">
            <TB icon={<Search size={14} />} label="搜索" tip="Ctrl+F" onClick={() => setSearchOpen(true)} />
            <TB icon={<FileImage size={14} />} label="PNG" onClick={() => { try { mm?.export("png", { withTheme: true }); } catch {} }} />
            <TB icon={<FileJson size={14} />} label="JSON" onClick={() => { try { mm?.export("json", { withTheme: true }); } catch {} }} />
            <TB icon={<FileText size={14} />} label="MD" onClick={() => { try { mm?.export("md", { withTheme: true }); } catch {} }} />
          </TGroup>
          <Div />
          <TGroup label="面板">
            <TB icon={<PanelRight size={14} />} label={showSidebar ? "关" : "侧栏"} onClick={() => setShowSidebar(!showSidebar)} />
          </TGroup>
          <div className="flex-1" />
          <Button size="sm" onClick={handleSave} disabled={saving}
            className="h-9 text-xs gap-1.5 px-3 bg-primary text-primary-foreground hover:bg-primary/90 self-center">
            <Save className="h-3.5 w-3.5" />{saving ? "..." : dirty ? "保存 *" : "保存"}
          </Button>
        </div>
      )}

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
          <input className="flex-1 bg-transparent text-xs outline-none" placeholder="搜索节点..." value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && searchText.trim()) { try { mm?.search?.search(searchText); setSearchOpen(false); } catch {} } if (e.key === "Escape") setSearchOpen(false); }} autoFocus />
          <Button size="sm" className="h-6 text-xs" onClick={() => { try { mm?.search?.search(searchText); setSearchOpen(false); } catch {} }}>搜索</Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setSearchOpen(false)}>取消</Button>
        </div>
      )}

      {/* ═══ 主体：画布 + 侧边栏 ═══ */}
      <div className="flex flex-1 min-h-0">
        {/* 画布 */}
        <div ref={containerRef} id="mindmap-editor-container" className="flex-1 min-h-0" style={{ position: "relative", overflow: "hidden" }} />

        {/* 侧边栏 */}
        {showSidebar && (
          <div className="w-56 shrink-0 border-l border-border bg-surface overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-semibold">样式面板</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowSidebar(false)}><X size={13} /></Button>
            </div>
            <div className="p-3 space-y-4">
              {/* 主题 */}
              <div>
                <label className="text-[10px] text-text-tertiary block mb-1">主题</label>
                <div className="grid grid-cols-2 gap-1">
                  {THEMES.slice(0, 12).map(t => (
                    <button key={t} className={`text-left px-2 py-1 text-[10px] rounded hover:bg-accent ${theme === t ? "bg-primary/10 text-primary font-bold" : ""}`}
                      onClick={() => { setTheme(t); try { mm?.setTheme(t); } catch {} }}>{t}</button>
                  ))}
                </div>
              </div>
              {/* 布局 */}
              <div>
                <label className="text-[10px] text-text-tertiary block mb-1">结构</label>
                <div className="space-y-0.5">
                  {LAYOUTS.map(l => (
                    <button key={l.key} className={`block w-full text-left px-2 py-1 text-[10px] rounded hover:bg-accent ${layout === l.key ? "bg-primary/10 text-primary font-bold" : ""}`}
                      onClick={() => { setLayout(l.key); try { mm?.setLayout(l.key); } catch {} }}>{l.label}</button>
                  ))}
                </div>
              </div>
              {/* 快捷键 */}
              <div>
                <label className="text-[10px] text-text-tertiary block mb-1">快捷键</label>
                <div className="text-[10px] text-text-secondary space-y-0.5">
                  <div>Tab — 插入子节点</div>
                  <div>Enter — 插入兄弟节点</div>
                  <div>Del — 删除节点</div>
                  <div>F2 — 编辑文本</div>
                  <div>Ctrl+Z — 撤销</div>
                  <div>Ctrl+C/V — 复制粘贴</div>
                  <div>滚轮 — 缩放画布</div>
                  <div>拖拽 — 移动节点/画布</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="flex shrink-0 items-center gap-4 border-t border-border px-3 py-1 bg-surface-2">
        <span className="text-[10px] text-text-tertiary">双击编辑 · 拖拽移动 · 滚轮缩放 · 右键菜单 · 侧边栏切换主题布局</span>
        {dirty && <span className="text-[10px] text-amber-500">● 未保存的更改</span>}
      </div>

      <style>{`#mindmap-editor-container * { margin: 0; padding: 0; box-sizing: border-box; } #mindmap-editor-container svg { display: block; }`}</style>
    </div>
  );
};

// ═══ 小组件 ═══
const TGroup: React.FC<{ label?: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col items-center gap-0.5">
    {label && <span className="text-[9px] text-text-tertiary leading-none">{label}</span>}
    <div className="flex items-center gap-0.5">{children}</div>
  </div>
);
const TB: React.FC<{ icon: React.ReactNode; label: string; tip?: string; onClick: () => void }> = ({ icon, label, tip, onClick }) => (
  <Button size="sm" variant="ghost" className="flex flex-col items-center h-auto py-1 px-1.5 gap-0.5 min-w-[40px]"
    onClick={onClick} title={tip || label}>{icon}<span className="text-[10px] leading-tight">{label}</span></Button>
);
const Div = () => <span className="w-px h-10 bg-border mx-0.5 self-center" />;

const PopBtn: React.FC<{ icon: React.ReactNode; label: string; open: boolean; setOpen: (v: boolean) => void; items: { key: string; label: string }[]; active: string; onSelect: (key: string) => void }> = ({ icon, label, open, setOpen, items, active, onSelect }) => (
  <div className="relative">
    <Button size="sm" variant="ghost" className="flex flex-col items-center h-auto py-1 px-2 gap-0.5 min-w-[44px]"
      onClick={() => setOpen(!open)}>
      {icon}<span className="text-[10px] leading-tight">{label}</span><ChevronDown size={9} />
    </Button>
    {open && (
      <div className="absolute top-full left-0 mt-1 z-50 rounded-md border border-border bg-surface shadow-xl py-1 min-w-[100px]"
        onMouseLeave={() => setOpen(false)}>
        {items.map((it: any) => (
          <button key={it.key} className={`block w-full text-left px-3 py-1 text-[11px] hover:bg-accent whitespace-nowrap ${active === it.key ? "font-bold text-primary bg-primary/5" : ""}`}
            onClick={() => { onSelect(it.key); setOpen(false); }}>{it.label}</button>
        ))}
      </div>
    )}
  </div>
);

export default MindMapEditorLib;
