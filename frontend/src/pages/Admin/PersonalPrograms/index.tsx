import React, { useEffect, useState } from "react";
import { Typography, Card, Space, Button, Switch, message, Row, Col } from "antd";
import { AppstoreOutlined, ArrowRightOutlined, SettingOutlined } from "@ant-design/icons";
import { xbkPublicConfigApi } from "@services";
import { AdminPage } from "@/components/Admin";

const { Text, Title } = Typography;

interface AppCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: (checked: boolean) => void;
  onOpen?: () => void;
  loading?: boolean;
}

const AppCard: React.FC<AppCardProps> = ({ 
  title, description, icon, enabled, onToggle, onOpen, loading 
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
  >
    <div style={{ 
      display: 'flex',
      alignItems: 'flex-start',
      marginBottom: 20
    }}>
      <div style={{ 
        width: 48, height: 48, 
        borderRadius: 8, 
        background: 'linear-gradient(135deg, #fff2e8 0%, #ffbb96 100%)', // Orange theme for Personal Programs
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#d4380d', fontSize: 24,
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
      
      {onOpen && (
        <Button type="link" size="small" icon={<ArrowRightOutlined />} onClick={onOpen} style={{ padding: 0 }}>
          打开
        </Button>
      )}
    </div>
  </Card>
);

const AdminPersonalPrograms: React.FC = () => {
  const [xbkEnabled, setXbkEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const config = await xbkPublicConfigApi.get();
        if (!mounted) return;
        setXbkEnabled(Boolean(config.enabled));
      } catch {
        if (!mounted) return;
        setXbkEnabled(false);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleXbk = async (nextEnabled: boolean) => {
    const prev = xbkEnabled;
    setXbkEnabled(nextEnabled);
    setSaving(true);
    try {
      const res = await xbkPublicConfigApi.set(nextEnabled);
      setXbkEnabled(Boolean(res.enabled));
      message.success(res.enabled ? "已开启前台 XBK 入口" : "已关闭前台 XBK 入口");
    } catch (e) {
      setXbkEnabled(prev);
      message.error("更新失败，请确认已登录管理员账号");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPage>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, color: "#2c3e50" }}>个人程序管理</Title>
        <Text type="secondary">管理用户开发的个人程序入口与权限</Text>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <AppCard
            title="校本课 (XBK)"
            description="校本课程作业提交与处理系统，支持文件上传与自动化处理"
            icon={<AppstoreOutlined />}
            enabled={xbkEnabled}
            loading={loading || saving}
            onToggle={handleToggleXbk}
            onOpen={() => window.open("/xbk", "_blank")}
          />
        </Col>
      </Row>
    </AdminPage>
  );
};

export default AdminPersonalPrograms;
