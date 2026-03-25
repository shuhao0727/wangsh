import React, { useState, useMemo } from "react";
import { Avatar, Button, Tag, Select, Tooltip, Typography } from "antd";
import { SettingOutlined, MenuFoldOutlined, PlusOutlined, HistoryOutlined, DownOutlined, RightOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { AgentSidebarProps } from "./types";

const { Text } = Typography;
const { Option } = Select;

const AgentSidebar: React.FC<AgentSidebarProps> = ({
  agents, currentAgent, sessions, currentSessionId,
  historyVisible, onAgentChange, onToggleSidebar,
  onStartNewConversation, onSelectSession,
}) => {
  // 折叠状态 - Hooks 必须在条件判断之前
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    today: false,
    yesterday: true,
    thisWeek: true,
    thisMonth: true,
    older: true,
  });

  // 按日期分组
  const groupedSessions = useMemo(() => {
    const now = dayjs();
    const groups = {
      today: [] as typeof sessions,
      yesterday: [] as typeof sessions,
      thisWeek: [] as typeof sessions,
      thisMonth: [] as typeof sessions,
      older: [] as typeof sessions,
    };

    sessions.forEach((s) => {
      const date = dayjs(s.last_at);
      const diffDays = now.diff(date, 'day');

      if (diffDays === 0) groups.today.push(s);
      else if (diffDays === 1) groups.yesterday.push(s);
      else if (diffDays <= 7) groups.thisWeek.push(s);
      else if (diffDays <= 30) groups.thisMonth.push(s);
      else groups.older.push(s);
    });

    return groups;
  }, [sessions]);

  const formatTimestamp = (timestamp: string) => dayjs(timestamp).format("MM-DD HH:mm");

  const toggleGroup = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!currentAgent) {
    return (
      <div className="flex flex-col h-full p-4 items-center justify-center">
        <Text type="secondary" className="text-sm">正在加载智能体...</Text>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4">

      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SettingOutlined className="text-text-secondary" />
          <Text strong className="text-sm">智能体</Text>
        </div>
        {onToggleSidebar && (
          <Tooltip title="隐藏侧边栏">
            <Button type="text" size="small" icon={<MenuFoldOutlined />} onClick={onToggleSidebar} />
          </Tooltip>
        )}
      </div>

      {/* 智能体选择器 */}
      <div className="mb-4">
        <Text type="secondary" className="block text-xs mb-1.5">当前智能体</Text>
        <Select
          value={currentAgent.id}
          onChange={onAgentChange}
          style={{ width: "100%" }}
          optionLabelProp="label"
        >
          {agents.map((agent) => (
            <Option key={agent.id} value={agent.id} label={agent.name}>
              <div className="flex items-center gap-2">
                <Avatar shape="square" size="small" icon={agent.icon}
                  style={{ backgroundColor: agent.color }} />
                <span className="text-sm">{agent.name}</span>
              </div>
            </Option>
          ))}
        </Select>
      </div>

      {/* 当前智能体信息卡 */}
      <div className="rounded-xl p-3 mb-4 bg-surface-2">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Avatar shape="square" size="small" icon={currentAgent.icon}
              style={{ backgroundColor: currentAgent.color }} />
            <Text strong className="text-sm truncate">{currentAgent.name}</Text>
          </div>
          <Tag color="success" className="!m-0 !text-[10px] !leading-4 !h-[18px] !border-0">
            在线
          </Tag>
        </div>
        {currentAgent.description && (
          <Text type="secondary" className="text-xs leading-relaxed line-clamp-2">
            {currentAgent.description}
          </Text>
        )}
      </div>

      {/* 历史记录 */}
      {historyVisible && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <Text type="secondary" className="text-xs font-medium">历史记录</Text>
            <Button type="link" size="small" icon={<PlusOutlined />}
              onClick={onStartNewConversation} className="!p-0 !h-auto">
              新对话
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 max-h-60 flex flex-col gap-2">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <HistoryOutlined className="text-2xl opacity-20 text-text-secondary" />
                <Text type="secondary" className="text-xs">暂无历史记录</Text>
              </div>
            ) : (
              <>
                {[
                  { key: 'today', label: '今天', data: groupedSessions.today },
                  { key: 'yesterday', label: '昨天', data: groupedSessions.yesterday },
                  { key: 'thisWeek', label: '本周', data: groupedSessions.thisWeek },
                  { key: 'thisMonth', label: '本月', data: groupedSessions.thisMonth },
                  { key: 'older', label: '更早', data: groupedSessions.older },
                ].map(({ key, label, data }) =>
                  data.length > 0 && (
                    <div key={key}>
                      <div
                        onClick={() => toggleGroup(key)}
                        className="flex items-center justify-between px-1 py-1 cursor-pointer hover:bg-surface-2 rounded transition-colors"
                      >
                        <Text type="secondary" className="text-xs font-medium">
                          {label} <span className="text-text-tertiary">({data.length})</span>
                        </Text>
                        {collapsed[key] ? <RightOutlined className="text-[10px]" /> : <DownOutlined className="text-[10px]" />}
                      </div>
                      {!collapsed[key] && (
                        <div className="flex flex-col gap-1 mt-1">
                          {data.map((s) => (
                            <div
                              key={s.session_id}
                              onClick={() => onSelectSession(s.session_id)}
                              className={`rounded-lg p-2.5 cursor-pointer transition-colors duration-150 ${
                                s.session_id === currentSessionId ? "bg-primary-soft" : "hover:bg-surface-2"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <Tag color="blue" className="!m-0 !text-[10px] !leading-4 !h-[18px]">
                                  {s.turns}轮
                                </Tag>
                                <span className="text-[10px] text-text-tertiary">
                                  {formatTimestamp(s.last_at)}
                                </span>
                              </div>
                              <div className={`text-sm leading-snug line-clamp-2 ${
                                s.session_id === currentSessionId ? "text-primary" : "text-text-base"
                              }`}>
                                {s.preview || "新对话"}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentSidebar;
