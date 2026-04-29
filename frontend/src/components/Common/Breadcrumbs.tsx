import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  className?: string;
}

/** 路径段 → 中文标签映射 */
const PATH_LABEL_MAP: Record<string, string> = {
  admin: "管理后台",
  dashboard: "状态概览",
  "ai-agents": "AI智能体管理",
  users: "用户管理",
  "agent-data": "智能体数据",
  "group-discussion": "小组讨论",
  assessment: "自适应测评",
  "classroom-interaction": "课堂互动",
  "classroom-plan": "课堂计划",
  informatics: "信息学竞赛",
  "it-technology": "信息技术",
  "personal-programs": "个人程序",
  articles: "文章管理",
  categories: "分类管理",
  system: "系统设置",
  questions: "题目管理",
  statistics: "答题统计",
  editor: "编辑器",
  new: "新建",
  plan: "课堂计划",
  agents: "智能体",
};

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ className }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const items = useMemo<BreadcrumbItem[]>(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    if (segments.length === 0 || (segments.length === 1 && segments[0] === "admin")) {
      return [];
    }

    const crumbs: BreadcrumbItem[] = [];
    let accumulated = "";

    for (const seg of segments) {
      accumulated += `/${seg}`;
      const label = PATH_LABEL_MAP[seg];
      // 数字段（ID）回退显示段名
      const displayLabel = label || (seg.match(/^\d+$/) ? `#${seg}` : seg);
      crumbs.push({ label: displayLabel, href: accumulated });
    }

    // 最少保留最后两段
    if (crumbs.length <= 1) return crumbs;
    return crumbs;
  }, [location.pathname]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="面包屑导航"
      className={cn(
        "flex items-center gap-1 px-4 py-2 text-sm text-text-tertiary border-b border-[var(--ws-color-border)] bg-[var(--ws-color-surface-2)]",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => navigate("/admin/dashboard")}
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-text-base hover:bg-[var(--ws-color-hover-bg)]"
      >
        <Home className="h-3.5 w-3.5" />
      </button>
      {items.map((item, i) => (
        <React.Fragment key={item.href}>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary/60" />
          {i === items.length - 1 || !item.href ? (
            <span className="text-text-secondary font-medium truncate max-w-[200px]">
              {item.label}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => item.href && navigate(item.href)}
              className="rounded px-1 py-0.5 transition-colors hover:text-text-base hover:bg-[var(--ws-color-hover-bg)] truncate max-w-[200px]"
            >
              {item.label}
            </button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
