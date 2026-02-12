/**
 * 智能体数据详情弹窗组件
 * 显示智能体使用记录的完整信息
 */
import React, { useEffect, useState } from "react";
import {
  Row,
  Col,
  Tag,
  Typography,
  Modal,
  Button,
  Divider,
  Alert,
  Descriptions,
  Spin,
} from "antd";
import {
  UserOutlined,
  RobotOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  DatabaseOutlined,
  CopyOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import type { AgentUsageData } from "@services/znt/types";
import { agentDataApi } from "@services/agents";

const { Text, Title, Paragraph } = Typography;

interface DetailModalProps {
  visible: boolean;
  record: AgentUsageData | null;
  onClose: () => void;
}

// 格式化响应时间
const formatResponseTime = (ms?: number) => {
  if (!ms) return "未知";
  if (ms < 1000) return `${ms}毫秒`;
  return `${(ms / 1000).toFixed(2)}秒`;
};

// 智能体类型标签配置
const agentTypeConfig = {
  general: {
    color: "blue" as const,
    text: "通用智能体",
    icon: <RobotOutlined />,
  },
  dify: {
    color: "purple" as const,
    text: "Dify智能体",
    icon: <RobotOutlined />,
  },
  default: {
    color: "cyan" as const,
    text: "未知类型",
    icon: <RobotOutlined />,
  },
};

const DetailModal: React.FC<DetailModalProps> = ({
  visible,
  record,
  onClose,
}) => {
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationMessages, setConversationMessages] = useState<
    Array<{
      id: number;
      session_id: string;
      message_type: string;
      content: string;
      created_at: string;
    }>
  >([]);

  useEffect(() => {
    const sessionId = record?.session_id;
    if (!visible) return;
    if (!sessionId) {
      setConversationMessages([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setConversationLoading(true);
      try {
        const res = await agentDataApi.getConversationMessagesAdmin(sessionId);
        if (cancelled) return;
        if (res.success) {
          setConversationMessages(res.data);
        } else {
          setConversationMessages([]);
        }
      } finally {
        if (!cancelled) setConversationLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [record?.session_id, visible]);

  if (!record) return null;

  const user = record.user;
  const agent = record.moxing;
  const agentTypeConfigItem = agent
    ? agentTypeConfig[agent.agent_type as keyof typeof agentTypeConfig] ||
      agentTypeConfig.default
    : agentTypeConfig.default;

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center" }}>
          <DatabaseOutlined style={{ marginRight: 8, color: "#1890ff" }} />
          <span>智能体使用记录详情</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={800}
    >
      <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
        {/* 基本信息区域 */}
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 16 }}>
            <MessageOutlined style={{ marginRight: 8 }} />
            对话信息
          </Title>

          <Row gutter={24} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="记录ID">
                  <Text strong>{record.id}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="会话ID">
                  <Tag
                    icon={<CopyOutlined />}
                    style={{ fontFamily: "monospace" }}
                  >
                    {record.session_id || "未记录"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="响应时间">
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <ClockCircleOutlined
                      style={{ marginRight: 4, color: "#fa8c16" }}
                    />
                    <Text>{formatResponseTime(record.response_time_ms)}</Text>
                  </div>
                </Descriptions.Item>
              </Descriptions>
            </Col>

            <Col span={12}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="使用时间">
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <CalendarOutlined
                      style={{ marginRight: 4, color: "#1890ff" }}
                    />
                    <Text>
                      {dayjs(record.used_at).format("YYYY-MM-DD HH:mm:ss")}
                    </Text>
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="用户ID">
                  <Text>{record.user_id}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="智能体ID">
                  <Text>{record.moxing_id}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Col>
          </Row>
        </div>

        <Divider />

        {/* 学生信息区域 */}
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 16 }}>
            <UserOutlined style={{ marginRight: 8 }} />
            学生信息
          </Title>

          {user ? (
            <Row gutter={24}>
              <Col span={8}>
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ display: "block", marginBottom: 4 }}>
                    姓名
                  </Text>
                  <Text>{user.name}</Text>
                </div>
              </Col>

              <Col span={8}>
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ display: "block", marginBottom: 4 }}>
                    学号
                  </Text>
                  <Text copyable>{user.student_id}</Text>
                </div>
              </Col>

              <Col span={8}>
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ display: "block", marginBottom: 4 }}>
                    状态
                  </Text>
                  <Tag color={user.is_active ? "success" : "error"}>
                    {user.is_active ? "活跃" : "未激活"}
                  </Tag>
                </div>
              </Col>

              <Col span={12}>
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ display: "block", marginBottom: 4 }}>
                    班级
                  </Text>
                  <Text>{user.class_name}</Text>
                </div>
              </Col>

              <Col span={12}>
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ display: "block", marginBottom: 4 }}>
                    学年
                  </Text>
                  <Text>{user.grade}</Text>
                </div>
              </Col>
            </Row>
          ) : (
            <Alert
              title="用户信息未关联"
              description="此记录未关联到具体的用户信息"
              type="warning"
              showIcon
            />
          )}
        </div>

        <Divider />

        {/* 智能体信息区域 */}
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 16 }}>
            <RobotOutlined style={{ marginRight: 8 }} />
            智能体信息
          </Title>

          {agent ? (
            <Row gutter={24}>
              <Col span={12}>
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ display: "block", marginBottom: 4 }}>
                    智能体名称
                  </Text>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {agentTypeConfigItem.icon}
                    <Text style={{ marginLeft: 8 }}>{agent.agent_name}</Text>
                  </div>
                </div>
              </Col>

              <Col span={12}>
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ display: "block", marginBottom: 4 }}>
                    智能体类型
                  </Text>
                  <Tag color={agentTypeConfigItem.color}>
                    {agentTypeConfigItem.text}
                  </Tag>
                </div>
              </Col>

              <Col span={12}>
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ display: "block", marginBottom: 4 }}>
                    模型名称
                  </Text>
                  <Text>{agent.model_name}</Text>
                </div>
              </Col>

              <Col span={12}>
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ display: "block", marginBottom: 4 }}>
                    创建者
                  </Text>
                  <Text>用户ID: {agent.user_id}</Text>
                </div>
              </Col>
            </Row>
          ) : (
            <Alert
              title="智能体信息未关联"
              description="此记录未关联到具体的智能体信息"
              type="warning"
              showIcon
            />
          )}
        </div>

        <Divider />

        {/* 完整对话区域 */}
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ marginBottom: 16 }}>
            <MessageOutlined style={{ marginRight: 8 }} />
            完整对话
          </Title>

          {conversationLoading ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <Spin />
            </div>
          ) : conversationMessages.length > 0 ? (
            <div>
              {conversationMessages.map((m) => {
                const isQuestion = m.message_type === "question";
                const isAnswer = m.message_type === "answer";
                const borderColor = isQuestion
                  ? "var(--ws-color-primary)"
                  : isAnswer
                    ? "var(--ws-color-success)"
                    : "var(--ws-color-border)";
                const background = isQuestion
                  ? "var(--ws-color-surface-2)"
                  : isAnswer
                    ? "var(--ws-color-info-soft)"
                    : "var(--ws-color-surface-2)";
                const label = isQuestion ? "Q" : isAnswer ? "A" : m.message_type;
                return (
                  <div key={m.id} style={{ marginBottom: 12 }}>
                    <div style={{ marginBottom: 4, display: "flex", gap: 8, alignItems: "center" }}>
                      <Tag color={isQuestion ? "blue" : isAnswer ? "green" : "cyan"} style={{ marginInlineEnd: 0 }}>
                        {label}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(m.created_at).format("YYYY-MM-DD HH:mm:ss")}
                      </Text>
                    </div>
                    <div
                      style={{
                        backgroundColor: background,
                        padding: "12px 16px",
                        borderRadius: 6,
                        borderLeft: `4px solid ${borderColor}`,
                      }}
                    >
                      <Paragraph style={{ margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {m.content}
                      </Paragraph>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <Alert
                title="未加载到完整对话"
                description="当前记录未关联会话，或会话已被清理"
                type="warning"
                showIcon
              />
              <div style={{ marginTop: 16 }}>
                <Title level={5} style={{ marginBottom: 8 }}>
                  单轮摘要
                </Title>
                <div
                  style={{
                    backgroundColor: "#f9f9f9",
                    padding: "12px 16px",
                    borderRadius: "6px",
                    borderLeft: "4px solid #1890ff",
                    marginBottom: 12,
                  }}
                >
                  <Paragraph style={{ margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {record.question}
                  </Paragraph>
                </div>
                <div
                  style={{
                    backgroundColor: "#f0f9ff",
                    padding: "12px 16px",
                    borderRadius: "6px",
                    borderLeft: "4px solid #52c41a",
                  }}
                >
                  <Paragraph style={{ margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {record.answer}
                  </Paragraph>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 附加数据信息（如果有） */}
        {record.additional_data && (
          <>
            <Divider />
            <div style={{ marginBottom: 16 }}>
              <Title level={4} style={{ marginBottom: 16 }}>
                附加信息
              </Title>
              <Alert
                title="附加数据"
                description={
                  <pre style={{ fontSize: "12px", margin: 0 }}>
                    {JSON.stringify(record.additional_data, null, 2)}
                  </pre>
                }
                type="info"
                showIcon
              />
            </div>
          </>
        )}

        {/* 统计信息 */}
        <div
          style={{
            marginTop: 24,
            padding: "16px",
            backgroundColor: "var(--ws-color-surface-2)",
            borderRadius: "6px",
            border: "1px solid var(--ws-color-border)",
          }}
        >
          <Row gutter={24}>
            <Col span={8} style={{ textAlign: "center" }}>
              <div>
                <Text
                  type="secondary"
                  style={{ display: "block", fontSize: "12px" }}
                >
                  问题字数
                </Text>
                <Title level={3} style={{ margin: "8px 0" }}>
                  {record.question ? record.question.length : 0}
                </Title>
              </div>
            </Col>

            <Col span={8} style={{ textAlign: "center" }}>
              <div>
                <Text
                  type="secondary"
                  style={{ display: "block", fontSize: "12px" }}
                >
                  回答字数
                </Text>
                <Title level={3} style={{ margin: "8px 0" }}>
                  {record.answer ? record.answer.length : 0}
                </Title>
              </div>
            </Col>

            <Col span={8} style={{ textAlign: "center" }}>
              <div>
                <Text
                  type="secondary"
                  style={{ display: "block", fontSize: "12px" }}
                >
                  响应时间
                </Text>
                <Title level={3} style={{ margin: "8px 0" }}>
                  {record.response_time_ms
                    ? formatResponseTime(record.response_time_ms)
                    : "未知"}
                </Title>
              </div>
            </Col>
          </Row>
        </div>
      </div>
    </Modal>
  );
};

export default DetailModal;
