import React, { useCallback, useEffect, useState } from "react";
import {
  Typography,
  Space,
  Button,
  Row,
  Col,
  Input,
  Switch,
  Tag,
  message,
  Segmented,
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { AdminCard, AdminPage } from "@components/Admin";
import { api } from "@services";
import { featureFlagsApi } from "@/services/system/featureFlags";
import { NAV_VISIBILITY_ITEMS } from "@/constants/navVisibility";
import TypstMetricsPanel from "./TypstMetrics";

const { Text } = Typography;

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-2">
    <Text type="secondary">{label}</Text>
    <span>{value}</span>
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
      message.success(`${item.label}${checked ? "已设为可见" : "已设为隐藏"}`);
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      message.error(typeof d === "string" ? d : (e?.message || "保存失败"));
    } finally {
      setNavToggleLoading((prev) => ({ ...prev, [item.path]: false }));
    }
  };

  return (
    <AdminPage>
      <div className="flex justify-end items-center mb-4">
        <Space>
          <Segmented value={tab} options={[{ label: "系统", value: "system" }, { label: "Typst", value: "typst" }]} onChange={(v) => setTab(v as any)} />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>
        </Space>
      </div>

      {tab === "typst" ? (
        <TypstMetricsPanel />
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <AdminCard title="前端导航可见性">
              <div className="flex gap-6 flex-wrap items-center" style={{ rowGap: 12 }}>
                {NAV_VISIBILITY_ITEMS.map((item) => (
                  <Space key={item.path} size={8}>
                    <Text>{item.label}</Text>
                    <Switch
                      checked={navVisibleMap[item.path] !== false}
                      loading={!!navToggleLoading[item.path]}
                      onChange={(checked) => handleNavToggle(item, checked)}
                    />
                  </Space>
                ))}
              </div>
            </AdminCard>
          </Col>

          <Col xs={24} lg={12}>
            <AdminCard title="基本设置">
              <InfoRow label="服务状态" value={
                health?.status
                  ? <Tag color={health.status === "healthy" ? "green" : health.status === "degraded" ? "orange" : "red"}>{health.status}</Tag>
                  : <Tag>-</Tag>
              } />
              <InfoRow label="后端版本" value={<Text type="secondary">{health?.system?.version || "-"}</Text>} />
              <InfoRow label="运行环境" value={<Text type="secondary">{health?.system?.environment || "-"}</Text>} />
            </AdminCard>
          </Col>

          <Col xs={24} lg={12}>
            <AdminCard title="安全设置">
              <div className="flex flex-col gap-3">
                <div>
                  <Text type="secondary" className="text-xs">JWT 过期时间</Text>
                  <Space.Compact style={{ width: "100%" }}>
                    <Input value={settings?.security?.jwt_expire_minutes ?? ""} readOnly className="flex-1" />
                    <Button disabled>分钟</Button>
                  </Space.Compact>
                </div>
                <div>
                  <Text type="secondary" className="text-xs">算法</Text>
                  <Input value={settings?.security?.algorithm ?? ""} readOnly />
                </div>
                <div>
                  <Text type="secondary" className="text-xs">Auto Create Tables</Text>
                  <Input value={String(settings?.features?.auto_create_tables ?? "")} readOnly />
                </div>
              </div>
            </AdminCard>
          </Col>

          <Col xs={24}>
            <AdminCard title="观测指标">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Text strong className="block mb-2">HTTP</Text>
                  <InfoRow label="总请求" value={overview?.observability?.http?.total ?? "-"} />
                  <InfoRow label="4xx" value={overview?.observability?.http?.["4xx"] ?? "-"} />
                  <InfoRow label="5xx" value={overview?.observability?.http?.["5xx"] ?? "-"} />
                  <InfoRow label="In-flight" value={overview?.observability?.http?.inflight ?? "-"} />
                  <InfoRow label="p95(ms)" value={overview?.observability?.http?.dur_ms?.p95 ?? "-"} />
                </Col>
                <Col xs={24} md={12}>
                  <Text strong className="block mb-2">DB Pool</Text>
                  <InfoRow label="pool_size" value={overview?.observability?.db?.pool_size ?? "-"} />
                  <InfoRow label="checked_in" value={overview?.observability?.db?.checked_in ?? "-"} />
                  <InfoRow label="checked_out" value={overview?.observability?.db?.checked_out ?? "-"} />
                  <InfoRow label="overflow" value={overview?.observability?.db?.overflow ?? "-"} />
                  <InfoRow label="capacity" value={overview?.observability?.db?.capacity_total ?? "-"} />
                </Col>
              </Row>
            </AdminCard>
          </Col>
        </Row>
      )}
    </AdminPage>
  );
};

export default AdminSystem;
