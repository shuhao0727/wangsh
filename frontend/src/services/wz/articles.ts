/**
 * 文章管理 API 服务
 * 封装文章相关的所有 API 调用
 */

import { api } from "../api";

export interface MarkdownStyle {
  key: string;
  title: string;
  sort_order: number;
  content: string;
  created_at: string;
  updated_at: string;
}

// 文章基础接口
export interface Article {
  id: number;
  title: string;
  slug: string;
  content: string;
  summary: string;
  custom_css?: string | null;
  style_key?: string | null;
  style?: MarkdownStyle | null;
  published: boolean;
  author_id: number;
  category_id: number | null;
  created_at: string;
  updated_at: string;
  // 可选字段 - 实际数据库中可能没有这些字段
  cover_image?: string | null;
  published_at?: string | null; // 注意：数据库中可能没有这个字段
  view_count?: number;
  like_count?: number;
  comment_count?: number;
}

// 带关联关系的文章接口（根据后端实际返回的字段）
export interface ArticleWithRelations extends Article {
  author: {
    id: number;
    username: string;
    full_name: string | null;
  };
  category: {
    id: number;
    name: string;
    slug: string;
  } | null;
}

// 文章列表响应
export interface ArticleListResponse {
  total: number;
  articles: ArticleWithRelations[];
  page: number;
  size: number;
  total_pages: number;
}

// 创建文章请求
export interface CreateArticleRequest {
  title: string;
  slug: string;
  content: string;
  summary: string;
  cover_image?: string;
  published?: boolean;
  author_id: number;
  category_id?: number | null;
  custom_css?: string | null;
  style_key?: string | null;
}

// 更新文章请求
export interface UpdateArticleRequest {
  title?: string;
  slug?: string;
  content?: string;
  summary?: string;
  cover_image?: string | null;
  published?: boolean;
  category_id?: number | null;
  custom_css?: string | null;
  style_key?: string | null;
}

// 文章筛选参数
export interface ArticleFilterParams {
  page?: number;
  size?: number;
  published_only?: boolean;
  category_id?: number;
  author_id?: number;
  include_relations?: boolean;
}

// 公开文章筛选参数
export interface PublicArticleFilterParams {
  page?: number;
  size?: number;
  category_id?: number;
}

/**
 * 文章管理 API 服务
 */
export const articleApi = {
  /**
   * 获取文章列表（需要管理员权限）
   */
  listArticles: (params: ArticleFilterParams = {}) => {
    const {
      page = 1,
      size = 20,
      published_only = true,
      category_id,
      author_id,
      include_relations = false,
    } = params;

    // 注意：后端直接返回数据，没有ApiResponse包装
    // 使用client.get避免ApiResponse包装期望
    return api.client.get<ArticleListResponse>("/articles", {
      params: {
        page,
        size,
        published_only,
        category_id,
        author_id,
        include_relations,
      },
    });
  },

  /**
   * 获取文章详情
   */
  getArticle: (articleId: number, includeRelations: boolean = true) => {
    // 后端直接返回数据，没有ApiResponse包装
    // 使用client.get避免ApiResponse包装期望
    return api.client.get<ArticleWithRelations>(`/articles/${articleId}`, {
      params: { include_relations: includeRelations },
    });
  },

  /**
   * 根据slug获取文章详情
   */
  getArticleBySlug: (slug: string, includeRelations: boolean = true) => {
    // 后端直接返回数据，没有ApiResponse包装
    // 使用client.get避免ApiResponse包装期望
    return api.client.get<ArticleWithRelations>(`/articles/slug/${slug}`, {
      params: { include_relations: includeRelations },
    });
  },

  /**
   * 创建文章（需要管理员权限）
   */
  createArticle: (articleData: CreateArticleRequest) => {
    // 后端直接返回数据，没有ApiResponse包装
    // 使用client.post避免ApiResponse包装期望
    return api.client.post<Article>("/articles", articleData);
  },

  /**
   * 更新文章（需要管理员权限）
   */
  updateArticle: (articleId: number, articleData: UpdateArticleRequest) => {
    // 后端直接返回数据，没有ApiResponse包装
    // 使用client.put避免ApiResponse包装期望
    return api.client.put<Article>(`/articles/${articleId}`, articleData);
  },

  /**
   * 删除文章（需要管理员权限）
   */
  deleteArticle: (articleId: number) => {
    // 后端直接返回数据，没有ApiResponse包装
    // 使用client.delete避免ApiResponse包装期望
    return api.client.delete(`/articles/${articleId}`);
  },

  /**
   * 发布或取消发布文章（需要管理员权限）
   */
  togglePublishStatus: (articleId: number, published: boolean = true) => {
    // 后端直接返回数据，没有ApiResponse包装
    // 使用client.post避免ApiResponse包装期望
    return api.client.post<Article>(`/articles/${articleId}/publish`, null, {
      params: { published },
    });
  },

  /**
   * 获取文章的所有标签
   */
  getArticleTags: (articleId: number) => {
    // 后端直接返回数据，没有ApiResponse包装
    // 使用client.get避免ApiResponse包装期望
    return api.client.get<
      Array<{ id: number; name: string; description: string | null }>
    >(`/articles/${articleId}/tags`);
  },

  /**
   * 获取公开文章列表（无需认证）
   */
  listPublicArticles: (params: PublicArticleFilterParams = {}) => {
    const { page = 1, size = 20, category_id } = params;

    // 后端直接返回数据，没有ApiResponse包装
    // 使用client.get避免ApiResponse包装期望
    return api.client.get<ArticleListResponse>("/articles/public/list", {
      params: {
        page,
        size,
        category_id,
      },
    });
  },

  /**
   * 根据slug获取公开文章详情（无需认证）
   */
  getPublicArticleBySlug: (slug: string) => {
    // 后端直接返回数据，没有ApiResponse包装
    // 使用client.get避免ApiResponse包装期望
    return api.client.get<ArticleWithRelations>(`/articles/public/${slug}`);
  },

  /**
   * 搜索文章
   */
  searchArticles: (query: string, page: number = 1, size: number = 20) => {
    // 后端直接返回数据，没有ApiResponse包装
    // 使用client.get避免ApiResponse包装期望
    return api.client.get<ArticleListResponse>("/articles/search", {
      params: {
        q: query,
        page,
        size,
      },
    });
  },
};

export default articleApi;
