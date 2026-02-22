import React from "react";
import { Card, Avatar, Button, Space, Tag, Select, Badge, Tooltip, Flex, Divider, Typography } from "antd";
import {
  SettingOutlined,
  HistoryOutlined,
  SendOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { AgentSidebarProps } from "./types";

const { Text, Title } = Typography;
const { Option } = Select;

const AgentSidebar: React.FC<AgentSidebarProps> = ({
  agents,
  currentAgent,
  sessions,
  currentSessionId,
  historyVisible,
  onAgentChange,
  onToggleSidebar,
  onStartNewConversation,
  onSelectSession,
}) => {
  // 如果当前智能体为null，显示空状态
  if (!currentAgent) {
    return (
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>智能体列表</span>
          </Space>
        }
        style={{ height: "100%" }}
      >
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <Text type="secondary">正在加载智能体...</Text>
        </div>
      </Card>
    );
  }

  // 格式化时间戳
  const formatTimestamp = (timestamp: string) => {
    return dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss");
  };

  return (
    <Card
      title={
        <Space>
          <SettingOutlined />
          <span>智能体列表</span>
        </Space>
      }
      style={{ height: "100%" }}
      extra={
        <Tooltip title="隐藏侧边栏">
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={onToggleSidebar}
          />
        </Tooltip>
      }
    >
      {/* 智能体选择器 */}
      <div style={{ marginBottom: "24px" }}>
        <Text strong style={{ display: "block", marginBottom: "12px" }}>
          选择智能体：
        </Text>
        <Select
          value={currentAgent.id}
          onChange={onAgentChange}
          style={{ width: "100%" }}
          size="middle"
        >
          {agents.map((agent) => (
            <Option key={agent.id} value={agent.id}>
              <Space>
                <Avatar
                  size="small"
                  icon={agent.icon}
                  style={{ backgroundColor: agent.color }}
                />
                <span>{agent.name}</span>
                <Badge
                  status={agent.status === "online" ? "success" : "default"}
                  text={agent.status === "online" ? "在线" : "离线"}
                />
              </Space>
            </Option>
          ))}
        </Select>
      </div>

      {/* 智能体详情卡片 */}
      <Card
        size="small"
        style={{
          borderLeft: `4px solid ${currentAgent.color}`,
          marginBottom: "16px",
        }}
        styles={{ body: { padding: "12px" } }}
      >
        <Space orientation="vertical" size={4} style={{ width: "100%" }}>
          <Flex align="center" gap="small">
            <Avatar
              size="default"
              icon={currentAgent.icon}
              style={{ backgroundColor: currentAgent.color }}
            />
            <div>
              <Text strong style={{ color: currentAgent.color, fontSize: "14px" }}>
                {currentAgent.name}
              </Text>
              <div style={{ fontSize: "12px", color: "var(--ws-color-text-secondary)", lineHeight: 1.2 }}>
                {currentAgent.description}
              </div>
            </div>
          </Flex>
          <div style={{ marginTop: 4 }}>
             <Tag color={currentAgent.status === "online" ? "success" : "default"} style={{ margin: 0, fontSize: "10px", lineHeight: "18px" }}>
              {currentAgent.status === "online" ? "在线" : "离线"}
            </Tag>
          </div>
        </Space>
      </Card>

      <div>
        <Text strong style={{ display: "block", marginBottom: "12px" }}>对话记录</Text>
        <div style={{ maxHeight: "300px", overflowY: "auto" }}>
          {sessions.map((s) => (
            <div
              key={s.session_id}
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid var(--ws-color-border)",
                cursor: "pointer",
                background: s.session_id === currentSessionId ? "#e6f7ff" : "#ffffff",
                borderRadius: 6,
                margin: "4px 8px",
              }}
              onClick={() => onSelectSession(s.session_id)}
            >
              <Space align="start">
                <Avatar
                  size="small"
                  icon={currentAgent.icon}
                  style={{
                    backgroundColor: currentAgent.color,
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <Space size="small">
                    <Text style={{ fontSize: "12px" }}>{currentAgent.name}</Text>
                    <Text type="secondary" style={{ fontSize: "10px" }}>
                      <ClockCircleOutlined /> {formatTimestamp(s.last_at)}
                    </Text>
                    <Tag style={{ marginInlineStart: 0 }} color="blue">
                      {s.turns}轮
                    </Tag>
                  </Space>
                  <div style={{ marginTop: 4 }}>
                    <Text
                      style={{
                        fontSize: "12px",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {s.preview || "（空）"}
                    </Text>
                  </div>
                </div>
              </Space>
            </div>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <Divider style={{ margin: "16px 0" }} />
      <Space orientation="vertical" style={{ width: "100%" }}>
        <Button
          block
          type="primary"
          icon={<SendOutlined style={{ color: "inherit" }} />}
          onClick={onStartNewConversation}
        >
          开始新对话
        </Button>
      </Space>
    </Card>
  );
};

export default AgentSidebar;
