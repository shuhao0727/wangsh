import React from "react";
import { Typography } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toScopedCss } from "@utils/scopedCss";

const { Text } = Typography;

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
        <FileTextOutlined style={{ fontSize: 48, marginBottom: 16 }} />
        <Text type="secondary" style={{ fontSize: "16px" }}>
          开始输入内容，预览将在此处显示
        </Text>
        <Text type="secondary" style={{ fontSize: "12px", marginTop: "8px" }}>
          支持Markdown语法：标题、列表、代码块、链接等
        </Text>
      </div>
    );
  }

  const combinedCss = `${styleCss || ""}\n${customCss || ""}`;
  const scopedCss = combinedCss.trim() ? toScopedCss(combinedCss, `[data-article-scope="${scopeId}"]`) : "";

  return (
    <div className="ws-markdown" data-article-scope={scopeId} style={{ height: "100%", minHeight: "100%" }}>
      {scopedCss ? <style dangerouslySetInnerHTML={{ __html: scopedCss }} /> : null}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
