/**
 * 后端管理页面
 * 只有超级管理员可以访问
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Cable,
  CircleCheck,
  Clock3,
  Database,
  Loader2,
  RotateCcw,
  Settings,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import useAuth from "@hooks/useAuth";
import { logger } from "@services/logger";

// 用户数据接口
interface UserData {
  id: number;
  username: string;
  is_active: boolean;
  is_superuser: boolean;
  full_name: string;
  created_at: string;
}

// 系统统计接口
interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  superAdmins: number;
  databaseSize: string;
  uptime: string;
  apiRequests: number;
}

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    activeUsers: 0,
    superAdmins: 0,
    databaseSize: "0 MB",
    uptime: "0分钟",
    apiRequests: 0,
  });

  // 加载用户数据
  const loadUserData = useCallback(async () => {
    try {
      // 这里应该调用API获取用户列表，暂时模拟数据
      const mockUsers: UserData[] = [
        {
          id: 1,
          username: "admin",
          is_active: true,
          is_superuser: true,
          full_name: "系统超级管理员",
          created_at: "2026-02-03T05:57:37.780150Z",
        },
        {
          id: 2,
          username: "user1",
          is_active: true,
          is_superuser: false,
          full_name: "普通用户1",
          created_at: "2026-02-03T06:00:00.000000Z",
        },
        {
          id: 3,
          username: "user2",
          is_active: false,
          is_superuser: false,
          full_name: "普通用户2",
          created_at: "2026-02-03T06:30:00.000000Z",
        },
      ];

      setUsers(mockUsers);

      // 计算统计信息
      setStats({
        totalUsers: mockUsers.length,
        activeUsers: mockUsers.filter((u) => u.is_active).length,
        superAdmins: mockUsers.filter((u) => u.is_superuser).length,
        databaseSize: "7.7 MB", // 从API获取实际数据
        uptime: "约1小时", // 从API获取实际数据
        apiRequests: 1245, // 从API获取实际数据
      });

      setLoading(false);
    } catch (error) {
      logger.error("加载用户数据失败:", error);
      setLoading(false);
    }
  }, []);

  // 检查权限 - 如果不是超级管理员，重定向到首页
  useEffect(() => {
    if (!auth.isLoading && !auth.isSuperAdmin()) {
      navigate("/home");
    }
  }, [auth.isLoading, auth.isSuperAdmin, navigate]);

  // 初始化加载
  useEffect(() => {
    if (auth.isSuperAdmin && auth.isSuperAdmin()) {
      loadUserData();
    }
  }, [auth.isSuperAdmin, loadUserData]);

  const userColumns = useMemo<ColumnDef<UserData>[]>(
    () => [
      {
        id: "id",
        header: "用户ID",
        accessorKey: "id",
        size: 80,
        meta: { className: "w-[80px] align-top" },
      },
      {
        id: "username",
        header: "用户名",
        accessorKey: "username",
        size: 120,
        meta: { className: "w-[120px] align-top" },
      },
      {
        id: "full_name",
        header: "全名",
        accessorKey: "full_name",
        size: 150,
        meta: { className: "w-[150px] align-top" },
      },
      {
        id: "status",
        header: "状态",
        size: 180,
        meta: { className: "w-[180px] align-top" },
        cell: ({ row }) => {
          const record = row.original;
          return (
            <div className="flex items-center gap-2">
              {record.is_active ? (
                <Badge variant="success">
                  <CircleCheck className="h-3 w-3" />
                  活跃
                </Badge>
              ) : (
                <Badge variant="danger">
                  <TriangleAlert className="h-3 w-3" />
                  禁用
                </Badge>
              )}
              {record.is_superuser ? (
                <Badge variant="purple">
                  <ShieldCheck className="h-3 w-3" />
                  管理员
                </Badge>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "created_at",
        header: "创建时间",
        accessorKey: "created_at",
        size: 180,
        meta: { className: "w-[180px] align-top" },
        cell: ({ row }) => new Date(row.original.created_at).toLocaleString("zh-CN"),
      },
      {
        id: "action",
        header: "操作",
        size: 150,
        meta: { className: "w-[150px] align-top" },
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button variant="link" size="sm">
              编辑
            </Button>
            <Button variant="link" size="sm" className="text-destructive">
              {row.original.is_active ? "禁用" : "启用"}
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const userTable = useReactTable({
    data: users,
    columns: userColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  // 如果正在加载或不是管理员，显示加载中
  if (auth.isLoading || loading) {
    return (
      <div className="text-center py-24">
        <div className="inline-flex items-center gap-2 text-text-tertiary">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>加载管理员面板...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="admin-page mx-auto max-w-[1400px] bg-[var(--ws-color-bg)] p-[var(--ws-space-4)]"
    >
      {/* 权限警告 */}
      {!auth.isSuperAdmin() && (
        <Alert variant="destructive" className="mb-6">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>权限不足</AlertTitle>
          <AlertDescription>您没有权限访问后端管理页面。只有超级管理员可以访问此页面。</AlertDescription>
        </Alert>
      )}

      {/* 系统概览统计卡片 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-surface-2 p-5">
          <div className="mb-1 flex items-center gap-2 text-sm text-text-tertiary">
            <Users className="h-4 w-4 text-primary" />
            总用户数
          </div>
          <div className="text-2xl font-semibold text-primary">{stats.totalUsers}</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-5">
          <div className="mb-1 flex items-center gap-2 text-sm text-text-tertiary">
            <CircleCheck className="h-4 w-4 text-[var(--ws-color-success)]" />
            活跃用户
          </div>
          <div className="text-2xl font-semibold text-[var(--ws-color-success)]">{stats.activeUsers}</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-5">
          <div className="mb-1 flex items-center gap-2 text-sm text-text-tertiary">
            <ShieldCheck className="h-4 w-4 text-[var(--ws-color-info)]" />
            管理员数量
          </div>
          <div className="text-2xl font-semibold text-[var(--ws-color-info)]">{stats.superAdmins}</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-5">
          <div className="mb-1 flex items-center gap-2 text-sm text-text-tertiary">
            <Database className="h-4 w-4 text-[var(--ws-color-warning)]" />
            数据库大小
          </div>
          <div className="text-2xl font-semibold text-[var(--ws-color-warning)]">{stats.databaseSize}</div>
        </div>
      </div>

      {/* 管理功能标签页 */}
      <div className="border-t border-border-secondary pt-6">
        <Tabs defaultValue="users">
          <TabsList className="mb-4">
            <TabsTrigger value="users">
              <Users className="mr-1.5 h-4 w-4" />
              用户管理
            </TabsTrigger>
            <TabsTrigger value="api">
              <Cable className="mr-1.5 h-4 w-4" />
              API 管理
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-1.5 h-4 w-4" />
              系统设置
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-0">
            <div className="rounded-xl bg-surface-2 p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-base font-semibold">用户列表</span>
                <Button>
                  <Users className="h-4 w-4" />
                  添加用户
                </Button>
              </div>
              <div className="overflow-auto rounded-md border border-border bg-surface">
                <DataTable table={userTable} tableClassName="min-w-[800px]" />
              </div>
              <div className="mt-3 text-sm text-text-tertiary">共 {users.length} 条</div>
            </div>
          </TabsContent>

          <TabsContent value="api" className="mt-0">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl bg-surface-2 p-6">
                <div className="mb-4 text-base font-semibold">API 统计</div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary">总请求数</span>
                    <Badge variant="sky">
                      {stats.apiRequests}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary">服务状态</span>
                    <Badge variant="success">
                      <CircleCheck className="h-3 w-3" />
                      正常运行
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary">运行时间</span>
                    <Badge variant="cyan">
                      <Clock3 className="h-3 w-3" />
                      {stats.uptime}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-surface-2 p-6">
                <div className="mb-4 text-base font-semibold">API 配置</div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary">JWT 有效期</span>
                    <span>8天 (11520分钟)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary">API 版本</span>
                    <span>v1.0.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary">调试模式</span>
                    <Badge
                      variant={process.env.NODE_ENV === "development" ? "warning" : "success"}
                    >
                      {process.env.NODE_ENV === "development" ? "已启用" : "已禁用"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <div className="rounded-xl bg-surface-2 p-6">
              <div className="mb-4 text-base font-semibold">系统配置</div>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
                  <span className="text-text-tertiary">后端服务</span>
                  <Badge variant="sky">
                    {window.location.origin}/api/v1
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
                  <span className="text-text-tertiary">前端服务</span>
                  <Badge variant="success">
                    {window.location.origin}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
                  <span className="text-text-tertiary">数据库</span>
                  <Badge variant="purple">
                    PostgreSQL 15.15
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
                  <span className="text-text-tertiary">Redis</span>
                  <Badge variant="danger">
                    redis://localhost:6379
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
                  <span className="text-text-tertiary">环境变量</span>
                  <Button variant="link" size="sm">查看 .env 配置</Button>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
                  <span className="text-text-tertiary">系统重启</span>
                  <Button variant="outline" size="sm">
                    <RotateCcw className="h-4 w-4" />
                    重启后端服务
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 管理员信息 */}
      <div className="border-t border-border-secondary mt-6 pt-6">
        <div className="bg-surface-2 rounded-xl p-6">
          <div className="text-base font-semibold mb-4">当前管理员信息</div>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <div className="text-xs text-text-tertiary">用户名</div>
              <div>{auth.user?.username}</div>
            </div>
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <div className="text-xs text-text-tertiary">全名</div>
              <div>{auth.user?.full_name || "未设置"}</div>
            </div>
            <div className="rounded-md border border-border bg-surface px-3 py-2 md:col-span-2">
              <div className="text-xs text-text-tertiary mb-1">权限级别</div>
              <Badge variant="purple">
                <ShieldCheck className="h-3 w-3" />
                超级管理员
              </Badge>
            </div>
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <div className="text-xs text-text-tertiary">账户创建时间</div>
              <div>
                {auth.user?.created_at
                  ? new Date(auth.user.created_at).toLocaleString("zh-CN")
                  : "未知"}
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <div className="text-xs text-text-tertiary">最后登录</div>
              <div>刚刚</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AdminPage;
