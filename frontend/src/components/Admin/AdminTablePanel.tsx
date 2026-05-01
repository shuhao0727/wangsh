import React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@components/Common/EmptyState";

type Props = {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  /** 自定义 aria-label，当 title 为 ReactNode 时建议提供 */
  ariaLabel?: string;
  loading?: boolean;
  isEmpty?: boolean;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  /** 筛选后无结果（与 isEmpty 区分：空数据 vs 筛选无匹配） */
  noResults?: boolean;
  noResultsDescription?: React.ReactNode;
  /** 请求失败 */
  error?: boolean;
  errorDescription?: React.ReactNode;
  onRetry?: () => void;
  /** 权限不足 */
  permissionDenied?: boolean;
  permissionDeniedDescription?: React.ReactNode;
  children: React.ReactNode;
  pagination?: React.ReactNode;
};

const TableSkeleton: React.FC = () => (
  <div className="space-y-3 px-4 py-4" role="status" aria-label="加载中">
    <Skeleton className="h-8 w-full" />
    {Array.from({ length: 5 }).map((_, i) => (
      <Skeleton key={i} className="h-9 w-full" />
    ))}
  </div>
);

const AdminTablePanel: React.FC<Props> = ({
  title, extra, ariaLabel,
  loading = false,
  isEmpty = false,
  emptyDescription, emptyAction,
  noResults = false,
  noResultsDescription = "尝试调整筛选条件或搜索关键词",
  error = false,
  errorDescription = "请稍后重试",
  onRetry,
  permissionDenied = false,
  permissionDeniedDescription = "请联系管理员获取访问权限",
  children, pagination,
}) => {
  const resolvedAriaLabel = ariaLabel ?? (typeof title === "string" ? title : "数据面板");

  const renderBody = () => {
    if (loading) return <TableSkeleton />;
    if (permissionDenied) {
      return (
        <div className="flex items-center justify-center h-full" role="alert">
          <EmptyState variant="permission-denied" description={permissionDeniedDescription} />
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex items-center justify-center h-full" role="alert">
          <EmptyState
            variant="error"
            description={errorDescription}
            action={
              onRetry ? (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  重试
                </Button>
              ) : undefined
            }
          />
        </div>
      );
    }
    if (noResults) {
      return (
        <div className="flex items-center justify-center h-full">
          <EmptyState variant="no-results" description={noResultsDescription} />
        </div>
      );
    }
    if (isEmpty) {
      return (
        <div className="flex items-center justify-center h-full">
          <EmptyState description={emptyDescription} action={emptyAction} />
        </div>
      );
    }
    return <div className="flex-1 overflow-auto">{children}</div>;
  };

  return (
    <div className="flex flex-col min-h-0 overflow-hidden flex-1" role="region" aria-label={resolvedAriaLabel}>
      {(title || extra) && (
        <div className="flex items-center justify-between px-4 py-3">
          {title && <div className="text-base font-semibold text-text-base">{title}</div>}
          {extra && <div>{extra}</div>}
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        {renderBody()}
      </div>

      {pagination && !loading && !error && !permissionDenied && (
        <div className="flex justify-end border-t border-border-secondary px-4 py-3">
          {pagination}
        </div>
      )}
    </div>
  );
};

export default AdminTablePanel;
