/**
 * 分页工具函数
 * 提供分页计算、验证和数据获取等通用功能
 */

/**
 * 分页参数
 */
export interface PaginationParams {
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页条目数 */
  pageSize: number;
  /** 总条目数 */
  total: number;
}

/**
 * 分页计算结果
 */
export interface PaginationResult {
  /** 当前页码 */
  currentPage: number;
  /** 每页条目数 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 总条目数 */
  total: number;
  /** 是否有上一页 */
  hasPrevious: boolean;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 当前页开始索引（从 0 开始） */
  startIndex: number;
  /** 当前页结束索引（不包含，从 0 开始） */
  endIndex: number;
  /** 数据库 skip 参数 */
  skip: number;
  /** 数据库 limit 参数 */
  limit: number;
}

/**
 * 计算分页信息
 * @param params 分页参数
 * @returns 分页计算结果
 */
export function calculatePagination(params: PaginationParams): PaginationResult {
  const { page, pageSize, total } = params;

  // 确保参数有效
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const safeTotal = Math.max(0, Math.floor(total));

  // 计算总页数
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));

  // 确保当前页在有效范围内
  const currentPage = Math.min(safePage, totalPages);

  // 计算索引
  const startIndex = (currentPage - 1) * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, safeTotal);

  return {
    currentPage,
    pageSize: safePageSize,
    totalPages,
    total: safeTotal,
    hasPrevious: currentPage > 1,
    hasNext: currentPage < totalPages,
    startIndex,
    endIndex,
    skip: startIndex,
    limit: safePageSize,
  };
}

/**
 * 验证页码是否有效
 * @param page 页码
 * @param totalPages 总页数
 * @returns 是否有效
 */
export function isValidPage(page: number, totalPages: number): boolean {
  return Number.isInteger(page) && page >= 1 && page <= totalPages;
}

/**
 * 生成页码数组（用于分页器显示）
 * @param currentPage 当前页
 * @param totalPages 总页数
 * @param maxVisible 最多显示页码数（默认 7）
 * @returns 页码数组，使用 null 表示省略号
 */
export function generatePageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible = 7
): (number | null)[] {
  if (totalPages <= maxVisible) {
    // 总页数少于最大显示数，显示所有页码
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | null)[] = [];
  const halfVisible = Math.floor((maxVisible - 3) / 2); // 减去首页、尾页和一个省略号

  // 始终显示首页
  pages.push(1);

  if (currentPage <= halfVisible + 2) {
    // 当前页靠近开头
    for (let i = 2; i <= maxVisible - 2; i++) {
      pages.push(i);
    }
    pages.push(null); // 省略号
    pages.push(totalPages);
  } else if (currentPage >= totalPages - halfVisible - 1) {
    // 当前页靠近末尾
    pages.push(null); // 省略号
    for (let i = totalPages - maxVisible + 3; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    // 当前页在中间
    pages.push(null); // 前省略号
    for (let i = currentPage - halfVisible; i <= currentPage + halfVisible; i++) {
      pages.push(i);
    }
    pages.push(null); // 后省略号
    pages.push(totalPages);
  }

  return pages;
}

/**
 * 分页 API 响应格式
 */
export interface PaginatedResponse<T> {
  /** 数据项 */
  items: T[];
  /** 总条目数 */
  total: number;
}

/**
 * 分页获取函数类型
 */
export type FetchPageFn<T> = (
  skip: number,
  limit: number
) => Promise<PaginatedResponse<T>>;

/**
 * 获取所有分页数据
 * 自动循环获取所有页，直到获取完所有数据
 * @param fetchFn 分页获取函数
 * @param pageSize 每页大小（默认 100）
 * @returns 所有数据项
 */
export async function fetchAllPages<T>(
  fetchFn: FetchPageFn<T>,
  pageSize = 100
): Promise<T[]> {
  const items: T[] = [];
  let skip = 0;
  let total = Number.POSITIVE_INFINITY;

  while (skip < total) {
    const resp = await fetchFn(skip, pageSize);
    items.push(...resp.items);
    total = resp.total;

    // 如果当前页没有数据，停止获取
    if (resp.items.length === 0) break;

    skip += resp.items.length;
  }

  return items;
}

/**
 * 从 URL 搜索参数中解析分页信息
 * @param searchParams URLSearchParams 对象
 * @param defaultPage 默认页码（默认 1）
 * @param defaultPageSize 默认每页大小（默认 10）
 * @returns 解析后的分页参数
 */
export function parsePaginationFromSearchParams(
  searchParams: URLSearchParams,
  defaultPage = 1,
  defaultPageSize = 10
): { page: number; pageSize: number } {
  const pageStr = searchParams.get('page');
  const pageSizeStr = searchParams.get('pageSize') || searchParams.get('limit');

  const page = pageStr ? parseInt(pageStr, 10) : defaultPage;
  const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : defaultPageSize;

  return {
    page: Number.isNaN(page) || page < 1 ? defaultPage : page,
    pageSize: Number.isNaN(pageSize) || pageSize < 1 ? defaultPageSize : pageSize,
  };
}
