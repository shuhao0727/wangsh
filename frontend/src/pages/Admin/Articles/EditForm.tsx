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
import { articleApi } from "@services";
import type { ArticleWithRelations } from "@services";
import { logger } from "@services/logger";
import "./EditForm.css";

const { TextArea } = Input;
const { Text } = Typography;
const { Option } = Select;

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
const PreviewContent: React.FC<{ content: string }> = ({ content }) => {
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

  return (
    <div style={{ height: "100%", minHeight: "100%" }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1
              style={{
                fontSize: "1.8em",
                fontWeight: "bold",
                margin: "0.8em 0 0.4em",
                paddingBottom: "6px",
                borderBottom: "2px solid var(--ws-color-border)",
                color: "var(--ws-color-text)",
              }}
              {...props}
            >
              {props.children}
            </h1>
          ),
          h2: ({ node, ...props }) => (
            <h2
              style={{
                fontSize: "1.5em",
                fontWeight: "bold",
                margin: "0.7em 0 0.3em",
                paddingBottom: "4px",
                borderBottom: "1px solid var(--ws-color-border)",
                color: "var(--ws-color-text)",
              }}
              {...props}
            >
              {props.children}
            </h2>
          ),
          h3: ({ node, ...props }) => (
            <h3
              style={{
                fontSize: "1.25em",
                fontWeight: "bold",
                margin: "0.6em 0 0.2em",
                color: "var(--ws-color-text)",
              }}
              {...props}
            >
              {props.children}
            </h3>
          ),
          h4: ({ node, ...props }) => (
            <h4
              style={{
                fontSize: "1.1em",
                fontWeight: "bold",
                margin: "0.5em 0 0.2em",
                color: "var(--ws-color-text-secondary)",
              }}
              {...props}
            >
              {props.children}
            </h4>
          ),
          p: ({ node, ...props }) => (
            <p
              style={{
                margin: "0.8em 0",
                lineHeight: 1.8,
                color: "var(--ws-color-text)",
              }}
              {...props}
            />
          ),
          ul: ({ node, ...props }) => (
            <ul
              style={{
                margin: "0.8em 0",
                paddingLeft: "1.8em",
              }}
              {...props}
            />
          ),
          ol: ({ node, ...props }) => (
            <ol
              style={{
                margin: "0.8em 0",
                paddingLeft: "1.8em",
              }}
              {...props}
            />
          ),
          li: ({ node, ...props }) => (
            <li
              style={{
                margin: "0.4em 0",
                lineHeight: 1.6,
              }}
              {...props}
            />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              style={{
                borderLeft: "3px solid var(--ws-color-info)",
                margin: "1em 0",
                padding: "0.5em 1em",
                backgroundColor: "var(--ws-color-info-soft)",
                color: "var(--ws-color-text-secondary)",
                fontStyle: "normal",
                borderRadius: "0 4px 4px 0",
              }}
              {...props}
            />
          ),
          code: ({ node, ...props }) => {
            const isBlockCode =
              typeof props.children === "string" &&
              props.children.includes("\n");
            if (isBlockCode) {
              return (
                <pre
                  style={{
                    backgroundColor: "var(--ws-color-surface-2)",
                    padding: "12px",
                    borderRadius: "6px",
                    overflow: "auto",
                    margin: "1em 0",
                    fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                    fontSize: "0.9em",
                    border: "1px solid var(--ws-color-border)",
                  }}
                >
                  <code {...props} />
                </pre>
              );
            }
            return (
              <code
                style={{
                  backgroundColor: "var(--ws-color-surface-2)",
                  padding: "2px 6px",
                  borderRadius: "3px",
                  fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                  fontSize: "0.9em",
                  border: "1px solid var(--ws-color-border)",
                  color: "var(--ws-color-accent)",
                }}
                {...props}
              />
            );
          },
          a: ({ node, ...props }) => (
            <a
              style={{
                color: "var(--ws-color-primary)",
                textDecoration: "none",
                borderBottom: "1px solid transparent",
                transition: "border-color 0.2s",
              }}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {props.children}
            </a>
          ),
          img: ({ node, ...props }) => (
            <img
              style={{
                maxWidth: "100%",
                borderRadius: "4px",
                boxShadow: "none",
                border: "1px solid var(--ws-color-border)",
                margin: "1em 0",
              }}
              alt={(props as any).alt ?? ""}
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
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
  const [viewMode, setViewMode] = useState<"split" | "edit" | "preview">(
    screens.lg ? "split" : "edit",
  );

  useEffect(() => {
    if (!screens.lg && viewMode === "split") setViewMode("edit");
  }, [screens.lg, viewMode]);

  const switchViewMode = (next: "split" | "edit" | "preview") => {
    setContent(form.getFieldValue("content") || "");
    setViewMode(next);
  };

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
        category_id: article.category_id,
        published: article.published,
      });
      // 设置内容状态
      setContent(article.content || "");
    } else {
      // 创建模式：清空表单
      form.resetFields();
      setContent("");
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
        published: values.published !== undefined ? values.published : false,
        author_id: 1, // 后端会从token获取当前用户ID，这里只是为了符合schema
        category_id: values.category_id || null,
        // 标签功能已移除，删除了tag_ids字段
      };

      logger.debug("提交的文章数据:", articleData);

      if (isCreateMode) {
        // 创建文章
        const response = await articleApi.createArticle(articleData);
        logger.debug("创建文章响应:", response.data);
        message.success("文章创建成功");
      } else {
        // 更新文章
        const response = await articleApi.updateArticle(
          article!.id,
          articleData,
        );
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
          height: "100%",
          display: "flex",
          flexDirection: "column",
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
          style={{
            flex: 1,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            border: "1px solid var(--ws-color-border)",
            borderRadius: "8px",
            background: "#fff",
            overflow: "hidden",
          }}
        >
          <TextArea
            id="article-content-textarea"
            placeholder="请输入文章内容，支持 Markdown 格式…"
            className="article-editor-textarea"
            style={{
              fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
              fontSize: "14px",
              lineHeight: 1.7,
              height: "100%",
              resize: "vertical",
              border: "none",
              padding: "12px",
              background: "#fff",
              borderRadius: "8px",
              minHeight: "420px",
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
          height: "100%",
          display: "flex",
          flexDirection: "column",
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
        <PreviewContent content={content} />
      </div>
    </Card>
  );

  return (
    <div className="article-edit-form">
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
                <Space direction="vertical" size={10} style={{ width: "100%" }}>
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
                <Space direction="vertical" size={10} style={{ width: "100%" }}>
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
    </div>
  );
};

export default ArticleEditForm;
