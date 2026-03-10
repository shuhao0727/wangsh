import React, { useEffect, useState } from "react";
import { Card, Row, Col, Button, Empty, Space, Tag, Typography, Skeleton } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";
import { xbkPublicConfigApi } from "@services";
import "./PersonalPrograms.css";

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
    <div className="personal-programs-page">
      {loading ? (
        <Card className="personal-programs-card">
          <div className="personal-programs-loading">
            <Skeleton active />
          </div>
        </Card>
      ) : xbkEnabled ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} lg={8}>
            <Card
              className="personal-programs-card"
              styles={{ body: { padding: "var(--ws-space-3)" } }}
            >
              <Space orientation="vertical" size={10} style={{ width: "100%" }}>
                <Space align="center" style={{ justifyContent: "space-between" }}>
                  <Text strong style={{ fontSize: "var(--ws-text-md)" }}>
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
        <Card className="personal-programs-card">
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
