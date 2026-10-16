import React from "react";
import DOMPurify from "dompurify";
import { FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toScopedCss } from "@utils/scopedCss";

type Props = {
  content: string;
  scopeId: string;
  styleCss?: string | null;
  customCss?: string | null;
};

export default function ArticlePreviewContent({ content, scopeId, styleCss, customCss }: Props) {
  if (!content || content.trim() === "") {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          color: "var(--ws-color-text-secondary)",
        }}
      >
        <FileText style={{ width: 48, height: 48, marginBottom: 16 }} />
        <span className="text-base text-text-secondary">
          开始输入内容，预览将在此处显示
        </span>
        <span className="text-xs text-text-secondary mt-2">
          支持Markdown语法：标题、列表、代码块、链接等
        </span>
      </div>
    );
  }

  const combinedCss = `${styleCss || ""}\n${customCss || ""}`;
  const scopedCss = combinedCss.trim() ? toScopedCss(combinedCss, `.ws-markdown[data-article-scope="${scopeId}"]`) : "";

  return (
    <div className="ws-markdown flex-1 min-h-0" data-article-scope={scopeId}>
      {scopedCss ? <style dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(scopedCss, { FORCE_BODY: true }) }} /> : null}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
