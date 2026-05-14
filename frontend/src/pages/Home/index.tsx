import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Rocket, BookOpen, Laptop, LayoutGrid, FileText,
  Database,
} from "lucide-react";
import { config } from "@services";
import useAuth from "@hooks/useAuth";
import { useNavigate } from "react-router-dom";

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

  const externalLinks = [
    { title: "Dify AI", url: config.difyUrl, icon: Rocket, color: "var(--ws-color-primary)" },
    { title: "NAS", url: config.nasUrl, icon: Database, color: "var(--ws-color-info)" },
  ].filter((l) => l.url);

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
    <div className="home-hero relative flex flex-col items-center justify-center overflow-hidden" style={{ minHeight: "100vh" }}>
      {/* Decorative blobs */}
      <div className="home-hero-blob home-hero-blob-1" />
      <div className="home-hero-blob home-hero-blob-2" />
      <div className="home-hero-blob home-hero-blob-3" />

      {/* Main content */}
      <div className="relative z-10 text-center px-6 max-w-2xl mx-auto flex flex-col items-center">
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
          <p className="text-white/60 text-lg mb-8 max-w-lg leading-relaxed">
            课程、训练与工具入口 — 从 AI 智能体到 Python 编程
          </p>
        )}

        {/* Module pills */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => navigate(mod.path)}
                className="home-hero-module-pill"
              >
                <Icon className="h-3.5 w-3.5" style={{ color: mod.color }} />
                {mod.title}
              </button>
            );
          })}
        </div>

        {/* External tools */}
        <div className="flex items-center justify-center gap-6 text-sm flex-wrap">
          {externalLinks.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="home-hero-tool-link"
            >
              <link.icon className="h-5 w-5" style={{ color: link.color }} />
              {link.title}
            </a>
          ))}
          <span className="text-white/25 text-xs">v1.5.12</span>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
