import React from "react";
import { cn } from "@/lib/utils";

interface AdminFilterBarProps {
  children?: React.ReactNode;
  className?: string;
  /** 搜索输入区 */
  searchSlot?: React.ReactNode;
  /** 筛选条件区 */
  filterSlot?: React.ReactNode;
  /** 操作按钮区（批量操作） */
  bulkSlot?: React.ReactNode;
  /** 主要操作区（新建、导出等） */
  actionSlot?: React.ReactNode;
}

/**
 * 管理页面统一工具栏容器，确保间距和换行一致。
 * 使用 slot 分区：searchSlot(搜索) → filterSlot(筛选) → bulkSlot(批量) → actionSlot(操作)。
 */
export const AdminFilterBar: React.FC<AdminFilterBarProps> = ({
  children,
  className,
  searchSlot,
  filterSlot,
  bulkSlot,
  actionSlot,
}) => {
  const hasSlots = [searchSlot, filterSlot, bulkSlot, actionSlot].some(Boolean);

  return (
    <div
      className={cn("mb-4 flex flex-wrap items-center gap-2", className)}
      {...(hasSlots ? { role: "toolbar", "aria-label": "操作工具栏" } : {})}
    >
      {hasSlots ? (
        <>
          {searchSlot && <div className="flex-shrink-0">{searchSlot}</div>}
          {filterSlot && <div className="flex flex-wrap items-center gap-2">{filterSlot}</div>}
          <div className="flex-1" />
          {bulkSlot && <div className="flex flex-wrap items-center gap-2">{bulkSlot}</div>}
          {actionSlot && <div className="flex flex-wrap items-center gap-2">{actionSlot}</div>}
        </>
      ) : (
        children
      )}
    </div>
  );
};
