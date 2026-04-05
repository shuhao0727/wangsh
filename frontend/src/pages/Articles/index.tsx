import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCcw, Search, ChevronLeft, ChevronRight, ListFilter } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { articleApi, categoryApi } from "@services";
import { logger } from "@services/logger";
import { subscribeArticleUpdated } from "@utils/articleUpdatedEvent";
import { useDebounce } from "@hooks/useDebounce";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import type {
  ArticleWithRelations,
  CategoryWithUsage,
} from "@services";
import SplitPanePage from "@components/Layout/SplitPanePage";
import PanelCard from "@components/Layout/PanelCard";
import EmptyState from "@components/Common/EmptyState";
import ArticleItem from "./components/ArticleItem";
import "./Articles.css";

const PAGE_SIZE_OPTIONS = [12, 24, 48];

const isValidationError = (obj: any): boolean => {
  if (!obj || typeof obj !== "object") return false;

  const validationErrorKeys = ["type", "loc", "msg", "input", "ctx"];
  const hasValidationErrorKeys = validationErrorKeys.some((key) => key in obj);

  const looksLikeValidationError =
    hasValidationErrorKeys ||
    (obj.detail &&
      Array.isArray(obj.detail) &&
      obj.detail.length > 0 &&
      obj.detail[0].msg) ||
    (obj.error && typeof obj.error === "string") ||
    (obj.message && typeof obj.message === "string" && obj.status_code);

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

  if (looksLikeValidationError && !hasNormalDataKeys) {
    return true;
  }

  return looksLikeValidationError;
};

const cleanAndValidateDataArray = <T,>(
  data: any,
  expectedKeys: string[] = [],
): T[] => {
  if (!data) return [];

  if (isValidationError(data)) {
    logger.warn("检测到验证错误对象，返回空数组:", data);
    return [];
  }

  let array: any[] = [];
  if (Array.isArray(data)) {
    array = data;
  } else if (data && typeof data === "object") {
    if (Array.isArray(data.categories)) array = data.categories;
    else if (Array.isArray(data.articles)) array = data.articles;
    else if (Array.isArray(data.items)) array = data.items;
    else if (Array.isArray(data.data)) array = data.data;
    else if (Array.isArray(data.list)) array = data.list;
  }

  const cleanedArray = array.filter((item) => {
    if (!item || typeof item !== "object") return false;
    if (isValidationError(item)) return false;

    if (expectedKeys.length > 0) {
      return expectedKeys.some((key) => key in item);
    }

    return true;
  });

  return cleanedArray as T[];
};

const ArticlesPage: React.FC = () => {
  const screens = useBreakpoint();
  const isCompactViewport = !screens.sm;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [articles, setArticles] = useState<ArticleWithRelations[]>([]);
  const [categories, setCategories] = useState<CategoryWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const debouncedKeyword = useDebounce(searchKeyword, 500);
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

  useEffect(() => {
    const page = parseInt(searchParams.get("page") || "1", 10);
    const category = searchParams.get("category");

    setCurrentPage(page);
    if (category) {
      setSelectedCategory(parseInt(category, 10));
    }
  }, [searchParams]);

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

        if (!isMounted) return;

        const categoriesData = cleanAndValidateDataArray<CategoryWithUsage>(
          response.data,
          ["id", "name"],
        );

        const mappedCategories = categoriesData.map((category) => ({
          id: category.id || 0,
          name: category.name || "未知分类",
          slug: category.slug || "",
          description: category.description || null,
          created_at: category.created_at || new Date().toISOString(),
          updated_at: category.updated_at || new Date().toISOString(),
          article_count: category.article_count || 0,
        }));

        if (isMounted) {
          setCategories(mappedCategories);
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

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let abortController: AbortController | null = null;

    const fetchArticles = async () => {
      try {
        if (isMounted) {
          setLoading(true);
        }

        abortController = new AbortController();

        let response;
        if (debouncedKeyword.trim()) {
          response = await articleApi.searchArticles(
            debouncedKeyword.trim(),
            currentPage,
            pageSize,
          );
        } else {
          response = await articleApi.listPublicArticles({
            page: currentPage,
            size: pageSize,
            category_id: selectedCategory || undefined,
          });
        }

        if (!isMounted) return;

        const articlesData = cleanAndValidateDataArray<ArticleWithRelations>(
          response.data,
          ["id", "title", "slug"],
        );

        let totalCount = 0;
        if (response.data && typeof response.data === "object") {
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

        if (totalCount === 0) {
          totalCount = articlesData.length;
        }

        if (isMounted) {
          setArticles(articlesData);
          setTotal(totalCount);
        }
      } catch (error: any) {
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

    fetchArticles();

    return () => {
      isMounted = false;
      if (abortController) {
        abortController.abort();
      }
    };
  }, [currentPage, pageSize, selectedCategory, refreshKey, debouncedKeyword]);

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

  const handlePageChange = (page: number, nextPageSize?: number) => {
    setCurrentPage(page);
    if (nextPageSize && nextPageSize !== pageSize) {
      setPageSize(nextPageSize);
    }
    updateUrlParams({ page });
  };

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

  const navigateToArticle = useCallback(
    (slug: string) => {
      navigate(`/articles/${slug}`);
    },
    [navigate],
  );

  const handleSearch = useCallback(() => {
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    if (debouncedKeyword) setCurrentPage(1);
  }, [debouncedKeyword]);

  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchKeyword(e.target.value);
    },
    [],
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSearch();
      }
    },
    [handleSearch],
  );

  const safeArticles = useMemo(() => {
    return articles.filter((article) => {
      if (!article || typeof article !== "object") return false;
      if (isValidationError(article)) return false;
      return Boolean(article.id && article.title && article.slug);
    });
  }, [articles]);

  const displayedArticles = safeArticles;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="articles-page">
      <div className="articles-split-pane">
        <SplitPanePage
          leftWidth={isCompactViewport ? 280 : 320}
          alignItems="stretch"
          left={
            <div className="articles-left-sticky">
              <PanelCard bodyPadding="var(--ws-panel-padding-sm)">
                <div className="articles-left">
                  <div className="articles-left-search">
                    <div className="relative flex-1 min-w-0">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                      <Input
                        className="pl-[var(--ws-search-input-padding-start)]"
                        placeholder="搜索文章..."
                        value={searchKeyword}
                        onChange={handleSearchInputChange}
                        onKeyDown={handleSearchKeyDown}
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchKeyword("");
                        handleCategorySelect(null);
                      }}
                      disabled={!selectedCategory && !searchKeyword.trim()}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="articles-left-menu rounded-lg border border-[var(--ws-color-border-secondary)] bg-surface p-[var(--ws-space-1)]">
                    <button
                      type="button"
                      className={`appearance-none border-0 articles-category-item ${!selectedCategory ? "articles-category-item-active" : ""}`}
                      onClick={() => handleCategorySelect(null)}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <ListFilter className="h-4 w-4" />
                        全部文章
                      </span>
                    </button>

                    {categoriesLoading ? (
                      <div className="space-y-[var(--ws-space-1)] p-[var(--ws-space-1)]">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <Skeleton key={i} className="h-8 w-full rounded-md" />
                        ))}
                      </div>
                    ) : null}

                    {!categoriesLoading
                      ? categories.map((category) => {
                          const active = selectedCategory === category.id;
                          return (
                            <button
                              type="button"
                              key={category.id}
                              className={`appearance-none border-0 articles-category-item ${active ? "articles-category-item-active" : ""}`}
                              onClick={() => handleCategorySelect(category.id)}
                            >
                              <span className="truncate">{category.name}</span>
                              <span className="text-sm text-text-tertiary">({category.article_count || 0})</span>
                            </button>
                          );
                        })
                      : null}

                    {!categoriesLoading && categories.length === 0 ? (
                      <div className="px-3 py-6 text-center text-sm text-text-tertiary">暂无分类</div>
                    ) : null}
                  </div>
                </div>
              </PanelCard>
            </div>
          }
          right={
            <div className="articles-right-shell">
              <PanelCard bodyPadding="var(--ws-panel-padding-sm)">
                <div className="articles-right-body">
                  <div className="articles-right-scroll">
                    {loading ? (
                      <div className="loading-container animate-in fade-in-0 duration-200 space-y-[var(--ws-space-2)] p-[var(--ws-space-3)]">
                        <div className="space-y-[var(--ws-space-1)] rounded-lg border border-[var(--ws-color-border-secondary)] p-[var(--ws-space-2)]">
                          <Skeleton className="h-5 w-1/2" />
                          <Skeleton className="h-4 w-11/12" />
                          <Skeleton className="h-4 w-2/3" />
                        </div>
                        <div className="space-y-[var(--ws-space-1)] rounded-lg border border-[var(--ws-color-border-secondary)] p-[var(--ws-space-2)]">
                          <Skeleton className="h-5 w-2/5" />
                          <Skeleton className="h-4 w-10/12" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      </div>
                    ) : displayedArticles.length === 0 ? (
                      <div className="empty-container animate-in fade-in-0 duration-200">
                        <EmptyState
                          variant={debouncedKeyword.trim() ? "no-results" : "no-data"}
                          description={
                            debouncedKeyword.trim()
                              ? "未找到匹配的文章"
                              : selectedCategory
                                ? "该分类下暂无文章"
                                : "暂无文章"
                          }
                          action={
                            (selectedCategory || debouncedKeyword.trim()) && (
                              <Button
                                onClick={() => {
                                  setSearchKeyword("");
                                  handleCategorySelect(null);
                                }}
                              >
                                清除筛选
                              </Button>
                            )
                          }
                        />
                      </div>
                    ) : (
                      <div>
                        {displayedArticles.map((article) => (
                          <ArticleItem
                            key={article.id}
                            article={article}
                            onClick={navigateToArticle}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {!searchKeyword.trim() && total > 0 ? (
                    <div className="articles-pagination-bar">
                      <div className="flex flex-wrap items-center justify-end gap-[var(--ws-space-1)] text-sm text-text-secondary">
                        <span>共 {total} 条</span>
                        <select
                          value={pageSize}
                          onChange={(e) => handlePageChange(1, Number(e.target.value))}
                          aria-label="每页条数"
                          className="h-8 rounded-md border border-[var(--ws-color-border)] bg-surface px-2 text-sm"
                        >
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>{size} / 页</option>
                          ))}
                        </select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                          disabled={currentPage <= 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-center text-sm text-text-base tabular-nums">
                          {currentPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage >= totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </PanelCard>
            </div>
          }
        />
      </div>
    </div>
  );
};

export default ArticlesPage;
