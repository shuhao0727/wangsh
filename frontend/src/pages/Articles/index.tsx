import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCcw, Search, ChevronLeft, ChevronRight, ListFilter } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { articleApi, categoryApi } from "@services";
import { logger } from "@services/logger";
import { subscribeArticleUpdated } from "@utils/articleUpdatedEvent";
import { useDebounce } from "@hooks/useDebounce";
import { calculatePagination } from "@utils/pagination";
import type {
  ArticleWithRelations,
  CategoryWithUsage,
} from "@services";
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
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [articles, setArticles] = useState<ArticleWithRelations[]>([]);
  const [categories, setCategories] = useState<CategoryWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const pageParam = Number(searchParams.get("page"));
  const currentPage = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const sizeParam = Number(searchParams.get("size"));
  const pageSize = PAGE_SIZE_OPTIONS.includes(sizeParam) ? sizeParam : 12;
  const categoryParam = Number(searchParams.get("category"));
  const selectedCategory = Number.isSafeInteger(categoryParam) && categoryParam > 0
    ? categoryParam : null;
  const urlKeyword = searchParams.get("q") || "";
  const [searchKeyword, setSearchKeyword] = useState(urlKeyword);
  const [previousLocationKey, setPreviousLocationKey] = useState(location.key);
  const pendingSearchRef = useRef(false);
  const ownNavigationRef = useRef<string | null>(null);
  // Keep keystrokes synchronous; URL navigation can commit after the next input event.
  // Restore external navigation before effects can submit an obsolete input draft.
  if (previousLocationKey !== location.key) {
    setPreviousLocationKey(location.key);
    if (ownNavigationRef.current !== searchParams.toString()) {
      pendingSearchRef.current = false;
      setSearchKeyword(urlKeyword);
    }
    ownNavigationRef.current = null;
  }
  const debouncedKeyword = useDebounce(searchKeyword, 500);

  useEffect(() => {
    if (!pendingSearchRef.current || debouncedKeyword !== searchKeyword || searchKeyword === urlKeyword) return;
    pendingSearchRef.current = false;
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (searchKeyword) next.set("q", searchKeyword);
      else next.delete("q");
      next.set("page", "1");
      ownNavigationRef.current = next.toString();
      return next;
    });
  }, [debouncedKeyword, searchKeyword, urlKeyword, setSearchParams]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshTimerRef = useRef<number | null>(null);
  const lastRefreshAtRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

    void fetchCategories();

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
          setError(null);
        }

        abortController = new AbortController();

        let response;
        if (urlKeyword.trim()) {
          response = await articleApi.searchArticles(
            urlKeyword.trim(),
            currentPage,
            pageSize,
            selectedCategory || undefined,
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
          setError(error?.response?.data?.detail || "文章列表加载失败，请稍后重试");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchArticles();

    return () => {
      isMounted = false;
      if (abortController) {
        abortController.abort();
      }
    };
  }, [currentPage, pageSize, selectedCategory, refreshKey, urlKeyword]);

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
    size?: number;
    q?: string;
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

    if (updates.size !== undefined) {
      newParams.set("size", updates.size.toString());
    }
    if (updates.q !== undefined) {
      if (updates.q) newParams.set("q", updates.q);
      else newParams.delete("q");
      setSearchKeyword(updates.q);
    }

    if (updates.sort !== undefined) {
      newParams.set("sort", updates.sort);
    }

    pendingSearchRef.current = false;
    ownNavigationRef.current = newParams.toString();
    setSearchParams(newParams);
  };

  const handlePageChange = (page: number, nextPageSize?: number) => {
    updateUrlParams({ page: searchKeyword === urlKeyword ? page : 1, size: nextPageSize ?? pageSize, q: searchKeyword });
  };

  const handlePageButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    page: number,
  ) => {
    if (event.nativeEvent.isTrusted) {
      event.preventDefault();
      event.stopPropagation();
      window.setTimeout(() => handlePageChange(page), 0);
      return;
    }
    handlePageChange(page);
  };

  const handleCategorySelect = (categoryId: number | null) => {
    updateUrlParams({ category: categoryId, q: searchKeyword, page: 1 });
  };

  const handleCategoryFocus = useCallback(
    (event: React.FocusEvent<HTMLButtonElement>) => {
      if (!window.matchMedia("(max-width: 768px)").matches) return;
      event.currentTarget.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    },
    [],
  );

  const navigateToArticle = useCallback(
    (slug: string) => {
      void navigate(`/articles/${slug}`);
    },
    [navigate],
  );

  const handleSearch = () => updateUrlParams({ q: searchKeyword, page: 1 });

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    pendingSearchRef.current = true;
    setSearchKeyword(e.target.value);
  };

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
  const { totalPages } = calculatePagination({ page: currentPage, pageSize, total });

  return (
    <div className="articles-page">
      <PanelCard bodyPadding="var(--ws-panel-padding-sm)" className="articles-panel-card">
        <div className="articles-content-body">
          <aside className="articles-toolbar" aria-label="文章筛选">
            <div className="articles-search-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <Input
                  ref={searchInputRef}
                  className="articles-search-input pl-[var(--ws-search-input-padding-start)]"
                  aria-label="搜索文章"
                  placeholder="搜索文章..."
                  value={searchKeyword}
                  onChange={handleSearchInputChange}
                  onKeyDown={handleSearchKeyDown}
                  clearable
                  onClear={() => {
                    updateUrlParams({ q: "", page: 1 });
                  }}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 disabled:bg-transparent"
                aria-label="清除搜索和分类"
                title="清除搜索和分类"
                onClick={() => {
                  updateUrlParams({ q: "", category: null, page: 1 });
                  searchInputRef.current?.focus();
                }}
                disabled={!selectedCategory && !searchKeyword.trim()}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            <div className="articles-category-toolbar" aria-label="文章分类">
              <div className="articles-category-label">
                <ListFilter className="h-4 w-4" />
                分类
              </div>
              <div className="articles-category-list" role="group" aria-label="选择文章分类">
                <button
                  type="button"
                  className={`articles-category-item ${!selectedCategory ? "articles-category-item-active" : ""}`}
                  aria-pressed={!selectedCategory}
                  onFocus={handleCategoryFocus}
                  onClick={() => handleCategorySelect(null)}
                >
                  全部文章
                </button>
                {categoriesLoading ? (
                  <div className="articles-category-loading" aria-label="分类加载中">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-20 rounded-md" />
                    ))}
                  </div>
                ) : categories.map((category) => {
                  const active = selectedCategory === category.id;
                  return (
                    <button
                      type="button"
                      key={category.id}
                      className={`articles-category-item ${active ? "articles-category-item-active" : ""}`}
                      aria-pressed={active}
                      onFocus={handleCategoryFocus}
                      onClick={() => handleCategorySelect(category.id)}
                    >
                      <span className="truncate">{category.name}</span>
                      <span className="text-xs text-text-secondary">({category.article_count || 0})</span>
                    </button>
                  );
                })}
                {!categoriesLoading && categories.length === 0 ? (
                  <span className="articles-category-empty">暂无分类</span>
                ) : null}
              </div>
            </div>
          </aside>

          <section className="articles-results" aria-label="文章列表">
            <div className="articles-list-region">
              <div className="articles-right-scroll">
                {loading ? (
                  <div className="loading-container animate-in fade-in-0 duration-200 space-y-[var(--ws-space-2)] p-[var(--ws-space-3)]">
                    <div className="space-y-[var(--ws-space-1)] border-b border-[var(--ws-color-border-subtle)] p-[var(--ws-space-2)]">
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="h-4 w-11/12" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                    <div className="space-y-[var(--ws-space-1)] p-[var(--ws-space-2)]">
                      <Skeleton className="h-5 w-2/5" />
                      <Skeleton className="h-4 w-10/12" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                ) : error ? (
                  <div className="p-[var(--ws-space-3)]">
                    <Alert variant="destructive">
                      <AlertTitle>文章列表加载失败</AlertTitle>
                      <AlertDescription className="mt-2 flex flex-wrap items-center justify-between gap-3">
                        <span>{error}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={requestRefresh}
                        >
                          <RotateCcw className="h-4 w-4" />
                          重试
                        </Button>
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : displayedArticles.length === 0 ? (
                  <div className="empty-container animate-in fade-in-0 duration-200">
                    <EmptyState
                      variant={urlKeyword.trim() ? "no-results" : "no-data"}
                      description={
                        urlKeyword.trim()
                          ? "未找到匹配的文章"
                          : selectedCategory
                            ? "该分类下暂无文章"
                            : "暂无文章"
                      }
                      action={
                        (selectedCategory || urlKeyword.trim()) && (
                          <Button
                            onClick={() => {
                              updateUrlParams({ q: "", category: null, page: 1 });
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
            </div>

            {!searchKeyword.trim() && total > 0 ? (
              <div className="articles-pagination-bar">
                <div className="flex flex-wrap items-center justify-end gap-[var(--ws-space-1)] text-sm text-text-secondary">
                  <span>共 {total} 条</span>
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageChange(1, Number(e.target.value))}
                    aria-label="每页条数"
                    className="h-8 rounded-md border border-[var(--ws-color-border-subtle)] bg-surface px-xs text-sm"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size} / 页</option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="上一页"
                    onClick={(event) => handlePageButtonClick(event, Math.max(1, currentPage - 1))}
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
                    aria-label="下一页"
                    onClick={(event) => handlePageButtonClick(event, Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </PanelCard>
    </div>
  );
};

export default ArticlesPage;
