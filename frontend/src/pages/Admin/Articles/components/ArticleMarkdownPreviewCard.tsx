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
          <EyeOutlined className="text-primary" />
          <span className="text-text-base font-semibold">预览</span>
        </Space>
      }
      size="small"
      className="article-preview-card"
      styles={{ body: { padding: 0 } }}
    >
      <div className="article-preview-toolbar">
        <Text strong className="text-text-base">
          内容预览
        </Text>
        <div className="flex-1" />
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
