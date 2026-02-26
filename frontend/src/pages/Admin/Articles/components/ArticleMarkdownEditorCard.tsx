import React from "react";
import { Button, Card, Form, Space, Tag, Tooltip, Typography } from "antd";
import {
  BarChartOutlined,
  BoldOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  EditOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  PictureOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import LineNumberedMarkdownTextArea from "../LineNumberedMarkdownTextArea";

const { Text } = Typography;

type Tool = {
  icon: React.ReactNode;
  tooltip: string;
  action: () => void;
};

export default function ArticleMarkdownEditorCard() {
  const form = Form.useFormInstance();
  const content = Form.useWatch("content", form) || "";

  const insertText = (text: string) => {
    const current = form.getFieldValue("content") || "";
    const textarea = document.getElementById("article-content-textarea") as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = current.substring(0, start) + text + current.substring(end);
    form.setFieldValue("content", next);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const tools: Tool[] = [
    { icon: <BoldOutlined />, tooltip: "粗体", action: () => insertText("**粗体文字**") },
    { icon: <ItalicOutlined />, tooltip: "斜体", action: () => insertText("*斜体文字*") },
    { icon: <CodeOutlined />, tooltip: "行内代码", action: () => insertText("`代码`") },
    { icon: <LinkOutlined />, tooltip: "链接", action: () => insertText("[链接文字](https://)") },
    { icon: <OrderedListOutlined />, tooltip: "有序列表", action: () => insertText("1. 列表项") },
    { icon: <UnorderedListOutlined />, tooltip: "无序列表", action: () => insertText("- 列表项") },
    { icon: <PictureOutlined />, tooltip: "图片", action: () => insertText("![图片描述](图片链接)") },
  ];

  return (
    <Card
      title={
        <Space size={8}>
          <EditOutlined style={{ color: "#fa541c" }} />
          <span style={{ color: "var(--ws-color-text)", fontWeight: 600 }}>编辑</span>
        </Space>
      }
      size="small"
      className="article-editor-card"
      styles={{ body: { padding: 0 } }}
    >
      <div className="article-editor-toolbar">
        <Text type="secondary" className="article-editor-toolbar-label">
          快捷工具
        </Text>
        <Space size={6} wrap>
          {tools.map((tool, index) => (
            <Tooltip key={index} title={tool.tooltip}>
              <Button
                type="text"
                icon={tool.icon}
                size="small"
                onClick={tool.action}
                className="article-editor-toolbar-btn"
              />
            </Tooltip>
          ))}
        </Space>
        <div style={{ flex: 1 }} />
        <Tag color="orange" style={{ fontSize: "11px" }}>
          Markdown
        </Tag>
      </div>

      <div className="article-editor-body">
        <Form.Item
          name="content"
          getValueFromEvent={(v) => (typeof v === "string" ? v : v?.target?.value)}
          rules={[
            { required: true, message: "请输入文章内容" },
            { min: 10, message: "内容不能少于10个字符" },
          ]}
        >
          <LineNumberedMarkdownTextArea id="article-content-textarea" placeholder="请输入文章内容，支持 Markdown 格式…" />
        </Form.Item>
      </div>

      <div className="article-editor-footer">
        <Tag color="geekblue" style={{ fontSize: "11px" }}>
          <BarChartOutlined /> 字数: {content.length} 字符
        </Tag>
        <Tag color="green" style={{ fontSize: "11px" }}>
          <ClockCircleOutlined /> 预计 {content.length / 500 > 1 ? Math.ceil(content.length / 500) : 1} 分钟阅读
        </Tag>
      </div>
    </Card>
  );
}
