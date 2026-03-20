import React from "react";
import { Avatar, Button, Space, Tag, Select, Badge, Tooltip, Flex, Typography } from "antd";
import {
  SettingOutlined,
  HistoryOutlined,
  SendOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { AgentSidebarProps } from "./types";

const { Text } = Typography;
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
  if (!currentAgent) {
    return (
      <div className="agent-sidebar">
        <div className="agent-sidebar-empty">
          <Text type="secondary">正在加载智能体...</Text>
        </div>
      </div>
    );
  }

  const formatTimestamp = (timestamp: string) => {
    return dayjs(timestamp).format("MM-DD HH:mm");
  };

  return (
    <div className="agent-sidebar">
      {/* 头部 */}
      <div className="agent-sidebar-header">
        <Space>
          <SettingOutlined />
          <Text strong>智能体</Text>
        </Space>
        {onToggleSidebar && (
          <Tooltip title="隐藏侧边栏">
            <Button type="text" size="small" icon={<HistoryOutlined />} onClick={onToggleSidebar} />
          </Tooltip>
        )}
      </div>

      {/* 智能体选择器 */}
      <div className="agent-sidebar-selector">
        <Text type="secondary" className="agent-sidebar-label">当前智能体</Text>
        <Select
          value={currentAgent.id}
          onChange={onAgentChange}
          style={{ width: "100%" }}
          optionLabelProp="label"
        >
          {agents.map((agent) => (
            <Option key={agent.id} value={agent.id} label={agent.name}>
              <Space>
                <Avatar
                  shape="square"
                  size="small"
                  icon={agent.icon}
                  style={{ backgroundColor: agent.color, borderRadius: 6 }}
                />
                <span>{agent.name}</span>
                <Badge status={agent.status === "online" ? "success" : "default"} />
              </Space>
            </Option>
          ))}
        </Select>
      </div>

      {/* 智能体详情 */}
      <div className="agent-sidebar-detail">
        <Flex align="flex-start" gap={12}>
          <Avatar
            shape="square"
            size={40}
            icon={currentAgent.icon}
            style={{ backgroundColor: currentAgent.color, flexShrink: 0, borderRadius: 8 }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="agent-sidebar-detail-head">
              <Text strong style={{ fontSize: 14 }}>{currentAgent.name}</Text>
              <Tag
                color={currentAgent.status === "online" ? "success" : "default"}
                className="agent-status-tag"
              >
                {currentAgent.status === "online" ? "在线" : "离线"}
              </Tag>
            </div>
            <div className="agent-sidebar-desc">{currentAgent.description}</div>
          </div>
        </Flex>
      </div>

      {/* 对话记录 */}
      <div className="agent-sidebar-sessions">
        <div className="agent-sidebar-sessions-header">
          <Text type="secondary" className="agent-sidebar-label">对话记录</Text>
          <Button type="link" size="small" icon={<SendOutlined />} onClick={onStartNewConversation} style={{ padding: 0, height: "auto" }}>
            新对话
          </Button>
        </div>

        <div className="agent-sidebar-sessions-list">
          {sessions.length === 0 ? (
            <div className="agent-sidebar-sessions-empty">
              <HistoryOutlined style={{ fontSize: 24, opacity: 0.3 }} />
              <div>暂无历史记录</div>
            </div>
          ) : (
            <div className="agent-sidebar-sessions-items">
              {sessions.map((s) => (
                <div
                  key={s.session_id}
                  className={`agent-session-item ${s.session_id === currentSessionId ? "active" : ""}`}
                  onClick={() => onSelectSession(s.session_id)}
                >
                  <div className="agent-session-item-meta">
                    <Tag color="blue" className="agent-session-tag">{s.turns}轮</Tag>
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      {formatTimestamp(s.last_at)}
                    </Text>
                  </div>
                  <div className="agent-session-item-preview">
                    {s.preview || "新对话"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentSidebar;
