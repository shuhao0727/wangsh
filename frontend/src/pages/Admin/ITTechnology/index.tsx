import React from "react";
import { Typography, Card, Space, Button, Row, Col, Divider } from "antd";
import { PlusOutlined, EditOutlined } from "@ant-design/icons";

const { Text } = Typography;

const AdminITTechnology: React.FC = () => {
  return (
    <div className="admin-it-technology">
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <Space>
          <Button type="primary" icon={<PlusOutlined />}>
            添加技术文章
          </Button>
        </Space>
      </div>

      <Card title="技术分类">
        <Text type="secondary">功能开发中...</Text>
        <Divider />
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Card
              size="small"
              title="前端开发"
              extra={<Button size="small" icon={<EditOutlined />} />}
            >
              <Text>React, Vue, TypeScript 等前端技术</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card
              size="small"
              title="后端开发"
              extra={<Button size="small" icon={<EditOutlined />} />}
            >
              <Text>Python, Node.js, 数据库等技术</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card
              size="small"
              title="DevOps"
              extra={<Button size="small" icon={<EditOutlined />} />}
            >
              <Text>Docker, Kubernetes, CI/CD 等技术</Text>
            </Card>
          </Col>
        </Row>
      </Card>

    </div>
  );
};

export default AdminITTechnology;
