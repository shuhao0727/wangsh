import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Settings, PanelLeftClose, Plus, History, ChevronDown, ChevronRight } from "lucide-react";
import dayjs from "dayjs";
import type { AgentSidebarProps } from "./types";

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
      <div className="flex flex-col h-full p-4">
        <div className="space-y-[var(--ws-space-2)]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-[var(--ws-space-2)]">
              <Skeleton className="h-9 w-9 rounded-md" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-col h-full p-4">

        {/* 头部 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="text-text-secondary h-4 w-4" />
            <span className="text-base font-semibold">智能体</span>
          </div>
          {onToggleSidebar && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onToggleSidebar}>
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>隐藏侧边栏</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* 智能体选择器 */}
        <div className="mb-4">
          <span className="mb-1.5 block text-sm text-text-tertiary">当前智能体</span>
          <Select value={currentAgent.id} onValueChange={onAgentChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="请选择智能体" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 rounded-md">
                      <AvatarFallback className="rounded-md text-white text-xs" style={{ backgroundColor: agent.color }}>
                        {agent.icon}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-base">{agent.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 当前智能体信息卡 */}
        <div className="rounded-lg p-[var(--ws-panel-padding-sm)] mb-4 bg-surface-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-6 w-6 rounded-md">
                <AvatarFallback className="rounded-md text-white text-xs" style={{ backgroundColor: currentAgent.color }}>
                  {currentAgent.icon}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-base font-semibold">{currentAgent.name}</span>
            </div>
            <Badge variant="success" className="m-0 h-5 px-2 text-xs leading-4">
              在线
            </Badge>
          </div>
          {currentAgent.description && (
            <p className="line-clamp-2 text-sm leading-relaxed text-text-tertiary">
              {currentAgent.description}
            </p>
          )}
        </div>

        {/* 历史记录 */}
        {historyVisible && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-sm font-medium text-text-tertiary">历史记录</span>
              <Button
                variant="link"
                size="sm"
                onClick={onStartNewConversation}
                className="h-auto p-0 text-sm"
              >
                <Plus className="h-4 w-4" />
                新对话
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-[var(--ws-space-1)]">
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-1">
                  <History className="text-2xl opacity-20 text-text-secondary h-6 w-6" />
                  <span className="text-sm text-text-tertiary">暂无历史记录</span>
                </div>
              ) : (
                <>
                  {[
                    { key: "today", label: "今天", data: groupedSessions.today },
                    { key: "yesterday", label: "昨天", data: groupedSessions.yesterday },
                    { key: "thisWeek", label: "本周", data: groupedSessions.thisWeek },
                    { key: "thisMonth", label: "本月", data: groupedSessions.thisMonth },
                    { key: "older", label: "更早", data: groupedSessions.older },
                  ].map(({ key, label, data }) =>
                    data.length > 0 && (
                      <div key={key}>
                        <div
                          onClick={() => toggleGroup(key)}
                          className="flex items-center justify-between px-1 py-1 cursor-pointer hover:bg-surface-2 rounded transition-colors"
                        >
                          <span className="text-sm font-medium text-text-tertiary">
                            {label} <span className="text-text-tertiary">({data.length})</span>
                          </span>
                          {collapsed[key] ? <ChevronRight className="text-xs h-4 w-4" /> : <ChevronDown className="text-xs h-4 w-4" />}
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
                                  <Badge variant="sky" className="m-0 h-5 px-2 text-xs leading-4">
                                    {s.turns}轮
                                  </Badge>
                                  <span className="text-xs text-text-tertiary">
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
    </TooltipProvider>
  );
};

export default AgentSidebar;
