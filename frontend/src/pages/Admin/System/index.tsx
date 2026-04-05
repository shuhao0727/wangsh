import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AdminCard, AdminPage } from "@components/Admin";
import { api } from "@services";
import { featureFlagsApi } from "@/services/system/featureFlags";
import { NAV_VISIBILITY_ITEMS } from "@/constants/navVisibility";
import TypstMetricsPanel from "./TypstMetrics";

const InfoRow: React.FC<{ label: string; value: React.ReactNode; valueClassName?: string }> = ({
  label,
  value,
  valueClassName,
}) => (
  <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 py-1.5">
    <span className="text-sm text-text-secondary">{label}</span>
    <span className={valueClassName}>{value}</span>
  </div>
);

const MetricRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border-secondary py-1.5 last:border-b-0">
    <span className="text-sm text-text-secondary">{label}</span>
    <span className="text-sm font-medium tabular-nums text-text-base">{value}</span>
  </div>
);

const AdminSystem: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [tab, setTab] = useState<"system" | "typst">("system");
  const [navVisibleMap, setNavVisibleMap] = useState<Record<string, boolean>>({});
  const [navToggleLoading, setNavToggleLoading] = useState<Record<string, boolean>>({});
/* PLACEHOLDER_SYS_1 */

  const load = useCallback(async () => {
    setLoading(true);
    try { setHealth((await api.get("/health")).data); } catch { setHealth(null); }
    try { setSettings((await api.get("/system/settings")).data); } catch { setSettings(null); }
    try { setOverview((await api.get("/system/overview")).data); } catch { setOverview(null); }
    try {
      const flags = await featureFlagsApi.list();
      const next: Record<string, boolean> = {};
      for (const item of NAV_VISIBILITY_ITEMS) {
        const found = flags.find((f) => f.key === item.flagKey);
        next[item.path] = found?.value?.enabled !== false;
      }
      setNavVisibleMap(next);
    } catch {
      const next: Record<string, boolean> = {};
      for (const item of NAV_VISIBILITY_ITEMS) next[item.path] = true;
      setNavVisibleMap(next);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleNavToggle = async (item: typeof NAV_VISIBILITY_ITEMS[number], checked: boolean) => {
    setNavToggleLoading((prev) => ({ ...prev, [item.path]: true }));
    try {
      await featureFlagsApi.save({ key: item.flagKey, value: { enabled: checked } });
      setNavVisibleMap((prev) => ({ ...prev, [item.path]: checked }));
      showMessage.success(`${item.label}${checked ? "已设为可见" : "已设为隐藏"}`);
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      showMessage.error(typeof d === "string" ? d : (e?.message || "保存失败"));
    } finally {
      setNavToggleLoading((prev) => ({ ...prev, [item.path]: false }));
    }
  };

  return (
    <AdminPage>
      <div className="mb-4 flex items-center justify-end gap-2">
        <div className="inline-flex rounded-lg bg-surface-2 p-1">
          <Button
            size="sm"
            variant={tab === "system" ? "default" : "ghost"}
            onClick={() => setTab("system")}
          >
            系统
          </Button>
          <Button
            size="sm"
            variant={tab === "typst" ? "default" : "ghost"}
            onClick={() => setTab("typst")}
          >
            Typst
          </Button>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      {tab === "typst" ? (
        <TypstMetricsPanel />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <AdminCard title="前端导航可见性" className="rounded-lg border border-border bg-surface" size="small">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-5">
                {NAV_VISIBILITY_ITEMS.map((item) => (
                  <div
                    key={item.path}
                    className="flex items-center justify-between rounded-md border border-border-secondary bg-surface-2 px-2.5 py-1.5"
                  >
                    <span className="text-sm text-text-base">{item.label}</span>
                    <Switch
                      checked={navVisibleMap[item.path] !== false}
                      disabled={!!navToggleLoading[item.path]}
                      onCheckedChange={(checked) => handleNavToggle(item, checked)}
                    />
                  </div>
                ))}
              </div>
            </AdminCard>
          </div>

          <AdminCard title="基本设置" className="rounded-lg border border-border bg-surface" size="small">
            <InfoRow
              label="服务状态"
              value={
                health?.status ? (
                  <Badge variant={health.status === "healthy" ? "success" : health.status === "degraded" ? "warning" : "danger"}>
                    {health.status}
                  </Badge>
                ) : (
                  <Badge variant="secondary">-</Badge>
                )
              }
            />
            <InfoRow
              label="后端版本"
              value={health?.system?.version || "-"}
              valueClassName="text-sm text-text-secondary"
            />
            <InfoRow
              label="运行环境"
              value={health?.system?.environment || "-"}
              valueClassName="text-sm text-text-secondary"
            />
          </AdminCard>

          <AdminCard title="安全设置" className="rounded-lg border border-border bg-surface" size="small">
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-2">
                <span className="text-sm text-text-secondary">JWT 过期时间</span>
                <Input value={settings?.security?.jwt_expire_minutes ?? ""} readOnly className="h-9" />
                <span className="text-sm text-text-tertiary">分钟</span>
              </div>
              <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2">
                <span className="text-sm text-text-secondary">算法</span>
                <Input value={settings?.security?.algorithm ?? ""} readOnly className="h-9" />
              </div>
              <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2">
                <span className="text-sm text-text-secondary">Auto Create Tables</span>
                <Input value={String(settings?.features?.auto_create_tables ?? "")} readOnly className="h-9" />
              </div>
            </div>
          </AdminCard>

          <div className="lg:col-span-2">
            <AdminCard title="观测指标" className="rounded-lg border border-border bg-surface" size="small">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-md border border-border-secondary bg-surface-2 px-3 py-2">
                  <span className="mb-1.5 block text-sm font-semibold">HTTP</span>
                  <MetricRow label="总请求" value={overview?.observability?.http?.total ?? "-"} />
                  <MetricRow label="4xx" value={overview?.observability?.http?.["4xx"] ?? "-"} />
                  <MetricRow label="5xx" value={overview?.observability?.http?.["5xx"] ?? "-"} />
                  <MetricRow label="In-flight" value={overview?.observability?.http?.inflight ?? "-"} />
                  <MetricRow label="p95(ms)" value={overview?.observability?.http?.dur_ms?.p95 ?? "-"} />
                </div>
                <div className="rounded-md border border-border-secondary bg-surface-2 px-3 py-2">
                  <span className="mb-1.5 block text-sm font-semibold">DB Pool</span>
                  <MetricRow label="pool_size" value={overview?.observability?.db?.pool_size ?? "-"} />
                  <MetricRow label="checked_in" value={overview?.observability?.db?.checked_in ?? "-"} />
                  <MetricRow label="checked_out" value={overview?.observability?.db?.checked_out ?? "-"} />
                  <MetricRow label="overflow" value={overview?.observability?.db?.overflow ?? "-"} />
                  <MetricRow label="capacity" value={overview?.observability?.db?.capacity_total ?? "-"} />
                </div>
              </div>
            </AdminCard>
          </div>
        </div>
      )}
    </AdminPage>
  );
};

export default AdminSystem;
