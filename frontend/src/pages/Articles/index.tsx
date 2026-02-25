import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Typography, Card, Tag, Button, Empty, Spin, Pagination, Menu, Input } from "antd";
import {
  CalendarOutlined,
  FolderOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import { articleApi, categoryApi } from "@services";
import { logger } from "@services/logger";
import { subscribeArticleUpdated } from "@utils/articleUpdatedEvent";
import type {
  ArticleWithRelations,
  CategoryWithUsage,
} from "@services";
import SplitPanePage from "@components/Layout/SplitPanePage";
import PanelCard from "@components/Layout/PanelCard";
import "./Articles.css"; // 导入样式文件

const { Text, Title } = Typography;

// 工具函数：检测对象是否是验证错误对象 - 更严格的检查
const isValidationError = (obj: any): boolean => {
  if (!obj || typeof obj !== "object") return false;

  // 检查是否是验证错误对象（包含type、loc、msg等字段）
  // 错误消息中提到的键：{type, loc, msg, input, ctx}
  const validationErrorKeys = ["type", "loc", "msg", "input", "ctx"];
  const hasValidationErrorKeys = validationErrorKeys.some((key) => key in obj);

  // 检查对象是否看起来像验证错误（有错误消息结构）
  const looksLikeValidationError =
    hasValidationErrorKeys ||
    (obj.detail &&
      Array.isArray(obj.detail) &&
      obj.detail.length > 0 &&
      obj.detail[0].msg) ||
    (obj.error && typeof obj.error === "string") ||
    (obj.message && typeof obj.message === "string" && obj.status_code);

  // 特别检查：如果对象只有这些键，没有正常的数据键，就认为是验证错误
  const normalDataKeys = [
    "id",
    "name",
    "title",
    "slug",
    "content",
    "description",
    "created_at",
    "updated_at",
  ];
  const hasNormalDataKeys = normalDataKeys.some((key) => key in obj);

  // 如果是验证错误对象，且没有正常的数据键，就返回true
  if (looksLikeValidationError && !hasNormalDataKeys) {
    return true;
  }

  return looksLikeValidationError;
};

// 工具函数：清理和验证数据数组
const cleanAndValidateDataArray = <T,>(
  data: any,
  expectedKeys: string[] = [],
): T[] => {
  if (!data) return [];

  // 如果是验证错误对象，返回空数组
  if (isValidationError(data)) {
    logger.warn("检测到验证错误对象，返回空数组:", data);
    return [];
  }

  // 确保是数组
  let array: any[] = [];
  if (Array.isArray(data)) {
    array = data;
  } else if (data && typeof data === "object") {
    // 尝试从常见属性中提取数组
    if (Array.isArray(data.categories)) array = data.categories;
    else if (Array.isArray(data.articles)) array = data.articles;
    else if (Array.isArray(data.items)) array = data.items;
    else if (Array.isArray(data.data)) array = data.data;
    else if (Array.isArray(data.list)) array = data.list;
  }

  // 过滤掉无效对象和验证错误对象
  const cleanedArray = array.filter((item) => {
    if (!item || typeof item !== "object") return false;
    if (isValidationError(item)) return false;

    // 如果有预期键，检查对象是否包含这些键
    if (expectedKeys.length > 0) {
      return expectedKeys.some((key) => key in item);
    }

    return true;
  });

  return cleanedArray as T[];
};

const ArticlesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 状态管理
  const [articles, setArticles] = useState<ArticleWithRelations[]>([]);
  const [categories, setCategories] = useState<CategoryWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshTimerRef = useRef<number | null>(null);
  const lastRefreshAtRef = useRef(0);

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

  // 从URL参数初始化状态
  useEffect(() => {
    const page = parseInt(searchParams.get("page") || "1");
    const category = searchParams.get("category");

    setCurrentPage(page);
    if (category) setSelectedCategory(parseInt(category));
  }, [searchParams]);

  // 获取分类列表 - 使用工具函数清理数据
  useEffect(() => {
    let isMounted = true;

    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true);
        const response = await categoryApi.listPublicCategories({
          page: 1,
          size: 50,
          include_usage_count: true,
        });

        // 只有组件仍然挂载时才更新状态
        if (!isMounted) return;

        logger.debug("分类API原始响应:", response.data);

        const categoriesData = cleanAndValidateDataArray<CategoryWithUsage>(
          response.data,
          ["id", "name"],
        );

        logger.debug("清理后的分类数据:", categoriesData);

        // 格式化分类数据 - 确保符合CategoryWithUsage接口
        const categories = categoriesData.map((category) => ({
          id: category.id || 0,
          name: category.name || "未知分类",
          slug: category.slug || "",
          description: category.description || null,
          created_at: category.created_at || new Date().toISOString(),
          updated_at: category.updated_at || new Date().toISOString(),
          article_count: category.article_count || 0,
        }));

        if (isMounted) {
          setCategories(categories);
        }
      } catch (error) {
        logger.error("获取分类失败:", error);
        if (isMounted) {
          setCategories([]);
        }
      } finally {
        if (isMounted) {
          setCategoriesLoading(false);
        }
      }
    };

    fetchCategories();

    // 清理函数
    return () => {
      isMounted = false;
    };
  }, []);

  // 热门标签功能已移除，删除相关代码

  // 获取文章列表 - 完全重写，使用工具函数彻底清理数据
  useEffect(() => {
    let isMounted = true;
    let abortController: AbortController | null = null;

    const fetchArticles = async () => {
      try {
        if (isMounted) {
          setLoading(true);
        }

        // 创建AbortController来取消请求
        abortController = new AbortController();

        const response = await articleApi.listPublicArticles({
          page: currentPage,
          size: pageSize,
          category_id: selectedCategory || undefined,
        });

        // 只有组件仍然挂载时才更新状态
        if (!isMounted) return;

        logger.debug("文章API原始响应:", response.data);

        // 使用工具函数清理和验证文章数据
        const articlesData = cleanAndValidateDataArray<ArticleWithRelations>(
          response.data,
          ["id", "title", "slug"], // 文章对象应至少包含id、title、slug属性
        );

        logger.debug("清理后的文章数据:", articlesData);

        // 获取总数
        let totalCount = 0;
        if (response.data && typeof response.data === "object") {
          // 检查是否有total字段
          if (
            "total" in response.data &&
            typeof response.data.total === "number"
          ) {
            totalCount = response.data.total;
          } else if (
            "data" in response.data &&
            response.data.data &&
            typeof response.data.data === "object"
          ) {
            // 标准ApiResponse格式：检查data.total
            const data = response.data.data;
            if (
              data &&
              typeof data === "object" &&
              "total" in data &&
              typeof data.total === "number"
            ) {
              totalCount = data.total;
            }
          }
        }

        // 如果没有从响应中获取到总数，使用数组长度
        if (totalCount === 0) {
          totalCount = articlesData.length;
        }

        logger.debug("文章总数:", totalCount);

        if (isMounted) {
          setArticles(articlesData);
          setTotal(totalCount);
        }
      } catch (error: any) {
        // 忽略被取消的请求的错误
        if (error.name === "AbortError" || error.name === "CanceledError") {
          return;
        }
        logger.error("获取文章列表失败:", error);
        if (isMounted) {
          setArticles([]);
          setTotal(0);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // 防抖：避免快速连续触发
    const timeoutId = setTimeout(() => {
      fetchArticles();
    }, 100);

    // 清理函数
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      if (abortController) {
        abortController.abort();
      }
    };
  }, [currentPage, pageSize, selectedCategory, refreshKey]);

  useEffect(() => {
    const unsub = subscribeArticleUpdated(() => {
      requestRefresh();
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
  }, [requestRefresh]);

  // 更新URL参数
  const updateUrlParams = (updates: {
    page?: number;
    category?: number | null;
    sort?: string;
  }) => {
    const newParams = new URLSearchParams(searchParams);

    if (updates.page !== undefined) {
      newParams.set("page", updates.page.toString());
    }

    if (updates.category !== undefined) {
      if (updates.category === null) {
        newParams.delete("category");
      } else {
        newParams.set("category", updates.category.toString());
      }
    }

    if (updates.sort !== undefined) {
      newParams.set("sort", updates.sort);
    }

    setSearchParams(newParams);
  };

  // 处理分页变化
  const handlePageChange = (page: number, pageSize?: number) => {
    setCurrentPage(page);
    if (pageSize) setPageSize(pageSize);
    updateUrlParams({ page });
  };

  // 处理分类选择
  const handleCategorySelect = useCallback(
    (categoryId: number | null) => {
      setSelectedCategory(categoryId);
      setCurrentPage(1);
      const newParams = new URLSearchParams(searchParams);
      if (categoryId === null) {
        newParams.delete("category");
      } else {
        newParams.set("category", categoryId.toString());
      }
      newParams.set("page", "1");
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams],
  );

  // 跳转到文章详情
  const navigateToArticle = useCallback(
    (slug: string) => {
      navigate(`/articles/${slug}`);
    },
    [navigate],
  );

  // 处理搜索
  const handleSearch = useCallback(() => {
    setCurrentPage(1); // 搜索时重置到第一页
  }, []);

  // 处理搜索输入变化
  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchKeyword(e.target.value);
    },
    [],
  );

  // 处理搜索输入回车键
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSearch();
      }
    },
    [handleSearch],
  );

  // 修复React内存泄漏：确保所有useEffect都有正确的依赖项
  // 当前已经包含：categoriesLoading, selectedCategory, categoryMenuItems, handleCategorySelect

  // 使用useMemo缓存
  const categoryMenuItems = useMemo(() => {
    return [
      {
        key: "all",
        label: "全部文章",
      },
      {
        type: "divider" as const,
      },
      ...categories.map((category) => ({
        key: category.id.toString(),
        label: (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <span>{category.name}</span>
            <span style={{ color: "var(--ws-color-text-secondary)", fontSize: "0.85rem" }}>
              ({category.article_count || 0})
            </span>
          </div>
        ),
      })),
    ];
  }, [categories]);

  const safeArticles = useMemo(() => {
    return articles.filter((article) => {
      if (!article || typeof article !== "object") return false;
      if (isValidationError(article)) return false;
      return Boolean(article.id && article.title && article.slug);
    });
  }, [articles]);

  const displayedArticles = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    if (!q) return safeArticles;
    return safeArticles.filter((a) => {
      const title = (a.title || "").toLowerCase();
      const summary = (a.summary || "").toLowerCase();
      const author = (a.author?.username || "").toLowerCase();
      const category = (a.category?.name || "").toLowerCase();
      return (
        title.includes(q) ||
        summary.includes(q) ||
        author.includes(q) ||
        category.includes(q)
      );
    });
  }, [safeArticles, searchKeyword]);

  const selectedCategoryName = useMemo(() => {
    if (!selectedCategory) return "";
    return categories.find((c) => c.id === selectedCategory)?.name || "未知分类";
  }, [categories, selectedCategory]);

  // 文章卡片组件 - 条状布局版本（添加防御性编程）
  const renderArticleItem = (article: ArticleWithRelations) => {
    const articleId = article.id || "unknown";
    const articleSlug = article.slug || "";
    const articleTitle = article.title || "无标题";
    const articleDate = article.created_at
      ? dayjs(article.created_at).format("YYYY-MM-DD")
      : "未知日期";
    const articleSummary = article.summary || "暂无摘要";
    const categoryName = article.category?.name || "";
    const authorName = article.author?.username || "未知";

    return (
      <div
        key={articleId}
        onClick={() => articleSlug && navigateToArticle(articleSlug)}
        className="article-item-row"
      >
        <div className="article-card-title">{articleTitle}</div>
        <div className="article-card-meta">
            <Text type="secondary" style={{ fontSize: "0.8125rem" }}>
              <CalendarOutlined /> {articleDate}
            </Text>
            {categoryName && (
              <Tag color="blue" icon={<FolderOutlined />} style={{ fontSize: "0.8125rem", margin: 0 }}>
                {categoryName}
              </Tag>
            )}
            <Text type="secondary" style={{ fontSize: "0.8125rem" }}>
              作者：{authorName}
            </Text>
          </div>
          <div className="article-card-summary">{articleSummary}</div>
      </div>
    );
  };

  return (
    <div className="informatics-page">
      <SplitPanePage
        leftWidth={320}
        left={
          <PanelCard bodyPadding={12} title=" " extra={<span></span>}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <Input
                placeholder="搜索文章..."
                value={searchKeyword}
                onChange={handleSearchInputChange}
                onKeyDown={handleSearchKeyDown}
                onPressEnter={handleSearch}
                allowClear
                prefix={<SearchOutlined />}
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setSearchKeyword("");
                  handleCategorySelect(null);
                }}
                disabled={!selectedCategory && !searchKeyword.trim()}
              />
            </div>

            <div
              style={{
                maxHeight: "calc(100vh - 260px)",
                overflow: "auto",
                border: "none",
                borderRadius: "var(--ws-radius-md)",
              }}
            >
              {categoriesLoading ? (
                <div style={{ textAlign: "center", padding: 18 }}>
                  <Spin />
                </div>
              ) : null}
              <Menu
                mode="inline"
                className="category-menu"
                selectedKeys={selectedCategory ? [selectedCategory.toString()] : ["all"]}
                onClick={({ key }) => handleCategorySelect(key === "all" ? null : parseInt(key))}
                items={categoryMenuItems}
              />
              {categories.length === 0 && !categoriesLoading ? (
                <Empty description="暂无分类" style={{ marginTop: 12 }} />
              ) : null}
            </div>
          </PanelCard>
        }
        right={
          <PanelCard
            title={
              <Title level={4} style={{ margin: 0, fontSize: "18px", color: "#2c3e50" }}>
                {selectedCategory ? selectedCategoryName : "文章"}
              </Title>
            }
            extra={
              selectedCategory ? (
                <Button type="link" onClick={() => handleCategorySelect(null)}>
                  清除筛选
                </Button>
              ) : null
            }
            bodyPadding={12}
          >
            {loading ? (
              <div className="loading-container">
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>加载文章中...</div>
              </div>
            ) : displayedArticles.length === 0 ? (
              <div className="empty-container">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    searchKeyword.trim()
                      ? "未找到匹配的文章（当前页）"
                      : selectedCategory
                        ? "该分类下暂无文章"
                        : "暂无文章"
                  }
                >
                  {(selectedCategory || searchKeyword.trim()) && (
                    <Button
                      type="primary"
                      onClick={() => {
                        setSearchKeyword("");
                        handleCategorySelect(null);
                      }}
                    >
                      清除筛选
                    </Button>
                  )}
                </Empty>
              </div>
            ) : (
              <>
                <div>{displayedArticles.map(renderArticleItem)}</div>
                {total > pageSize && !searchKeyword.trim() && (
                  <div className="articles-pagination">
                    <Pagination
                      current={currentPage}
                      pageSize={pageSize}
                      total={total}
                      onChange={handlePageChange}
                      showSizeChanger
                      showQuickJumper
                      showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
                    />
                  </div>
                )}
              </>
            )}
          </PanelCard>
        }
      />
    </div>
  );
};

export default ArticlesPage;
