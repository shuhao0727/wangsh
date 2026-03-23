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
        <div className="flex items-center">
          <DatabaseOutlined className="mr-2 text-primary" />
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
      styles={{ body: { padding: 24 } }}
    >
      <div className="overflow-y-auto" style={{ maxHeight: "70vh" }}>
        {/* 基本信息区域 */}
        <div className="mb-6">
          <Title level={4} className="mb-4">
            <MessageOutlined className="mr-2" />
            对话信息
          </Title>

          <Row gutter={24} className="mb-4">
            <Col span={12}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="记录ID">
                  <Text strong>{record.id}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="会话ID">
                  <Tag
                    icon={<CopyOutlined />}
                    className="font-mono"
                  >
                    {record.session_id || "未记录"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="响应时间">
                  <div className="flex items-center">
                    <ClockCircleOutlined
                      className="mr-1 text-warning"
                    />
                    <Text>{formatResponseTime(record.response_time_ms)}</Text>
                  </div>
                </Descriptions.Item>
              </Descriptions>
            </Col>

            <Col span={12}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="使用时间">
                  <div className="flex items-center">
                    <CalendarOutlined
                      className="mr-1 text-primary"
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
        <div className="mb-6">
          <Title level={4} className="mb-4">
            <UserOutlined className="mr-2" />
            学生信息
          </Title>

          {user ? (
            <Row gutter={24}>
              <Col span={8}>
                <div className="mb-3">
                  <Text strong className="block mb-1">
                    姓名
                  </Text>
                  <Text>{user.name}</Text>
                </div>
              </Col>

              <Col span={8}>
                <div className="mb-3">
                  <Text strong className="block mb-1">
                    学号
                  </Text>
                  <Text copyable>{user.student_id}</Text>
                </div>
              </Col>

              <Col span={8}>
                <div className="mb-3">
                  <Text strong className="block mb-1">
                    状态
                  </Text>
                  <Tag color={user.is_active ? "success" : "error"}>
                    {user.is_active ? "活跃" : "未激活"}
                  </Tag>
                </div>
              </Col>

              <Col span={12}>
                <div className="mb-3">
                  <Text strong className="block mb-1">
                    班级
                  </Text>
                  <Text>{user.class_name}</Text>
                </div>
              </Col>

              <Col span={12}>
                <div className="mb-3">
                  <Text strong className="block mb-1">
                    学年
                  </Text>
                  <Text>{user.grade}</Text>
                </div>
              </Col>
            </Row>
          ) : (
            <Alert
              message="用户信息未关联"
              description="此记录未关联到具体的用户信息"
              type="warning"
              showIcon
            />
          )}
        </div>

        <Divider />

        {/* 智能体信息区域 */}
        <div className="mb-6">
          <Title level={4} className="mb-4">
            <RobotOutlined className="mr-2" />
            智能体信息
          </Title>

          {agent ? (
            <Row gutter={24}>
              <Col span={12}>
                <div className="mb-3">
                  <Text strong className="block mb-1">
                    智能体名称
                  </Text>
                  <div className="flex items-center">
                    {agentTypeConfigItem.icon}
                    <Text className="ml-2">{agent.agent_name}</Text>
                  </div>
                </div>
              </Col>

              <Col span={12}>
                <div className="mb-3">
                  <Text strong className="block mb-1">
                    智能体类型
                  </Text>
                  <Tag color={agentTypeConfigItem.color}>
                    {agentTypeConfigItem.text}
                  </Tag>
                </div>
              </Col>

              <Col span={12}>
                <div className="mb-3">
                  <Text strong className="block mb-1">
                    模型名称
                  </Text>
                  <Text>{agent.model_name}</Text>
                </div>
              </Col>

              <Col span={12}>
                <div className="mb-3">
                  <Text strong className="block mb-1">
                    创建者
                  </Text>
                  <Text>用户ID: {agent.user_id}</Text>
                </div>
              </Col>
            </Row>
          ) : (
            <Alert
              message="智能体信息未关联"
              description="此记录未关联到具体的智能体信息"
              type="warning"
              showIcon
            />
          )}
        </div>

        <Divider />

        {/* 完整对话区域 */}
        <div className="mb-4">
          <Title level={4} className="mb-4">
            <MessageOutlined className="mr-2" />
            完整对话
          </Title>

          {conversationLoading ? (
            <div className="text-center py-6">
              <Spin />
            </div>
          ) : conversationMessages.length > 0 ? (
            <div>
              {conversationMessages.map((m) => {
                const isQuestion = m.message_type === "question";
                const isAnswer = m.message_type === "answer";
                const borderColor = isQuestion
                  ? "#0EA5E9"
                  : isAnswer
                    ? "#10B981"
                    : "rgba(0,0,0,0.08)";
                const background = isQuestion
                  ? "#FAFAFA"
                  : isAnswer
                    ? "rgba(14, 165, 233, 0.06)"
                    : "#FAFAFA";
                const label = isQuestion ? "Q" : isAnswer ? "A" : m.message_type;
                return (
                  <div key={m.id} className="mb-3">
                    <div className="mb-1 flex gap-2 items-center">
                      <Tag color={isQuestion ? "blue" : isAnswer ? "green" : "cyan"} style={{ marginInlineEnd: 0 }}>
                        {label}
                      </Tag>
                      <Text type="secondary" className="text-xs">
                        {dayjs(m.created_at).format("YYYY-MM-DD HH:mm:ss")}
                      </Text>
                    </div>
                    <div
                      className="px-4 py-3 rounded-md"
                      style={{
                        backgroundColor: background,
                        borderLeft: `4px solid ${borderColor}`,
                      }}
                    >
                      <Paragraph className="!m-0 leading-relaxed whitespace-pre-wrap">
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
                message="未加载到完整对话"
                description="当前记录未关联会话，或会话已被清理"
                type="warning"
                showIcon
              />
              <div className="mt-4">
                <Title level={5} className="mb-2">
                  单轮摘要
                </Title>
                <div className="bg-gray-50 px-4 py-3 rounded-md mb-3" style={{ borderLeft: "4px solid #0EA5E9" }}>
                  <Paragraph className="!m-0 leading-relaxed whitespace-pre-wrap">
                    {record.question}
                  </Paragraph>
                </div>
                <div className="px-4 py-3 rounded-md" style={{ backgroundColor: "rgba(14, 165, 233, 0.06)", borderLeft: "4px solid #10B981" }}>
                  <Paragraph className="!m-0 leading-relaxed whitespace-pre-wrap">
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
            <div className="mb-4">
              <Title level={4} className="mb-4">
                附加信息
              </Title>
              <Alert
                message="附加数据"
                description={
                  <pre className="text-xs !m-0">
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
        <div className="mt-6 p-4 bg-gray-50 rounded-md border border-black/5">
          <Row gutter={24}>
            <Col span={8} className="text-center">
              <div>
                <Text
                  type="secondary"
                  className="block text-xs"
                >
                  问题字数
                </Text>
                <Title level={3} className="!my-2">
                  {record.question ? record.question.length : 0}
                </Title>
              </div>
            </Col>

            <Col span={8} className="text-center">
              <div>
                <Text
                  type="secondary"
                  className="block text-xs"
                >
                  回答字数
                </Text>
                <Title level={3} className="!my-2">
                  {record.answer ? record.answer.length : 0}
                </Title>
              </div>
            </Col>

            <Col span={8} className="text-center">
              <div>
                <Text
                  type="secondary"
                  className="block text-xs"
                >
                  响应时间
                </Text>
                <Title level={3} className="!my-2">
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
