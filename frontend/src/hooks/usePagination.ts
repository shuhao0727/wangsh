import { useCallback, useEffect, useMemo, useState } from 'react';
import { calculatePagination, generatePageNumbers, type PaginationResult } from '@/utils/pagination';

/**
 * usePagination Hook 配置
 */
export interface UsePaginationOptions {
  /** 初始页码（默认 1） */
  initialPage?: number;
  /** 每页条目数（默认 10） */
  pageSize?: number;
  /** 总条目数 */
  total: number;
  /** 页码变化回调 */
  onPageChange?: (page: number) => void;
}

/**
 * usePagination Hook 返回值
 */
export interface UsePaginationReturn extends PaginationResult {
  /** 设置页码 */
  setPage: (page: number) => void;
  /** 跳转到指定页 */
  goToPage: (page: number) => void;
  /** 下一页 */
  nextPage: () => void;
  /** 上一页 */
  prevPage: () => void;
  /** 跳转到首页 */
  goToFirstPage: () => void;
  /** 跳转到末页 */
  goToLastPage: () => void;
  /** 页码数组（用于分页器显示） */
  pageNumbers: (number | null)[];
}

/**
 * 分页状态管理 Hook
 * 提供分页状态和操作方法
 *
 * @example
 * ```tsx
 * const pagination = usePagination({
 *   total: 100,
 *   pageSize: 10,
 *   onPageChange: (page) => console.log('页码变化:', page),
 * });
 *
 * // 使用
 * <Button onClick={pagination.prevPage} disabled={!pagination.hasPrevious}>
 *   上一页
 * </Button>
 * <span>第 {pagination.currentPage} 页，共 {pagination.totalPages} 页</span>
 * <Button onClick={pagination.nextPage} disabled={!pagination.hasNext}>
 *   下一页
 * </Button>
 * ```
 */
export function usePagination(options: UsePaginationOptions): UsePaginationReturn {
  const {
    initialPage = 1,
    pageSize = 10,
    total,
    onPageChange,
  } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);

  // 计算分页信息
  const paginationInfo = useMemo(
    () => calculatePagination({ page: currentPage, pageSize, total }),
    [currentPage, pageSize, total]
  );

  // Keep stored state aligned with the displayed page after totals shrink.
  useEffect(() => {
    setCurrentPage(paginationInfo.currentPage);
  }, [paginationInfo.currentPage]);

  // 生成页码数组
  const pageNumbers = useMemo(
    () => generatePageNumbers(paginationInfo.currentPage, paginationInfo.totalPages),
    [paginationInfo.currentPage, paginationInfo.totalPages]
  );

  // 设置页码（带验证）
  const setPage = useCallback(
    (page: number) => {
      const validPage = Math.max(1, Math.min(page, paginationInfo.totalPages));
      if (validPage !== paginationInfo.currentPage) {
        setCurrentPage(validPage);
        onPageChange?.(validPage);
      }
    },
    [paginationInfo.currentPage, paginationInfo.totalPages, onPageChange]
  );

  // 跳转到指定页
  const goToPage = useCallback(
    (page: number) => {
      setPage(page);
    },
    [setPage]
  );

  // 下一页
  const nextPage = useCallback(() => {
    if (paginationInfo.hasNext) {
      setPage(paginationInfo.currentPage + 1);
    }
  }, [paginationInfo.currentPage, paginationInfo.hasNext, setPage]);

  // 上一页
  const prevPage = useCallback(() => {
    if (paginationInfo.hasPrevious) {
      setPage(paginationInfo.currentPage - 1);
    }
  }, [paginationInfo.currentPage, paginationInfo.hasPrevious, setPage]);

  // 跳转到首页
  const goToFirstPage = useCallback(() => {
    setPage(1);
  }, [setPage]);

  // 跳转到末页
  const goToLastPage = useCallback(() => {
    setPage(paginationInfo.totalPages);
  }, [paginationInfo.totalPages, setPage]);

  return {
    ...paginationInfo,
    setPage,
    goToPage,
    nextPage,
    prevPage,
    goToFirstPage,
    goToLastPage,
    pageNumbers,
  };
}
