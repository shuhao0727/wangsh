/**
 * AI智能体详情组件 - 模拟数据版
 */
import React from "react";
import { Row, Col, Tag, Typography, Modal, Button } from "antd";
import {
  LinkOutlined,
  KeyOutlined,
  ThunderboltOutlined,
  CloudOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { AIAgent } from "@services/znt/types";

const { Text } = Typography;

interface AgentDetailProps {
  visible: boolean;
  agent: AIAgent | null;
  onClose: () => void;
}

// 格式化API密钥显示
const formatApiKey = (key?: string): string => {
  if (!key) return "未设置";
  if (key.length <= 8) return "****";
  return `${key.substring(0, 4)}****${key.substring(key.length - 4)}`;
};

// 智能体类型标签映射
const getAgentTypeTag = (agentType: string) => {
  switch (agentType) {
    case "general":
      return (
        <Tag color="blue" icon={<ThunderboltOutlined />}>
          通用智能体
        </Tag>
      );
    case "dify":
      return (
        <Tag color="purple" icon={<CloudOutlined />}>
          Dify智能体
        </Tag>
      );
    default:
      return (
        <Tag color="default" icon={<ThunderboltOutlined />}>
          {agentType}
        </Tag>
      );
  }
};

const AgentDetail: React.FC<AgentDetailProps> = ({
  visible,
  agent,
  onClose,
}) => {
  if (!agent) return null;

  return (
    <Modal
      title="智能体详情"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={600}
    >
      <div>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Text strong>名称：</Text>
            <Text>{agent.name || agent.agent_name}</Text>
          </Col>
          <Col span={12}>
            <Text strong>类型：</Text>
            {getAgentTypeTag(agent.agent_type)}
          </Col>
        </Row>

        {agent.model_name && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Text strong>模型名称：</Text>
              <Text>{agent.model_name}</Text>
            </Col>
            <Col span={12}>
              <Text strong>状态：</Text>
              <Tag color={agent.is_active ? "success" : "error"}>
                {agent.is_active ? "启用" : "停用"}
              </Tag>
            </Col>
          </Row>
        )}

        {agent.description && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={24}>
              <Text strong>描述：</Text>
              <Text>{agent.description}</Text>
            </Col>
          </Row>
        )}

        {agent.api_endpoint && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={24}>
              <Text strong>API地址：</Text>
              <div style={{ marginTop: 4 }}>
                <LinkOutlined style={{ marginRight: 4, color: "#1890ff" }} />
                <Text copyable>{agent.api_endpoint}</Text>
              </div>
            </Col>
          </Row>
        )}

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Text strong>API密钥：</Text>
            <div style={{ marginTop: 4 }}>
              <KeyOutlined style={{ marginRight: 4, color: "#faad14" }} />
              <Tag color="orange">{formatApiKey(agent.api_key)}</Tag>
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                （部分隐藏）
              </Text>
            </div>
          </Col>
        </Row>

        {!agent.model_name && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Text strong>状态：</Text>
              <Tag color={agent.is_active ? "success" : "error"}>
                {agent.is_active ? "启用" : "停用"}
              </Tag>
            </Col>
            <Col span={12}>
              <Text strong>创建时间：</Text>
              <Text>{dayjs(agent.created_at).format("YYYY-MM-DD HH:mm")}</Text>
            </Col>
          </Row>
        )}

        {agent.model_name && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Text strong>创建时间：</Text>
              <Text>{dayjs(agent.created_at).format("YYYY-MM-DD HH:mm")}</Text>
            </Col>
            <Col span={12}>
              <Text strong>状态显示：</Text>
              <Tag color={agent.status ? "success" : "error"}>
                {agent.status ? "在线" : "离线"}
              </Tag>
            </Col>
          </Row>
        )}

        {agent.deleted_at && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={24}>
              <Text strong>删除时间：</Text>
              <Text>{dayjs(agent.deleted_at).format("YYYY-MM-DD HH:mm")}</Text>
            </Col>
          </Row>
        )}

        {agent.is_deleted && (
          <Row gutter={16}>
            <Col span={24}>
              <Text strong>已删除：</Text>
              <Tag color="error">是</Tag>
              {agent.deleted_at && (
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  （{dayjs(agent.deleted_at).format("YYYY-MM-DD HH:mm")}）
                </Text>
              )}
            </Col>
          </Row>
        )}
      </div>
    </Modal>
  );
};

export default AgentDetail;
