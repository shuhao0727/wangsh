/**
 * 智能体数据详情弹窗组件
 * 显示智能体使用记录的完整信息
 */
import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Bot,
  Calendar,
  Clock3,
  Copy,
  Database,
  Loader2,
  MessageSquare,
  User,
} from "lucide-react";

import type { AgentUsageData } from "@services/znt/types";
import { agentDataApi } from "@services/agents";
import { showMessage } from "@/lib/toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DetailModalProps {
  visible: boolean;
  record: AgentUsageData | null;
  onClose: () => void;
}

const formatResponseTime = (ms?: number) => {
  if (!ms) return "未知";
  if (ms < 1000) return `${ms}毫秒`;
  return `${(ms / 1000).toFixed(2)}秒`;
};

const formatDateTime = (value?: string) =>
  value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "-";

const displayText = (value?: string | number | null) => {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text || "-";
};

const agentTypeConfig = {
  general: {
    text: "通用智能体",
    icon: <Bot className="h-4 w-4" />,
    variant: "primarySubtle" as const,
  },
  dify: {
    text: "Dify智能体",
    icon: <Bot className="h-4 w-4" />,
    variant: "violet" as const,
  },
  default: {
    text: "未知类型",
    icon: <Bot className="h-4 w-4" />,
    variant: "cyan" as const,
  },
};

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string }> = ({
  icon,
  title,
}) => (
  <div className="flex items-center gap-2 text-base font-semibold text-text-base">
    <span className="text-primary">{icon}</span>
    <span>{title}</span>
  </div>
);

const InfoTile: React.FC<{
  label: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, children, className }) => (
  <div className={`rounded-lg border border-border-secondary bg-surface p-3 ${className || ""}`}>
    <div className="mb-1.5 text-xs font-medium text-text-tertiary">{label}</div>
    <div className="text-sm font-medium text-text-base">{children}</div>
  </div>
);

const MetricTile: React.FC<{
  label: string;
  value: React.ReactNode;
  tone?: "primary" | "success" | "warning";
}> = ({ label, value, tone = "primary" }) => {
  const toneClass =
    tone === "success"
      ? "text-[var(--ws-color-success)]"
      : tone === "warning"
        ? "text-[var(--ws-color-warning)]"
        : "text-primary";
  return (
    <div className="rounded-lg border border-border-secondary bg-surface p-3">
      <div className="text-xs text-text-tertiary">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
};

const DetailModal: React.FC<DetailModalProps> = ({ visible, record, onClose }) => {
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
    <Dialog open={visible} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden p-0 sm:max-w-[940px]">
        <DialogHeader className="border-b border-border-secondary bg-surface-2 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Database className="h-5 w-5 text-primary" />
            智能体使用记录详情
          </DialogTitle>
          <DialogDescription>
            查看会话、学生、智能体和完整对话信息。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricTile label="记录ID" value={record.id} />
            <MetricTile label="使用时间" value={formatDateTime(record.used_at)} tone="success" />
            <MetricTile
              label="响应耗时"
              value={formatResponseTime(record.response_time_ms)}
              tone="warning"
            />
          </div>

          <section className="space-y-3 rounded-xl border border-border bg-surface-2 p-4">
            <SectionTitle icon={<MessageSquare className="h-4 w-4" />} title="会话信息" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoTile label="会话ID" className="sm:col-span-2">
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md border border-border-secondary bg-surface px-2.5 py-1.5 text-xs text-text-base">
                    {displayText(record.session_id)}
                  </code>
                  {record.session_id ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(record.session_id || "");
                          showMessage.success("会话ID已复制");
                        } catch {
                          showMessage.error("复制失败");
                        }
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </InfoTile>
              <InfoTile label="用户ID">{displayText(record.user_id)}</InfoTile>
              <InfoTile label="智能体ID">{displayText(record.moxing_id)}</InfoTile>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="space-y-3 rounded-xl border border-border bg-surface-2 p-4">
              <SectionTitle icon={<User className="h-4 w-4" />} title="学生信息" />
              {user ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoTile label="姓名">{displayText(user.name)}</InfoTile>
                  <InfoTile label="学号">{displayText(user.student_id)}</InfoTile>
                  <InfoTile label="班级">{displayText(user.class_name)}</InfoTile>
                  <InfoTile label="学年">{displayText(user.grade)}</InfoTile>
                  <InfoTile label="状态" className="sm:col-span-2">
                    <Badge variant={user.is_active ? "success" : "danger"}>
                      {user.is_active ? "活跃" : "未激活"}
                    </Badge>
                  </InfoTile>
                </div>
              ) : (
                <Alert className="border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning-soft)]">
                  <AlertTitle>用户信息未关联</AlertTitle>
                  <AlertDescription>此记录未关联到具体的用户信息。</AlertDescription>
                </Alert>
              )}
            </section>

            <section className="space-y-3 rounded-xl border border-border bg-surface-2 p-4">
              <SectionTitle icon={<Bot className="h-4 w-4" />} title="智能体信息" />
              {agent ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoTile label="智能体名称">
                    <div className="flex items-center gap-2">
                      {agentTypeConfigItem.icon}
                      {displayText(agent.agent_name)}
                    </div>
                  </InfoTile>
                  <InfoTile label="智能体类型">
                    <Badge variant={agentTypeConfigItem.variant}>
                      {agentTypeConfigItem.text}
                    </Badge>
                  </InfoTile>
                  <InfoTile label="模型名称">{displayText(agent.model_name)}</InfoTile>
                  <InfoTile label="创建者">{displayText(agent.user_id)}</InfoTile>
                  <InfoTile label="描述" className="sm:col-span-2">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                      {displayText(agent.description)}
                    </div>
                  </InfoTile>
                </div>
              ) : (
                <Alert className="border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning-soft)]">
                  <AlertTitle>智能体信息未关联</AlertTitle>
                  <AlertDescription>此记录未关联到具体的智能体信息。</AlertDescription>
                </Alert>
              )}
            </section>
          </div>

          <section className="space-y-3 rounded-xl border border-border bg-surface-2 p-4">
            <SectionTitle icon={<MessageSquare className="h-4 w-4" />} title="完整对话" />
            {conversationLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-text-tertiary" />
              </div>
            ) : conversationMessages.length > 0 ? (
              <div className="space-y-3">
                {conversationMessages.map((message) => {
                  const isQuestion = message.message_type === "question";
                  const isAnswer = message.message_type === "answer";
                  const toneClass = isQuestion
                    ? "border-primary/30 bg-primary-soft"
                    : isAnswer
                      ? "border-[var(--ws-color-success)]/30 bg-success-soft"
                      : "border-border-secondary bg-surface";
                  const label = isQuestion ? "Q" : isAnswer ? "A" : message.message_type;
                  return (
                    <div key={message.id} className={`rounded-lg border px-3 py-2.5 ${toneClass}`}>
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant={isQuestion ? "primarySubtle" : isAnswer ? "success" : "neutral"}>
                          {label}
                        </Badge>
                        <span className="inline-flex items-center gap-1 text-xs text-text-tertiary">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDateTime(message.created_at)}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-base">
                        {displayText(message.content)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <Alert className="border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning-soft)]">
                  <AlertTitle>未加载到完整对话</AlertTitle>
                  <AlertDescription>
                    当前记录未关联会话，或会话已被清理，已展示单轮摘要。
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-lg border border-primary/30 bg-primary-soft px-3 py-2.5">
                    <div className="mb-1 text-xs font-medium text-primary">问题</div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-base">
                      {displayText(record.question)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--ws-color-success)]/30 bg-success-soft px-3 py-2.5">
                    <div className="mb-1 text-xs font-medium text-[var(--ws-color-success)]">回答</div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-base">
                      {displayText(record.answer)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {record.additional_data ? (
            <section className="space-y-3 rounded-xl border border-border bg-surface-2 p-4">
              <SectionTitle icon={<Database className="h-4 w-4" />} title="附加信息" />
              <div className="max-h-56 overflow-auto rounded-lg border border-primary/20 bg-primary-soft p-3">
                <pre className="m-0 whitespace-pre-wrap text-xs text-text-secondary">
                  {JSON.stringify(record.additional_data, null, 2)}
                </pre>
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-border-secondary bg-surface-2 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <InfoTile label="问题字数">
                <span className="text-lg font-semibold">{record.question ? record.question.length : 0}</span>
              </InfoTile>
              <InfoTile label="回答字数">
                <span className="text-lg font-semibold">{record.answer ? record.answer.length : 0}</span>
              </InfoTile>
              <InfoTile label="响应时间">
                <span className="inline-flex items-center gap-1.5 text-lg font-semibold">
                  <Clock3 className="h-4 w-4 text-[var(--ws-color-warning)]" />
                  {formatResponseTime(record.response_time_ms)}
                </span>
              </InfoTile>
            </div>
          </section>
        </div>

        <DialogFooter className="border-t border-border-secondary bg-surface-2 px-6 py-3">
          <Button type="button" onClick={onClose} className="min-w-[96px]">
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DetailModal;
