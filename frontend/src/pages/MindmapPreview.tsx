/**
 * 思维导图全屏预览页
 */
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import MindMapViewer from "./Admin/ITTechnology/learning/MindMapViewer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";

const MindmapPreview: React.FC = () => {
  const [params] = useSearchParams();
  const id = params.get("id");
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");

  useEffect(() => {
    // 从 localStorage 读取预览数据
    try {
      const raw = localStorage.getItem("_wangsh_preview_data");
      if (raw) {
        const item = JSON.parse(raw);
        setTitle(item.title || "");
        setMarkdown(item.content?.markdown || `# ${item.title}`);
      }
    } catch {}
  }, []);

  const handleEdit = () => {
    if (id) {
      const rootText = title || "未命名";
      const md = markdown || `# ${rootText}`;
      localStorage.setItem("_wangsh_mindmap_data", JSON.stringify({
        root: parseMarkdownForPreview(md, rootText),
        theme: { template: "classic4", config: {} },
        layout: "logicalStructure", config: {}, view: null,
      }));
      window.open(`/mindmap-demo/index.html?id=${id}`, "_blank");
    }
  };

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
          onClick={() => window.close()}>
          <ArrowLeft className="h-3.5 w-3.5" />返回
        </Button>
        <h2 className="text-sm font-semibold">{title}</h2>
        {id && (
          <div className="ml-auto">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
              onClick={handleEdit}>
              <Pencil className="h-3 w-3" />编辑
            </Button>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 p-4">
        <MindMapViewer markdown={markdown} />
      </div>
    </div>
  );
};

function parseMarkdownForPreview(md: string, rootText: string) {
  const lines = md.split("\n").filter(l => l.trim());
  const root: any = { data: { text: rootText }, children: [] };
  const stack: { level: number; node: any }[] = [{ level: 0, node: root }];
  for (const line of lines) {
    const m = line.match(/^(#+)\s+(.+)/); if (!m) continue;
    const child: any = { data: { text: m[2].trim() }, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= m[1].length) stack.pop();
    if (stack.length > 0) stack[stack.length - 1].node.children.push(child);
    stack.push({ level: m[1].length, node: child });
  }
  return root;
}

export default MindmapPreview;
