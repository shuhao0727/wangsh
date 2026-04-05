import React from "react";
import { cn } from "@/lib/utils";

interface AdminCardProps {
  /** 卡片标题 */
  title?: React.ReactNode;
  /** 额外操作区 */
  extra?: React.ReactNode;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 自定义类名 */
  className?: string;
  /** 子元素 */
  children?: React.ReactNode;
  /** 卡片密度：small 减少内边距 */
  size?: "small" | "default";
  /** 子元素样式覆盖（兼容 antd Card API） */
  styles?: {
    body?: React.CSSProperties;
  };
}

/**
 * 管理后台通用卡片
 * 无边框、透明背景的简约风格
 */
const AdminCard: React.FC<AdminCardProps> = ({
  title,
  extra,
  style,
  className,
  children,
  size,
  styles,
}) => {
  return (
    <div
      className={cn("bg-transparent ws-admin-card", className)}
      style={style}
    >
      {(title || extra) && (
        <div className="flex items-center justify-between px-4 py-3">
          {title && (
            <h3 className="text-base font-semibold text-text-base">{title}</h3>
          )}
          {extra && <div>{extra}</div>}
        </div>
      )}
      <div
        className={cn(size === "small" ? "px-3 py-2.5" : "px-4 py-3.5")}
        style={styles?.body}
      >
        {children}
      </div>
    </div>
  );
};

export default AdminCard;
