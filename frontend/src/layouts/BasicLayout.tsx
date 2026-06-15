import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation, NavLink } from "react-router-dom";
import {
  Home,
  Bot,
  Code,
  Laptop,
  LayoutGrid,
  FileText,
  Menu as MenuIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "./BasicLayout.css";
import useAuth from "@hooks/useAuth";
import { UserMenu } from "@components/Auth";
import { PageTransitionShell } from "@/components/Common/PageTransitionShell";
import { logger } from "@services/logger";
import { featureFlagsApi } from "@/services/system/featureFlags";
import { NAV_VISIBILITY_ITEMS } from "@/constants/navVisibility";

import { useBreakpoint } from "@hooks/useBreakpoint";
import { getAuthExpiredReason } from "@/lib/auth-expired";

// 这些页面需要 overflow:hidden + flex-col（子页面自己处理滚动）
const FULL_HEIGHT_PATHS = [
  /^\/home(\/|$)/,
  /^\/ai-agents(\/|$)/,
  /^\/articles(\/|$)/,
  /^\/informatics(\/|$)/,
  /^\/it-technology(\/|$)/,
  /^\/xbk(\/|$)/,
];

// 导航项配置
const NAV_ITEMS = [
  { key: "/home", icon: Home, label: "首页" },
  { key: "/ai-agents", icon: Bot, label: "AI智能体" },
  { key: "/informatics", icon: Code, label: "信息学竞赛" },
  { key: "/it-technology", icon: Laptop, label: "信息技术" },
  { key: "/personal-programs", icon: LayoutGrid, label: "个人程序" },
  { key: "/articles", icon: FileText, label: "文章" },
];

const BasicLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const {
    isLoading,
    isAuthenticated,
    user,
    error,
    getToken,
    isLoggedIn,
  } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navVisibleMap, setNavVisibleMap] = useState<Record<string, boolean>>({});

  const authError = String(error || "").trim();
  const authExpiredBannerReason = authError || getAuthExpiredReason();

  const isFullHeight = FULL_HEIGHT_PATHS.some((re) => re.test(location.pathname));
  const isHomePage = /^\/home(\/|$)/.test(location.pathname);

  useEffect(() => {
    logger.debug("BasicLayout - 认证状态:", {
      isLoading, isAuthenticated, isLoggedIn: isLoggedIn(), user,
      token: getToken() ? "[exists]" : "[null]",
    });
  }, [isLoading, isAuthenticated, user, isLoggedIn, getToken]);


  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
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

  const visibleNavItems = NAV_ITEMS.filter(
    (it) => navVisibleMap[it.key] !== false
  );

  const isNavItemActive = (key: string) =>
    location.pathname === key || location.pathname.startsWith(key + "/");


  return (
    <div className={cn("basic-layout", isHomePage && "home-page")}>
      {/* Home page nav hover trigger */}
      {isHomePage && <div className="nav-trigger" />}
      {/* 顶部导航栏 */}
      <header className="top-header">
        <div className="top-header-inner">
          <div className="header-left">
            {/* Logo */}
            <button
              type="button"
              className="logo appearance-none border-0 bg-transparent p-0 text-left"
              onClick={() => void navigate("/")}
              aria-label="返回首页"
            >
              <div className="logo-icon">W</div>
              {!isMobile && (
                <span className="logo-text">WangSh</span>
              )}
            </button>

            {/* 桌面端导航 */}
            {!isMobile && (
              <nav className="horizontal-menu">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isNavItemActive(item.key);
                  return (
                    <NavLink
                      key={item.key}
                      to={item.key}
                      className={cn(
                        "nav-item appearance-none border-0",
                        isActive && "nav-item-active"
                      )}
                    >
                      <Icon className="nav-icon" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            )}
          </div>

          <div className="header-right">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className="mobile-menu-btn"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="打开菜单"
              >
                <MenuIcon className="h-5 w-5" />
              </Button>
            )}
            <UserMenu
              showName={!isMobile}
              onMenuClick={(key) => { if (key === "login") navigate("/login"); }}
            />
          </div>
        </div>
      </header>

      {/* 移动端侧边栏菜单 */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle>导航菜单</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col py-2">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActive(item.key);
              return (
                <NavLink
                  key={item.key}
                  to={item.key}
                  className={cn(
                    "appearance-none border-0 flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    isActive
                      ? "text-primary bg-primary/5 border-r-2 border-primary"
                      : "text-muted-foreground"
                  )}
                  onClick={() => {
                    setMobileMenuOpen(false);
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {/* 内容区域 — 统一两种模式 */}
      <main
        className={cn("main-content", isFullHeight && "main-content--full-height")}
        style={isFullHeight ? {
          paddingTop: 0,
          paddingBottom: 0,
          paddingLeft: isHomePage ? 0 : "var(--ws-space-3)",
          paddingRight: isHomePage ? 0 : "var(--ws-space-3)",
          margin: 0,
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          width: "100%",
        } : undefined}
      >
        {authExpiredBannerReason ? (
          <div className="mx-4 mt-4 flex flex-col gap-3 rounded-xl border border-[color:var(--ws-color-error)]/20 bg-[var(--ws-color-error-soft)] px-4 py-3 text-sm text-[color:var(--ws-color-error)] sm:flex-row sm:items-center sm:justify-between">
            <div className="font-medium">{authExpiredBannerReason}</div>
            {!isLoggedIn() ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full border-[color:var(--ws-color-error)]/30 text-[color:var(--ws-color-error)] hover:bg-[color:var(--ws-color-error)]/5 sm:w-auto"
                onClick={() => navigate("/login")}
              >
                重新登录
              </Button>
            ) : null}
          </div>
        ) : null}
        <PageTransitionShell variant="fade">
          <Outlet />
        </PageTransitionShell>
      </main>
    </div>
  );
};

export default BasicLayout;
