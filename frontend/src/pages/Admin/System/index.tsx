import React, { useCallback, useEffect, useState } from "react";
import {
  Typography,
  Space,
  Button,
  Row,
  Col,
  Divider,
  Input,
  Tag,
  message,
  Segmented,
} from "antd";
import { SaveOutlined, ReloadOutlined } from "@ant-design/icons";
import { AdminCard, AdminPage } from "@components/Admin";
import { api } from "@services";
import TypstMetricsPanel from "./TypstMetrics";

const { Text } = Typography;

const AdminSystem: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [tab, setTab] = useState<"system" | "typst">("system");

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
