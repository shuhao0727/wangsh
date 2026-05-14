import React, { useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Rocket, BookOpen, Laptop, LayoutGrid, FileText,
  Database, ArrowRight, User, ChevronDown,
} from "lucide-react";
import { config } from "@services";
import useAuth from "@hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { featureFlagsApi } from "@/services/system/featureFlags";
import { NAV_VISIBILITY_ITEMS } from "@/constants/navVisibility";

const MODULE_COLORS: Record<string, { accent: string; bg: string; ring: string }> = {
  "ai-agents":         { accent: "var(--ws-color-primary)", bg: "color-mix(in srgb, var(--ws-color-primary) 12%, transparent)", ring: "color-mix(in srgb, var(--ws-color-primary) 25%, transparent)" },
  "informatics":       { accent: "var(--ws-color-purple)",  bg: "color-mix(in srgb, var(--ws-color-purple) 12%, transparent)",  ring: "color-mix(in srgb, var(--ws-color-purple) 25%, transparent)" },
  "it-technology":     { accent: "var(--ws-color-info)",    bg: "color-mix(in srgb, var(--ws-color-info) 12%, transparent)",    ring: "color-mix(in srgb, var(--ws-color-info) 25%, transparent)" },
  "personal-programs": { accent: "var(--ws-color-success)", bg: "color-mix(in srgb, var(--ws-color-success) 12%, transparent)", ring: "color-mix(in srgb, var(--ws-color-success) 25%, transparent)" },
  "articles":          { accent: "var(--ws-color-warning)", bg: "color-mix(in srgb, var(--ws-color-warning) 12%, transparent)", ring: "color-mix(in srgb, var(--ws-color-warning) 25%, transparent)" },
};

const MODULES = [
  { id: "ai-agents", title: "AI 智能体", desc: "智能对话 · 文档分析 · 知识检索", icon: Rocket, path: "/ai-agents", wide: true },
  { id: "informatics", title: "信息学竞赛", desc: "笔记管理 · 题库练习 · GitHub 同步", icon: BookOpen, path: "/informatics", wide: false },
  { id: "it-technology", title: "信息技术", desc: "Python 编程 · ML 实验 · Agent 开发", icon: Laptop, path: "/it-technology", wide: false },
  { id: "personal-programs", title: "个人项目", desc: "程序展示 · 项目管理", icon: LayoutGrid, path: "/personal-programs", wide: false },
  { id: "articles", title: "文章", desc: "技术分享 · 知识沉淀", icon: FileText, path: "/articles", wide: true },
];

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [navVisibleMap, setNavVisibleMap] = React.useState<Record<string, boolean>>({});

  const externalLinks = [
    { title: "Dify AI 平台", desc: "AI 智能体开发与部署平台", url: config.difyUrl, icon: Rocket, color: "var(--ws-color-primary)" },
    { title: "NAS 文件服务", desc: "网络附加存储管理", url: config.nasUrl, icon: Database, color: "var(--ws-color-info)" },
  ].filter((l) => l.url);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const pairs = await Promise.all(NAV_VISIBILITY_ITEMS.map(async (it) => {
        try { const res = await featureFlagsApi.getPublic(it.flagKey); return [it.path, res?.value?.enabled !== false] as const; }
        catch { return [it.path, true] as const; }
      }));
      if (!mounted) return;
      const next: Record<string, boolean> = {};
      for (const [path, visible] of pairs) next[path] = visible;
      setNavVisibleMap(next);
    })();
    return () => { mounted = false; };
  }, []);

  const visibleModules = useMemo(() => {
    if (Object.keys(navVisibleMap).length === 0) return MODULES;
    return MODULES.filter((m) => {
      const item = NAV_VISIBILITY_ITEMS.find((n) => n.id === m.id);
      return !item || navVisibleMap[item.path] !== false;
    });
  }, [navVisibleMap]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return "夜深了，注意休息";
    if (h < 11) return "早上好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  })();

  const role = auth.user?.role_code;
  const roleLabel = role === "super_admin" ? "超级管理员" : role === "admin" ? "管理员" : role === "teacher" ? "教师" : null;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* ═══ Hero ═══ */}
      <section className="home-hero relative flex items-center justify-center overflow-hidden" style={{ minHeight: "calc(100vh - var(--ws-header-height))" }}>
        {/* Decorative blobs */}
        <div className="home-hero-blob home-hero-blob-1" />
        <div className="home-hero-blob home-hero-blob-2" />
        <div className="home-hero-blob home-hero-blob-3" />

        <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-white/10 backdrop-blur text-white/80 text-sm">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            探索 · 学习 · 创造
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight leading-tight">
            WangSh <span className="text-white/60">学习平台</span>
          </h1>

          {auth.isLoggedIn() ? (
            <div className="text-white/70 text-lg mb-8">
              {greeting}，{auth.getDisplayName() || "同学"}
              {roleLabel && <Badge variant="outline" className="ml-2 text-white/80 border-white/30">{roleLabel}</Badge>}
            </div>
          ) : (
            <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
              课程、训练与工具入口 — 从 AI 智能体到 Python 编程，一站式学习平台
            </p>
          )}

          <div className="flex items-center justify-center gap-4">
            {!auth.isLoggedIn() ? (
              <button onClick={() => navigate("/login")} className="home-hero-btn home-hero-btn-primary">
                开始探索
              </button>
            ) : (
              <button onClick={() => navigate("/ai-agents")} className="home-hero-btn home-hero-btn-primary">
                开始学习
              </button>
            )}
            {auth.isStaff() && (
              <button onClick={() => navigate("/admin/dashboard")} className="home-hero-btn home-hero-btn-secondary">
                管理后台
              </button>
            )}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 animate-bounce">
          <ChevronDown className="h-6 w-6" />
        </div>
      </section>

      {/* ═══ Modules ═══ */}
      <section className="py-16 md:py-24 px-4 md:px-8" style={{ background: "var(--ws-color-bg)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-3">探索模块</h2>
            <p className="text-text-secondary">选择你感兴趣的领域开始学习</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {visibleModules.map((mod) => {
              const c = MODULE_COLORS[mod.id] ?? { accent: "var(--ws-color-text-secondary)", bg: "transparent", ring: "transparent" };
              const Icon = mod.icon;
              return (
                <button
                  key={mod.id}
                  onClick={() => navigate(mod.path)}
                  className={`home-card group text-left ${mod.wide ? "md:col-span-2" : ""}`}
                >
                  <div className="home-card-accent" style={{ background: c.accent }} />
                  <div className="flex gap-4 items-start">
                    <div className="home-card-icon shrink-0" style={{ background: c.bg }}>
                      <Icon className="h-6 w-6" style={{ color: c.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-1">{mod.title}</h3>
                      <p className="text-sm text-text-secondary leading-relaxed">{mod.desc}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 text-text-tertiary group-hover:text-[var(--ws-color-accent)] transition-all group-hover:translate-x-1" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ External Tools ═══ */}
      {externalLinks.length > 0 && (
        <section className="py-12 md:py-16 px-4 md:px-8" style={{ background: "var(--ws-color-surface-2)" }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold tracking-tight mb-2">工具与服务</h2>
              <p className="text-text-secondary">连接外部平台与资源</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {externalLinks.map((link, i) => (
                <button
                  key={i}
                  onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
                  className="home-tool-card group flex items-center gap-4"
                >
                  <div className="home-tool-strip" style={{ background: link.color }} />
                  <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `color-mix(in srgb, ${link.color} 12%, transparent)`, color: link.color }}>
                    <link.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{link.title}</div>
                    <div className="text-xs text-text-secondary mt-0.5">{link.desc}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-text-tertiary group-hover:text-[var(--ws-color-accent)] transition-all group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ Footer ═══ */}
      <footer className="py-8 text-center text-xs text-text-tertiary" style={{ background: "var(--ws-color-surface)" }}>
        WangSh 学习平台 · v1.5.12
      </footer>
    </div>
  );
};

export default HomePage;
