/**
 * 文章详情页面 - 分栏布局版
 * 展示单篇文章的完整内容，左侧内容区，右侧目录
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import DOMPurify from "dompurify";
import {
  Typography,
  Button,
  Skeleton,
  Alert,
  Empty,
  Space,
  Divider,
  Tag,
} from "antd";
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  UserOutlined,
  FolderOutlined,
  ClockCircleOutlined,
  BookOutlined,
} from "@ant-design/icons";
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
import "./Detail.css";
import "../../styles/markdown.css";

const { Title, Text, Paragraph } = Typography;

// 目录项接口
interface TableOfContentsItem {
  id: string;
  text: string;
  level: number;
}

// 辅助函数：将文本转换为有效的ID
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

  // 状态管理
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

  // 加载文章详情
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

    // 清理函数
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

  // 生成文章目录 - 从文章内容中提取标题
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

  // 处理返回
  const handleBack = () => {
    navigate("/articles");
  };

  // 滚动到目录项
  const scrollToTocItem = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // 加载状态
  if (loading) {
    return (
      <div className="max-w-[1560px] mx-auto px-6 py-10">
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="max-w-[1560px] mx-auto px-6 py-10">
        <Alert
          title="文章加载失败"
          description={error}
          type="error"
          showIcon
          action={
            <Space>
              <Button onClick={handleBack}>返回文章列表</Button>
            </Space>
          }
        />
      </div>
    );
  }

  // 文章不存在
  if (!article) {
    return (
      <div className="article-detail-container article-detail-empty">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="文章不存在或已被删除"
        >
          <Button type="primary" onClick={handleBack}>
            返回文章列表
          </Button>
        </Empty>
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
      {/* 文章标题 */}
      <div className="article-detail-hero">
        <div className="article-detail-title" id={textToId(article.title)}>
          {article.title}
        </div>
        {article.summary && (
          <Paragraph className="article-detail-summary">
            {article.summary}
          </Paragraph>
        )}
      </div>

      {/* 文章元信息 */}
      <div className="article-meta-row">
        <Space wrap size="large" style={{ width: "100%" }}>
          <div className="flex items-center gap-2">
            <UserOutlined className="text-primary" />
            <Text>
              {article.author?.full_name ||
                article.author?.username ||
                "匿名作者"}
            </Text>
          </div>

          <div className="flex items-center gap-2">
            <CalendarOutlined className="text-success" />
            <Text>
              {dayjs(article.created_at).format("YYYY年MM月DD日")}
            </Text>
          </div>

          <div className="flex items-center gap-2">
            <ClockCircleOutlined className="text-primary" />
            <Text>发布于 {dayjs(article.created_at).fromNow()}</Text>
          </div>

          {article.category && (
            <div className="flex items-center gap-2">
              <FolderOutlined className="text-warning" />
              <Tag color="orange">
                <Link to={`/articles?category=${article.category.id}`}>
                  {article.category.name}
                </Link>
              </Tag>
            </div>
          )}
        </Space>
      </div>

      <Divider className="!mt-3 !mb-6" />

      {/* 文章内容 */}
      <div className="min-h-[400px]">
        {article.content ? (
          <div className="article-content ws-markdown" data-article-scope={scopeId}>
            {scopedCss ? <style dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(scopedCss, { FORCE_BODY: true }) }} /> : null}
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ node, ...props }) => {
                  const text = headingText(props.children);
                  const id = text ? makeId(text) : undefined;
                  return (
                    <h1 id={id} {...props}>
                      {props.children}
                    </h1>
                  );
                },
                h2: ({ node, ...props }) => {
                  const text = headingText(props.children);
                  const id = text ? makeId(text) : undefined;
                  return (
                    <h2 id={id} {...props}>
                      {props.children}
                    </h2>
                  );
                },
                h3: ({ node, ...props }) => {
                  const text = headingText(props.children);
                  const id = text ? makeId(text) : undefined;
                  return (
                    <h3 id={id} {...props}>
                      {props.children}
                    </h3>
                  );
                },
                h4: ({ node, ...props }) => {
                  const text = headingText(props.children);
                  const id = text ? makeId(text) : undefined;
                  return (
                    <h4 id={id} {...props}>
                      {props.children}
                    </h4>
                  );
                },
                a: ({ node, ...props }) => (
                  <a target="_blank" rel="noopener noreferrer" {...props}>
                    {props.children}
                  </a>
                ),
                img: ({ node, ...props }) => (
                  <img alt={(props as any).alt ?? ""} {...props} />
                ),
              }}
            >
              {article.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="text-center px-5 py-16">
            <div className="text-5xl mb-6 text-text-secondary">
              📝
            </div>
            <Title level={3} className="mb-4 text-text-secondary">
              文章内容正在建设中
            </Title>
            <Paragraph className="max-w-[500px] mx-auto text-text-secondary">
              这篇文章的详细内容正在编写中，敬请期待。
            </Paragraph>
          </div>
        )}
      </div>

      <Divider />

      {/* 文章底部信息 */}
      <div className="flex justify-between items-center pt-4">
        <Text type="secondary">
          最后更新：{dayjs(article.updated_at).format("YYYY-MM-DD HH:mm")}
        </Text>
      </div>
      </div>
    );
  };

  return (
    <div className="article-page-wrapper">
      <div className="article-header">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
          className="article-back-btn"
        >
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
                    <BookOutlined />
                    <span>文章目录</span>
                  </div>
                }
                bodyPadding={0}
              >
                <div className="article-toc-list border-none">
                  {tableOfContents.length > 0 ? (
                    tableOfContents.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => scrollToTocItem(item.id)}
                        className="article-toc-item"
                        style={{ paddingLeft: `${(item.level - 1) * 16 + 12}px` }}
                      >
                          <Text
                          ellipsis={{ tooltip: item.text }}
                          className="text-sm"
                        >
                          {item.text}
                        </Text>
                      </div>
                    ))
                  ) : (
                          <div className="p-4 text-center">
                      <Text type="secondary">暂无目录</Text>
                    </div>
                  )}
                </div>
              </PanelCard>
            </div>
          }
          right={
            <div className="article-right-pane">
              <PanelCard bodyPadding={24}>
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
