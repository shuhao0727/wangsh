import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
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
import { showMessage } from "@/lib/toast";
import { cn } from "@/lib/utils";
import "./BasicLayout.css";
import useAuth from "@hooks/useAuth";
import { LoginForm, UserMenu } from "@components/Auth";
import { logger } from "@services/logger";
import { featureFlagsApi } from "@/services/system/featureFlags";
import { NAV_VISIBILITY_ITEMS } from "@/constants/navVisibility";

// 这些页面需要 overflow:hidden + flex-col（子页面自己处理滚动）
const FULL_HEIGHT_PATHS = [
  /^\/home(\/|$)/,
  /^\/ai-agents(\/|$)/,
  /^\/articles(\/|$)/,
  /^\/informatics(\/|$)/,
  /^\/it-technology(\/|$)/,
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

// 简单的响应式 hook
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

const BasicLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const {
    isLoading,
    isAuthenticated,
    user,
    getToken,
    isLoggedIn,
  } = useAuth();
  const [isLoginModalVisible, setIsLoginModalVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navVisibleMap, setNavVisibleMap] = useState<Record<string, boolean>>({});

  const isFullHeight = FULL_HEIGHT_PATHS.some((re) => re.test(location.pathname));

  useEffect(() => {
    logger.debug("BasicLayout - 认证状态:", {
      isLoading, isAuthenticated, isLoggedIn: isLoggedIn(), user,
      token: getToken() ? "[exists]" : "[null]",
    });
  }, [isLoading, isAuthenticated, user, isLoggedIn, getToken]);

  useEffect(() => {
    logger.debug("BasicLayout - 登录模态框状态:", isLoginModalVisible);
  }, [isLoginModalVisible]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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

  const visibleNavItems = NAV_ITEMS.filter(
    (it) => navVisibleMap[it.key] !== false
  );

  const handleLoginSuccess = () => {
    setIsLoginModalVisible(false);
    showMessage.success("登录成功！");
    navigate(0);
  };

  return (
    <div className="basic-layout">
      {/* 顶部导航栏 */}
      <header className="top-header">
        <div className="top-header-inner">
          <div className="header-left">
            {/* Logo */}
            <div className="logo" onClick={() => navigate("/")}>
              <div className="logo-icon">W</div>
              {!isMobile && (
                <h4 className="logo-text">WangSh</h4>
              )}
            </div>

            {/* 桌面端导航 */}
            {!isMobile && (
              <nav className="horizontal-menu">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.key ||
                    location.pathname.startsWith(item.key + "/");
                  return (
                    <button
                      key={item.key}
                      className={cn(
                        "nav-item appearance-none border-0",
                        isActive && "nav-item-active"
                      )}
                      onClick={() => navigate(item.key)}
                    >
                      <Icon className="nav-icon" />
                      <span>{item.label}</span>
                    </button>
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
              >
                <MenuIcon className="h-5 w-5" />
              </Button>
            )}
            <UserMenu onMenuClick={(key) => { if (key === "login") setIsLoginModalVisible(true); }} />
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
              const isActive = location.pathname === item.key ||
                location.pathname.startsWith(item.key + "/");
              return (
                <button
                  key={item.key}
                  className={cn(
                    "appearance-none border-0 flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    isActive
                      ? "text-primary bg-primary/5 border-r-2 border-primary"
                      : "text-muted-foreground"
                  )}
                  onClick={() => {
                    navigate(item.key);
                    setMobileMenuOpen(false);
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {/* 登录弹窗 */}
      <LoginForm
        visible={isLoginModalVisible}
        onClose={() => setIsLoginModalVisible(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* 内容区域 — 统一两种模式 */}
      <main
        className="main-content"
        style={isFullHeight ? {
          padding: 0,
          margin: 0,
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          width: "100%",
        } : undefined}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default BasicLayout;
