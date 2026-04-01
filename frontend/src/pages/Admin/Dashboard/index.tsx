import React, { useCallback, useEffect, useState } from "react";
import { Typography, Button, Tag, Alert, Skeleton } from "antd";
import {
  SyncOutlined, CheckCircleOutlined, CloseCircleOutlined,
  TeamOutlined, FileTextOutlined, RobotOutlined,
} from "@ant-design/icons";
import { AdminPage } from "@components/Admin";
import { api, config } from "@services";

const { Text } = Typography;

const dot = (ok: boolean) => ok
  ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
  : <span className="inline-block w-2 h-2 rounded-full bg-red-400" />;

interface StatCardProps { label: string; value: React.ReactNode; icon?: React.ReactNode; color?: string; }
const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color = "#0EA5E9" }) => (
  <div className="rounded-xl p-5 bg-surface-2">
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{label}</span>
      {icon && <span className="text-base" style={{ color }}>{icon}</span>}
    </div>
    <div className="text-xl font-semibold text-text-base">{value ?? "-"}</div>
  </div>
);

interface StatusRowProps { label: string; value: React.ReactNode; ok?: boolean; }
const StatusRow: React.FC<StatusRowProps> = ({ label, value, ok }) => (
  <div className="flex items-center justify-between py-3 border-b border-black/[0.04]">
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-base font-semibold text-text-base">系统状态</div>
          <div className="text-sm mt-0.5 text-text-secondary">实时监控系统运行状态与核心指标</div>
        </div>
        <Button type="text" icon={<SyncOutlined spin={loading} />} onClick={loadAll}>刷新</Button>
      </div>

      {errorText && (
        <Alert type="warning" showIcon message="健康检查请求失败" description={errorText} className="mb-5" />
      )}

      {loading && !health ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <div className="space-y-6">
          {/* 整体状态 banner */}
          <div className="rounded-xl px-5 py-4 flex items-center gap-3"
            style={{ background: isHealthy ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)" }}>
            {isHealthy
              ? <CheckCircleOutlined className="text-lg" style={{ color: "#10B981" }} />
              : <CloseCircleOutlined className="text-lg" style={{ color: "#EF4444" }} />}
            <div>
              <div className="text-sm font-semibold" style={{ color: isHealthy ? "#10B981" : "#EF4444" }}>
                {isHealthy ? "系统运行正常" : "系统存在异常"}
              </div>
              {health?.system?.timestamp && (
                <div className="text-xs mt-0.5 text-text-tertiary">
                  最后检查：{new Date(health.system.timestamp).toLocaleTimeString("zh-CN")}
                </div>
              )}
            </div>
          </div>

          {/* 数据概览卡片 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="用户总数" value={overview?.counts?.users} icon={<TeamOutlined />} color="#0EA5E9" />
            <StatCard label="文章总数" value={overview?.counts?.articles} icon={<FileTextOutlined />} color="#6366F1" />
            <StatCard label="智能体" value={overview?.counts?.agents} icon={<RobotOutlined />} color="#F59E0B" />
          </div>

          {/* 健康检查详情 */}
          <div className="rounded-xl p-5 bg-surface-2">
            <div className="text-xs font-semibold uppercase tracking-wide mb-3 text-text-tertiary">
              服务检查
            </div>
            <StatusRow label="数据库连接" ok={health?.checks?.database === "healthy"}
              value={health?.checks?.database === "healthy" ? "已连接" : "断开"} />
            <StatusRow label="Redis 缓存" ok={health?.checks?.redis === "healthy"}
              value={health?.checks?.redis === "healthy" ? "在线" : "离线"} />
            <StatusRow label="后端版本" value={health?.system?.version} />
            <StatusRow label="运行环境"
              value={<Tag bordered={false}>{health?.system?.environment || "Development"}</Tag>} />
            <div className="flex items-center justify-between pt-3">
              <span className="text-sm text-text-secondary">API 端点</span>
              <Text code className="text-xs">{config.apiUrl}</Text>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
};

export default AdminDashboard;
