/**
 * 分类管理 API 服务
 * 封装分类相关的所有 API 调用
 */

import { api } from "../api";

// 分类基础接口
export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// 分类响应接口
export interface CategoryResponse extends Category {}

// 包含使用次数的分类接口
export interface CategoryWithUsage extends Category {
  article_count: number;
}

// 分类列表响应
export interface CategoryListResponse {
  total: number;
  categories: CategoryResponse[] | CategoryWithUsage[];
  page: number;
  size: number;
  total_pages: number;
}

// 创建分类请求
export interface CreateCategoryRequest {
  name: string;
  slug: string;
  description?: string | null;
}

// 更新分类请求
export interface UpdateCategoryRequest {
  name?: string;
  slug?: string;
  description?: string | null;
}

// 分类筛选参数
export interface CategoryFilterParams {
  page?: number;
  size?: number;
  include_usage_count?: boolean;
}

export interface PublicCategoryFilterParams {
  page?: number;
  size?: number;
  include_usage_count?: boolean;
}

// 分类搜索参数
export interface CategorySearchParams {
  keyword: string;
  limit?: number;
}

// 热门分类参数
export interface PopularCategoriesParams {
  limit?: number;
}

// 分类统计信息
export interface CategoryStats {
  total_articles: number;
  published_articles: number;
  draft_articles: number;
  average_views_per_article: number;
  latest_article_date: string | null;
}

// 分类文章列表响应
export interface CategoryArticlesResponse {
  category: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
  };
  total: number;
  articles: any[]; // 可以根据实际需求定义更具体的类型
  page: number;
  size: number;
  total_pages: number;
}

// 获取或创建分类参数
export interface GetOrCreateCategoryParams {
  name: string;
  slug?: string;
  description?: string;
}

/**
 * 分类管理 API 服务
 */
export const categoryApi = {
  /**
   * 获取分类列表
   * 权限：任何登录用户
   */
  listCategories: (params: CategoryFilterParams = {}) => {
    const { page = 1, size = 20, include_usage_count = false } = params;

    // 注意：后端直接返回数据，没有ApiResponse包装
    return api.client.get<CategoryListResponse>("/categories", {
      params: {
        page,
        size,
        include_usage_count,
      },
    });
  },

  /**
   * 获取公开分类列表（无需认证）
   */
  listPublicCategories: (params: PublicCategoryFilterParams = {}) => {
    const { page = 1, size = 50, include_usage_count = true } = params;
    return api.client.get<CategoryListResponse>("/categories/public/list", {
      params: {
        page,
        size,
        include_usage_count,
      },
    });
  },

  /**
   * 创建分类
   * 权限：超级管理员
   */
  createCategory: (categoryData: CreateCategoryRequest) => {
    return api.post<CategoryResponse>("/categories", categoryData);
  },

  /**
   * 根据ID获取分类详情
   * 权限：任何登录用户
   */
  getCategory: (categoryId: number) => {
    return api.get<CategoryResponse>(`/categories/${categoryId}`);
  },

  /**
   * 根据slug获取分类详情
   * 权限：任何登录用户
   */
  getCategoryBySlug: (slug: string) => {
    return api.get<CategoryResponse>(`/categories/slug/${slug}`);
  },

  /**
   * 更新分类
   * 权限：超级管理员
   */
  updateCategory: (categoryId: number, categoryData: UpdateCategoryRequest) => {
    return api.put<CategoryResponse>(`/categories/${categoryId}`, categoryData);
  },

  /**
   * 删除分类
   * 权限：超级管理员
   */
  deleteCategory: (categoryId: number) => {
    return api.delete(`/categories/${categoryId}`);
  },

  /**
   * 搜索分类（按名称或slug模糊匹配）
   * 权限：任何登录用户
   */
  searchCategories: (params: CategorySearchParams) => {
    const { keyword, limit = 20 } = params;
    return api.get<CategoryResponse[]>("/categories/search", {
      params: {
        keyword,
        limit,
      },
    });
  },

  /**
   * 获取热门分类（按文章数量排序）
   * 权限：任何登录用户
   */
  getPopularCategories: (params: PopularCategoriesParams = {}) => {
    const { limit = 10 } = params;
    return api.get<
      Array<{
        id: number;
        name: string;
        slug: string;
        description: string | null;
        article_count: number;
      }>
    >("/categories/popular", {
      params: { limit },
    });
  },

  /**
   * 获取或创建分类
   * 如果分类不存在，则创建新分类；如果已存在，则返回现有分类
   * 权限：超级管理员
   */
  getOrCreateCategory: (params: GetOrCreateCategoryParams) => {
    const { name, slug, description } = params;
    return api.post<CategoryResponse>("/categories/get-or-create", null, {
      params: {
        name,
        slug,
        description,
      },
    });
  },

  /**
   * 获取分类统计信息
   * 权限：任何登录用户
   */
  getCategoryStats: (categoryId: number) => {
    return api.get<CategoryStats>(`/categories/${categoryId}/stats`);
  },

  /**
   * 获取属于该分类的文章列表
   * 权限：任何登录用户
   */
  getCategoryArticles: (
    categoryId: number,
    page: number = 1,
    size: number = 20,
    publishedOnly: boolean = true,
  ) => {
    return api.get<CategoryArticlesResponse>(
      `/categories/${categoryId}/articles`,
      {
        params: {
          page,
          size,
          published_only: publishedOnly,
        },
      },
    );
  },
};

export default categoryApi;
