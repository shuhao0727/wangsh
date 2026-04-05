import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@components/Common/EmptyState";

type Props = {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  loading?: boolean;
  isEmpty?: boolean;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  children: React.ReactNode;
  pagination?: React.ReactNode;
};

const TableSkeleton: React.FC = () => (
  <div className="space-y-3 px-4 py-4">
    <Skeleton className="h-8 w-full" />
    {Array.from({ length: 5 }).map((_, i) => (
      <Skeleton key={i} className="h-9 w-full" />
    ))}
  </div>
);

const AdminTablePanel: React.FC<Props> = ({
  title, extra, loading = false, isEmpty = false,
  emptyDescription, emptyAction, children, pagination,
}) => (
  <div className="flex flex-col h-full overflow-hidden">
    {(title || extra) && (
      <div className="flex items-center justify-between px-4 py-3">
        {title && <div className="text-base font-semibold text-text-base">{title}</div>}
        {extra && <div>{extra}</div>}
      </div>
    )}

    <div className="flex-1 overflow-hidden flex flex-col">
      {loading ? (
        <TableSkeleton />
      ) : isEmpty ? (
        <div className="flex items-center justify-center h-full">
          <EmptyState description={emptyDescription as string} action={emptyAction} />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      )}
    </div>

    {pagination && (
      <div className="flex justify-end border-t border-border-secondary px-4 py-3">
        {pagination}
      </div>
    )}
  </div>
);

export default AdminTablePanel;
