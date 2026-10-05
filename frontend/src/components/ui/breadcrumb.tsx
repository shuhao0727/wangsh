import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  /** 是否显示首页图标（默认false） */
  showHomeIcon?: boolean;
}

/**
 * 面包屑导航组件
 * 用于显示当前页面在导航层级中的位置
 */
export function Breadcrumb({ items, className, showHomeIcon = false }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="面包屑导航" className={cn("mb-4", className)}>
      <ol className="flex items-center gap-xs text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const Icon = item.icon;

          return (
            <li key={index} className="flex items-center gap-xs">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 text-text-tertiary flex-shrink-0" />
              )}
              {item.href ? (
                <Link
                  to={item.href}
                  className="text-text-secondary hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  {index === 0 && showHomeIcon && (
                    <Home className="h-3.5 w-3.5" />
                  )}
                  {Icon && !showHomeIcon && <Icon className="h-3.5 w-3.5" />}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    isLast ? "text-text-base font-medium" : "text-text-secondary"
                  )}
                >
                  {index === 0 && showHomeIcon && (
                    <Home className="h-3.5 w-3.5" />
                  )}
                  {Icon && !showHomeIcon && <Icon className="h-3.5 w-3.5" />}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
