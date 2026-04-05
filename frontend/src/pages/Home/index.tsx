import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Rocket, BookOpen, Laptop, LayoutGrid, FileText,
  Database, ArrowRight, User,
} from "lucide-react";
import { config } from "@services";
import useAppMeta from "@hooks/useAppMeta";
import useAuth from "@hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { featureFlagsApi } from "@/services/system/featureFlags";
import { NAV_VISIBILITY_ITEMS } from "@/constants/navVisibility";

// 动态颜色配置（保留 inline style，因为颜色是动态的）
const moduleColors: Record<string, { icon: string; bg: string; ring: string }> = {
  "ai-agents":         { icon: "var(--ws-color-primary)", bg: "color-mix(in srgb, var(--ws-color-primary) 8%, transparent)", ring: "color-mix(in srgb, var(--ws-color-primary) 22%, transparent)" },
  "informatics":       { icon: "var(--ws-color-secondary)", bg: "color-mix(in srgb, var(--ws-color-secondary) 8%, transparent)", ring: "color-mix(in srgb, var(--ws-color-secondary) 22%, transparent)" },
  "it-technology":     { icon: "var(--ws-color-warning)", bg: "color-mix(in srgb, var(--ws-color-warning) 8%, transparent)", ring: "color-mix(in srgb, var(--ws-color-warning) 22%, transparent)" },
  "personal-programs": { icon: "var(--ws-color-success)", bg: "color-mix(in srgb, var(--ws-color-success) 8%, transparent)", ring: "color-mix(in srgb, var(--ws-color-success) 22%, transparent)" },
  "articles":          { icon: "var(--ws-color-accent)", bg: "color-mix(in srgb, var(--ws-color-accent) 8%, transparent)", ring: "color-mix(in srgb, var(--ws-color-accent) 22%, transparent)" },
};

const platformModules = [
  { id: "ai-agents",         title: "AI 智能体",   description: "智能对话与文档分析",   icon: <Rocket className="h-5 w-5" />,     path: "/ai-agents" },
  { id: "informatics",       title: "信息学竞赛", description: "笔记、题库与竞赛指导", icon: <BookOpen className="h-5 w-5" />,   path: "/informatics" },
  { id: "it-technology",     title: "信息技术",   description: "IT 课程与实践工具",   icon: <Laptop className="h-5 w-5" />,     path: "/it-technology" },
  { id: "personal-programs", title: "个人项目",   description: "程序展示与项目管理",   icon: <LayoutGrid className="h-5 w-5" />, path: "/personal-programs" },
  { id: "articles",          title: "文章",       description: "技术文章与知识分享",   icon: <FileText className="h-5 w-5" />,   path: "/articles" },
];

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { version, envLabel } = useAppMeta();
  const auth = useAuth();
  const [navVisibleMap, setNavVisibleMap] = useState<Record<string, boolean>>({});

  const externalLinks = [
    { title: "Dify AI 平台", description: "AI 智能体开发与部署", url: config.difyUrl, icon: <Rocket className="h-5 w-5" />, color: "var(--ws-color-primary)", surfaceBg: "color-mix(in srgb, var(--ws-color-primary) 7%, transparent)", iconBg: "color-mix(in srgb, var(--ws-color-primary) 12%, transparent)" },
    { title: "NAS 文件服务", description: "网络附加存储管理",   url: config.nasUrl,  icon: <Database className="h-5 w-5" />, color: "var(--ws-color-secondary)", surfaceBg: "color-mix(in srgb, var(--ws-color-secondary) 7%, transparent)", iconBg: "color-mix(in srgb, var(--ws-color-secondary) 12%, transparent)" },
  ].filter((l) => l.url);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const pairs = await Promise.all(
        NAV_VISIBILITY_ITEMS.map(async (it) => {
          try {
            const res = await featureFlagsApi.getPublic(it.flagKey);
            return [it.path, res?.value?.enabled !== false] as const;
          } catch {
            return [it.path, true] as const;
          }
        }),
      );
      if (!mounted) return;
      const next: Record<string, boolean> = {};
      for (const [path, visible] of pairs) next[path] = visible;
      setNavVisibleMap(next);
    })();
    return () => { mounted = false; };
  }, []);

  const visibleModules = useMemo(() => {
    if (Object.keys(navVisibleMap).length === 0) return platformModules;
    return platformModules.filter((m) => {
      const item = NAV_VISIBILITY_ITEMS.find((n) => n.id === m.id);
      if (!item) return true;
      return navVisibleMap[item.path] !== false;
    });
  }, [navVisibleMap]);

  const isLoggedIn = auth.isLoggedIn();
  const displayName = auth.getDisplayName();
  const roleCode = auth.user?.role_code;
  const roleLabel =
    roleCode === "super_admin" ? "超级管理员" :
    roleCode === "admin" ? "管理员" :
    roleCode === "student" ? "学生" : null;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return "夜深了";
    if (h < 11) return "早上好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  })();

  return (
    <div className="home-page w-full flex-1 flex flex-col overflow-hidden bg-surface">
      <div
        className="flex-1 min-h-0 mx-auto w-full px-4 md:px-6 py-5 flex flex-col gap-5 overflow-y-auto"
        style={{ maxWidth: "var(--ws-page-max-width)" }}
      >
        {/* ─── 欢迎条 ─── */}
        <div className="rounded-xl bg-surface-2 px-5 py-4 md:px-6 md:py-5">
          {isLoggedIn ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-bold text-text-base leading-tight truncate">
                    {greeting}，{displayName || "同学"}
                    {roleLabel && <Badge variant="primarySubtle" className="ml-2 text-xs align-middle">{roleLabel}</Badge>}
                  </div>
                  <div className="text-sm text-text-secondary mt-0.5">欢迎使用 WangSh 平台</div>
                </div>
              </div>
              {(auth.isAdmin() || auth.isSuperAdmin()) && (
                <button
                  onClick={() => navigate("/admin/dashboard")}
                  className="appearance-none flex-shrink-0 flex items-center gap-1.5 rounded-lg border-0 px-3.5 py-2 text-sm font-medium text-primary cursor-pointer transition-all admin-btn-hover"
                >
                  <User className="h-4 w-4" /> 管理后台
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="text-lg font-bold text-text-base">WangSh 平台</div>
              <div className="text-sm text-text-secondary mt-0.5">一站式教学与学习平台</div>
            </div>
          )}
        </div>

        {/* ─── 平台模块 ─── */}
        <div>
          <h2 className="text-sm font-semibold text-text-secondary mb-3">平台模块</h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {visibleModules.map((mod) => {
              const c = moduleColors[mod.id] ?? {
                icon: "var(--ws-color-text-secondary)",
                bg: "color-mix(in srgb, var(--ws-color-text-secondary) 8%, transparent)",
                ring: "color-mix(in srgb, var(--ws-color-text-secondary) 22%, transparent)",
              };
              return (
                <button
                  key={mod.id}
                  onClick={() => navigate(mod.path)}
                  className="appearance-none module-card relative flex h-full flex-col items-start text-left rounded-xl px-5 py-5 border-0 cursor-pointer w-full bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  style={{ "--mc-bg": c.bg, "--mc-ring": c.ring, minHeight: 120 } as React.CSSProperties}
                >
                  <div className="module-icon flex items-center justify-center w-10 h-10 rounded-lg mb-2.5 transition-transform"
                    style={{ background: c.bg }}>
                    <span style={{ color: c.icon }}>{mod.icon}</span>
                  </div>
                  <div className="text-sm font-semibold text-text-base mb-0.5">{mod.title}</div>
                  <div className="text-xs leading-relaxed text-text-secondary">{mod.description}</div>
                  <ArrowRight className="module-arrow absolute top-4 right-4 h-4 w-4 transition-all" style={{ color: c.icon }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── 外部服务 ─── */}
        {externalLinks.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-text-secondary mb-3">外部服务</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {externalLinks.map((link, i) => (
                <button
                  key={i}
                  onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
                  className="appearance-none ext-card flex items-center gap-3.5 rounded-xl px-5 py-4 text-left border-0 cursor-pointer w-full bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  style={{ "--ec-bg": link.surfaceBg } as React.CSSProperties}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0"
                    style={{ background: link.iconBg, color: link.color }}>
                    {link.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-text-base">{link.title}</div>
                    <div className="text-xs mt-0.5 text-text-secondary">{link.description}</div>
                  </div>
                  <ArrowRight className="ext-arrow flex-shrink-0 h-4 w-4 transition-all" style={{ color: link.color }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── 底部 ─── */}
        <div className="mt-auto pt-3 pb-1 text-center">
          <span className="text-xs text-text-tertiary">
            WangSh 平台 · v{version} · {envLabel || "本地开发"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
