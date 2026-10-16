/**
 * 文章详情页面 - 分栏布局版
 * 展示单篇文章的完整内容，桌面左侧目录、右侧正文
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import DOMPurify from "dompurify";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Copy,
  FileText,
} from "lucide-react";
import { useNavigate, useParams, Link } from "react-router-dom";
import dayjs from "dayjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { articleApi } from "@services";
import type { ArticleWithRelations } from "@services";
import { logger } from "@services/logger";
import { showMessage } from "@/lib/toast";
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
  const mobileTocRef = useRef<HTMLDetailsElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

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

    void fetchArticle();

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
        void navigate(`/articles/${payload.newSlug}`, { replace: true });
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
    if (loading || error || !article) {
      setTableOfContents([]);
      return;
    }
    // Use the same parsed headings the reader sees; do not reparse Markdown with regex.
    const counts = new Map<string, number>();
    const usedIds = new Set([`article-title-${article.id}`]);
    const tocItems: TableOfContentsItem[] = [];
    contentRef.current?.querySelectorAll<HTMLHeadingElement>("h1, h2, h3, h4").forEach((heading) => {
      const text = heading.textContent?.trim() || "";
      if (!text) return;
      const base = textToId(text) || "section";
      let count = (counts.get(base) || 0) + 1;
      let id = count === 1 ? base : `${base}-${count}`;
      while (usedIds.has(id)) id = `${base}-${++count}`;
      counts.set(base, count);
      usedIds.add(id);
      heading.id = id;
      tocItems.push({ id, text, level: Number(heading.tagName.slice(1)) });
    });
    if (tocItems.length === 0 && article.title.trim()) {
      tocItems.push({ id: `article-title-${article.id}`, text: article.title.trim(), level: 1 });
    }
    setTableOfContents(tocItems);
  }, [article, loading, error]);

  const handleBack = () => {
    void navigate("/articles");
  };

  const scrollToTocItem = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const mobileToc = mobileTocRef.current;
      if (mobileToc?.open) {
        mobileToc.open = false;
        mobileToc.querySelector("summary")?.focus();
      }
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const renderBackButton = () => (
    <Button
      variant="ghost"
      onClick={handleBack}
      className="article-back-btn !text-text-secondary hover:!text-primary-text"
    >
      <ArrowLeft className="h-4 w-4" />
      返回文章列表
    </Button>
  );

  if (loading) {
    return (
      <div className="article-page-wrapper bg-page">
        <div className="article-header">{renderBackButton()}</div>
        <div className="article-detail-state" role="status" aria-label="正在加载文章" aria-busy="true">
          <div className="mb-6 space-y-3" aria-hidden="true">
            <Skeleton className="h-8 w-3/5" />
            <Skeleton className="h-4 w-2/5" />
          </div>
          <div className="space-y-xs" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="article-page-wrapper bg-page">
        <div className="article-header">{renderBackButton()}</div>
        <div className="article-detail-state">
          <Alert variant="destructive" className="article-detail-error">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>文章加载失败</AlertTitle>
            <AlertDescription className="mt-2xs flex flex-wrap items-center justify-between gap-[var(--ws-space-2)]">
              <span className="min-w-0 break-words">{error}</span>
              <Button onClick={() => setRefreshKey((key) => key + 1)}>重试</Button>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="article-page-wrapper bg-page">
        <div className="article-header">{renderBackButton()}</div>
        <div className="article-detail-state article-detail-empty">
          <EmptyState variant="no-data" description="文章不存在或已被删除" />
        </div>
      </div>
    );
  }

  const renderContent = () => {
    const scopeId = article?.id ? `article-${article.id}` : `article-${article.slug}`;
    const combinedCss = `${article?.style?.content || ""}\n${article?.custom_css || ""}`;
    const scopedCss = combinedCss.trim()
      ? toScopedCss(combinedCss, `.ws-markdown[data-article-scope="${scopeId}"]`)
      : "";

    return (
      <div className="article-content-wrapper">
        <div className="article-detail-hero border-0 bg-transparent">
          <h1 className="article-detail-title text-text-base" id={`article-title-${article.id}`}>
            {article.title}
          </h1>
          {article.summary && (
            <p className="article-detail-summary text-text-secondary">{article.summary}</p>
          )}
        </div>

        <div className="article-meta-row text-text-secondary">
          <div className="article-meta-item">
              <User className="h-4 w-4 text-text-tertiary" />
              <span title={article.author?.full_name || article.author?.username || "匿名作者"}>
                {article.author?.full_name ||
                  article.author?.username ||
                  "匿名作者"}
              </span>
          </div>

          <div className="article-meta-item">
              <Calendar className="h-4 w-4 text-text-tertiary" />
              <time dateTime={article.created_at}>{dayjs(article.created_at).format("YYYY年MM月DD日")}</time>
          </div>

          <div className="article-meta-item">
              <Clock3 className="h-4 w-4 text-text-tertiary" />
              <time dateTime={article.created_at}>发布于 {dayjs(article.created_at).fromNow()}</time>
          </div>

          {article.category && (
            <div className="article-meta-item">
                <FolderOpen className="h-4 w-4 text-text-tertiary" />
              <Link className="article-meta-category" title={article.category.name} to={`/articles?category=${article.category.id}`}>
                {article.category.name}
              </Link>
            </div>
          )}
        </div>

        <Separator className="my-6" />

        <div className="min-h-[400px]">
          {article.content ? (
            <div ref={contentRef} className="article-content ws-markdown" data-markdown-entry="article-detail" data-article-scope={scopeId}>
              {scopedCss ? <style dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(scopedCss, { FORCE_BODY: true }) }} /> : null}
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node: _node, ...props }) => (
                    <a target="_blank" rel="noopener noreferrer" {...props}>
                      {props.children}
                    </a>
                  ),
                  img: ({ node: _node, ...props }) => (
                    <img alt={(props as any).alt ?? "文章配图"} loading="lazy" decoding="async" {...props} />
                  ),
                  pre: ({ node: _node, children, ...props }) => {
                    const codeText = nodeToText(children);
                    return (
                      <div className="group relative">
                        <button
                          type="button"
                          className="article-code-copy absolute right-2 top-2 z-10 inline-flex items-center gap-2xs rounded-md bg-[var(--ws-color-surface-2)] px-xs py-2xs text-xs text-text-secondary opacity-0 transition-opacity hover:bg-interaction-hover focus-visible:opacity-100 group-hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interaction-focus focus-visible:ring-offset-2"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(codeText);
                              showMessage.success("代码已复制到剪贴板");
                            } catch {
                              showMessage.error("复制失败");
                            }
                          }}
                        >
                          <Copy className="h-3 w-3" />
                          复制
                        </button>
                        <pre {...props}>{children}</pre>
                      </div>
                    );
                  },
                }}
              >
                {article.content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-center px-5 py-16">
              <div className="mb-6 text-text-secondary"><FileText className="h-12 w-12 mx-auto" /></div>
              <h3 className="mb-4 text-2xl font-semibold text-text-secondary">文章内容正在建设中</h3>
              <p className="mx-auto max-w-prose text-sm text-text-secondary">
                这篇文章的详细内容正在编写中，敬请期待。
              </p>
            </div>
          )}
        </div>

        <Separator className="my-6" />

        <div className="flex items-center justify-between pt-4">
          <span className="text-sm text-text-secondary">
            最后更新：<time dateTime={article.updated_at}>{dayjs(article.updated_at).format("YYYY-MM-DD HH:mm")}</time>
          </span>
        </div>
      </div>
    );
  };

  const renderToc = () => (
    <nav aria-label="文章目录" className="article-toc-list border-none">
      {tableOfContents.length > 0 ? tableOfContents.map((item) => (
        <button
          type="button"
          key={item.id}
          title={item.text}
          onClick={() => scrollToTocItem(item.id)}
          className="article-toc-item appearance-none border-0 border-l-[var(--ws-border-accent-width)] border-l-transparent bg-transparent text-left text-text-secondary hover:border-l-brand-accent hover:bg-interaction-hover hover:text-text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interaction-focus focus-visible:ring-inset"
          style={{ paddingLeft: `calc(var(--ws-space-2) * ${Math.max(item.level - 1, 0)} + var(--ws-space-2))` }}
        >
          {item.text}
        </button>
      )) : <div className="p-4 text-center text-sm text-text-tertiary">暂无目录</div>}
    </nav>
  );

  return (
    <div className="article-page-wrapper bg-page">
      <div className="article-header">
        {renderBackButton()}
      </div>

      <details className="article-mobile-toc" ref={mobileTocRef}>
        <summary>文章目录</summary>
        {renderToc()}
      </details>

      <div className="article-body">
        <SplitPanePage
          leftWidth={280}
          alignItems="stretch"
          className="article-detail-layout h-full"
          left={
            <div className="article-left-pane [&>.informatics-card]:!border-0 [&>.informatics-card]:!bg-transparent [&>.informatics-card]:!shadow-none">
              <PanelCard
                title={
                  <div className="flex items-center gap-xs">
                    <BookOpen className="h-4 w-4" />
                    <span>文章目录</span>
                  </div>
                }
                bodyPadding={0}
              >
                {renderToc()}
              </PanelCard>
            </div>
          }
          right={
            <div className="article-right-pane [&>.informatics-card]:!border-0 [&>.informatics-card]:!bg-transparent [&>.informatics-card]:!shadow-none">
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
