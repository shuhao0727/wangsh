import React, { useCallback, useEffect, useState } from "react";
import {
  Typography,
  Space,
  Button,
  Row,
  Col,
  Tag,
  Alert,
  Skeleton,
} from "antd";
import { SyncOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { AdminPage } from "@components/Admin";
import { api, config } from "@services";
import StatusItem from "./components/StatusItem";
import "./index.css";

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

  // Removed inline StatusItem component


  return (
    <AdminPage>
      <div className="admin-dashboard-header">
        <Text type="secondary" style={{ fontSize: 13 }}>实时监控系统运行状态与核心指标</Text>
        <Button type="text" icon={<SyncOutlined spin={loading} />} onClick={loadAll}>
          刷新
        </Button>
      </div>

      <div className="admin-dashboard-content">
        {errorText ? (
          <Alert
            type="warning"
            showIcon
            message="健康检查请求失败"
            description={errorText}
            style={{ marginBottom: 16 }}
          />
        ) : null}

        {loading && !health ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <>
            <div style={{ marginBottom: 32 }}>
              <Title level={5} className="admin-dashboard-section-title">
                系统健康 (System Health)
              </Title>
    
              <div className="admin-dashboard-health-grid">
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
    
            <div>
              <Title level={5} className="admin-dashboard-section-title">
                系统概况 (System Overview)
              </Title>
    
              <Row gutter={[0, 0]} className="admin-dashboard-overview-grid">
                 <Col xs={24} sm={12} md={8} className="admin-dashboard-overview-cell admin-dashboard-overview-cell--right admin-dashboard-overview-cell--bottom">
                    <StatusItem label="后端版本" value={health?.system?.version || "-"} />
                 </Col>
                 <Col xs={24} sm={12} md={8} className="admin-dashboard-overview-cell admin-dashboard-overview-cell--right admin-dashboard-overview-cell--bottom">
                    <StatusItem label="运行环境" value={<Tag bordered={false}>{health?.system?.environment || "Development"}</Tag>} />
                 </Col>
                 <Col xs={24} sm={12} md={8} className="admin-dashboard-overview-cell admin-dashboard-overview-cell--bottom">
                    <StatusItem label="API 端点" value={<Text code>{config.apiUrl}</Text>} />
                 </Col>
                 <Col xs={24} sm={12} md={8} className="admin-dashboard-overview-cell admin-dashboard-overview-cell--right">
                    <StatusItem label="用户总数" value={overview?.counts?.users || "-"} />
                 </Col>
                 <Col xs={24} sm={12} md={8} className="admin-dashboard-overview-cell admin-dashboard-overview-cell--right">
                    <StatusItem label="文章总数" value={overview?.counts?.articles || "-"} />
                 </Col>
                 <Col xs={24} sm={12} md={8} className="admin-dashboard-overview-cell">
                    <StatusItem label="智能体总数" value={overview?.counts?.agents || "-"} />
                 </Col>
              </Row>
            </div>
          </>
        )}
      </div>
    </AdminPage>
  );
};

export default AdminDashboard;
