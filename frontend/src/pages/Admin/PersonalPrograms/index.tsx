import React, { useEffect, useState } from "react";
import { Typography, Card, Space, Button, Switch, message, Tag } from "antd";
import { AppstoreOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { xbkPublicConfigApi } from "@services";

const { Text } = Typography;

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
    <div className="admin-personal-programs">
      <Card
        style={{ borderRadius: 12, border: "1px solid var(--ws-color-border)" }}
        styles={{ body: { padding: 18 } }}
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Space
            align="center"
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            <Space align="center" size={10}>
              <AppstoreOutlined style={{ color: "#fa541c" }} />
              <Text strong style={{ fontSize: 16 }}>
                个人程序管理
              </Text>
              <Tag color="orange">XBK 已接入</Tag>
            </Space>
            <Button
              icon={<ArrowRightOutlined />}
              onClick={() => window.open("/xbk", "_blank")}
            >
              打开 XBK
            </Button>
          </Space>

          <Space align="center" style={{ justifyContent: "space-between" }}>
            <Space align="center" size={10}>
              <Text>前台公开入口</Text>
              <Switch
                checked={xbkEnabled}
                loading={loading || saving}
                onChange={handleToggleXbk}
              />
              <Text type="secondary">校本课（XBK）处理系统</Text>
            </Space>
            <Text type="secondary">
              开启后，“个人程序”公开页会显示 XBK 入口
            </Text>
          </Space>
        </Space>
      </Card>
    </div>
  );
};

export default AdminPersonalPrograms;
