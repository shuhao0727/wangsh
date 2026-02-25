import React, { useState, useEffect } from "react";
import { Typography, Row, Col, Button, message, Breadcrumb } from "antd";
import { 
  ExperimentOutlined, 
  FormOutlined, 
  NodeIndexOutlined, 
  CodeOutlined,
  SettingOutlined, 
  HomeOutlined,
} from "@ant-design/icons";
import { AdminAppCard, AdminPage } from "@/components/Admin";
import DianmingManager from "./DianmingManager";
import { featureFlagsApi } from "@/services/system/featureFlags";

const { Title } = Typography;

type ViewState = 'dashboard' | 'dianming-manager';

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
      <AdminPage padding={16}>
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
    <AdminPage padding={16}>
      <div style={{ marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0, color: "#2c3e50" }}>
          IT 应用管理
        </Title>
      </div>

      <Row gutter={[24, 24]}>
        {appConfigs.map(app => (
          <Col xs={24} sm={12} md={8} lg={6} key={app.key}>
            <AdminAppCard
              title={app.title}
              description={app.description}
              icon={app.icon}
              enabled={flags[`${app.key}_enabled`] || false}
              loading={loading[app.key]}
              onToggle={(checked) => handleToggle(app.key, checked)}
              theme="blue"
              actionLabel={app.hasManager ? "管理" : undefined}
              actionIcon={app.hasManager ? <SettingOutlined /> : undefined}
              onAction={
                app.hasManager
                  ? () => {
                      if (app.key === "it_dianming") setView("dianming-manager");
                    }
                  : undefined
              }
            />
          </Col>
        ))}
      </Row>
    </AdminPage>
  );
};

export default AdminITTechnology;
