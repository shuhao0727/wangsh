/**
 * 文章详情页面 - 分栏布局版
 * 展示单篇文章的完整内容，左侧内容区，右侧目录
 */

import React, { useState, useEffect } from "react";
import {
  Typography,
  Card,
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
import SplitPanePage from "@components/Layout/SplitPanePage";
import PanelCard from "@components/Layout/PanelCard";
import "./Detail.css";

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
        console.error("获取文章详情失败:", err);
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
  }, [slug]);

  // 生成文章目录 - 从文章内容中提取标题
  useEffect(() => {
    if (article?.content) {
      const lines = article.content.split("\n");
      const tocItems: TableOfContentsItem[] = [];

      lines.forEach((line, index) => {
        const text = line.trim();
        let level = 0;
        let titleText = "";

        if (text.startsWith("# ")) {
          level = 1;
          titleText = text.substring(2).trim();
        } else if (text.startsWith("## ")) {
          level = 2;
          titleText = text.substring(3).trim();
        } else if (text.startsWith("### ")) {
          level = 3;
          titleText = text.substring(4).trim();
        } else if (text.startsWith("#### ")) {
          level = 4;
          titleText = text.substring(5).trim();
        }

        if (level > 0 && titleText) {
          // 使用与标题组件相同的ID生成逻辑
          const id = textToId(titleText);

          tocItems.push({
            id,
            text: titleText,
            level,
          });
        }
      });

      // 如果没有标题，显示一个简化的目录
      if (tocItems.length === 0 && article.title) {
        const titleId = textToId(article.title);
        tocItems.push({
          id: titleId,
          text: article.title,
          level: 1,
        });
      }

      setTableOfContents(tocItems);
    }
  }, [article]);

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
      <div style={{ maxWidth: 1560, margin: "0 auto", padding: "40px 24px" }}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div style={{ maxWidth: 1560, margin: "0 auto", padding: "40px 24px" }}>
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

  const renderContent = () => (
    <div className="article-content-wrapper">
      {/* 文章标题 */}
      <div className="article-detail-hero">
        <div className="article-detail-title">{article.title}</div>
        {article.summary && (
          <Paragraph className="article-detail-summary">
            {article.summary}
          </Paragraph>
        )}
      </div>

      {/* 文章元信息 */}
      <div className="article-meta-row">
        <Space wrap size="large" style={{ width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UserOutlined style={{ color: "var(--ws-color-primary)" }} />
            <Text>
              {article.author?.full_name ||
                article.author?.username ||
                "匿名作者"}
            </Text>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CalendarOutlined style={{ color: "var(--ws-color-success)" }} />
            <Text>
              {dayjs(article.created_at).format("YYYY年MM月DD日")}
            </Text>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ClockCircleOutlined style={{ color: "var(--ws-color-info)" }} />
            <Text>发布于 {dayjs(article.created_at).fromNow()}</Text>
          </div>

          {article.category && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FolderOutlined style={{ color: "var(--ws-color-accent)" }} />
              <Tag color="orange">
                <Link to={`/articles?category=${article.category.id}`}>
                  {article.category.name}
                </Link>
              </Tag>
            </div>
          )}
        </Space>
      </div>

      <Divider style={{ margin: "12px 0 24px" }} />

      {/* 文章内容 */}
      <div style={{ minHeight: 400 }}>
        {article.content ? (
          <div className="article-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ node, ...props }) => {
                  const children = props.children || [];
                  const text = Array.isArray(children)
                    ? children.join("")
                    : children.toString();
                  const id = textToId(text);
                  return (
                    <h1
                      style={{
                        fontSize: "1.8em",
                        fontWeight: "bold",
                        margin: "1.2em 0 0.6em",
                        paddingBottom: "8px",
                        borderBottom: "2px solid var(--ws-color-border)",
                        color: "var(--ws-color-text)",
                      }}
                      id={id}
                      {...props}
                    >
                      {props.children}
                    </h1>
                  );
                },
                h2: ({ node, ...props }) => {
                  const children = props.children || [];
                  const text = Array.isArray(children)
                    ? children.join("")
                    : children.toString();
                  const id = textToId(text);
                  return (
                    <h2
                      style={{
                        fontSize: "1.5em",
                        fontWeight: "bold",
                        margin: "1em 0 0.5em",
                        paddingBottom: "6px",
                        borderBottom: "1px solid var(--ws-color-border)",
                        color: "var(--ws-color-text)",
                      }}
                      id={id}
                      {...props}
                    >
                      {props.children}
                    </h2>
                  );
                },
                h3: ({ node, ...props }) => {
                  const children = props.children || [];
                  const text = Array.isArray(children)
                    ? children.join("")
                    : children.toString();
                  const id = textToId(text);
                  return (
                    <h3
                      style={{
                        fontSize: "1.25em",
                        fontWeight: "bold",
                        margin: "0.8em 0 0.4em",
                        color: "var(--ws-color-text)",
                      }}
                      id={id}
                      {...props}
                    >
                      {props.children}
                    </h3>
                  );
                },
                h4: ({ node, ...props }) => {
                  const children = props.children || [];
                  const text = Array.isArray(children)
                    ? children.join("")
                    : children.toString();
                  const id = textToId(text);
                  return (
                    <h4
                      style={{
                        fontSize: "1.1em",
                        fontWeight: "bold",
                        margin: "0.7em 0 0.3em",
                        color: "var(--ws-color-text-secondary)",
                      }}
                      id={id}
                      {...props}
                    >
                      {props.children}
                    </h4>
                  );
                },
                p: ({ node, ...props }) => (
                  <p
                    style={{
                      margin: "1em 0",
                      lineHeight: 1.8,
                      color: "var(--ws-color-text)",
                    }}
                    {...props}
                  />
                ),
                ul: ({ node, ...props }) => (
                  <ul
                    style={{
                      margin: "1em 0",
                      paddingLeft: "2em",
                    }}
                    {...props}
                  />
                ),
                ol: ({ node, ...props }) => (
                  <ol
                    style={{
                      margin: "1em 0",
                      paddingLeft: "2em",
                    }}
                    {...props}
                  />
                ),
                li: ({ node, ...props }) => (
                  <li
                    style={{
                      margin: "0.5em 0",
                      lineHeight: 1.6,
                    }}
                    {...props}
                  />
                ),
                blockquote: ({ node, ...props }) => (
                  <blockquote
                    style={{
                      borderLeft: "4px solid var(--ws-color-info)",
                      margin: "1.2em 0",
                      padding: "0.8em 1.2em",
                      backgroundColor: "var(--ws-color-info-soft)",
                      color: "var(--ws-color-text-secondary)",
                      borderRadius: "0 8px 8px 0",
                      fontStyle: "italic",
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
                          padding: "16px",
                          borderRadius: "8px",
                          overflow: "auto",
                          margin: "1.2em 0",
                          fontFamily:
                            "'Consolas', 'Monaco', 'Courier New', monospace",
                          fontSize: "0.95em",
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
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontFamily:
                          "'Consolas', 'Monaco', 'Courier New', monospace",
                        fontSize: "0.95em",
                        border: "1px solid var(--ws-color-border)",
                        color: "#c41d7f",
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
                      borderRadius: "8px",
                      margin: "1.2em 0",
                    }}
                    alt={(props as any).alt ?? ""}
                    {...props}
                  />
                ),
              }}
            >
              {article.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div
              style={{ fontSize: 48, color: "var(--ws-color-text-secondary)", marginBottom: 24 }}
            >
              📝
            </div>
            <Title
              level={3}
              style={{ color: "var(--ws-color-text-secondary)", marginBottom: 16 }}
            >
              文章内容正在建设中
            </Title>
            <Paragraph
              style={{
                maxWidth: 500,
                margin: "0 auto",
                color: "var(--ws-color-text-secondary)",
              }}
            >
              这篇文章的详细内容正在编写中，敬请期待。
            </Paragraph>
          </div>
        )}
      </div>

      <Divider />

      {/* 文章底部信息 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 16,
        }}
      >
        <Text type="secondary">
          最后更新：{dayjs(article.updated_at).format("YYYY-MM-DD HH:mm")}
        </Text>
      </div>
    </div>
  );

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

      <SplitPanePage
        leftWidth={280}
        left={
          <PanelCard
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BookOutlined />
                <span>文章目录</span>
              </div>
            }
            bodyPadding={0}
          >
            <div className="article-toc-list" style={{ border: "none" }}>
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
                      style={{ fontSize: 14 }}
                    >
                      {item.text}
                    </Text>
                  </div>
                ))
              ) : (
                <div style={{ padding: 16, textAlign: "center" }}>
                  <Text type="secondary">暂无目录</Text>
                </div>
              )}
            </div>
          </PanelCard>
        }
        right={
          <PanelCard bodyPadding={32}>
            {renderContent()}
          </PanelCard>
        }
      />
    </div>
  );
};

export default ArticleDetailPage;
