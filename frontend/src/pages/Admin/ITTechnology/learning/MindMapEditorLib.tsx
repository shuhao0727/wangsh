/**
 * simple-mind-map 全功能 React 封装 — 完整工具栏 + 面板 + 插件
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
    const child: LibNode = { data: { text: m[2].trim(), uid: nextUid() }, children: [] };
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

interface Props {
  mindmapId?: number;
  initialTitle?: string;
  initialMarkdown?: string;
  onBack?: () => void;
  onSaved?: () => void;
}

const MindMapEditorLib: React.FC<Props> = ({ mindmapId, initialTitle, initialMarkdown, onBack, onSaved }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mmRef = useRef<any>(null);
  const [title, setTitle] = useState(initialTitle || "未命名导图");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const readyRef = useRef(false);

  // 初始化 —— 注册全部插件并创建实例
  useEffect(() => {
    if (!containerRef.current || readyRef.current) return;
    readyRef.current = true;

    const init = async () => {
      const [MindMapMod, Drag, Select, AssociativeLine, Scrollbar, Search,
        MiniMap, Watermark, Export, ExportPDF, ExportXMind,
        KeyboardNavigation, RainbowLines, OuterFrame, Demonstrate, NodeImgAdjust,
        Painter, Formula, RichText, Cooperate] = await Promise.all([
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
        import("simple-mind-map/src/plugins/Cooperate.js"),
      ]);

      const MindMap: any = MindMapMod.default || MindMapMod;

      // 注册全部插件
      MindMap.usePlugin(Drag.default || Drag)
        .usePlugin(Select.default || Select)
        .usePlugin(AssociativeLine.default || AssociativeLine)
        .usePlugin(Scrollbar.default || Scrollbar)
        .usePlugin(Search.default || Search)
        .usePlugin(MiniMap.default || MiniMap)
        .usePlugin(Watermark.default || Watermark)
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
        .usePlugin(Cooperate.default || Cooperate);

      const rootText = initialTitle || "中心主题";
      const md = initialMarkdown || `# ${rootText}`;

      mmRef.current = new MindMap({
        el: containerRef.current,
        data: mdToLibData(md, rootText),
        layout: "logicalStructure",
        theme: "classic4",
        enableFreeDrag: true,
        mouseScaleCenterUseMousePosition: true,
        customInnerElsAppendTo: containerRef.current,
        // 开启鼠标滚轮行为为缩放
        mousewheelAction: "zoom",
        mousewheelZoomActionReverse: false,
        // 显示水印（开发版先不加）
        // 自定义节点内容
        isUseCustomNodeContent: false,
        // 允许拖拽文件到节点作为图片
        enableNodeImgDrag: true,
        // 激活关联线
        enableAssociativeLine: true,
      });

      mmRef.current.on("data_change", () => setDirty(true));
    };

    init().catch(console.error);

    return () => {
      mmRef.current?.destroy?.();
      mmRef.current = null;
      readyRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
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
  }, [title, mindmapId, onSaved]);

  const handleExportPng = async () => {
    if (!mmRef.current) return;
    try { await mmRef.current.export("png", { withTheme: true }); }
    catch (e: any) { showMessage.error("导出失败"); }
  };

  // Ctrl+S
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleSave]);

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* 工具栏 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-1.5">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-7 text-xs gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />返回
        </Button>
        <Input value={title} onChange={(e) => setTitle(e.target.value)}
          className="h-7 w-36 text-xs font-medium border-0 bg-transparent focus-visible:ring-0 px-1" />

        <span className="text-[11px] text-text-tertiary hidden sm:inline">
          Tab 子节点 · Enter 兄弟 · Del 删除 · F2 改名 · 拖拽排序 · 滚轮缩放
          {dirty && <span className="ml-1 text-amber-500">● 未保存</span>}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={handleExportPng} className="h-7 text-xs gap-1">
            <Download className="h-3 w-3" />导出 PNG
          </Button>
          <Button size="sm" variant="outline" onClick={() => mmRef.current?.execCommand("EXPAND_ALL")}
            className="h-7 text-xs px-1.5" title="全部展开">⊞</Button>
          <Button size="sm" variant="outline" onClick={() => mmRef.current?.execCommand("UNEXPAND_ALL")}
            className="h-7 text-xs px-1.5" title="全部收起">⊟</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1">
            <Save className="h-3 w-3" />{saving ? "..." : "保存"}
          </Button>
        </div>
      </div>

      {/* 导图容器 */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
};

export default MindMapEditorLib;
