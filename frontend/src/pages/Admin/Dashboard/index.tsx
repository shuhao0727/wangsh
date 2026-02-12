import React, { useCallback, useEffect, useState } from "react";
import {
  Typography,
  Space,
  Button,
  Row,
  Col,
  Divider,
  Alert,
  Tag,
} from "antd";
import { SyncOutlined } from "@ant-design/icons";
import { AdminCard, AdminPage } from "@components/Admin";
import { api, config } from "@services";

const { Text } = Typography;

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

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <AdminPage>
      {/* 标题和操作 */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <Space>
          <Button
            icon={<SyncOutlined />}
            onClick={loadAll}
            loading={loading}
          >
            刷新数据
          </Button>
        </Space>
      </div>

      {/* 系统状态提示 */}
      <Alert
        title="系统状态"
        description={
          errorText
            ? errorText
            : `后端：${health?.system?.service || "-"} · 版本：${health?.system?.version || "-"} · 环境：${health?.system?.environment || "-"}`
        }
        type={errorText ? "error" : health?.status === "healthy" ? "success" : "warning"}
        showIcon
        style={{
          marginBottom: "24px",
          background: "var(--ws-color-surface)",
          border: "1px solid var(--ws-color-border)",
        }}
      />

      {/* 基础信息卡片 */}
      <Row gutter={[24, 24]} style={{ marginBottom: "32px" }}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <AdminCard title="服务状态" style={{ textAlign: "center" }}>
            <Text strong style={{ fontSize: "24px" }}>
              {health?.status === "healthy" ? (
                <span style={{ color: "var(--ws-color-success)" }}>正常</span>
              ) : health?.status ? (
                <span style={{ color: "#faad14" }}>{health.status}</span>
              ) : (
                <span style={{ color: "#8c8c8c" }}>未知</span>
              )}
            </Text>
          </AdminCard>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <AdminCard title="连接状态" style={{ textAlign: "center" }}>
            <Text strong style={{ fontSize: "24px" }}>
              {health?.checks?.database === "healthy" ? (
                <span style={{ color: "var(--ws-color-success)" }}>在线</span>
              ) : health?.checks?.database ? (
                <span style={{ color: "#ff4d4f" }}>异常</span>
              ) : (
                <span style={{ color: "#8c8c8c" }}>未知</span>
              )}
            </Text>
          </AdminCard>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <AdminCard title="Redis" style={{ textAlign: "center" }}>
            <Text type="secondary" style={{ fontSize: "14px" }}>
              {health?.checks?.redis === "healthy" ? (
                <Tag color="green">healthy</Tag>
              ) : health?.checks?.redis ? (
                <Tag color="red">unhealthy</Tag>
              ) : (
                "-"
              )}
            </Text>
          </AdminCard>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <AdminCard title="最近检查" style={{ textAlign: "center" }}>
            <Text type="secondary" style={{ fontSize: "14px" }}>
              {health?.system?.timestamp ? new Date(health.system.timestamp).toLocaleTimeString("zh-CN") : "-"}
            </Text>
          </AdminCard>
        </Col>
      </Row>

      <Divider />

      {/* 系统信息 */}
      <AdminCard
        title="系统信息"
        accentColor="var(--ws-color-success)"
        gradient="var(--ws-color-surface)"
      >
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Space orientation="vertical">
              <Text strong>后端版本</Text>
              <Text type="secondary">{health?.system?.version || "-"}</Text>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space orientation="vertical">
              <Text strong>前端版本</Text>
              <Text type="secondary">build</Text>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space orientation="vertical">
              <Text strong>数据概览</Text>
              <Text type="secondary">
                {overview?.counts
                  ? `用户 ${overview.counts.users} · 文章 ${overview.counts.articles} · 智能体 ${overview.counts.agents}`
                  : "需要管理员登录后可见"}
              </Text>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space orientation="vertical">
              <Text strong>API地址</Text>
              <Text type="secondary">{config.apiUrl}</Text>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space orientation="vertical">
              <Text strong>运行环境</Text>
              <Text type="secondary">{health?.system?.environment || "-"}</Text>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space orientation="vertical">
              <Text strong>当前时间</Text>
              <Text type="secondary">{new Date().toLocaleString("zh-CN")}</Text>
            </Space>
          </Col>
        </Row>
      </AdminCard>

    </AdminPage>
  );
};

export default AdminDashboard;
