import React from "react";
import { Spinner, type SpinnerSize } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * 区块级 / 按钮内联 的加载态。
 *
 * 与 `<Spinner>` 的分工：
 * - `<Spinner>` 只负责"转圈图形"，尺寸与可访问性由调用方决定；
 * - `<LoadingState>` 负责"加载区域"，自带布局与**必然存在的可访问名称**。
 *
 * 迁移前形态参考 `App.tsx`：`<div className="p-12 text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" /></div>`。
 * 该写法没有任何 aria 属性，屏幕阅读器静默 —— 这是本次统一要修的缺陷。
 */
export interface LoadingStateProps {
  /** 可访问名称，同时作为可见文案（默认「加载中…」） */
  label?: string;
  /**
   * block：整块内容区（居中 + 纵向留白）；
   * inline：按钮/行内，无留白。
   */
  variant?: "block" | "inline";
  size?: SpinnerSize;
  className?: string;
  /** 是否显示可见文案。false 时文案仅对屏幕阅读器可见（sr-only） */
  showLabel?: boolean;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  label = "加载中…",
  variant = "block",
  size = "sm",
  className,
  showLabel = false,
}) => {
  const isBlock = variant === "block";
  return (
    <div
      role="status"
      aria-live="polite"
      // role="status" 不是 name-from-content 角色：内部文本不会成为可访问名称，
      // 不显式 aria-label 时无障碍树里名称恒为空串（实测）。
      // 显式命名后，既保证 live region 被播报，也让 getByRole("status",{name}) 可取。
      aria-label={label}
      // 间距走语义 token（gap-item-gap / p-panel-padding），不用数字类：
      // 本仓库有 ui:spacing:ci 门禁统计数字间距类，新增数字类会被判为债务。
      className={cn(
        "flex items-center justify-center gap-item-gap text-text-tertiary",
        isBlock ? "p-panel-padding" : "",
        className,
      )}
    >
      <Spinner size={size} />
      <span className={showLabel ? "text-sm" : "sr-only"}>{label}</span>
    </div>
  );
};

export { LoadingState };
export default LoadingState;
