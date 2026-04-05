import React, { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  RefreshCw, CheckCircle, XCircle,
  Users, FileText, Bot, TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPage } from "@components/Admin";
import { api, config } from "@services";

const dot = (ok: boolean) => ok
  ? <span className="inline-block w-2 h-2 rounded-full bg-[var(--ws-color-success)]" />
  : <span className="inline-block w-2 h-2 rounded-full bg-[var(--ws-color-error)]" />;

interface StatCardProps { label: string; value: React.ReactNode; icon?: React.ReactNode; color?: string; }
const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color = "var(--ws-color-primary)" }) => (
  <div className="rounded-xl p-4 bg-surface-2">
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm font-medium uppercase tracking-wide text-text-tertiary">{label}</span>
      {icon && <span style={{ color }}>{icon}</span>}
    </div>
    <div className="text-xl font-semibold text-text-base">{value ?? "-"}</div>
  </div>
);

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

const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [errorText, setErrorText] = useState<string>("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrorText("");
    try {
      const h = await api.get("/health");
      setHealth(h.data);
    } catch (e: any) {
      setErrorText(e?.response?.data?.detail || e?.message || "加载健康状态失败");
      setHealth(null);
    }
    try {
      const o = await api.get("/system/overview");
      setOverview(o.data);
    } catch {
      setOverview(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const isHealthy = health?.status === "healthy";

  return (
    <AdminPage>
      {/* 页头 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-lg font-semibold text-text-base">系统状态</div>
          <div className="text-base mt-0.5 text-text-secondary">实时监控系统运行状态与核心指标</div>
        </div>
        <Button variant="ghost" onClick={loadAll}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="用户总数" value={overview?.counts?.users} icon={<Users className="h-4 w-4" />} color="var(--ws-color-primary)" />
            <StatCard label="文章总数" value={overview?.counts?.articles} icon={<FileText className="h-4 w-4" />} color="var(--ws-color-purple)" />
            <StatCard label="智能体" value={overview?.counts?.agents} icon={<Bot className="h-4 w-4" />} color="var(--ws-color-warning)" />
          </div>

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

export default AdminDashboard;
