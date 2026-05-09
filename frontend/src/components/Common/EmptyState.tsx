import React from "react";
import { Inbox, Search, ShieldAlert, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type Variant = "no-data" | "no-results" | "error" | "permission-denied";

interface EmptyStateProps {
  variant?: Variant;
  icon?: React.ReactNode;
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const defaults: Record<Variant, { icon: React.ReactNode; title: string; description: string }> = {
  "no-data": {
    icon: <Inbox className="h-10 w-10 text-text-tertiary" />,
    title: "暂无数据",
    description: "当前没有可显示的内容",
  },
  "no-results": {
    icon: <Search className="h-10 w-10 text-text-tertiary" />,
    title: "未找到结果",
    description: "尝试调整筛选条件或搜索关键词",
  },
  error: {
    icon: <TriangleAlert className="h-10 w-10 text-warning" />,
    title: "加载失败",
    description: "请稍后重试或联系管理员",
  },
  "permission-denied": {
    icon: <ShieldAlert className="h-10 w-10 text-text-tertiary" />,
    title: "权限不足",
    description: "请联系管理员获取访问权限",
  },
};

const EmptyState: React.FC<EmptyStateProps> = ({
  variant = "no-data",
  icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  className = "",
}) => {
  const d = defaults[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}
    >
      <div className="mb-3">{icon ?? d.icon}</div>
      <div className="text-sm font-medium text-text-secondary mb-1">{title ?? d.title}</div>
      <div className="text-xs text-text-tertiary mb-4">{description ?? d.description}</div>
      {actionLabel && onAction && (
        <div className="mb-3">
          <Button variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};

export default EmptyState;
