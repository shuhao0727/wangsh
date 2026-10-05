import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 统一加载指示器。
 *
 * 背景：迁移前全仓有 126 处 `Loader2 + animate-spin` 的直接写法，尺寸散落为
 * h-3.5 / h-4 / h-5 / h-6 / h-8 / h-9 六档，且**绝大多数没有可访问名称**——
 * 屏幕阅读器只能读出"图形"，无法得知正在加载。
 *
 * 本组件的两点约定：
 * 1. **尺寸收敛为 5 档语义名**，不再各处写 h-/w-。
 * 2. **可访问性二选一**：
 *    - 装饰性（按钮内已有文案说明，如「保存中…」）→ 保持默认，`aria-hidden`；
 *    - 独立承载加载语义 → 传 `label`，渲染 `role="status"` + 可访问名称。
 *    不传 label 时**不会**谎报角色，避免和无文案场景叠加重复播报。
 */
/**
 * 档位**一一对应迁移前的实测尺寸谱系**（3.5 / 4 / 5 / 6 / 7 / 8 / 9 / 10），
 * 只把仅出现 1 次的 `h-3` 并入 `xs`。
 *
 * 为什么不"归并成 5 档"（那是我最初的设计，实测后推翻了）：
 * 项目根字号是流体 `--ws-font-size-base: clamp(14px, 0.12vw + 13px, 15px)`，
 * 1rem ≈ **14.73px 而非 16px**。于是相邻档位实际只差约 3.7px，
 * 但恰恰是这 3.7px 造成了可测的跳变——L3 实测：
 *   `h-9` = 33.13px（Auth Guard 的原值）
 *   `h-8` = 29.45px（若并档，Guard 会缩 3.68px）
 *   `h-7` = 25.77px（Detail 的原值）
 * "统一档位"若以改变既有尺寸为代价，就是**用一个视觉回归换代码整洁**——
 * 这不是本次迁移的目的。保真优先，档位数次要。
 */
const SIZES = {
  xs: "h-3.5 w-3.5", // 30 处
  sm: "h-4 w-4", // 69 处，绝对主力
  md: "h-5 w-5", // 13 处
  lg: "h-6 w-6", // 7 处
  "1.5x": "h-7 w-7", // 3 处（Detail 等）
  xl: "h-8 w-8", // 9 处
  "2xl": "h-9 w-9", // 3 处（Auth 三个 Guard，**不能并档**）
  "3xl": "h-10 w-10", // 3 处（App.tsx 全屏加载）
} as const;

export type SpinnerSize = keyof typeof SIZES;

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  /** 尺寸档位。xs=3.5 / sm=4 / md=5 / lg=6 / 1.5x=7 / xl=8 / 2xl=9 / 3xl=10 */
  size?: SpinnerSize;
  /**
   * 可访问名称。提供时渲染 `role="status"`，供屏幕阅读器播报；
   * 省略时视为装饰性元素（`aria-hidden`）。
   */
  label?: string;
}

const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ size = "sm", label, className, ...props }, ref) => {
    const decorative = !label;
    return (
      <Loader2
        ref={ref}
        className={cn("animate-spin", SIZES[size], className)}
        aria-hidden={decorative || undefined}
        role={decorative ? undefined : "status"}
        aria-label={label}
        {...props}
      />
    );
  },
);
Spinner.displayName = "Spinner";

export { Spinner };
export default Spinner;
