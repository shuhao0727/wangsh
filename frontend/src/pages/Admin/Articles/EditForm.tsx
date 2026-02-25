/**
 * 文章编辑表单组件
 * 支持创建和编辑文章，集成Markdown编辑器和标签选择器
 */

import React, { useState, useEffect } from "react";
import {
  Form,
  Input,
  Select,
  Button,
  Card,
  Space,
  Switch,
  message,
  Typography,
  Row,
  Col,
  Tooltip,
  Tag,
  Radio,
  Grid,
  Modal,
  InputNumber,
} from "antd";
import {
  EyeOutlined,
  EditOutlined,
  FileTextOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  BoldOutlined,
  ItalicOutlined,
  CodeOutlined,
  LinkOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { articleApi, markdownStylesApi } from "@services";
import type {
  ArticleWithRelations,
  MarkdownStyleListItem,
  MarkdownStyleResponse,
} from "@services";
import { logger } from "@services/logger";
import { publishArticleUpdated } from "@utils/articleUpdatedEvent";
import { toScopedCss } from "@utils/scopedCss";
import "./EditForm.css";
import "../../../styles/markdown.css";

const { TextArea } = Input;
const { Text } = Typography;
const { Option } = Select;

const STYLE_PREVIEW_MD = `# 标题一

这是段落，包含 \`行内代码\`、**粗体**、*斜体* 与 [链接](https://example.com)。

## 标题二

> 引用块：样式应该对引用也有明显效果。

\`\`\`ts
export const add = (a: number, b: number) => a + b;
\`\`\`

- 列表项 1
- 列表项 2

| 列 | 值 |
| --- | --- |
| A | 1 |
| B | 2 |
`;

interface ArticleEditFormProps {
  article: ArticleWithRelations | null;
  categories: any[];
  isCreateMode: boolean;
  layout?: "default" | "editor";
  onSave: () => void;
  onCancel: () => void;
}

// 标签功能已移除，删除了TagOption接口

// 预览组件 - 使用react-markdown
const PreviewContent: React.FC<{
  content: string;
  scopeId: string;
  styleCss?: string | null;
  customCss?: string | null;
}> = ({ content, scopeId, styleCss, customCss }) => {
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
  const scopedCss = combinedCss.trim()
    ? toScopedCss(combinedCss, `[data-article-scope="${scopeId}"]`)
    : "";

  return (
    <div
      className="ws-markdown"
      data-article-scope={scopeId}
      style={{ height: "100%", minHeight: "100%" }}
    >
      {scopedCss ? <style dangerouslySetInnerHTML={{ __html: scopedCss }} /> : null}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
};

const ArticleEditForm: React.FC<ArticleEditFormProps> = ({
  article,
  categories,
  isCreateMode,
  layout = "default",
  onSave,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const screens = Grid.useBreakpoint();
  const [loading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const [customCss, setCustomCss] = useState("");
  const [styleKey, setStyleKey] = useState<string | null>(
    article?.style_key || null,
  );
  const [styleCss, setStyleCss] = useState<string>("");
  const [styleOptions, setStyleOptions] = useState<MarkdownStyleListItem[]>([]);
  const [stylesManageOpen, setStylesManageOpen] = useState(false);
  const [styleEditingKey, setStyleEditingKey] = useState<string>("");
  const [styleDraft, setStyleDraft] = useState<MarkdownStyleResponse | null>(
    null,
  );
  const [newStyleKey, setNewStyleKey] = useState("");
  const [newStyleTitle, setNewStyleTitle] = useState("");
  const [viewMode, setViewMode] = useState<"split" | "edit" | "preview">(
    screens.lg ? "split" : "edit",
  );
  const articleScopeId = article?.id ? `article-${article.id}` : "article-draft";

  useEffect(() => {
    if (!screens.lg && viewMode === "split") setViewMode("edit");
  }, [screens.lg, viewMode]);

  const switchViewMode = (next: "split" | "edit" | "preview") => {
    setContent(form.getFieldValue("content") || "");
    setViewMode(next);
  };

  useEffect(() => {
    markdownStylesApi
      .list()
      .then((items) => setStyleOptions(items || []))
      .catch(() => setStyleOptions([]));
  }, []);

  useEffect(() => {
    if (!styleKey) {
      setStyleCss("");
      return;
    }
    markdownStylesApi
      .get(styleKey)
      .then((s) => setStyleCss(s?.content || ""))
      .catch(() => setStyleCss(""));
  }, [styleKey]);

  const refreshStyles = async () => {
    const items = await markdownStylesApi.list();
    setStyleOptions(items || []);
    return items || [];
  };

  useEffect(() => {
    if (!stylesManageOpen) return;
    refreshStyles()
      .then((items) => {
        const nextKey = styleKey || items[0]?.key || "";
        setStyleEditingKey(nextKey);
        if (!nextKey) {
          setStyleDraft(null);
          return;
        }
        markdownStylesApi
          .get(nextKey)
          .then((s) => setStyleDraft(s))
          .catch(() => setStyleDraft(null));
      })
      .catch(() => {
        setStyleEditingKey("");
        setStyleDraft(null);
      });
  }, [stylesManageOpen, styleKey]);

  useEffect(() => {
    if (!stylesManageOpen) return;
    if (!styleEditingKey) {
      setStyleDraft(null);
      return;
    }
    markdownStylesApi
      .get(styleEditingKey)
      .then((s) => setStyleDraft(s))
      .catch(() => setStyleDraft(null));
  }, [stylesManageOpen, styleEditingKey]);

  // 编辑器工具栏按钮
  const editorTools = [
    {
      icon: <BoldOutlined />,
      action: () => insertText("**粗体文字**"),
      tooltip: "粗体",
    },
    {
      icon: <ItalicOutlined />,
      action: () => insertText("*斜体文字*"),
      tooltip: "斜体",
    },
    {
      icon: <CodeOutlined />,
      action: () => insertText("`代码`"),
      tooltip: "行内代码",
    },
    {
      icon: <LinkOutlined />,
      action: () => insertText("[链接文字](https://)"),
      tooltip: "链接",
    },
    {
      icon: <OrderedListOutlined />,
      action: () => insertText("1. 列表项"),
      tooltip: "有序列表",
    },
    {
      icon: <UnorderedListOutlined />,
      action: () => insertText("- 列表项"),
      tooltip: "无序列表",
    },
    {
      icon: <PictureOutlined />,
      action: () => insertText("![图片描述](图片链接)"),
      tooltip: "图片",
    },
  ];

  // 插入文本到编辑器
  const insertText = (text: string) => {
    const content = form.getFieldValue("content") || "";
    const textarea = document.getElementById(
      "article-content-textarea",
    ) as HTMLTextAreaElement;

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent =
        content.substring(0, start) + text + content.substring(end);

      form.setFieldValue("content", newContent);

      // 聚焦并设置光标位置
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      }, 0);
    }
  };

  // 标签功能已移除，删除相关函数

  // 初始化表单数据
  useEffect(() => {
    if (article) {
      // 编辑模式：填充表单
      form.setFieldsValue({
        title: article.title,
        summary: article.summary,
        content: article.content,
        custom_css: article.custom_css || "",
        style_key: article.style_key || null,
        category_id: article.category_id,
        published: article.published,
      });
      // 设置内容状态
      setContent(article.content || "");
      setCustomCss(article.custom_css || "");
      setStyleKey(article.style_key || null);
      setStyleCss(article.style?.content || "");
    } else {
      // 创建模式：清空表单
      form.resetFields();
      setContent("");
      setCustomCss("");
      setStyleKey(null);
      setStyleCss("");
    }
  }, [article, form]);

  // 标签功能已移除，删除加载标签的useEffect

  // 处理表单提交
  const handleSubmit = async (values: any) => {
    try {
      setSubmitting(true);

      // 生成slug：创建模式从标题生成，编辑模式使用原有的slug
      let slug;
      if (isCreateMode) {
        slug = values.title
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
        // 如果slug为空，使用默认值
        if (!slug || slug.trim() === "") {
          slug = "article-" + Date.now();
        }
      } else {
        // 编辑模式下使用原有的slug
        slug =
          article?.slug ||
          values.title
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "");
        if (!slug || slug.trim() === "") {
          slug = "article-" + Date.now();
        }
      }

      // 确保slug符合格式要求（只包含字母、数字、破折号和下划线）
      slug = slug
        .replace(/[^a-z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      const articleData = {
        title: values.title || "",
        slug: slug,
        content: values.content || "",
        summary:
          values.summary ||
          (values.content || "").substring(0, 200) ||
          "文章摘要",
        custom_css: (values.custom_css || "").trim() || null,
        style_key: values.style_key || null,
        published: values.published !== undefined ? values.published : false,
        author_id: 1, // 后端会从token获取当前用户ID，这里只是为了符合schema
        category_id: values.category_id || null,
        // 标签功能已移除，删除了tag_ids字段
      };

      logger.debug("提交的文章数据:", articleData);

      if (isCreateMode) {
        // 创建文章
        const response = await articleApi.createArticle(articleData);
        const saved = response.data;
        const payload = {
          articleId: saved.id,
          action: "created" as const,
          updatedAt: saved.updated_at,
          slug: saved.slug,
          title: saved.title,
        };
        const meta = publishArticleUpdated(payload);
        if (meta && window.opener && window.opener !== window) {
          try {
            window.opener.postMessage(
              { type: "article_updated", ...meta, payload },
              window.location.origin,
            );
          } catch {}
        }
        logger.debug("创建文章响应:", response.data);
        message.success("文章创建成功");
      } else {
        // 更新文章
        const response = await articleApi.updateArticle(
          article!.id,
          articleData,
        );
        const saved = response.data;
        const oldSlug = article?.slug;
        const newSlug = saved.slug;
        const slugChanged =
          typeof oldSlug === "string" &&
          typeof newSlug === "string" &&
          oldSlug !== newSlug;
        const payload = {
          articleId: saved.id,
          action: "updated" as const,
          updatedAt: saved.updated_at,
          slug: saved.slug,
          ...(slugChanged ? { oldSlug, newSlug } : {}),
          title: saved.title,
        };
        const meta = publishArticleUpdated(payload);
        if (meta && window.opener && window.opener !== window) {
          try {
            window.opener.postMessage(
              { type: "article_updated", ...meta, payload },
              window.location.origin,
            );
          } catch {}
        }
        logger.debug("更新文章响应:", response.data);
        message.success("文章更新成功");
      }

      onSave();
    } catch (error: any) {
      logger.error("保存文章失败 - 完整错误对象:", error);
      logger.error("保存文章失败 - 响应数据:", error.response?.data);
      logger.error("保存文章失败 - 请求配置:", error.config);
      logger.error("保存文章失败 - 错误详情:", error.response?.data?.detail);

      // 显示更详细的错误信息
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          // 如果是验证错误数组
          const errorMessages = error.response.data.detail
            .map((err: any) => {
              if (err.loc && err.msg) {
                return `${err.loc.join(".")}: ${err.msg}`;
              }
              return err.msg || JSON.stringify(err);
            })
            .join(", ");
          message.error(`保存失败: ${errorMessages}`);
        } else if (typeof error.response.data.detail === "string") {
          // 如果是字符串错误
          message.error(`保存失败: ${error.response.data.detail}`);
        } else {
          // 其他格式的错误
          message.error(
            `保存失败: ${JSON.stringify(error.response.data.detail)}`,
          );
        }
      } else if (error.response?.data?.message) {
        message.error(`保存失败: ${error.response.data.message}`);
      } else if (error.message) {
        message.error(`保存失败: ${error.message}`);
      } else {
        message.error("保存文章失败，请检查表单数据");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 处理表单值变化
  const handleValuesChange = (changedValues: any, allValues: any) => {
    if (changedValues.content !== undefined) {
      setContent(changedValues.content || "");
    }
    if (changedValues.custom_css !== undefined) {
      setCustomCss(changedValues.custom_css || "");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      form.submit();
    }
  };

  // 处理表单验证失败
  const handleFormFailed = (errorInfo: any) => {
    logger.warn("表单验证失败:", errorInfo);
    message.error("请检查表单数据是否正确");
  };

  const renderEditorCard = () => (
    <Card
      title={
        <Space size={8}>
          <EditOutlined style={{ color: "#fa541c" }} />
          <span style={{ color: "var(--ws-color-text)", fontWeight: 600 }}>编辑</span>
        </Space>
      }
      size="small"
      className="article-editor-card"
      styles={{
        body: {
          padding: 0,
        },
      }}
    >
      <div className="article-editor-toolbar">
        <Text type="secondary" className="article-editor-toolbar-label">
          快捷工具
        </Text>
        <Space size={6} wrap>
          {editorTools.map((tool, index) => (
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
          rules={[
            { required: true, message: "请输入文章内容" },
            { min: 10, message: "内容不能少于10个字符" },
          ]}
        >
          <TextArea
            id="article-content-textarea"
            placeholder="请输入文章内容，支持 Markdown 格式…"
            className="article-editor-textarea"
            style={{
              fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
              fontSize: "14px",
              lineHeight: 1.7,
            }}
            onFocus={(e) => {
              e.target.style.outline = "none";
              e.target.style.backgroundColor = "#fff";
            }}
            onBlur={(e) => {
              e.target.style.backgroundColor = "#fff";
            }}
          />
        </Form.Item>
      </div>

      <div className="article-editor-footer">
        <Tag color="geekblue" style={{ fontSize: "11px" }}>
          <BarChartOutlined /> 字数: {(form.getFieldValue("content") || "").length} 字符
        </Tag>
        <Tag color="green" style={{ fontSize: "11px" }}>
          <ClockCircleOutlined /> 预计{" "}
          {(form.getFieldValue("content") || "").length / 500 > 1
            ? Math.ceil((form.getFieldValue("content") || "").length / 500)
            : 1}{" "}
          分钟阅读
        </Tag>
      </div>
    </Card>
  );

  const renderPreviewCard = () => (
    <Card
      title={
        <Space size={8}>
          <EyeOutlined style={{ color: "#fa541c" }} />
          <span style={{ color: "var(--ws-color-text)", fontWeight: 600 }}>预览</span>
        </Space>
      }
      size="small"
      className="article-preview-card"
      styles={{
        body: {
          padding: 0,
        },
      }}
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
        <PreviewContent
          content={content}
          scopeId={articleScopeId}
          styleCss={styleCss}
          customCss={customCss}
        />
      </div>
    </Card>
  );

  return (
    <div className={`article-edit-form ${layout === "editor" ? "is-editor-layout" : ""}`}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        onFinishFailed={handleFormFailed}
        onValuesChange={handleValuesChange}
        onKeyDown={handleKeyDown}
        initialValues={{
          published: false,
        }}
      >
        {layout === "editor" ? (
          <div className="article-edit-editor-grid">
            <div className="article-edit-editor-side">
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
                      <Form.Item label={<span style={{ fontWeight: 500 }}>分类</span>} name="category_id" style={{ marginBottom: 0 }}>
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

                  <Form.Item
                    label={<span style={{ fontWeight: 500 }}>文章摘要</span>}
                    name="summary"
                    rules={[{ max: 500, message: "摘要不能超过500个字符" }]}
                  >
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
                  {article?.slug ? (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <Text type="secondary">Slug</Text>
                      <Text copyable>{article.slug}</Text>
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
                      onChange={(v) => {
                        form.setFieldValue("style_key", v || null);
                        setStyleKey(v || null);
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

                  <Button size="small" block onClick={() => setStylesManageOpen(true)}>
                    管理样式
                  </Button>

                  <Text type="secondary" style={{ fontSize: 12 }}>
                    仅作用于当前文章内容区域
                  </Text>
                </Space>
              </Card>
            </div>

            <div className="article-edit-editor-main">
              <Card
                title={
                  <div className="article-edit-content-header">
                    <div className="article-edit-content-header-left">
                      <span>文章内容</span>
                    </div>
                    <Radio.Group
                      value={viewMode}
                      onChange={(e) => switchViewMode(e.target.value)}
                      optionType="button"
                      buttonStyle="solid"
                      size="small"
                    >
                      {screens.lg && <Radio.Button value="split">分屏</Radio.Button>}
                      <Radio.Button value="edit">编辑</Radio.Button>
                      <Radio.Button value="preview">预览</Radio.Button>
                    </Radio.Group>
                  </div>
                }
                size="small"
                className="article-edit-content-card"
              >
                <Row gutter={16} className="article-edit-content-row">
                  <Col
                    xs={24}
                    lg={viewMode === "preview" ? 0 : viewMode === "split" && screens.lg ? 10 : 24}
                    style={{ display: viewMode === "preview" ? "none" : "block" }}
                  >
                    <div className="article-edit-panel">{renderEditorCard()}</div>
                  </Col>
                  <Col
                    xs={24}
                    lg={viewMode === "edit" ? 0 : viewMode === "split" && screens.lg ? 14 : 24}
                    style={{ display: viewMode === "edit" ? "none" : "block" }}
                  >
                    <div className="article-edit-panel">{renderPreviewCard()}</div>
                  </Col>
                </Row>
              </Card>

              <Card size="small" className="article-edit-actions-card">
                <Row align="middle" justify="end">
                  <Col>
                    <Space>
                      <Button onClick={onCancel} style={{ minWidth: 80 }}>
                        取消
                      </Button>
                      <Button type="primary" htmlType="submit" loading={submitting} style={{ minWidth: 100 }}>
                        {isCreateMode ? "创建文章" : "保存修改"}
                      </Button>
                    </Space>
                  </Col>
                </Row>
                {isCreateMode && (
                  <div style={{ textAlign: "center", marginTop: 12 }}>
                    <Text type="secondary" style={{ fontSize: "12px" }}>
                      保存后文章将出现在文章列表中
                    </Text>
                  </div>
                )}
              </Card>
            </div>
          </div>
        ) : (
          <>
            <Card title="基本信息" size="small" className="article-edit-basic-card">
              <Row gutter={16}>
                <Col xs={24} lg={12}>
                  <Form.Item
                    label={<span style={{ fontWeight: 500 }}>文章标题</span>}
                    name="title"
                    rules={[
                      { required: true, message: "请输入文章标题" },
                      { max: 200, message: "标题不能超过200个字符" },
                    ]}
                  >
                    <Input placeholder="请输入文章标题" size="large" allowClear />
                  </Form.Item>
                </Col>

                <Col xs={12} lg={6}>
                  <Form.Item name="published" label={<span style={{ fontWeight: 500 }}>发布状态</span>} valuePropName="checked">
                    <Switch checkedChildren="发布" unCheckedChildren="草稿" />
                  </Form.Item>
                </Col>

                <Col xs={12} lg={6}>
                  <Form.Item label={<span style={{ fontWeight: 500 }}>分类</span>} name="category_id">
                    <Select placeholder="选择分类" allowClear loading={loading} style={{ width: "100%" }}>
                      {categories.map((category) => (
                        <Option key={category.id} value={category.id}>
                          {category.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col span={24}>
                  <Form.Item label={<span style={{ fontWeight: 500 }}>文章摘要</span>} name="summary" rules={[{ max: 500, message: "摘要不能超过500个字符" }]}>
                    <TextArea placeholder="请输入文章摘要" rows={2} maxLength={500} showCount />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card
              title={
                <div className="article-edit-content-header">
                  <div className="article-edit-content-header-left">
                    <span>文章内容</span>
                  </div>
                  <Radio.Group
                    value={viewMode}
                    onChange={(e) => switchViewMode(e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                    size="small"
                  >
                    {screens.lg && <Radio.Button value="split">分屏</Radio.Button>}
                    <Radio.Button value="edit">编辑</Radio.Button>
                    <Radio.Button value="preview">预览</Radio.Button>
                  </Radio.Group>
                </div>
              }
              size="small"
              className="article-edit-content-card"
            >
              <Row gutter={16} className="article-edit-content-row">
                <Col
                  xs={24}
                  lg={viewMode === "preview" ? 0 : viewMode === "split" && screens.lg ? 10 : 24}
                  style={{ display: viewMode === "preview" ? "none" : "block" }}
                >
                  <div className="article-edit-panel">{renderEditorCard()}</div>
                </Col>
                <Col
                  xs={24}
                  lg={viewMode === "edit" ? 0 : viewMode === "split" && screens.lg ? 14 : 24}
                  style={{ display: viewMode === "edit" ? "none" : "block" }}
                >
                  <div className="article-edit-panel">{renderPreviewCard()}</div>
                </Col>
              </Row>
            </Card>

            <Card size="small" className="article-edit-actions-card">
              <Row align="middle" justify="end">
                <Col>
                  <Space>
                    <Button onClick={onCancel} style={{ minWidth: 80 }}>
                      取消
                    </Button>
                    <Button type="primary" htmlType="submit" loading={submitting} style={{ minWidth: 100 }}>
                      {isCreateMode ? "创建文章" : "保存修改"}
                    </Button>
                  </Space>
                </Col>
              </Row>
              {isCreateMode && (
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    保存后文章将出现在文章列表中
                  </Text>
                </div>
              )}
            </Card>
          </>
        )}
      </Form>

      <Modal
        title="管理 CSS 样式方案"
        open={stylesManageOpen}
        width={960}
        footer={null}
        onCancel={() => setStylesManageOpen(false)}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: 10, marginBottom: 12 }}>
          <Input value={newStyleKey} onChange={(e) => setNewStyleKey(e.target.value)} placeholder="key（如：my_style）" />
          <Input value={newStyleTitle} onChange={(e) => setNewStyleTitle(e.target.value)} placeholder="标题（可选）" />
          <Button
            onClick={async () => {
              const key = newStyleKey.trim();
              if (!key) {
                message.error("请输入样式 key");
                return;
              }
              try {
                await markdownStylesApi.upsert({
                  key,
                  title: newStyleTitle.trim() || undefined,
                  content: "",
                  sort_order: 0,
                });
                setNewStyleKey("");
                setNewStyleTitle("");
                await refreshStyles();
                setStyleEditingKey(key);
                message.success("样式已创建");
              } catch (e: any) {
                message.error(e?.response?.data?.detail || "创建样式失败");
              }
            }}
          >
            新建
          </Button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, minHeight: 520 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Select
              value={styleEditingKey || undefined}
              placeholder="选择样式"
              onChange={(v) => {
                setStyleEditingKey(v);
                form.setFieldValue("style_key", v || null);
                setStyleKey(v || null);
              }}
              options={styleOptions.map((s) => ({
                value: s.key,
                label: s.title ? `${s.title}（${s.key}）` : s.key,
              }))}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                danger
                size="small"
                style={{ flex: 1 }}
                onClick={() => {
                  if (!styleEditingKey) return;
                  Modal.confirm({
                    title: "删除样式方案？",
                    content: styleEditingKey,
                    okText: "删除",
                    okButtonProps: { danger: true },
                    cancelText: "取消",
                    onOk: async () => {
                      await markdownStylesApi.remove(styleEditingKey);
                      const items = await refreshStyles();
                      const next = items[0]?.key || "";
                      setStyleEditingKey(next);
                      if (styleKey === styleEditingKey) {
                        form.setFieldValue("style_key", null);
                        setStyleKey(null);
                      }
                      message.success("已删除");
                    },
                  });
                }}
              >
                删除
              </Button>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              样式方案可复用，文章通过 style_key 选择
            </Text>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {styleDraft ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 120px", gap: 10 }}>
                  <Input
                    value={styleDraft.title || ""}
                    onChange={(e) =>
                      setStyleDraft((p) => (p ? { ...p, title: e.target.value } : p))
                    }
                    placeholder="标题"
                  />
                  <InputNumber
                    value={styleDraft.sort_order ?? 0}
                    onChange={(v) =>
                      setStyleDraft((p) => (p ? { ...p, sort_order: Number(v || 0) } : p))
                    }
                    placeholder="排序"
                    style={{ width: "100%" }}
                  />
                  <Button
                    type="primary"
                    onClick={async () => {
                      if (!styleDraft) return;
                      try {
                        const saved = await markdownStylesApi.update(styleDraft.key, {
                          title: styleDraft.title,
                          sort_order: styleDraft.sort_order,
                          content: styleDraft.content,
                        });
                        setStyleDraft(saved);
                        await refreshStyles();
                        if (styleKey === saved.key) setStyleCss(saved.content || "");
                        message.success("已保存");
                      } catch (e: any) {
                        message.error(e?.response?.data?.detail || "保存失败");
                      }
                    }}
                  >
                    保存
                  </Button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, minHeight: 420 }}>
                  <TextArea
                    value={styleDraft.content || ""}
                    onChange={(e) =>
                      setStyleDraft((p) => (p ? { ...p, content: e.target.value } : p))
                    }
                    rows={18}
                    spellCheck={false}
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    }}
                  />
                  <div
                    style={{
                      border: "1px solid var(--ws-color-border)",
                      borderRadius: 8,
                      background: "var(--ws-color-surface)",
                      overflow: "auto",
                      padding: 12,
                    }}
                  >
                    <PreviewContent
                      content={STYLE_PREVIEW_MD}
                      scopeId={`style-preview-${styleDraft.key}`}
                      styleCss={styleDraft.content || ""}
                      customCss={null}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: 24 }}>
                <Text type="secondary">暂无样式或未选择</Text>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ArticleEditForm;
