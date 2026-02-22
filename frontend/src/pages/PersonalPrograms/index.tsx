import React, { useEffect, useState } from "react";
import { Card, Row, Col, Button, Spin, Empty, Space, Tag, Typography } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";
import { xbkPublicConfigApi } from "@services";

const { Text } = Typography;

const PersonalProgramsPage: React.FC = () => {
  const [xbkEnabled, setXbkEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

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

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", padding: "32px" }}>
      {loading ? (
        <Card style={{ borderRadius: 12, border: "1px solid var(--ws-color-border)" }}>
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <Spin />
          </div>
        </Card>
      ) : xbkEnabled ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} lg={8}>
            <Card
              style={{ borderRadius: 12, border: "1px solid var(--ws-color-border)" }}
              styles={{ body: { padding: 18 } }}
            >
              <Space orientation="vertical" size={10} style={{ width: "100%" }}>
                <Space align="center" style={{ justifyContent: "space-between" }}>
                  <Text strong style={{ fontSize: 16 }}>
                    校本课（XBK）处理系统
                  </Text>
                  <Tag color="orange">新</Tag>
                </Space>
                <Text type="secondary">
                  第一阶段：页面与流程框架；数据处理将在下一阶段上线
                </Text>
                <div>
                  <Button
                    type="primary"
                    icon={<ArrowRightOutlined />}
                    onClick={() => window.open("/xbk", "_blank")}
                  >
                    进入
                  </Button>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      ) : (
        <Card style={{ borderRadius: 12, border: "1px solid var(--ws-color-border)" }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无公开的个人程序"
          />
        </Card>
      )}
    </div>
  );
};

export default PersonalProgramsPage;
