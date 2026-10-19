/**
 * 思维导图全屏预览页
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MindMapViewer from "@/features/it-technology/learning/MindMapViewer";
import { markdownToMindMapData } from "@/features/it-technology/learning/mindMapData";
import { Button } from "@/components/ui/button";
import { showMessage } from "@/lib/toast";
import {
  isMindmapEditorRuntimeAvailable,
  MINDMAP_EDITOR_UNAVAILABLE_MESSAGE,
} from "@/lib/mindmapRuntime";
import { ArrowLeft, Pencil, GitBranch } from "lucide-react";

const MindmapPreview: React.FC = () => {
  const [params] = useSearchParams();
  const id = params.get("id");
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [hasPreview, setHasPreview] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // 从 localStorage 读取预览数据
    try {
      const raw = localStorage.getItem("_wangsh_preview_data");
      if (raw) {
        const item = JSON.parse(raw);
        if (item && typeof item === "object") {
          const nextTitle = typeof item.title === "string" ? item.title : "";
          const nextMarkdown = typeof item.content?.markdown === "string"
            ? item.content.markdown
            : nextTitle ? `# ${nextTitle}` : "";
          setTitle(nextTitle);
          setMarkdown(nextMarkdown);
          setHasPreview(Boolean(nextTitle || nextMarkdown));
        }
      }
    } catch {}
  }, []);

  const handleBack = () => {
    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    navigate("/mindmaps");
  };

  const handleEdit = () => {
    if (!isMindmapEditorRuntimeAvailable()) {
      showMessage.warning(MINDMAP_EDITOR_UNAVAILABLE_MESSAGE);
      return;
    }
    if (id) {
      const rootText = title || "未命名";
      const md = markdown || `# ${rootText}`;
      localStorage.setItem("_wangsh_mindmap_data", JSON.stringify({
        root: markdownToMindMapData(md, rootText),
        theme: { template: "classic4", config: {} },
        layout: "logicalStructure", config: {}, view: null,
      }));
      window.open(`/mindmap-demo/index.html?id=${id}`, "_blank");
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface">
      <header className="flex min-h-11 shrink-0 items-center gap-3 border-b border-border-secondary px-3 py-2 sm:px-4">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
          onClick={handleBack}>
          <ArrowLeft className="h-3.5 w-3.5" />返回
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-text-base">{title || "思维导图预览"}</h1>
        {id && hasPreview && (
          <div className="ml-auto">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
              onClick={handleEdit}>
              <Pencil className="h-3 w-3" />编辑
            </Button>
          </div>
        )}
      </header>
      <main className="min-h-0 flex-1 p-3 sm:p-4">
        {hasPreview ? (
          <div className="h-full min-h-[calc(100dvh-4rem)]">
            <MindMapViewer markdown={markdown} />
          </div>
        ) : (
          <section className="flex min-h-[55vh] flex-col items-center justify-center gap-3 text-center">
            <GitBranch aria-hidden="true" className="h-8 w-8 text-text-tertiary" />
            <h2 className="text-sm font-medium text-text-secondary">没有可预览的思维导图</h2>
            <Button size="sm" onClick={handleBack}>返回导图广场</Button>
          </section>
        )}
      </main>
    </div>
  );
};

export default MindmapPreview;
