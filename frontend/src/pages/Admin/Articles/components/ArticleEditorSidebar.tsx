import React from "react";
import { Button, Card, Form, Input, Select, Space, Switch, Tag, Typography } from "antd";
import type { MarkdownStyleListItem } from "@services";

const { TextArea } = Input;
const { Text } = Typography;
const { Option } = Select;

type Props = {
  categories: any[];
  loading: boolean;
  isCreateMode: boolean;
  articleSlug?: string | null;
  styleOptions: MarkdownStyleListItem[];
  styleKey: string | null;
  onStyleKeyChange: (next: string | null) => void;
  onOpenStyleManager: () => void;
};

export default function ArticleEditorSidebar({
  categories,
  loading,
  isCreateMode,
  articleSlug,
  styleOptions,
  styleKey,
  onStyleKeyChange,
  onOpenStyleManager,
}: Props) {
  const form = Form.useFormInstance();

  return (
    <>
      <Card title="基本信息" size="small" className="article-edit-basic-card">
        <Space orientation="vertical" size={10} style={{ width: "100%" }}>
          <Form.Item
            label={<span style={{ fontWeight: 500 }}>文章标题</span>}
            name="title"
            rules={[
              { required: true, message: "请输入文章标题" },
              { max: 200, message: "标题不能超过200个字符" },
            ]}
          >
            <Input placeholder="请输入文章标题" size="middle" allowClear />
          </Form.Item>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Form.Item
                name="published"
                label={<span style={{ fontWeight: 500 }}>发布状态</span>}
                valuePropName="checked"
                style={{ marginBottom: 0 }}
              >
                <Switch checkedChildren="发布" unCheckedChildren="草稿" />
              </Form.Item>
            </div>
            <div style={{ flex: 1 }}>
              <Form.Item
                label={<span style={{ fontWeight: 500 }}>分类</span>}
                name="category_id"
                style={{ marginBottom: 0 }}
              >
                <Select placeholder="选择分类" allowClear loading={loading} style={{ width: "100%" }}>
                  {categories.map((category) => (
                    <Option key={category.id} value={category.id}>
                      {category.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </div>
          </div>

          <Form.Item label={<span style={{ fontWeight: 500 }}>文章摘要</span>} name="summary" rules={[{ max: 500, message: "摘要不能超过500个字符" }]}>
            <TextArea placeholder="请输入文章摘要" rows={3} maxLength={500} showCount />
          </Form.Item>
        </Space>
      </Card>

      <Card size="small" title="写作面板" className="article-edit-side-card" styles={{ body: { padding: 12 } }}>
        <Space orientation="vertical" size={10} style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <Text type="secondary">模式</Text>
            <Tag color={isCreateMode ? "blue" : "green"}>{isCreateMode ? "新建" : "编辑"}</Tag>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <Text type="secondary">快捷</Text>
            <Text>Ctrl/⌘ + Enter 保存</Text>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <Text type="secondary">建议</Text>
            <Text>分屏更利于排版</Text>
          </div>
          {articleSlug ? (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <Text type="secondary">Slug</Text>
              <Text copyable>{articleSlug}</Text>
            </div>
          ) : null}
        </Space>
      </Card>

      <Card size="small" title="样式" className="article-edit-side-card" styles={{ body: { padding: 12 } }}>
        <Space orientation="vertical" size={10} style={{ width: "100%" }}>
          <Form.Item name="style_key" style={{ marginBottom: 0 }}>
            <Select
              placeholder="选择 CSS 样式方案"
              allowClear
              value={styleKey || undefined}
              onChange={(v) => {
                form.setFieldValue("style_key", v || null);
                onStyleKeyChange(v || null);
              }}
              options={styleOptions.map((s) => ({
                value: s.key,
                label: s.title ? `${s.title}（${s.key}）` : s.key,
              }))}
            />
          </Form.Item>

          <Form.Item name="custom_css" hidden>
            <Input />
          </Form.Item>

          <Button size="small" block onClick={onOpenStyleManager}>
            管理样式
          </Button>

          <Text type="secondary" style={{ fontSize: 12 }}>
            仅作用于当前文章内容区域
          </Text>
        </Space>
      </Card>
    </>
  );
}
