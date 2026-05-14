import React, { useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Rocket, BookOpen, Laptop, LayoutGrid, FileText,
  Database, User,
} from "lucide-react";
import { config } from "@services";
import useAuth from "@hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { featureFlagsApi } from "@/services/system/featureFlags";
import { NAV_VISIBILITY_ITEMS } from "@/constants/navVisibility";

const MODULES = [
  { id: "ai-agents", title: "AI 智能体", icon: Rocket, path: "/ai-agents", color: "var(--ws-color-primary)" },
  { id: "informatics", title: "信息学竞赛", icon: BookOpen, path: "/informatics", color: "var(--ws-color-purple)" },
  { id: "it-technology", title: "信息技术", icon: Laptop, path: "/it-technology", color: "var(--ws-color-info)" },
  { id: "personal-programs", title: "个人项目", icon: LayoutGrid, path: "/personal-programs", color: "var(--ws-color-success)" },
  { id: "articles", title: "文章", icon: FileText, path: "/articles", color: "var(--ws-color-warning)" },
];

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [navVisibleMap, setNavVisibleMap] = React.useState<Record<string, boolean>>({});

  const externalLinks = [
    { title: "Dify AI", url: config.difyUrl, icon: Rocket, color: "var(--ws-color-primary)" },
    { title: "NAS", url: config.nasUrl, icon: Database, color: "var(--ws-color-info)" },
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
    <div className="home-page-wrapper home-hero relative flex flex-col items-center justify-center overflow-hidden" style={{ minHeight: "calc(100vh - var(--ws-header-height))" }}>
      {/* Decorative blobs */}
      <div className="home-hero-blob home-hero-blob-1" />
      <div className="home-hero-blob home-hero-blob-2" />
      <div className="home-hero-blob home-hero-blob-3" />

      {/* ═══ Main content ═══ */}
      <div className="relative z-10 text-center px-6 max-w-2xl mx-auto flex flex-col items-center">
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-white/10 backdrop-blur text-white/80 text-sm">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          探索 · 学习 · 创造
        </div>

        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight leading-tight">
          WangSh <span className="text-white/60">学习平台</span>
        </h1>

        {auth.isLoggedIn() ? (
          <div className="text-white/70 text-lg mb-6">
            {greeting}，{auth.getDisplayName() || "同学"}
            {roleLabel && <Badge variant="outline" className="ml-2 text-white/80 border-white/30">{roleLabel}</Badge>}
          </div>
        ) : (
          <p className="text-white/60 text-lg mb-6 max-w-lg leading-relaxed">
            课程、训练与工具入口 — 从 AI 智能体到 Python 编程
          </p>
        )}

        {/* ═══ Module pills ═══ */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {visibleModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => navigate(mod.path)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border-0 cursor-pointer"
                style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.85)"; }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: mod.color }} />
                {mod.title}
              </button>
            );
          })}
        </div>

        {/* ═══ External tools ═══ */}
        <div className="flex items-center justify-center gap-6 text-sm">
          {externalLinks.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full no-underline transition-all"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.16)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
            >
              <link.icon className="h-4 w-4" style={{ color: link.color }} />
              {link.title}
            </a>
          ))}
          <span className="text-white/20">v1.5.12</span>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
