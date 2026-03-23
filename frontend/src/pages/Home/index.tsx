import React, { useEffect, useMemo, useState } from "react";
import { Tag } from "antd";
import {
  RocketOutlined, BookOutlined, LaptopOutlined, AppstoreOutlined, FileTextOutlined,
  DatabaseOutlined, ArrowRightOutlined, UserOutlined,
} from "@ant-design/icons";
import { config } from "@services";
import useAppMeta from "@hooks/useAppMeta";
import useAuth from "@hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { featureFlagsApi } from "@/services/system/featureFlags";
import { NAV_VISIBILITY_ITEMS } from "@/constants/navVisibility";

// 动态颜色配置（保留 inline style，因为颜色是动态的）
const moduleColors: Record<string, { icon: string; bg: string; ring: string }> = {
  "ai-agents":         { icon: "#0EA5E9", bg: "rgba(14,165,233,0.08)",  ring: "rgba(14,165,233,0.18)" },
  "informatics":       { icon: "#6366F1", bg: "rgba(99,102,241,0.08)",  ring: "rgba(99,102,241,0.18)" },
  "it-technology":     { icon: "#F59E0B", bg: "rgba(245,158,11,0.08)",  ring: "rgba(245,158,11,0.18)" },
  "personal-programs": { icon: "#10B981", bg: "rgba(16,185,129,0.08)",  ring: "rgba(16,185,129,0.18)" },
  "articles":          { icon: "#06B6D4", bg: "rgba(6,182,212,0.08)",   ring: "rgba(6,182,212,0.18)" },
};

const platformModules = [
  { id: "ai-agents",         title: "AI 智能体",   description: "智能对话与文档分析",   icon: <RocketOutlined />,   path: "/ai-agents" },
  { id: "informatics",       title: "信息学竞赛", description: "笔记、题库与竞赛指导", icon: <BookOutlined />,     path: "/informatics" },
  { id: "it-technology",     title: "信息技术",   description: "IT 课程与实践工具",   icon: <LaptopOutlined />,   path: "/it-technology" },
  { id: "personal-programs", title: "个人项目",   description: "程序展示与项目管理",   icon: <AppstoreOutlined />, path: "/personal-programs" },
  { id: "articles",          title: "文章",       description: "技术文章与知识分享",   icon: <FileTextOutlined />, path: "/articles" },
];

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { version, envLabel } = useAppMeta();
  const auth = useAuth();
  const [navVisibleMap, setNavVisibleMap] = useState<Record<string, boolean>>({});

  const externalLinks = [
    { title: "Dify AI 平台", description: "AI 智能体开发与部署", url: config.difyUrl, icon: <RocketOutlined />, color: "#0EA5E9", rgb: "14,165,233" },
    { title: "NAS 文件服务", description: "网络附加存储管理",   url: config.nasUrl,  icon: <DatabaseOutlined />, color: "#6366F1", rgb: "99,102,241" },
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
    <div className="w-full flex-1 flex flex-col overflow-hidden bg-white">
      <div className="flex-1 flex flex-col justify-center min-h-0 max-w-6xl mx-auto w-full px-10 gap-6">

        {/* Banner */}
        <div className="flex-none">
          <div className="relative overflow-hidden rounded-2xl px-8 py-7 flex items-center justify-between gap-4"
            style={{ background: "linear-gradient(135deg, rgba(14,165,233,0.07) 0%, rgba(99,102,241,0.08) 100%)" }}>
            {/* 装饰圆 — 动态背景色保留 inline */}
            <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none"
              style={{ background: "rgba(14,165,233,0.07)" }} />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full pointer-events-none"
              style={{ background: "rgba(99,102,241,0.05)" }} />

            <div className="relative z-10">
              {isLoggedIn ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-14 h-14 rounded-2xl flex-shrink-0 text-primary text-2xl"
                    style={{ background: "rgba(14,165,233,0.15)" }}>
                    <UserOutlined />
                  </div>
                  <div>
                    <div className="text-sm text-primary mb-0.5">{greeting}！</div>
                    <div className="text-2xl font-bold leading-tight text-text-base">
                      {displayName || "同学"}
                      {roleLabel && <Tag bordered={false} color="blue" className="ml-2 text-sm align-middle">{roleLabel}</Tag>}
                    </div>
                    <div className="text-sm text-text-secondary mt-1">欢迎使用 WangSh 平台</div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl font-bold text-text-base">WangSh 平台</div>
                  <div className="text-base text-text-secondary mt-1">一站式教学与学习平台</div>
                </div>
              )}
            </div>

            {isLoggedIn && (auth.isAdmin() || auth.isSuperAdmin()) && (
              <button
                onClick={() => navigate("/admin/dashboard")}
                className="relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-medium border-0 cursor-pointer flex-shrink-0 transition-all duration-150 text-primary admin-btn-hover"
              >
                <UserOutlined /> 管理后台
              </button>
            )}
          </div>
        </div>

        {/* 平台模块 */}
        <div className="flex-none">
          <div className="text-sm font-medium mb-4 text-text-secondary">平台模块</div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
            {visibleModules.map((mod) => {
              const c = moduleColors[mod.id] ?? { icon: "#64748B", bg: "rgba(100,116,139,0.08)", ring: "rgba(100,116,139,0.18)" };
              return (
                <button
                  key={mod.id}
                  onClick={() => navigate(mod.path)}
                  className="module-card relative flex flex-col items-center justify-center text-center rounded-2xl px-4 py-8 border-0 cursor-pointer w-full bg-surface-2"
                  style={{ "--mc-bg": c.bg, "--mc-ring": c.ring } as React.CSSProperties}
                >
                  <div className="module-icon flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
                    style={{ background: c.bg }}>
                    <span style={{ color: c.icon, fontSize: 28 }}>{mod.icon}</span>
                  </div>
                  <div className="font-semibold text-base mb-1.5 text-text-base">{mod.title}</div>
                  <div className="text-sm leading-relaxed text-text-secondary">{mod.description}</div>
                  <ArrowRightOutlined className="module-arrow absolute top-4 right-4 text-sm" style={{ color: c.icon }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* 外部服务 */}
        {externalLinks.length > 0 && (
          <div className="flex-none">
            <div className="text-sm font-medium mb-3 text-text-secondary">外部服务</div>
            <div className="grid grid-cols-2 gap-4">
              {externalLinks.map((link, i) => (
                <button
                  key={i}
                  onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
                  className="ext-card flex items-center gap-4 rounded-xl px-5 py-4 text-left border-0 cursor-pointer w-full bg-surface-2"
                  style={{ "--ec-bg": `rgba(${link.rgb},0.07)` } as React.CSSProperties}
                >
                  <div className="flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0"
                    style={{ background: `rgba(${link.rgb},0.1)`, color: link.color, fontSize: 20 }}>
                    {link.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-base text-text-base">{link.title}</div>
                    <div className="text-sm mt-0.5 text-text-secondary">{link.description}</div>
                  </div>
                  <ArrowRightOutlined className="ext-arrow flex-shrink-0 text-sm" style={{ color: link.color }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 底部 */}
        <div className="flex-none text-center">
          <span className="text-sm text-text-tertiary">
            WangSh 平台 · v{version} · {envLabel || "本地开发"}
          </span>
        </div>

      </div>
    </div>
  );
};

export default HomePage;
