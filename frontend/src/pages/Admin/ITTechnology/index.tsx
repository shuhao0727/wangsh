import React, { useState, useEffect } from "react";
import { Typography, Card, Row, Col, Switch, Button, message, Space, Breadcrumb, Divider } from "antd";
import { 
  ExperimentOutlined, 
  FormOutlined, 
  NodeIndexOutlined, 
  SettingOutlined, 
  HomeOutlined,
  ToolOutlined 
} from "@ant-design/icons";
import DianmingManager from "./DianmingManager";
import { featureFlagsApi } from "@/services/system/featureFlags";

const { Text, Title } = Typography;

type ViewState = 'dashboard' | 'dianming-manager';

interface AppCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  flagKey: string;
  enabled: boolean;
  onToggle: (checked: boolean) => void;
  onManage?: () => void;
  loading?: boolean;
}

const AppCard: React.FC<AppCardProps> = ({ 
  title, description, icon, flagKey, enabled, onToggle, onManage, loading 
}) => (
  <Card
    hoverable
    actions={[
      <div key="toggle" style={{ padding: '0 16px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
        <span>前端可见性</span>
        <Switch 
          checkedChildren="显示" 
          unCheckedChildren="隐藏" 
          checked={enabled} 
          loading={loading}
          onChange={onToggle} 
        />
      </div>,
      onManage ? (
        <Button type="link" key="manage" icon={<SettingOutlined />} onClick={onManage}>
          数据管理
        </Button>
      ) : (
        <Button type="link" key="manage" disabled>
          暂无管理
        </Button>
      )
    ]}
  >
    <Card.Meta
      avatar={
        <div style={{ 
          width: 48, height: 48, 
          borderRadius: 8, 
          background: '#f0f5ff', 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#1890ff', fontSize: 24
        }}>
          {icon}
        </div>
      }
      title={title}
      description={<div style={{ height: 40, overflow: 'hidden', textOverflow: 'ellipsis' }}>{description}</div>}
    />
  </Card>
);

const AdminITTechnology: React.FC = () => {
  const [view, setView] = useState<ViewState>('dashboard');
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const appConfigs = [
    {
      key: 'it_dianming',
      title: '随机点名',
      description: '班级名单管理与随机抽取工具',
      icon: <ExperimentOutlined />,
      hasManager: true,
    },
    {
      key: 'it_survey',
      title: '问卷调查',
      description: '在线问卷创建与数据收集分析',
      icon: <FormOutlined />,
      hasManager: false, // 暂未实现
    },
    {
      key: 'it_mindmap',
      title: '思维导图',
      description: '在线脑图编辑与知识梳理',
      icon: <NodeIndexOutlined />,
      hasManager: false, // 暂未实现
    },
  ];

  const fetchFlags = async () => {
    try {
      const res = await featureFlagsApi.list();
      const newFlags: Record<string, boolean> = {};
      res.forEach(f => {
        newFlags[f.key] = f.value?.enabled === true;
      });
      setFlags(newFlags);
    } catch (error) {
      console.error("Failed to fetch feature flags", error);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const handleToggle = async (key: string, checked: boolean) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      await featureFlagsApi.save({
        key: `${key}_enabled`,
        value: { enabled: checked }
      });
      setFlags(prev => ({ ...prev, [`${key}_enabled`]: checked }));
      message.success(`${checked ? '已启用' : '已禁用'}应用`);
    } catch (error) {
      message.error("操作失败");
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  if (view === 'dianming-manager') {
    return (
      <div style={{ padding: 24 }}>
        <Breadcrumb style={{ marginBottom: 16 }}>
          <Breadcrumb.Item>
            <a onClick={() => setView('dashboard')}>
              <HomeOutlined /> IT应用管理
            </a>
          </Breadcrumb.Item>
          <Breadcrumb.Item>随机点名管理</Breadcrumb.Item>
        </Breadcrumb>
        <DianmingManager />
      </div>
    );
  }

  return (
    <div className="admin-it-technology" style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>IT 应用管理中心</Title>
        <Text type="secondary">配置前台应用可见性，并管理各个应用的基础数据。</Text>
      </div>

      <Divider><ToolOutlined /> 应用列表</Divider>

      <Row gutter={[24, 24]}>
        {appConfigs.map(app => (
          <Col xs={24} sm={12} md={8} lg={6} key={app.key}>
            <AppCard
              title={app.title}
              description={app.description}
              icon={app.icon}
              flagKey={`${app.key}_enabled`}
              enabled={flags[`${app.key}_enabled`] || false}
              loading={loading[app.key]}
              onToggle={(checked) => handleToggle(app.key, checked)}
              onManage={app.hasManager ? () => {
                if (app.key === 'it_dianming') setView('dianming-manager');
              } : undefined}
            />
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default AdminITTechnology;
