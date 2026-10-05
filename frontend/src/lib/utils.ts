import clsx from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * 语义间距 token 名单（与 tailwind.config.js 的 theme.extend.spacing 保持一致）。
 *
 * 为什么必须显式注册：tailwind-merge 用「classGroupId」判断两个类是否互相覆盖，
 * 而内置配置把 `p-panel-padding` 整个当成未知类——实测 `twMerge('p-panel-padding','p-4')`
 * 会**两条都保留**，最终顺序取决于生成 CSS 的先后（见计划 §2.3 附带发现）。
 * 一旦 B5 把 `p-6` 换成语义 token，任何 `cn("p-card-padding", 条件 && "p-2")` 这类
 * 期望后者覆盖前者的写法都会静默失效，表现为「条件不满足时组件间距仍然变小」。
 *
 * 写法陷阱：classGroups 的值必须用**嵌套对象** `{ [prefix]: [names] }`。
 * 直接写 `{ p: names }` 会在 classMap 里另起一条与内置 `p` 组**平行**的路径，
 * `p-panel-padding` 仍解析不到内置 `p` 组，合并照旧失效（已实测）。
 */
const SEMANTIC_SPACING_TOKENS = [
  "section-gap",
  "panel-padding",
  "panel-padding-sm",
  "panel-padding-lg",
  "card-padding",
  "item-gap",
  "form-field-gap",
  "button-gap",
  "content-gap",
  "2xs",
  "xs",
] as const;

const SPACING_PREFIXES = [
  "p", "px", "py", "pt", "pr", "pb", "pl",
  "m", "mx", "my", "mt", "mr", "mb", "ml",
  "gap", "space-x", "space-y",
] as const;

const semanticSpacingClassGroups = Object.fromEntries(
  SPACING_PREFIXES.map((prefix) => [prefix, [{ [prefix]: [...SEMANTIC_SPACING_TOKENS] }]])
);

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: semanticSpacingClassGroups,
  },
});

export function cn(...inputs: Array<string | number | boolean | null | undefined | Record<string, boolean> | Array<unknown>>): string {
  return twMerge(clsx(inputs));
}
