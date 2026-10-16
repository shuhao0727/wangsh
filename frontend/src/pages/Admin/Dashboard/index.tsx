import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  RefreshCw, CheckCircle, XCircle,
  Users, FileText, Bot, TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPage } from "@components/Admin";
import { StatCard } from "@components/Common/StatCard";
import { api, config } from "@services";
import useAuth, { AuthRequestGate } from "@hooks/useAuth";
import { canAccessRoles, SUPER_ADMIN_ROLES } from "@components/Auth/roleAccess";

const dot = (ok: boolean) => ok
  ? <span className="inline-block w-2 h-2 rounded-full bg-[var(--ws-color-success)]" role="status" aria-label="运行正常" />
  : <span className="inline-block w-2 h-2 rounded-full bg-[var(--ws-color-error)]" role="status" aria-label="异常" />;

interface StatusRowProps { label: string; value: React.ReactNode; ok?: boolean; }
const StatusRow: React.FC<StatusRowProps> = ({ label, value, ok }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-border-secondary">
    <div className="flex items-center gap-2">
      {ok !== undefined && dot(ok)}
      <span className="text-sm text-text-secondary">{label}</span>
    </div>
    <div className="text-sm font-medium text-text-base">{value ?? "-"}</div>
  </div>
);

interface Health {
  status?: string;
  checks?: { database?: string; redis?: string };
  system?: { timestamp?: string; version?: string; environment?: string };
}
interface Overview { counts?: { users?: number; articles?: number; agents?: number } }

const DashboardStatus: React.FC<{ canViewOverview: boolean }> = ({ canViewOverview }) => {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<Health | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [errorText, setErrorText] = useState("");
  const [overviewError, setOverviewError] = useState(false);
  const gate = useRef(new AuthRequestGate()).current;

  // No system query hook/key exists yet. Keep requests local rather than creating
  // an ad-hoc shared cache; the keyed parent owns their authenticated lifetime.
  const loadAll = useCallback(async () => {
    const request = gate.begin();
    setLoading(true);
    setErrorText("");
    setOverview(null);
    setOverviewError(false);
    // These endpoints return raw objects, not the generic ApiResponse envelope.
    const loadHealth = async () => {
      try {
        const response = await api.client.get<Health>("/health", { signal: request.signal });
        if (gate.isCurrent(request)) setHealth(response.data);
      } catch {
        if (gate.isCurrent(request)) {
          setErrorText("无法获取健康状态，请重试。");
          setHealth(null);
        }
      }
    };
    const loadOverview = async () => {
      if (!canViewOverview) return;
      try {
        const response = await api.client.get<Overview>("/system/overview", { signal: request.signal });
        if (gate.isCurrent(request)) setOverview(response.data);
      } catch {
        if (gate.isCurrent(request)) {
          setOverview(null);
          setOverviewError(true);
        }
      }
    };
    try {
      await Promise.all([loadHealth(), loadOverview()]);
    } finally {
      if (gate.isCurrent(request)) setLoading(false);
      gate.release(request);
    }
  }, [canViewOverview, gate]);

  useEffect(() => {
    void loadAll();
    return () => gate.cancel();
  }, [loadAll, gate]);

  const isHealthy = health?.status === "healthy";

  return (
    <AdminPage>
      {/* 页头 */}
      <div className="flex items-center justify-between mb-5" aria-live="polite">
        <div>
          <div className="text-lg font-semibold text-text-base">系统状态</div>
          <div className="text-base mt-0.5 text-text-secondary">实时监控系统运行状态与核心指标</div>
        </div>
        <Button variant="ghost" onClick={loadAll}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      {!canViewOverview && (
        <Alert className="mb-5">
          <AlertTitle>系统统计权限</AlertTitle>
          <AlertDescription>仅超级管理员可查看系统统计；您仍可查看和刷新健康检查。</AlertDescription>
        </Alert>
      )}

      {canViewOverview && overviewError && (
        <Alert className="mb-5" variant="destructive">
          <AlertTitle>系统统计请求失败</AlertTitle>
          <AlertDescription>无法获取系统统计，请确认权限后重试。健康检查仍可使用。</AlertDescription>
        </Alert>
      )}

      {errorText && (
        <Alert className="mb-5 border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning-soft)] text-[var(--ws-color-warning)] [&>svg]:text-[var(--ws-color-warning)]">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>健康检查请求失败</AlertTitle>
          <AlertDescription>{errorText}</AlertDescription>
        </Alert>
      )}

      {loading && !health ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-3/5" />
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* 整体状态 banner */}
          <div className={`rounded-xl px-4 py-3.5 flex items-center gap-3 ${isHealthy ? "bg-success-soft" : "bg-error-soft"}`}>
            {isHealthy
              ? <CheckCircle className="h-5 w-5 text-success" />
              : <XCircle className="h-5 w-5 text-error" />}
            <div>
              <div className={`text-base font-semibold ${isHealthy ? "text-success" : "text-error"}`}>
                {isHealthy ? "系统运行正常" : "系统存在异常"}
              </div>
              {health?.system?.timestamp && (
                <div className="text-sm mt-0.5 text-text-tertiary">
                  最后检查：{new Date(health.system.timestamp).toLocaleTimeString("zh-CN")}
                </div>
              )}
            </div>
          </div>

          {/* 数据概览卡片 */}
          {canViewOverview && overview && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="用户总数" value={overview?.counts?.users} icon={<Users className="h-4 w-4" />} variant="horizontal" color="primary" />
            <StatCard label="文章总数" value={overview?.counts?.articles} icon={<FileText className="h-4 w-4" />} variant="horizontal" color="purple" />
            <StatCard label="智能体" value={overview?.counts?.agents} icon={<Bot className="h-4 w-4" />} variant="horizontal" color="warning" />
          </div>

          )}
          {canViewOverview && loading && !overview && !overviewError && (
            <div role="status" className="text-sm text-text-secondary">正在加载系统统计…</div>
          )}

          {/* 健康检查详情 */}
          <div className="rounded-xl p-4 bg-surface-2">
            <div className="text-sm font-semibold uppercase tracking-wide mb-3 text-text-tertiary">
              服务检查
            </div>
            <StatusRow label="数据库连接" ok={health?.checks?.database === "healthy"}
              value={health?.checks?.database === "healthy" ? "已连接" : "断开"} />
            <StatusRow label="Redis 缓存" ok={health?.checks?.redis === "healthy"}
              value={health?.checks?.redis === "healthy" ? "在线" : "离线"} />
            <StatusRow label="后端版本" value={health?.system?.version} />
            <StatusRow label="运行环境"
              value={<Badge variant="secondary" className="border-0">{health?.system?.environment || "Development"}</Badge>} />
            <div className="flex items-center justify-between pt-3">
              <span className="text-sm text-text-secondary">API 端点</span>
              <code className="text-xs px-1.5 py-0.5 rounded bg-surface-2">{config.apiUrl}</code>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
};

const AdminDashboard: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated || !user) {
    return <AdminPage><div role="status">{isLoading ? "正在确认登录状态…" : "请登录后查看系统状态。"}</div></AdminPage>;
  }
  // Reset state on user OR role changes, before any old data can be rendered.
  return <DashboardStatus key={JSON.stringify([user.id, user.role_code])}
    canViewOverview={canAccessRoles(user.role_code, SUPER_ADMIN_ROLES)} />;
};

export default AdminDashboard;
