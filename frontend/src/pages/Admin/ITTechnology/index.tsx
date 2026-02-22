import React, { useState, useEffect } from "react";
import { Typography, Card, Row, Col, Switch, Button, message, Breadcrumb, Divider } from "antd";
import { 
  ExperimentOutlined, 
  FormOutlined, 
  NodeIndexOutlined, 
  CodeOutlined,
  SettingOutlined, 
  HomeOutlined,
  ToolOutlined 
} from "@ant-design/icons";
import { AdminPage } from "@/components/Admin";
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
    style={{
      borderRadius: 8,
      border: '1px solid #f0f0f0',
      height: '100%',
      transition: 'all 0.3s ease',
    }}
    styles={{
      body: { padding: 24 }
    }}
    className="it-app-card"
  >
    <div style={{ 
      display: 'flex',
      alignItems: 'flex-start',
      marginBottom: 20
    }}>
      <div style={{ 
        width: 48, height: 48, 
        borderRadius: 8, 
        background: 'linear-gradient(135deg, #e6f7ff 0%, #1890ff 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 24,
        marginRight: 16,
        flexShrink: 0
      }}>
        {icon}
      </div>
      <div>
        <Title level={5} style={{ marginBottom: 4, color: '#2c3e50', fontSize: 16 }}>{title}</Title>
        <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5, display: 'block' }}>
          {description}
        </Text>
      </div>
    </div>
    
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch 
          size="small"
          checked={enabled} 
          loading={loading}
          onChange={onToggle} 
        />
        <Text type="secondary" style={{ fontSize: 12 }}>{enabled ? '已启用' : '已禁用'}</Text>
      </div>
      
      {onManage && (
        <Button type="link" size="small" icon={<SettingOutlined />} onClick={onManage} style={{ padding: 0 }}>
          管理
        </Button>
      )}
    </div>
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
      key: 'it_python_lab',
      title: 'Python 实验室',
      description: '实验模板管理与前台实验台入口',
      icon: <CodeOutlined />,
      hasManager: false,
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
      <AdminPage>
        <Breadcrumb style={{ marginBottom: 16 }}>
          <Breadcrumb.Item>
            <Button type="link" onClick={() => setView('dashboard')} style={{ padding: 0 }}>
              <HomeOutlined /> IT应用管理
            </Button>
          </Breadcrumb.Item>
          <Breadcrumb.Item>随机点名管理</Breadcrumb.Item>
        </Breadcrumb>
        <DianmingManager />
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, color: "#2c3e50" }}>IT 应用管理</Title>
        <Text type="secondary">配置前台应用的可见性与基础数据</Text>
      </div>

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
    </AdminPage>
  );
};

export default AdminITTechnology;
