/**
 * 文章编辑表单组件
 * 支持创建和编辑文章，集成 Markdown 编辑器和样式方案
 */

import { showMessage } from "@/lib/toast";
import React, { useEffect, useState } from "react";
import { FormProvider, useForm, type FieldErrors } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PanelLeftClose, PanelLeftOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBreakpoint } from "@/hooks/useBreakpoint";
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

const formSchema = z.object({
  title: z.string().trim().min(1, "请输入文章标题").max(200, "标题不能超过200个字符"),
  summary: z.string().max(500, "摘要不能超过500个字符"),
  content: z.string().trim().min(10, "内容不能少于10个字符"),
  custom_css: z.string(),
  style_key: z.string().nullable(),
  category_id: z.string(),
  published: z.boolean(),
});

export type ArticleFormValues = z.infer<typeof formSchema>;

interface ArticleEditFormProps {
  article: ArticleWithRelations | null;
  categories: any[];
  isCreateMode: boolean;
  layout?: "default" | "editor";
  onSave: () => void;
  onCancel: () => void;
}

const toInitialValues = (article: ArticleWithRelations | null): ArticleFormValues => ({
  title: article?.title || "",
  summary: article?.summary || "",
  content: article?.content || "",
  custom_css: article?.custom_css || "",
  style_key: article?.style_key || null,
  category_id: article?.category_id ? String(article.category_id) : "",
  published: article?.published ?? false,
});

const buildSlug = (raw: string): string => {
  const base = raw
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `article-${Date.now()}`;
};

const parseErrorMessage = (error: any): string => {
  if (error?.response?.data?.detail) {
    const detail = error.response.data.detail;
    if (Array.isArray(detail)) {
      return detail
        .map((err: any) => {
          if (err?.loc && err?.msg) return `${err.loc.join(".")}: ${err.msg}`;
          return err?.msg || JSON.stringify(err);
        })
        .join(", ");
    }
    if (typeof detail === "string") return detail;
    return JSON.stringify(detail);
  }
  if (error?.response?.data?.message) return String(error.response.data.message);
  if (error?.message) return String(error.message);
  return "保存文章失败，请检查表单数据";
};

const ArticleEditForm: React.FC<ArticleEditFormProps> = ({
  article,
  categories,
  isCreateMode,
  layout = "default",
  onSave,
  onCancel,
}) => {
  const screens = useBreakpoint();
  const methods = useForm<ArticleFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toInitialValues(article),
  });

  const {
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting },
  } = methods;

  const watchedContent = watch("content") || "";
  const watchedCustomCss = watch("custom_css") || "";
  const [styleKey, setStyleKey] = useState<string | null>(article?.style_key || null);
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

  useEffect(() => {
    void markdownStylesApi
      .list()
      .then((items) => setStyleOptions(items || []))
      .catch(() => setStyleOptions([]));
  }, []);

  useEffect(() => {
    const values = toInitialValues(article);
    reset(values);
    setStyleKey(values.style_key || null);
    setStyleCss(article?.style?.content || "");
  }, [article, reset]);

  useEffect(() => {
    let mounted = true;
    if (!styleKey) {
      setStyleCss("");
      return undefined;
    }
    void markdownStylesApi
      .get(styleKey)
      .then((s) => {
        if (mounted) setStyleCss(s?.content || "");
      })
      .catch(() => {
        if (mounted) setStyleCss("");
      });
    return () => {
      mounted = false;
    };
  }, [styleKey]);

  const refreshStyles = async () => {
    const items = await markdownStylesApi.list();
    setStyleOptions(items || []);
    return items || [];
  };

  const handleFormSubmit = async (values: ArticleFormValues) => {
    try {
      let slug: string;
      if (isCreateMode) {
        slug = buildSlug(values.title);
      } else {
        slug = buildSlug(article?.slug || values.title);
      }

      const categoryIdNum = Number(values.category_id);
      const categoryId =
        values.category_id && Number.isFinite(categoryIdNum)
          ? categoryIdNum
          : null;

      const articleData = {
        title: values.title || "",
        slug,
        content: values.content || "",
        summary:
          values.summary?.trim() ||
          (values.content || "").substring(0, 200) ||
          "文章摘要",
        custom_css: (values.custom_css || "").trim() || null,
        style_key: values.style_key || null,
        published: values.published !== undefined ? values.published : false,
        author_id: 1,
        category_id: categoryId,
      };

      logger.debug("提交的文章数据:", articleData);

      if (isCreateMode) {
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
        showMessage.success("文章创建成功");
      } else {
        const response = await articleApi.updateArticle(article!.id, articleData);
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
        showMessage.success("文章更新成功");
      }

      onSave();
    } catch (error: any) {
      logger.error("保存文章失败 - 完整错误对象:", error);
      logger.error("保存文章失败 - 响应数据:", error?.response?.data);
      logger.error("保存文章失败 - 请求配置:", error?.config);
      logger.error("保存文章失败 - 错误详情:", error?.response?.data?.detail);
      showMessage.error(`保存失败: ${parseErrorMessage(error)}`);
    }
  };

  const handleFormFailed = (errors: FieldErrors<ArticleFormValues>) => {
    logger.warn("表单验证失败:", errors);
    showMessage.error("请检查表单数据是否正确");
  };

  const submitForm = handleSubmit(handleFormSubmit, handleFormFailed);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void submitForm();
    }
  };

  const isSplit = viewMode === "split" && screens.lg;

  const renderContentPanel = () => (
    <Card className="article-edit-content-card">
      <div className="article-edit-content-card-body">
        <div className="article-edit-content-row">
          {viewMode !== "preview" ? (
            <div className="article-edit-panel-col" style={{ flex: isSplit ? "0 0 42%" : "1 1 auto" }}>
              <div className="article-edit-panel">
                <ArticleMarkdownEditorCard
                  viewMode={viewMode}
                  canSplit={!!screens.lg}
                  onViewModeChange={setViewMode}
                />
              </div>
            </div>
          ) : null}

          {viewMode !== "edit" ? (
            <div className="article-edit-panel-col" style={{ flex: isSplit ? "0 0 58%" : "1 1 auto" }}>
              <div className="article-edit-panel">
                <ArticleMarkdownPreviewCard
                  content={watchedContent}
                  scopeId={articleScopeId}
                  styleCss={styleCss}
                  customCss={watchedCustomCss}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );

  const renderActions = () => (
    <Card className="article-edit-actions-card">
      <div className="article-edit-actions-inner">
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="min-w-[80px]"
          >
            取消
          </Button>
          <Button type="submit" disabled={isSubmitting} className="min-w-[100px]">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isCreateMode ? "创建文章" : "保存修改"}
          </Button>
        </div>
        {isCreateMode ? (
          <div className="mt-3 text-center text-xs text-text-tertiary">
            保存后文章将出现在文章列表中
          </div>
        ) : null}
      </div>
    </Card>
  );

  return (
    <div className={`article-edit-form ${layout === "editor" ? "is-editor-layout" : ""}`}>
      <FormProvider {...methods}>
        <form className="article-edit-form-root" onSubmit={submitForm} onKeyDown={handleKeyDown}>
          {layout === "editor" ? (
            <div className={`article-edit-editor-grid ${sideCollapsed ? "article-edit-editor-grid-collapsed" : ""}`}>
              <div className={`article-edit-editor-side ${sideCollapsed ? "article-edit-editor-side-collapsed" : ""}`}>
                <div className={`article-edit-side-toggle ${sideCollapsed ? "collapsed" : ""}`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setSideCollapsed((v) => !v)}
                        aria-label={sideCollapsed ? "展开左侧栏" : "折叠左侧栏"}
                      >
                        {sideCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{sideCollapsed ? "展开左侧栏" : "折叠左侧栏"}</TooltipContent>
                  </Tooltip>
                </div>
                {sideCollapsed ? null : (
                  <ArticleEditorSidebar
                    categories={categories}
                    loading={false}
                    styleOptions={styleOptions}
                    styleKey={styleKey}
                    onStyleKeyChange={setStyleKey}
                    onOpenStyleManager={() => setStylesManageOpen(true)}
                  />
                )}
              </div>

              <div className="article-edit-editor-main">
                {renderContentPanel()}
                {renderActions()}
              </div>
            </div>
          ) : (
            <div className="article-edit-default-layout">
              <ArticleEditorSidebar
                categories={categories}
                loading={false}
                styleOptions={styleOptions}
                styleKey={styleKey}
                onStyleKeyChange={setStyleKey}
                onOpenStyleManager={() => setStylesManageOpen(true)}
              />
              {renderContentPanel()}
              {renderActions()}
            </div>
          )}
        </form>
      </FormProvider>

      <MarkdownStyleManagerModal
        open={stylesManageOpen}
        onClose={() => setStylesManageOpen(false)}
        styleOptions={styleOptions}
        refreshStyles={refreshStyles}
        activeStyleKey={styleKey}
        onActiveStyleKeyChange={(next) => {
          setValue("style_key", next, { shouldDirty: true, shouldValidate: true });
          setStyleKey(next);
        }}
        onStyleCssChange={setStyleCss}
      />
    </div>
  );
};

export default ArticleEditForm;
