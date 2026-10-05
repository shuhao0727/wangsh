import React from "react";
import { cn } from "@/lib/utils";

export interface GridProps {
  /** 列数，默认12列 */
  cols?: 4 | 6 | 12;
  /** 间距，默认4 (16px) */
  gap?: 2 | 3 | 4 | 6 | 8;
  children: React.ReactNode;
  className?: string;
  /** 响应式配置 */
  responsive?: boolean;
}

export interface GridColProps {
  /** 跨越列数，默认1 */
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  /** 响应式：小屏跨越列数 */
  smSpan?: 1 | 2 | 3 | 4 | 6 | 12;
  /** 响应式：中屏跨越列数 */
  mdSpan?: 1 | 2 | 3 | 4 | 6 | 12;
  /** 响应式：大屏跨越列数 */
  lgSpan?: 1 | 2 | 3 | 4 | 6 | 12;
  children: React.ReactNode;
  className?: string;
}

const gapClasses = {
  2: "gap-xs",
  3: "gap-3",
  4: "gap-4",
  6: "gap-6",
  8: "gap-8",
};

const colsClasses = {
  4: "grid-cols-4",
  6: "grid-cols-6",
  12: "grid-cols-12",
};

const spanClasses = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  5: "col-span-5",
  6: "col-span-6",
  7: "col-span-7",
  8: "col-span-8",
  9: "col-span-9",
  10: "col-span-10",
  11: "col-span-11",
  12: "col-span-12",
};

const smSpanClasses = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
  6: "sm:col-span-6",
  12: "sm:col-span-12",
};

const mdSpanClasses = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  6: "md:col-span-6",
  12: "md:col-span-12",
};

const lgSpanClasses = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  6: "lg:col-span-6",
  12: "lg:col-span-12",
};

/**
 * 栅格容器组件
 * 基于 CSS Grid 的 12 列栅格系统
 */
export function Grid({
  cols = 12,
  gap = 4,
  children,
  className,
  responsive = true,
}: GridProps) {
  return (
    <div
      className={cn(
        "grid",
        colsClasses[cols],
        gapClasses[gap],
        responsive && cols === 12 && "sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * 栅格列组件
 * 定义跨越的列数
 */
export function GridCol({
  span = 1,
  smSpan,
  mdSpan,
  lgSpan,
  children,
  className,
}: GridColProps) {
  return (
    <div
      className={cn(
        spanClasses[span],
        smSpan && smSpanClasses[smSpan],
        mdSpan && mdSpanClasses[mdSpan],
        lgSpan && lgSpanClasses[lgSpan],
        className
      )}
    >
      {children}
    </div>
  );
}
