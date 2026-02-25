import React, { useEffect, useState } from "react";
import { Typography, message, Row, Col } from "antd";
import { AppstoreOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { xbkPublicConfigApi } from "@services";
import { AdminAppCard, AdminPage } from "@/components/Admin";

const { Title } = Typography;

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
    <AdminPage padding={16}>
      <div style={{ marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0, color: "#2c3e50" }}>
          个人程序管理
        </Title>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <AdminAppCard
            title="校本课 (XBK)"
            description="校本课程作业提交与处理系统，支持文件上传与自动化处理"
            icon={<AppstoreOutlined />}
            enabled={xbkEnabled}
            loading={loading || saving}
            onToggle={handleToggleXbk}
            theme="orange"
            actionLabel="打开"
            actionIcon={<ArrowRightOutlined />}
            onAction={() => window.open("/xbk", "_blank")}
          />
        </Col>
      </Row>
    </AdminPage>
  );
};

export default AdminPersonalPrograms;
