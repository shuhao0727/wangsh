/**
 * 文章详情页面 - 分栏布局版
 * 展示单篇文章的完整内容，左侧内容区，右侧目录
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import DOMPurify from "dompurify";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Calendar,
  User,
  FolderOpen,
  Clock3,
  BookOpen,
  TriangleAlert,
} from "lucide-react";
import { useNavigate, useParams, Link } from "react-router-dom";
import dayjs from "dayjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { articleApi } from "@services";
import type { ArticleWithRelations } from "@services";
import { logger } from "@services/logger";
import { subscribeArticleUpdated } from "@utils/articleUpdatedEvent";
import { toScopedCss } from "@utils/scopedCss";
import SplitPanePage from "@components/Layout/SplitPanePage";
import PanelCard from "@components/Layout/PanelCard";
import EmptyState from "@components/Common/EmptyState";
import "./Detail.css";
import "../../styles/markdown.css";

interface TableOfContentsItem {
  id: string;
  text: string;
  level: number;
}

const textToId = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .replace(/-+/g, "-");
};

const nodeToText = (node: any): string => {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (React.isValidElement(node)) return nodeToText((node as any).props?.children);
  return "";
};

const markdownHeadingToPlainText = (raw: string): string => {
  const s = String(raw || "");
  return s
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
};

const ArticleDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const [article, setArticle] = useState<ArticleWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableOfContents, setTableOfContents] = useState<TableOfContentsItem[]>(
    [],
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshTimerRef = useRef<number | null>(null);
  const lastRefreshAtRef = useRef(0);
  const articleIdRef = useRef<number | null>(null);

  useEffect(() => {
    articleIdRef.current = article?.id ?? null;
  }, [article]);

  const requestRefresh = useCallback(() => {
    const now = Date.now();
    const minInterval = 500;
    const since = now - lastRefreshAtRef.current;
    if (since >= minInterval) {
      lastRefreshAtRef.current = now;
      setRefreshKey((k) => k + 1);
      return;
    }
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      lastRefreshAtRef.current = Date.now();
      setRefreshKey((k) => k + 1);
    }, minInterval - since);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchArticle = async () => {
      if (!slug) {
        if (isMounted) {
          setError("文章标识不存在");
          setLoading(false);
        }
        return;
      }

      try {
        if (isMounted) {
          setLoading(true);
          setError(null);
        }

        const response = await articleApi.getPublicArticleBySlug(slug);
        const articleData = response.data;

        if (isMounted) {
          setArticle(articleData);
        }
      } catch (err: any) {
        logger.error("获取文章详情失败:", err);
        if (isMounted) {
          setError(
            err.response?.data?.detail || "获取文章详情失败，请稍后重试",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchArticle();

    return () => {
      isMounted = false;
    };
  }, [slug, refreshKey]);

  useEffect(() => {
    const unsub = subscribeArticleUpdated((payload) => {
      const currentSlug = slug;
      if (!currentSlug) return;
      if (
        payload.oldSlug &&
        payload.newSlug &&
        payload.oldSlug === currentSlug &&
        payload.newSlug !== currentSlug
      ) {
        navigate(`/articles/${payload.newSlug}`, { replace: true });
        return;
      }

      const currentArticleId = articleIdRef.current;
      if (typeof currentArticleId === "number" && payload.articleId === currentArticleId) {
        requestRefresh();
      } else if (payload.slug && payload.slug === currentSlug) {
        requestRefresh();
      } else if (payload.newSlug && payload.newSlug === currentSlug) {
        requestRefresh();
      }
    });

    const onFocus = () => requestRefresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") requestRefresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      unsub();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    };
  }, [navigate, requestRefresh, slug]);

  useEffect(() => {
    const content = article?.content || "";
    const tocItems: TableOfContentsItem[] = [];
    const counts = new Map<string, number>();
    const makeId = (title: string) => {
      const base = textToId(title);
      const next = (counts.get(base) || 0) + 1;
      counts.set(base, next);
      return next === 1 ? base : `${base}-${next}`;
    };

    if (content) {
      const lines = content.split("\n");
      let inFence = false;
      for (const line of lines) {
        const trimmed = String(line || "").trim();
        if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
          inFence = !inFence;
          continue;
        }
        if (inFence) continue;

        const m = String(line || "")
          .replace(/^\s+/, "")
          .match(/^(#{1,4})[ \t]*(.+?)\s*$/);
        if (!m) continue;
        const level = m[1].length;
        const rawTitle = String(m[2] || "").replace(/\s+#+\s*$/, "");
        const titleText = markdownHeadingToPlainText(rawTitle);
        if (!titleText) continue;
        tocItems.push({ id: makeId(titleText), text: titleText, level });
      }
    }

    if (tocItems.length === 0 && article?.title) {
      const titleText = String(article.title || "").trim();
      if (titleText) tocItems.push({ id: textToId(titleText), text: titleText, level: 1 });
    }

    setTableOfContents(tocItems);
  }, [article?.content, article?.title]);

  const handleBack = () => {
    navigate("/articles");
  };

  const scrollToTocItem = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1560px] mx-auto px-[var(--ws-space-4)] py-[var(--ws-space-5)]">
        <div className="mb-6 space-y-3">
          <Skeleton className="h-8 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1560px] mx-auto px-[var(--ws-space-4)] py-[var(--ws-space-5)]">
        <Alert variant="destructive" className="border border-destructive/20 bg-destructive/5">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>文章加载失败</AlertTitle>
          <AlertDescription className="mt-1 flex flex-wrap items-center justify-between gap-[var(--ws-space-2)]">
            <span>{error}</span>
            <Button onClick={handleBack}>返回文章列表</Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="article-detail-container article-detail-empty">
        <EmptyState
          variant="no-data"
          description="文章不存在或已被删除"
          action={<Button onClick={handleBack}>返回文章列表</Button>}
        />
      </div>
    );
  }

  const renderContent = () => {
    const counts = new Map<string, number>();
    const makeId = (title: string) => {
      const base = textToId(title);
      const next = (counts.get(base) || 0) + 1;
      counts.set(base, next);
      return next === 1 ? base : `${base}-${next}`;
    };
    const headingText = (children: any) => nodeToText(children).trim();
    const scopeId = article?.id ? `article-${article.id}` : `article-${article.slug}`;
    const combinedCss = `${article?.style?.content || ""}\n${article?.custom_css || ""}`;
    const scopedCss = combinedCss.trim()
      ? toScopedCss(combinedCss, `.ws-markdown[data-article-scope="${scopeId}"]`)
      : "";

    return (
      <div className="article-content-wrapper">
        <div className="article-detail-hero">
          <div className="article-detail-title" id={textToId(article.title)}>
            {article.title}
          </div>
          {article.summary && (
            <p className="article-detail-summary">{article.summary}</p>
          )}
        </div>

        <div className="article-meta-row">
          <div className="flex w-full flex-wrap items-center gap-[var(--ws-layout-gap)]">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-text-tertiary" />
              <span>
                {article.author?.full_name ||
                  article.author?.username ||
                  "匿名作者"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-text-tertiary" />
              <span>{dayjs(article.created_at).format("YYYY年MM月DD日")}</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-text-tertiary" />
              <span>发布于 {dayjs(article.created_at).fromNow()}</span>
            </div>

            {article.category && (
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-text-tertiary" />
                <Badge variant="warning">
                  <Link to={`/articles?category=${article.category.id}`}>
                    {article.category.name}
                  </Link>
                </Badge>
              </div>
            )}
          </div>
        </div>

        <Separator className="my-6" />

        <div className="min-h-[400px]">
          {article.content ? (
            <div className="article-content ws-markdown" data-article-scope={scopeId}>
              {scopedCss ? <style dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(scopedCss, { FORCE_BODY: true }) }} /> : null}
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node: _node, ...props }) => {
                    const text = headingText(props.children);
                    const id = text ? makeId(text) : undefined;
                    return (
                      <h1 id={id} {...props}>
                        {props.children}
                      </h1>
                    );
                  },
                  h2: ({ node: _node, ...props }) => {
                    const text = headingText(props.children);
                    const id = text ? makeId(text) : undefined;
                    return (
                      <h2 id={id} {...props}>
                        {props.children}
                      </h2>
                    );
                  },
                  h3: ({ node: _node, ...props }) => {
                    const text = headingText(props.children);
                    const id = text ? makeId(text) : undefined;
                    return (
                      <h3 id={id} {...props}>
                        {props.children}
                      </h3>
                    );
                  },
                  h4: ({ node: _node, ...props }) => {
                    const text = headingText(props.children);
                    const id = text ? makeId(text) : undefined;
                    return (
                      <h4 id={id} {...props}>
                        {props.children}
                      </h4>
                    );
                  },
                  a: ({ node: _node, ...props }) => (
                    <a target="_blank" rel="noopener noreferrer" {...props}>
                      {props.children}
                    </a>
                  ),
                  img: ({ node: _node, ...props }) => (
                    <img alt={(props as any).alt ?? "文章配图"} loading="lazy" decoding="async" {...props} />
                  ),
                }}
              >
                {article.content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-center px-5 py-16">
              <div className="mb-6 text-5xl text-text-secondary">📝</div>
              <h3 className="mb-4 text-2xl font-semibold text-text-secondary">文章内容正在建设中</h3>
              <p className="mx-auto max-w-[500px] text-sm text-text-secondary">
                这篇文章的详细内容正在编写中，敬请期待。
              </p>
            </div>
          )}
        </div>

        <Separator className="my-6" />

        <div className="flex items-center justify-between pt-4">
          <span className="text-sm text-text-secondary">
            最后更新：{dayjs(article.updated_at).format("YYYY-MM-DD HH:mm")}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="article-page-wrapper">
      <div className="article-header">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="article-back-btn"
        >
          <ArrowLeft className="h-4 w-4" />
          返回文章列表
        </Button>
      </div>

      <div className="article-body">
        <SplitPanePage
          leftWidth={280}
          alignItems="stretch"
          className="h-full"
          left={
            <div className="article-left-pane">
              <PanelCard
                title={
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span>文章目录</span>
                  </div>
                }
                bodyPadding={0}
              >
                <div className="article-toc-list border-none">
                  {tableOfContents.length > 0 ? (
                    tableOfContents.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => scrollToTocItem(item.id)}
                        className="appearance-none border-0 article-toc-item text-left"
                        style={{ paddingLeft: `calc(var(--ws-space-2) * ${Math.max(item.level - 1, 0)} + var(--ws-space-2))` }}
                      >
                        {item.text}
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-text-tertiary">暂无目录</div>
                  )}
                </div>
              </PanelCard>
            </div>
          }
          right={
            <div className="article-right-pane">
              <PanelCard bodyPadding="var(--ws-space-4)">
                {renderContent()}
              </PanelCard>
            </div>
          }
        />
      </div>
    </div>
  );
};

export default ArticleDetailPage;
