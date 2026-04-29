import React from "react";
import { cn } from "@/lib/utils";

interface AdminFilterBarProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * 管理页面统一工具栏容器，确保间距一致
 */
export const AdminFilterBar: React.FC<AdminFilterBarProps> = ({
  children,
  className,
}) => (
  <div className={cn("mb-4 flex flex-wrap items-center gap-2", className)}>
    {children}
  </div>
);
