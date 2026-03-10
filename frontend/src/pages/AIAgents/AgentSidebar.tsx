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
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <Space>
          <SettingOutlined />
          <Text strong style={{ fontSize: "16px" }}>智能体列表</Text>
        </Space>
        {onToggleSidebar && (
          <Tooltip title="隐藏侧边栏">
            <Button
              type="text"
              size="small"
              icon={<HistoryOutlined />}
              onClick={onToggleSidebar}
            />
          </Tooltip>
        )}
      </div>

      {/* 智能体选择器 */}
      <div style={{ marginBottom: "20px" }}>
        <Text type="secondary" style={{ display: "block", marginBottom: "8px", fontSize: "12px" }}>
          当前智能体
        </Text>
        <Select
          value={currentAgent.id}
          onChange={onAgentChange}
          style={{ width: "100%" }}
          size="large"
          optionLabelProp="label"
        >
          {agents.map((agent) => (
            <Option key={agent.id} value={agent.id} label={agent.name}>
              <Space>
                <Avatar
                  shape="square"
                  size="small"
                  icon={agent.icon}
                  style={{ backgroundColor: agent.color, borderRadius: "4px" }}
                />
                <span>{agent.name}</span>
                <Badge
                  status={agent.status === "online" ? "success" : "default"}
                />
              </Space>
            </Option>
          ))}
        </Select>
      </div>

      {/* 智能体详情卡片 */}
      <div
        style={{
          padding: "12px",
          background: "var(--ws-color-bg-container)",
          borderRadius: "8px",
          border: "1px solid var(--ws-color-border)",
          marginBottom: "20px",
        }}
      >
        <Flex align="flex-start" gap="12px">
          <Avatar
            shape="square"
            size={40}
            icon={currentAgent.icon}
            style={{ backgroundColor: currentAgent.color, flexShrink: 0, borderRadius: "8px" }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <Text strong style={{ fontSize: "14px" }}>
                {currentAgent.name}
              </Text>
              <Tag color={currentAgent.status === "online" ? "success" : "default"} style={{ margin: 0, fontSize: "10px", lineHeight: "16px", height: "18px", border: "none" }}>
                {currentAgent.status === "online" ? "在线" : "离线"}
              </Tag>
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--ws-color-text-secondary)",
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {currentAgent.description}
            </div>
          </div>
        </Flex>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <Text type="secondary" style={{ fontSize: "12px" }}>对话记录</Text>
          <Button 
            type="link" 
            size="small" 
            icon={<SendOutlined />} 
            onClick={onStartNewConversation}
            style={{ padding: 0, height: "auto" }}
          >
            新对话
          </Button>
        </div>
        
        <div style={{ flex: 1, overflowY: "auto", margin: "0 -8px", padding: "0 8px" }}>
          {sessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--ws-color-text-tertiary)" }}>
              <HistoryOutlined style={{ fontSize: "24px", marginBottom: "8px", opacity: 0.5 }} />
              <div style={{ fontSize: "12px" }}>暂无历史记录</div>
            </div>
          ) : (
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              {sessions.map((s) => (
                <div
                  key={s.session_id}
                  className={`session-item ${s.session_id === currentSessionId ? "active" : ""}`}
                  style={{
                    padding: "10px",
                    cursor: "pointer",
                    borderRadius: "8px",
                    transition: "all 0.2s",
                    background: s.session_id === currentSessionId ? "var(--ws-color-primary-bg)" : "transparent",
                    border: s.session_id === currentSessionId ? "1px solid var(--ws-color-primary-border)" : "1px solid transparent",
                  }}
                  onClick={() => onSelectSession(s.session_id)}
                  onMouseEnter={(e) => {
                    if (s.session_id !== currentSessionId) {
                      e.currentTarget.style.background = "rgba(0,0,0,0.02)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (s.session_id !== currentSessionId) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <Tag color="blue" style={{ margin: 0, fontSize: "10px", lineHeight: "16px", height: "18px" }}>
                      {s.turns}轮
                    </Tag>
                    <Text type="secondary" style={{ fontSize: "10px" }}>
                      {formatTimestamp(s.last_at).split(" ")[0]}
                    </Text>
                  </div>
                  <Text
                    style={{
                      fontSize: "13px",
                      color: s.session_id === currentSessionId ? "var(--ws-color-primary)" : "var(--ws-color-text)",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      lineHeight: 1.4,
                    }}
                  >
                    {s.preview || "新对话"}
                  </Text>
                </div>
              ))}
            </Space>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentSidebar;
