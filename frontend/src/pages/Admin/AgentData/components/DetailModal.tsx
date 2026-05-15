/**
 * 智能体数据详情弹窗 — 精简版
 */
import React from "react";
import dayjs from "dayjs";
import {
  Bot,
  Calendar,
  Clock3,
  Loader2,
  MessageSquare,
  User,
  Zap,
} from "lucide-react";

import type { AgentUsageData } from "@services/znt/types";
import { useConversationMessages } from "@hooks/queries/useAgentDataQuery";
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
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatDateTime = (value?: string) =>
  value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "-";

const displayText = (value?: string | number | null) => {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text || "-";
};

const agentTypeConfig: Record<string, { text: string; variant: "info" | "purple" | "cyan" }> = {
  general: { text: "通用智能体", variant: "info" },
  dify:    { text: "Dify智能体", variant: "purple" },
};

const InfoTile: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label, children, className,
}) => (
  <div className={`flex items-center gap-2 rounded-md border border-border-secondary bg-surface px-2.5 py-1.5 ${className || ""}`}>
    <span className="shrink-0 text-[11px] text-text-tertiary">{label}</span>
    <span className="min-w-0 truncate text-sm font-medium text-text-base">{children}</span>
  </div>
);

const DetailModal: React.FC<DetailModalProps> = ({ visible, record, onClose }) => {
  const { data: conversationMessages, isLoading: conversationLoading } =
    useConversationMessages(record?.session_id, visible);

  if (!record) return null;

  const user = record.user;
  const agent = record.moxing;
  const atConfig = agent ? agentTypeConfig[agent.agent_type] : undefined;

  return (
    <Dialog open={visible} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[780px]">
        <DialogHeader className="border-b border-border-secondary bg-surface-2 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-primary" />
            智能体使用记录详情
          </DialogTitle>
          <DialogDescription>
            学生、智能体和对话内容。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-4">
          {/* Metrics */}
          <div className="flex items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 text-text-secondary">
              <Calendar className="h-4 w-4 text-primary" />
              {formatDateTime(record.used_at)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-text-secondary">
              <Clock3 className="h-4 w-4 text-[var(--ws-color-warning)]" />
              响应耗时 {formatResponseTime(record.response_time_ms)}
            </span>
          </div>

          {/* Student info */}
          <section className="space-y-2 rounded-xl border border-border bg-surface-2 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-base">
              <User className="h-4 w-4 text-primary" />
              学生信息
            </div>
            {user ? (
              <div className="grid grid-cols-3 gap-3">
                <InfoTile label="姓名">{displayText(user.name)}</InfoTile>
                <InfoTile label="学号">{displayText(user.student_id)}</InfoTile>
                <InfoTile label="班级">{displayText(user.class_name)}</InfoTile>
              </div>
            ) : (
              <Alert className="border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning-soft)]">
                <AlertTitle>用户信息未关联</AlertTitle>
                <AlertDescription>此记录未关联到具体的用户信息。</AlertDescription>
              </Alert>
            )}
          </section>

          {/* Agent info */}
          <section className="space-y-2 rounded-xl border border-border bg-surface-2 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-base">
              <Bot className="h-4 w-4 text-primary" />
              智能体信息
            </div>
            {agent ? (
              <div className="grid grid-cols-2 gap-3">
                <InfoTile label="名称">{displayText(agent.agent_name)}</InfoTile>
                <InfoTile label="类型">
                  {atConfig ? (
                    <Badge variant={atConfig.variant}>{atConfig.text}</Badge>
                  ) : (
                    <Badge variant="cyan">未知类型</Badge>
                  )}
                </InfoTile>
              </div>
            ) : (
              <Alert className="border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning-soft)]">
                <AlertTitle>智能体信息未关联</AlertTitle>
                <AlertDescription>此记录未关联到具体的智能体信息。</AlertDescription>
              </Alert>
            )}
          </section>

          {/* Conversation */}
          <section className="space-y-2 rounded-xl border border-border bg-surface-2 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-base">
              <MessageSquare className="h-4 w-4 text-primary" />
              对话内容
            </div>
            {conversationLoading ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
              </div>
            ) : (conversationMessages ?? []).length > 0 ? (
              <div className="space-y-2">
                {conversationMessages!.map((msg) => {
                  const isQ = msg.message_type === "question";
                  return (
                    <div
                      key={msg.id}
                      className={`rounded-lg border px-3 py-2.5 ${
                        isQ
                          ? "border-primary/30 bg-primary-soft"
                          : "border-[var(--ws-color-success)]/30 bg-success-soft"
                      }`}
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <Badge variant={isQ ? "info" : "success"} className="text-[10px]">
                          {isQ ? "问题" : "回答"}
                        </Badge>
                        <span className="text-xs text-text-tertiary">
                          {formatDateTime(msg.created_at)}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-base">
                        {displayText(msg.content)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-lg border border-primary/30 bg-primary-soft px-3 py-2.5">
                  <div className="mb-1 text-xs font-medium text-primary">问题</div>
                  <div className="whitespace-pre-wrap text-sm text-text-base">
                    {displayText(record.question)}
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--ws-color-success)]/30 bg-success-soft px-3 py-2.5">
                  <div className="mb-1 text-xs font-medium text-[var(--ws-color-success)]">回答</div>
                  <div className="whitespace-pre-wrap text-sm text-text-base">
                    {displayText(record.answer)}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="border-t border-border-secondary bg-surface-2 px-6 py-3">
          <Button type="button" onClick={onClose} className="min-w-[80px]">
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DetailModal;
