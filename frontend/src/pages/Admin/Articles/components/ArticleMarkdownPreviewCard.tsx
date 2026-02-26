import React from "react";
import { Card, Space, Tag, Typography } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import ArticlePreviewContent from "./ArticlePreviewContent";

const { Text } = Typography;

type Props = {
  content: string;
  scopeId: string;
  styleCss?: string | null;
  customCss?: string | null;
};

export default function ArticleMarkdownPreviewCard({ content, scopeId, styleCss, customCss }: Props) {
  return (
    <Card
      title={
        <Space size={8}>
          <EyeOutlined style={{ color: "#fa541c" }} />
          <span style={{ color: "var(--ws-color-text)", fontWeight: 600 }}>预览</span>
        </Space>
      }
      size="small"
      className="article-preview-card"
      styles={{ body: { padding: 0 } }}
    >
      <div className="article-preview-toolbar">
        <Text strong style={{ color: "#fa541c" }}>
          内容预览
        </Text>
        <div style={{ flex: 1 }} />
        <Tag color="orange" style={{ fontSize: "11px" }}>
          实时更新
        </Tag>
      </div>
      <div className="article-preview-body">
        <ArticlePreviewContent content={content} scopeId={scopeId} styleCss={styleCss} customCss={customCss} />
      </div>
    </Card>
  );
}
