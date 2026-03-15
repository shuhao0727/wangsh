import React, { useCallback, useEffect, useState } from "react";
import {
  Typography,
  Space,
  Button,
  Row,
  Col,
  Divider,
  Input,
  Switch,
  Tag,
  message,
  Segmented,
} from "antd";
import { SaveOutlined, ReloadOutlined } from "@ant-design/icons";
import { AdminCard, AdminPage } from "@components/Admin";
import { api } from "@services";
import { featureFlagsApi } from "@/services/system/featureFlags";
import { NAV_VISIBILITY_ITEMS } from "@/constants/navVisibility";
import TypstMetricsPanel from "./TypstMetrics";

const { Text } = Typography;

const AdminSystem: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [tab, setTab] = useState<"system" | "typst">("system");
  const [navVisibleMap, setNavVisibleMap] = useState<Record<string, boolean>>({});
  const [navToggleLoading, setNavToggleLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const h = await api.get("/health");
      setHealth(h.data);
    } catch {
      setHealth(null);
    }
    try {
      const s = await api.get("/system/settings");
      setSettings(s.data);
    } catch {
      setSettings(null);
    }
    try {
      const o = await api.get("/system/overview");
      setOverview(o.data);
    } catch {
      setOverview(null);
    }
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

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminPage>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <Space>
          <Segmented
            value={tab}
            options={[
              { label: "系统", value: "system" },
              { label: "Typst", value: "typst" },
            ]}
            onChange={(v) => setTab(v as any)}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            disabled
            onClick={() => message.info("当前为只读配置展示，后续可扩展为可编辑配置")}
          >
            保存设置
          </Button>
        </Space>
      </div>

      {tab === "typst" ? (
        <TypstMetricsPanel />
      ) : (
        <Row gutter={[24, 24]}>
          <Col xs={24}>
            <AdminCard title="前端导航可见性">
              <div style={{ display: "flex", gap: 24, rowGap: 12, flexWrap: "wrap", alignItems: "center" }}>
                {NAV_VISIBILITY_ITEMS.map((item) => (
                  <div key={item.path}>
                    <Space size={8}>
                      <Text>{item.label}</Text>
                      <Switch
                        checked={navVisibleMap[item.path] !== false}
                        loading={!!navToggleLoading[item.path]}
                        onChange={async (checked) => {
                          setNavToggleLoading((prev) => ({ ...prev, [item.path]: true }));
                          try {
                            await featureFlagsApi.save({
                              key: item.flagKey,
                              value: { enabled: checked },
                            });
                            setNavVisibleMap((prev) => ({ ...prev, [item.path]: checked }));
                            message.success(`${item.label}${checked ? "已设为可见" : "已设为隐藏"}`);
                          } catch (e: any) {
                            message.error(e?.response?.data?.detail || e?.message || "保存失败");
                          } finally {
                            setNavToggleLoading((prev) => ({ ...prev, [item.path]: false }));
                          }
                        }}
                      />
                    </Space>
                  </div>
                ))}
              </div>
            </AdminCard>
          </Col>
          <Col xs={24} lg={12}>
            <AdminCard
              title="基本设置"
            >
              <Space orientation="vertical" style={{ width: "100%" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text>服务状态</Text>
                  {health?.status ? (
                    <Tag color={health.status === "healthy" ? "green" : health.status === "degraded" ? "orange" : "red"}>
                      {health.status}
                    </Tag>
                  ) : (
                    <Tag>-</Tag>
                  )}
                </div>
                <Divider />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text>后端版本</Text>
                  <Text type="secondary">{health?.system?.version || "-"}</Text>
                </div>
                <Divider />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text>运行环境</Text>
                  <Text type="secondary">{health?.system?.environment || "-"}</Text>
                </div>
              </Space>
            </AdminCard>
          </Col>
          <Col xs={24} lg={12}>
            <AdminCard title="安全设置">
              <Space orientation="vertical" style={{ width: "100%" }}>
                <div>
                  <Text strong>JWT 过期时间</Text>
                  <Input value={settings?.security?.jwt_expire_minutes ?? ""} addonAfter="分钟" readOnly />
                </div>
                <Divider />
                <div>
                  <Text strong>算法</Text>
                  <Input value={settings?.security?.algorithm ?? ""} readOnly />
                </div>
                <Divider />
                <div>
                  <Text strong>Auto Create Tables</Text>
                  <Input value={String(settings?.features?.auto_create_tables ?? "")} readOnly />
                </div>
              </Space>
            </AdminCard>
          </Col>
          <Col xs={24}>
            <AdminCard title="观测指标">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Space orientation="vertical" style={{ width: "100%" }}>
                    <Text strong>HTTP</Text>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Text type="secondary">总请求</Text>
                      <Text>{overview?.observability?.http?.total ?? "-"}</Text>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Text type="secondary">4xx</Text>
                      <Text>{overview?.observability?.http?.["4xx"] ?? "-"}</Text>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Text type="secondary">5xx</Text>
                      <Text>{overview?.observability?.http?.["5xx"] ?? "-"}</Text>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Text type="secondary">In-flight</Text>
                      <Text>{overview?.observability?.http?.inflight ?? "-"}</Text>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Text type="secondary">p95(ms)</Text>
                      <Text>{overview?.observability?.http?.dur_ms?.p95 ?? "-"}</Text>
                    </div>
                  </Space>
                </Col>
                <Col xs={24} md={12}>
                  <Space orientation="vertical" style={{ width: "100%" }}>
                    <Text strong>DB Pool</Text>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Text type="secondary">pool_size</Text>
                      <Text>{overview?.observability?.db?.pool_size ?? "-"}</Text>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Text type="secondary">checked_in</Text>
                      <Text>{overview?.observability?.db?.checked_in ?? "-"}</Text>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Text type="secondary">checked_out</Text>
                      <Text>{overview?.observability?.db?.checked_out ?? "-"}</Text>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Text type="secondary">overflow</Text>
                      <Text>{overview?.observability?.db?.overflow ?? "-"}</Text>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Text type="secondary">capacity</Text>
                      <Text>{overview?.observability?.db?.capacity_total ?? "-"}</Text>
                    </div>
                  </Space>
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
