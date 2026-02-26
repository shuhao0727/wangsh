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
  Radio,
  Grid,
} from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { articleApi, markdownStylesApi } from "@services";
import type {
  ArticleWithRelations,
  MarkdownStyleListItem,
} from "@services";
import { logger } from "@services/logger";
import { publishArticleUpdated } from "@utils/articleUpdatedEvent";
import ArticleEditorSidebar from "./components/ArticleEditorSidebar";
import ArticleMarkdownEditorCard from "./components/ArticleMarkdownEditorCard";
import ArticleMarkdownPreviewCard from "./components/ArticleMarkdownPreviewCard";
import MarkdownStyleManagerModal from "./components/MarkdownStyleManagerModal";
import "./EditForm.css";
import "../../../styles/markdown.css";

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

const ArticleEditForm: React.FC<ArticleEditFormProps> = ({
  article,
  categories,
  isCreateMode,
  layout = "default",
  onSave,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const watchedContent = Form.useWatch("content", form) || "";
  const watchedCustomCss = Form.useWatch("custom_css", form) || "";
  const screens = Grid.useBreakpoint();
  const [loading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [styleKey, setStyleKey] = useState<string | null>(
    article?.style_key || null,
  );
  const [styleCss, setStyleCss] = useState<string>("");
  const [styleOptions, setStyleOptions] = useState<MarkdownStyleListItem[]>([]);
  const [stylesManageOpen, setStylesManageOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"split" | "edit" | "preview">(
    screens.lg ? "split" : "edit",
  );
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const articleScopeId = article?.id ? `article-${article.id}` : "article-draft";

  useEffect(() => {
    if (!screens.lg && viewMode === "split") setViewMode("edit");
  }, [screens.lg, viewMode]);

  useEffect(() => {
    if (!screens.lg && sideCollapsed) setSideCollapsed(false);
  }, [screens.lg, sideCollapsed]);

  const switchViewMode = (next: "split" | "edit" | "preview") => {
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
      setStyleKey(article.style_key || null);
      setStyleCss(article.style?.content || "");
    } else {
      form.resetFields();
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

  return (
    <div className={`article-edit-form ${layout === "editor" ? "is-editor-layout" : ""}`}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        onFinishFailed={handleFormFailed}
        onKeyDown={handleKeyDown}
        initialValues={{
          published: false,
        }}
      >
        {layout === "editor" ? (
          <div className={`article-edit-editor-grid ${sideCollapsed ? "article-edit-editor-grid-collapsed" : ""}`}>
            <div className={`article-edit-editor-side ${sideCollapsed ? "article-edit-editor-side-collapsed" : ""}`}>
              <div className={`article-edit-side-toggle ${sideCollapsed ? "collapsed" : ""}`}>
                <Tooltip title={sideCollapsed ? "展开左侧栏" : "折叠左侧栏"}>
                  <Button
                    type="text"
                    size="small"
                    icon={sideCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                    onClick={() => setSideCollapsed((v) => !v)}
                  />
                </Tooltip>
              </div>
              {sideCollapsed ? null : (
                <ArticleEditorSidebar
                  categories={categories}
                  loading={loading}
                  isCreateMode={isCreateMode}
                  articleSlug={article?.slug || null}
                  styleOptions={styleOptions}
                  styleKey={styleKey}
                  onStyleKeyChange={setStyleKey}
                  onOpenStyleManager={() => setStylesManageOpen(true)}
                />
              )}
            </div>

            <div className="article-edit-editor-main">
              <Card
                title={
                  <div className="article-edit-content-header">
                    <div style={{ flex: 1 }} />
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
                    <div className="article-edit-panel">
                      <ArticleMarkdownEditorCard />
                    </div>
                  </Col>
                  <Col
                    xs={24}
                    lg={viewMode === "edit" ? 0 : viewMode === "split" && screens.lg ? 14 : 24}
                    style={{ display: viewMode === "edit" ? "none" : "block" }}
                  >
                    <div className="article-edit-panel">
                      <ArticleMarkdownPreviewCard
                        content={watchedContent}
                        scopeId={articleScopeId}
                        styleCss={styleCss}
                        customCss={watchedCustomCss}
                      />
                    </div>
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
                  <div style={{ flex: 1 }} />
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
                  <div className="article-edit-panel">
                    <ArticleMarkdownEditorCard />
                  </div>
                </Col>
                <Col
                  xs={24}
                  lg={viewMode === "edit" ? 0 : viewMode === "split" && screens.lg ? 14 : 24}
                  style={{ display: viewMode === "edit" ? "none" : "block" }}
                >
                  <div className="article-edit-panel">
                    <ArticleMarkdownPreviewCard
                      content={watchedContent}
                      scopeId={articleScopeId}
                      styleCss={styleCss}
                      customCss={watchedCustomCss}
                    />
                  </div>
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
      <MarkdownStyleManagerModal
        open={stylesManageOpen}
        onClose={() => setStylesManageOpen(false)}
        styleOptions={styleOptions}
        refreshStyles={refreshStyles}
        activeStyleKey={styleKey}
        onActiveStyleKeyChange={(next) => {
          form.setFieldValue("style_key", next || null);
          setStyleKey(next);
        }}
        onStyleCssChange={setStyleCss}
      />
    </div>
  );
};

export default ArticleEditForm;
