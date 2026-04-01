import React, { useEffect, useState } from "react";
import { Card, Row, Col, Button, Tag, Typography, Skeleton } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";
import EmptyState from "@components/Common/EmptyState";
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
    <div className="max-w-[var(--ws-page-max-width-wide)] mx-auto p-[var(--ws-space-3)] sm:p-[var(--ws-space-4)] md:p-[var(--ws-space-5)]">
      {loading ? (
        <Card className="!rounded-xl !border-none !bg-surface-2">
          <div className="py-7 text-center">
            <Skeleton active />
          </div>
        </Card>
      ) : xbkEnabled ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} lg={8}>
            <Card
              className="!rounded-xl !border-none !bg-surface-2"
              styles={{ body: { padding: "var(--ws-space-3)" } }}
            >
              <div className="flex flex-col gap-2.5 w-full">
                <div className="flex items-center justify-between">
                  <Text strong className="!text-sm sm:!text-base">
                    校本课（XBK）处理系统
                  </Text>
                  <Tag color="orange">新</Tag>
                </div>
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
              </div>
            </Card>
          </Col>
        </Row>
      ) : (
        <Card className="!rounded-xl !border-none !bg-surface-2">
          <EmptyState description="暂无公开的个人程序" />
        </Card>
      )}
    </div>
  );
};

export default PersonalProgramsPage;
