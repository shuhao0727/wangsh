import { showMessage } from "@/lib/toast";
import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AppWindow,
  Bot,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Code2,
  Database,
  FileText,
  Home,
  Laptop,
  LayoutDashboard,
  ListOrdered,
  Lock,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  Settings,
  Sun,
  User,
  Users,
  Zap,
} from "lucide-react";
import useAuth from "@hooks/useAuth";
import useAppMeta from "@hooks/useAppMeta";
import { useBreakpoint } from "@hooks/useBreakpoint";
import { useDarkMode } from "@hooks/useDarkMode";
import { Breadcrumbs } from "@/components/Common/Breadcrumbs";
import { PageTransitionShell } from "@/components/Common/PageTransitionShell";

type AdminMenuItem = {
  key: string;
  icon: React.ReactNode;
  label: string;
  children?: AdminMenuItem[];
};

const agentPaths = [
  "/admin/ai-agents",
  "/admin/users",
  "/admin/agent-data",
  "/admin/group-discussion",
  "/admin/assessment",
  "/admin/classroom-interaction",
  "/admin/classroom-plan",
];

const adminMenuItems: AdminMenuItem[] = [
  {
    key: "/admin/dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
    label: "状态概览",
  },
  {
    key: "/admin/agents",
    icon: <Bot className="h-4 w-4" />,
    label: "智能体",
    children: [
      { key: "/admin/ai-agents", icon: <Bot className="h-4 w-4" />, label: "AI智能体管理" },
      { key: "/admin/users", icon: <Users className="h-4 w-4" />, label: "用户管理" },
      { key: "/admin/agent-data", icon: <Database className="h-4 w-4" />, label: "智能体数据" },
      { key: "/admin/group-discussion", icon: <Monitor className="h-4 w-4" />, label: "小组讨论" },
      { key: "/admin/assessment", icon: <ClipboardCheck className="h-4 w-4" />, label: "自适应测评" },
      { key: "/admin/classroom-interaction", icon: <Zap className="h-4 w-4" />, label: "课堂互动" },
      { key: "/admin/classroom-plan", icon: <ListOrdered className="h-4 w-4" />, label: "课堂计划" },
    ],
  },
  { key: "/admin/informatics", icon: <Code2 className="h-4 w-4" />, label: "信息学竞赛" },
  { key: "/admin/it-technology", icon: <Laptop className="h-4 w-4" />, label: "信息技术" },
  { key: "/admin/personal-programs", icon: <AppWindow className="h-4 w-4" />, label: "个人程序" },
  { key: "/admin/articles", icon: <FileText className="h-4 w-4" />, label: "文章管理" },
  { key: "/admin/system", icon: <Settings className="h-4 w-4" />, label: "系统设置" },
];

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { isDark, toggle: toggleDark } = useDarkMode();

  const [collapsed, setCollapsed] = useState(false);
  const { version, envLabel } = useAppMeta();

  const path = location.pathname;
  const selectedKey = path === "/admin" || path === "/admin/" ? "/admin/dashboard" : path;
  const inAgentGroup = agentPaths.some((p) => path.startsWith(p));
  const [agentsOpen, setAgentsOpen] = useState(inAgentGroup);

  useEffect(() => {
    if (inAgentGroup) setAgentsOpen(true);
  }, [inAgentGroup]);

  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile]);

  // Role-based menu item keys: super_admin sees all, admin excludes system/articles, teacher sees teaching only
  const menuWhitelist = useMemo(() => {
    if (auth.isSuperAdmin()) return null; // null = show all
    if (auth.isAdmin()) return new Set([
      "/admin/dashboard", "/admin/ai-agents", "/admin/users",
      "/admin/agent-data", "/admin/group-discussion", "/admin/assessment",
      "/admin/classroom-interaction", "/admin/classroom-plan",
    ]);
    if (auth.isTeacher()) return new Set([
      "/admin/dashboard",
      "/admin/classroom-interaction", "/admin/classroom-plan",
      "/admin/assessment", "/admin/group-discussion",
      "/admin/informatics", "/admin/it-technology",
    ]);
    return new Set<string>();
  }, [auth]);

  const visibleMenuItems = useMemo(() => {
    if (!menuWhitelist) return adminMenuItems;
    return adminMenuItems
      .map((item) => {
        if (item.children) {
          const filtered = item.children.filter((c) => menuWhitelist.has(c.key));
          if (filtered.length === 0) return null;
          return { ...item, children: filtered };
        }
        return menuWhitelist.has(item.key) ? item : null;
      })
      .filter((item): item is AdminMenuItem => item !== null);
  }, [menuWhitelist]);

  const flatItems = useMemo(() => {
    const result: AdminMenuItem[] = [];
    visibleMenuItems.forEach((item) => {
      if (item.children) result.push(...item.children);
      else result.push(item);
    });
    return result;
  }, [visibleMenuItems]);

  const currentTitle =
    flatItems.find((item) => item.key === path)?.label || "管理后台";

  const ROLE_LABELS: Record<string, string> = { super_admin: "超级管理员", admin: "管理员", teacher: "教师", student: "学生用户" };
  const roleLabel = ROLE_LABELS[auth.user?.role_code || ""] || "访客";

  const sidebarExpandedWidth = "var(--ws-sidebar-width)";
  const sidebarCollapsedWidth = "var(--ws-sidebar-collapsed-width)";
  const sidebarWidth = isMobile ? sidebarExpandedWidth : collapsed ? sidebarCollapsedWidth : sidebarExpandedWidth;
  const contentMarginLeft = isMobile ? 0 : collapsed ? sidebarCollapsedWidth : sidebarExpandedWidth;

  const renderMenuButton = (item: AdminMenuItem) => {
    const active = selectedKey.startsWith(item.key);
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => {
          void navigate(item.key);
          if (isMobile) setCollapsed(true);
        }}
        className={`appearance-none border-0 bg-transparent flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ws-color-focus-ring)] ${
          active
            ? "bg-primary-soft text-primary shadow-[inset_3px_0_0_var(--ws-color-accent)]"
            : "text-text-secondary hover:bg-[var(--ws-color-primary-muted)]"
        }`}
        title={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
      >
        <span className="shrink-0">{item.icon}</span>
        <span className={cn("truncate transition-opacity duration-150", collapsed ? "opacity-0 w-0" : "opacity-100")}>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="h-screen overflow-hidden bg-surface">
      {isMobile && !collapsed ? (
        <div
          className="fixed inset-0 z-[var(--ws-z-overlay)] bg-black/30"
          onClick={() => setCollapsed(true)}
        />
      ) : null}

      <aside
        role="navigation" aria-label="管理导航"
        className="fixed left-0 top-0 bottom-0 z-[var(--ws-z-header)] border-r border-border-secondary transition-[transform,box-shadow] duration-200"
        style={{
          background: "linear-gradient(180deg, var(--ws-color-surface-2), var(--ws-color-surface))",
          width: sidebarWidth,
          transform: isMobile && collapsed ? "translateX(-100%)" : "translateX(0)",
          boxShadow: isMobile ? "var(--ws-shadow-xl)" : "none",
        }}
      >
        <button
          type="button"
          className="flex w-full appearance-none items-center gap-2.5 border-0 bg-transparent px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ws-color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={() => void navigate("/admin/dashboard")}
          aria-label="返回管理后台首页"
        >
          <div
            className="grid h-8 w-8 shrink-0 place-content-center rounded-lg text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, var(--ws-color-primary) 0%, var(--ws-color-purple) 100%)" }}
          >
            W
          </div>
          {!collapsed ? (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-text-base">管理后台</span>
              {envLabel ? <span className="text-xs text-text-tertiary">{envLabel}</span> : null}
            </div>
          ) : null}
        </button>

        <div className="mx-4 mb-2 h-px bg-border-secondary" />

        <div className="h-[calc(100%-148px)] overflow-y-auto px-3 pb-3">
          <div className="space-y-1">
            {visibleMenuItems.map((item) => {
              if (!item.children) return renderMenuButton(item);
              return (
                <div key={item.key} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (collapsed) {
                        void navigate(item.children?.[0]?.key || "/admin/ai-agents");
                        if (isMobile) setCollapsed(true);
                        return;
                      }
                      setAgentsOpen((v) => !v);
                    }}
                    className={`appearance-none border-0 bg-transparent flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ws-color-focus-ring)] ${
                      inAgentGroup
                        ? "bg-primary-soft text-primary"
                        : "text-text-secondary hover:bg-[var(--ws-color-hover-bg)]"
                    }`}
                    aria-expanded={agentsOpen} aria-controls="agents-submenu"
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed ? (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {agentsOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                      </>
                    ) : null}
                  </button>
                  <div id="agents-submenu" role="group" aria-label="智能体子菜单"
                    className={cn(
                      "grid transition-[grid-template-rows] duration-200 ml-6",
                      !collapsed && agentsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    )}>
                    <div className="overflow-hidden">
                      <div className="space-y-1">
                        {item.children.map((child) => renderMenuButton(child))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 border-t border-border-secondary px-3 py-2.5">
          {!collapsed ? (
            <div className="mb-2 flex items-center gap-2">
              <Avatar className="h-7 w-7 shrink-0 bg-primary/10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-text-base">
                  {auth.user?.full_name || auth.user?.username || "管理员"}
                </div>
                <div className="truncate text-xs text-text-tertiary">{roleLabel}</div>
              </div>
            </div>
          ) : (
            <div className="mb-2 flex justify-center">
              <Avatar className="h-7 w-7 bg-primary/10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full text-xs text-text-secondary"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "展开侧栏" : "折叠侧栏"}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed ? "收起" : null}
          </Button>
        </div>
      </aside>

      <div
        className="flex h-full min-h-0 flex-col transition-[margin-left] duration-200 ease-out motion-reduce:transition-none"
        style={{ marginLeft: contentMarginLeft }}
      >
        <header
          className="sticky top-0 z-[var(--ws-z-sticky)] flex items-center justify-between border-b border-border-secondary bg-surface px-4 md:px-6"
          style={{ height: "var(--ws-header-height)" }}
        >
          <div className="flex items-center gap-3">
            {isMobile ? (
              <Button variant="ghost" size="icon" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? "展开侧栏" : "折叠侧栏"}>
                <Menu className="h-4 w-4" />
              </Button>
            ) : null}
            <span className="font-semibold text-text-base" style={{ fontSize: "var(--ws-text-nav)" }}>
              {currentTitle}
            </span>
            {version ? (
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">
                v{version}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDark}
              aria-label="切换暗色模式"
              title={isDark ? "切换亮色模式" : "切换暗色模式"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {auth.isLoggedIn() && auth.isStaff() ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="admin-user-menu appearance-none border-0 bg-transparent flex items-center gap-2 rounded-lg px-2 py-1 text-text-base"
                  >
                    <Avatar className="h-7 w-7 shrink-0 bg-primary/10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm font-medium sm:inline">
                      {auth.user?.full_name || auth.user?.username || "管理员"}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8}>
                  <DropdownMenuItem onClick={() => void navigate("/admin/users")}>
                    <User className="mr-2 h-4 w-4" />
                    管理员资料
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => window.location.href = "/login"}>
                    <Home className="mr-2 h-4 w-4" />
                    返回首页
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={async () => {
	                      await auth.logout();
	                      showMessage.success("已退出登录");
	                      window.location.href = "/login";
	                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button size="sm" onClick={() => navigate("/login")}>
                管理员登录
              </Button>
            )}
          </div>
        </header>

        <main
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          style={{ height: "calc(100dvh - var(--ws-header-height))" }}
        >
          {auth.isLoggedIn() && auth.isStaff() ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <Breadcrumbs />
              <PageTransitionShell variant="fade">
                <Outlet key={location.pathname} />
              </PageTransitionShell>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <Lock className="h-12 w-12 text-text-tertiary" />
              <h3 className="text-xl font-semibold">需要教职工权限</h3>
              <p className="text-sm text-text-tertiary">只有管理员可以访问此页面</p>
              <Button onClick={() => navigate("/login")}>管理员登录</Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
