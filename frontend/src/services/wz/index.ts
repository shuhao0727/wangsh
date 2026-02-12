/**
 * 文章管理相关 API 服务的统一导出
 */

// 首先导入所有模块
import articleApi, * as articlesModule from "./articles";
import categoryApi, * as categoriesModule from "./categories";

// 重新导出文章相关接口和服务
export * from "./articles";
export { default as articleApi } from "./articles";
export type {
  Article,
  ArticleWithRelations,
  ArticleListResponse,
  CreateArticleRequest,
  UpdateArticleRequest,
  ArticleFilterParams,
  PublicArticleFilterParams,
} from "./articles";

// 重新导出分类相关接口和服务
export * from "./categories";
export { default as categoryApi } from "./categories";
export type {
  Category,
  CategoryResponse,
  CategoryWithUsage,
  CategoryListResponse,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CategoryFilterParams,
  CategorySearchParams,
  PopularCategoriesParams,
  CategoryStats,
  CategoryArticlesResponse,
  GetOrCreateCategoryParams,
} from "./categories";

/**
 * 统一API服务对象
 * 提供对所有文章相关API的便捷访问
 */
export const wzApi = {
  articles: articleApi,
  categories: categoryApi,
};

export default wzApi;
