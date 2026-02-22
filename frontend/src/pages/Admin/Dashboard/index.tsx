import React, { useCallback, useEffect, useState } from "react";
import {
  Typography,
  Space,
  Button,
  Row,
  Col,
  Tag,
  Divider,
} from "antd";
import { SyncOutlined, DatabaseOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { AdminPage } from "@components/Admin";
import { api, config } from "@services";

const { Text, Title } = Typography;

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

  const StatusItem = ({ label, value, status }: { label: string; value: React.ReactNode; status?: "success" | "error" | "default" }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {status === "success" && <CheckCircleOutlined style={{ color: "var(--ws-color-success)" }} />}
        {status === "error" && <CloseCircleOutlined style={{ color: "var(--ws-color-error)" }} />}
        <span style={{ fontSize: 18, fontWeight: 500 }}>{value}</span>
      </div>
    </div>
  );

  return (
    <AdminPage>
      {/* Toolbar / Header Section */}
      <div style={{ 
        padding: "16px 24px", 
        borderBottom: "1px solid #f0f0f0",
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center" 
      }}>
        <Space direction="vertical" size={0}>
          <Title level={4} style={{ margin: 0 }}>状态概览</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>实时监控系统运行状态与核心指标</Text>
        </Space>
        <Button 
          type="text" 
          icon={<SyncOutlined spin={loading} />} 
          onClick={loadAll}
        >
          刷新
        </Button>
      </div>

      <div style={{ padding: 24, overflowY: "auto", height: "100%" }}>
        {/* Health Status Section */}
        <div style={{ marginBottom: 32 }}>
          <Title level={5} style={{ marginBottom: 16, fontSize: 14, color: "var(--ws-color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            系统健康 (System Health)
          </Title>
          
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
            gap: 24,
            padding: 24,
            border: "1px solid #f0f0f0",
            borderRadius: 8,
            background: "#fafafa" // Very subtle background for the status area
          }}>
            <StatusItem 
              label="整体状态" 
              value={health?.status === 'healthy' ? '正常运行' : '异常'} 
              status={health?.status === 'healthy' ? 'success' : 'error'} 
            />
            <StatusItem 
              label="数据库连接" 
              value={health?.checks?.database === 'healthy' ? '已连接' : '断开'} 
              status={health?.checks?.database === 'healthy' ? 'success' : 'error'} 
            />
            <StatusItem 
              label="Redis 缓存" 
              value={health?.checks?.redis === 'healthy' ? '在线' : '离线'} 
              status={health?.checks?.redis === 'healthy' ? 'success' : 'error'} 
            />
            <StatusItem 
              label="最后检查时间" 
              value={health?.system?.timestamp ? new Date(health.system.timestamp).toLocaleTimeString("zh-CN") : "-"} 
            />
          </div>
        </div>

        {/* System Overview Section */}
        <div>
          <Title level={5} style={{ marginBottom: 16, fontSize: 14, color: "var(--ws-color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            系统概况 (System Overview)
          </Title>

          <Row gutter={[0, 0]} style={{ border: "1px solid #f0f0f0", borderRadius: 8, overflow: "hidden" }}>
             <Col xs={24} sm={12} md={8} style={{ padding: 24, borderRight: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }}>
                <StatusItem label="后端版本" value={health?.system?.version || "-"} />
             </Col>
             <Col xs={24} sm={12} md={8} style={{ padding: 24, borderRight: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }}>
                <StatusItem label="运行环境" value={<Tag bordered={false}>{health?.system?.environment || "Development"}</Tag>} />
             </Col>
             <Col xs={24} sm={12} md={8} style={{ padding: 24, borderBottom: "1px solid #f0f0f0" }}>
                <StatusItem label="API 端点" value={<Text code>{config.apiUrl}</Text>} />
             </Col>
             <Col xs={24} sm={12} md={8} style={{ padding: 24, borderRight: "1px solid #f0f0f0" }}>
                <StatusItem label="用户总数" value={overview?.counts?.users || "-"} />
             </Col>
             <Col xs={24} sm={12} md={8} style={{ padding: 24, borderRight: "1px solid #f0f0f0" }}>
                <StatusItem label="文章总数" value={overview?.counts?.articles || "-"} />
             </Col>
             <Col xs={24} sm={12} md={8} style={{ padding: 24 }}>
                <StatusItem label="智能体总数" value={overview?.counts?.agents || "-"} />
             </Col>
          </Row>
        </div>
      </div>
    </AdminPage>
  );
};

export default AdminDashboard;
