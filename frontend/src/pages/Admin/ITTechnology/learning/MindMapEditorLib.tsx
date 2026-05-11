/**
 * simple-mind-map 全功能编辑器 — 自带工具栏、快捷键、右键菜单
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showMessage } from "@/lib/toast";
import {
  ArrowLeft, Save, Download, Plus, Trash2, Undo2, Redo2,
  ZoomIn, ZoomOut, Maximize, FileJson, FileImage, FileText,
  Search, Braces, GitBranch, ChevronDown,
} from "lucide-react";

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
  readonly?: boolean;
}

const LAYOUTS = [
  { key: "logicalStructure", label: "逻辑图" },
  { key: "mindMap", label: "思维导图" },
  { key: "organizationStructure", label: "组织图" },
  { key: "catalogOrganization", label: "目录图" },
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
  const readyRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || readyRef.current) return;
    readyRef.current = true;
    (async () => {
      const [MindMapMod, Drag, Select, AssociativeLine, Scrollbar, SearchMod, MiniMap, Watermark, Export, ExportPDF, ExportXMind,
        KeyboardNavigation, RainbowLines, OuterFrame, Demonstrate, NodeImgAdjust, Painter, Formula, RichText] =
        await Promise.all([
          import("simple-mind-map"),
          import("simple-mind-map/src/plugins/Drag.js"),
          import("simple-mind-map/src/plugins/Select.js"),
          import("simple-mind-map/src/plugins/AssociativeLine.js"),
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
        ]);
      const MindMap: any = MindMapMod.default || MindMapMod;
      MindMap.usePlugin(Drag.default || Drag).usePlugin(Select.default || Select)
        .usePlugin(AssociativeLine.default || AssociativeLine).usePlugin(Scrollbar.default || Scrollbar)
        .usePlugin(SearchMod.default || SearchMod).usePlugin(MiniMap.default || MiniMap)
        .usePlugin(Export.default || Export).usePlugin(ExportPDF.default || ExportPDF)
        .usePlugin(ExportXMind.default || ExportXMind).usePlugin(KeyboardNavigation.default || KeyboardNavigation)
        .usePlugin(RainbowLines.default || RainbowLines).usePlugin(OuterFrame.default || OuterFrame)
        .usePlugin(Demonstrate.default || Demonstrate).usePlugin(NodeImgAdjust.default || NodeImgAdjust)
        .usePlugin(Painter.default || Painter).usePlugin(Formula.default || Formula)
        .usePlugin(RichText.default || RichText);

      const rootText = initialTitle || "中心主题";
      const md = initialMarkdown || `# ${rootText}`;
      mmRef.current = new MindMap({
        el: containerRef.current, data: mdToLibData(md, rootText),
        layout: "logicalStructure", theme: "classic4", readonly: readonly ?? false,
        enableFreeDrag: true, mouseScaleCenterUseMousePosition: true,
        customInnerElsAppendTo: containerRef.current,
        mousewheelAction: "zoom", mousewheelZoomActionReverse: false,
      });
      mmRef.current.on("data_change", () => setDirty(true));
    })().catch(console.error);
    return () => { mmRef.current?.destroy?.(); mmRef.current = null; readyRef.current = false; };
  }, []); // eslint-disable-line

  const cmd = useCallback((name: string, ...args: any[]) => {
    try { mmRef.current?.execCommand(name, ...args); } catch {}
  }, []);

  const handleSave = async () => {
    if (!mmRef.current || mindmapId == null) return;
    setSaving(true);
    try {
      const d: LibNode = mmRef.current.getData();
      const md = libDataToMd(d).replace(/^# /, "");
      const body = { title, content: { markdown: `# ${title}\n${md}` } };
      const res = await fetch(`/api/v1/learning/mindmaps/${mindmapId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body),
      });
      if (res.ok) { showMessage.success("保存成功"); setDirty(false); onSaved?.(); }
      else showMessage.error(`保存失败: ${res.status}`);
    } catch (e: any) { showMessage.error(e.message); }
    setSaving(false);
  };

  const handleExport = async (type: string) => {
    if (!mmRef.current) return;
    try { await mmRef.current.export(type, { withTheme: true }); } catch {}
  };

  const handleSearch = () => {
    if (!searchText.trim() || !mmRef.current) return;
    try { mmRef.current.search.search(searchText); setSearchOpen(false); } catch {}
  };

  // Ctrl+S / Ctrl+Z / Ctrl+Shift+Z / Ctrl+F
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleSave]);

  const ToolBtn = ({ onClick, title, children, active }: any) => (
    <Button size="sm" variant={active ? "secondary" : "ghost"} onClick={onClick}
      className="h-7 text-xs gap-1 px-1.5" title={title}>{children}</Button>
  );

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* ── 工具栏 ── */}
      {!readonly && (
        <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border bg-surface px-2 py-1">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-7 text-xs gap-1 mr-1">
            <ArrowLeft className="h-3 w-3" />
          </Button>
          <Input value={title} onChange={(e) => setTitle(e.target.value)}
            className="h-7 w-28 text-xs font-medium border-0 bg-transparent focus-visible:ring-0 px-1" />

          <span className="w-px h-5 bg-border mx-0.5" />

          <ToolBtn onClick={() => cmd("INSERT_CHILD_NODE")} title="插入子节点 (Tab)"><Plus size={13} />子</ToolBtn>
          <ToolBtn onClick={() => cmd("INSERT_NODE")} title="插入兄弟节点 (Enter)"><GitBranch size={13} />兄</ToolBtn>
          <ToolBtn onClick={() => cmd("REMOVE_NODE")} title="删除节点 (Del)"><Trash2 size={13} /></ToolBtn>

          <span className="w-px h-5 bg-border mx-0.5" />

          <ToolBtn onClick={() => cmd("BACK")} title="撤销 (Ctrl+Z)"><Undo2 size={13} /></ToolBtn>
          <ToolBtn onClick={() => cmd("FORWARD")} title="重做"><Redo2 size={13} /></ToolBtn>

          <span className="w-px h-5 bg-border mx-0.5" />

          <ToolBtn onClick={() => mmRef.current?.view?.enlarge()} title="放大"><ZoomIn size={13} /></ToolBtn>
          <ToolBtn onClick={() => mmRef.current?.view?.narrow()} title="缩小"><ZoomOut size={13} /></ToolBtn>
          <ToolBtn onClick={() => mmRef.current?.view?.fit()} title="适应画布"><Maximize size={13} /></ToolBtn>

          <span className="w-px h-5 bg-border mx-0.5" />

          <ToolBtn onClick={() => cmd("EXPAND_ALL")} title="全部展开">⊞</ToolBtn>
          <ToolBtn onClick={() => cmd("UNEXPAND_ALL")} title="全部收起">⊟</ToolBtn>

          <div className="relative">
            <ToolBtn onClick={() => setShowLayouts(!showLayouts)} title="切换布局">
              <Braces size={13} /><ChevronDown size={10} />
            </ToolBtn>
            {showLayouts && (
              <div className="absolute top-full left-0 mt-1 z-50 rounded-md border border-border bg-surface shadow-lg py-1 min-w-[100px]"
                onMouseLeave={() => setShowLayouts(false)}>
                {LAYOUTS.map((l) => (
                  <button key={l.key} className={`block w-full text-left px-3 py-1 text-xs hover:bg-accent ${layout === l.key ? "font-bold text-primary" : ""}`}
                    onClick={() => { setLayout(l.key); mmRef.current?.setLayout(l.key); setShowLayouts(false); }}>{l.label}</button>
                ))}
              </div>
            )}
          </div>

          <ToolBtn onClick={() => setSearchOpen(true)} title="搜索 (Ctrl+F)"><Search size={13} /></ToolBtn>

          <span className="w-px h-5 bg-border mx-0.5" />

          <ToolBtn onClick={() => handleExport("png")} title="导出 PNG"><FileImage size={13} /></ToolBtn>
          <ToolBtn onClick={() => handleExport("json")} title="导出 JSON"><FileJson size={13} /></ToolBtn>
          <ToolBtn onClick={() => handleExport("md")} title="导出 Markdown"><FileText size={13} /></ToolBtn>

          <div className="ml-auto flex items-center gap-1">
            {dirty && <span className="text-[10px] text-amber-500 mr-1">未保存</span>}
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1">
              <Save className="h-3 w-3" />{saving ? "..." : "保存"}
            </Button>
          </div>
        </div>
      )}

      {/* ── 搜索弹窗 ── */}
      {searchOpen && (
        <div className="flex items-center gap-1 border-b border-border px-3 py-1.5 bg-surface-2">
          <Search size={14} className="text-text-tertiary" />
          <input className="flex-1 bg-transparent text-xs outline-none" placeholder="搜索节点..."
            value={searchText} onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); if (e.key === "Escape") setSearchOpen(false); }}
            autoFocus />
          <Button size="sm" className="h-6 text-xs" onClick={handleSearch}>搜索</Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setSearchOpen(false)}>×</Button>
        </div>
      )}

      {/* ── 导图容器 ── */}
      <div ref={containerRef} className="flex-1 min-h-0 relative" style={{ overflow: "hidden" }} />
    </div>
  );
};

export default MindMapEditorLib;
