import React from "react";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ArticlePreviewContent from "./ArticlePreviewContent";

type Props = {
  content: string;
  scopeId: string;
  styleCss?: string | null;
  customCss?: string | null;
};

export default function ArticleMarkdownPreviewCard({ content, scopeId, styleCss, customCss }: Props) {
  return (
    <div className="article-preview-card rounded-lg border border-border-secondary bg-surface shadow-none">
      <div className="flex items-center gap-2 border-b border-border-secondary px-3 py-2">
        <Eye className="h-4 w-4 text-primary" />
        <span className="text-text-base font-semibold">预览</span>
      </div>
      <div className="article-preview-card-body">
        <div className="article-preview-toolbar">
          <span className="text-text-base font-semibold">内容预览</span>
        <div className="flex-1" />
          <Badge variant="warning" className="text-[11px]">实时更新</Badge>
        </div>
        <div className="article-preview-body">
          <ArticlePreviewContent content={content} scopeId={scopeId} styleCss={styleCss} customCss={customCss} />
        </div>
      </div>
    </div>
  );
}
