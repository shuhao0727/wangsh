/**
 * 智能体数据详情弹窗
 */
import React from "react";
import dayjs from "dayjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  Calendar,
  Clock3,
  Loader2,
  MessageSquare,
  User,
  Zap,
} from "lucide-react";

import type { AgentUsageDisplayRecord, UsageConversationMessage } from "./usageRecordPreview";
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
  record: AgentUsageDisplayRecord | null;
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

const normalizeMessageContent = (value?: string | null) => {
  return typeof value === "string" && value.trim() ? value : "-";
};

const isConversationMessage = (value: unknown): value is UsageConversationMessage => {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<UsageConversationMessage>;
  return (
    (typeof message.id === "number" || typeof message.id === "string") &&
    typeof message.message_type === "string" &&
    typeof message.content === "string"
  );
};

const agentTypeConfig: Record<string, { text: string; variant: "info" | "purple" | "cyan" }> = {
  general: { text: "通用智能体", variant: "info" },
  dify: { text: "Dify智能体", variant: "purple" },
};

const InfoItem: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <span className="mr-2 text-xs text-text-tertiary">{label}</span>
    <span className="break-words text-sm font-medium text-text-base">{children}</span>
  </div>
);

const MarkdownContent: React.FC<{ content: string }> = ({ content }) => (
  <div
    className={[
      "markdown-body max-w-none break-words text-sm leading-7 text-text-base",
      "[&_a]:text-primary [&_a]:underline",
      "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border-secondary [&_blockquote]:pl-3 [&_blockquote]:text-text-secondary",
      "[&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:py-0.5",
      "[&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold",
      "[&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
      "[&_p]:mb-2 [&_p:last-child]:mb-0",
      "[&_pre]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface-2 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-xs",
      "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border-secondary [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border-secondary [&_th]:bg-surface-2 [&_th]:px-2 [&_th]:py-1",
      "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
    ].join(" ")}
  >
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
  </div>
);

const ConversationRow: React.FC<{ message: UsageConversationMessage }> = ({ message }) => {
  const isQuestion = message.message_type === "question";
  const content = normalizeMessageContent(message.content);

  return (
    <article className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-l-2 border-border-secondary pl-3">
      <div className="flex items-start gap-1.5 pt-0.5 text-xs font-medium text-text-secondary">
        {isQuestion ? <User className="h-4 w-4 text-primary" /> : <Bot className="h-4 w-4 text-[var(--ws-color-success)]" />}
        <span>{isQuestion ? "问题" : "回答"}</span>
      </div>
      <div className="min-w-0">
        <div className="mb-1 text-xs text-text-tertiary">{formatDateTime(message.created_at)}</div>
        {isQuestion ? <p className="whitespace-pre-wrap text-sm leading-7 text-text-base">{content}</p> : <MarkdownContent content={content} />}
      </div>
    </article>
  );
};

const DetailModal: React.FC<DetailModalProps> = ({ visible, record, onClose }) => {
  const { data: conversationMessages, isLoading: conversationLoading, isError: conversationError } =
    useConversationMessages(record?.session_id, visible && !record?.preview);

  if (!record) return null;

  const user = record.user;
  const agent = record.moxing;
  const atConfig = agent ? agentTypeConfig[agent.agent_type] : undefined;
  const previewMessages = record.preview?.messages;
  const embeddedMessages = Array.isArray(previewMessages)
    ? previewMessages.filter(isConversationMessage)
    : [];
  const messages: UsageConversationMessage[] = embeddedMessages.length > 0
    ? embeddedMessages
    : (conversationMessages ?? []) as UsageConversationMessage[];

  return (
    <Dialog open={visible} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex w-[calc(100%-1.5rem)] max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-[860px]">
        <DialogHeader className="border-b border-border-secondary bg-surface-2 px-4 py-4 sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-primary" />
            智能体使用记录详情
          </DialogTitle>
          <DialogDescription>查看学生、智能体和完整对话。</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              {formatDateTime(record.used_at)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4 text-[var(--ws-color-warning)]" />
              响应耗时 {formatResponseTime(record.response_time_ms)}
            </span>
          </div>

          <section className="grid gap-4 border-b border-border-secondary pb-4 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-base">
                <User className="h-4 w-4 text-primary" />
                学生信息
              </div>
              {user ? (
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  <InfoItem label="姓名">{displayText(user.name)}</InfoItem>
                  <InfoItem label="学号">{displayText(user.student_id)}</InfoItem>
                  <InfoItem label="班级">{displayText(user.class_name)}</InfoItem>
                </div>
              ) : (
                <Alert className="border-0 bg-warning-soft px-3 py-2">
                  <AlertTitle>用户信息未关联</AlertTitle>
                  <AlertDescription>此记录未关联到具体的用户信息。</AlertDescription>
                </Alert>
              )}
            </div>

            <div className="min-w-0 space-y-2 md:border-l md:border-border-secondary md:pl-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-base">
                <Bot className="h-4 w-4 text-primary" />
                智能体信息
              </div>
              {agent ? (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                  <InfoItem label="名称">{displayText(agent.agent_name)}</InfoItem>
                  <InfoItem label="类型">
                    {atConfig ? <Badge variant={atConfig.variant}>{atConfig.text}</Badge> : <Badge variant="cyan">未知类型</Badge>}
                  </InfoItem>
                </div>
              ) : (
                <Alert className="border-0 bg-warning-soft px-3 py-2">
                  <AlertTitle>智能体信息未关联</AlertTitle>
                  <AlertDescription>此记录未关联到具体的智能体信息。</AlertDescription>
                </Alert>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-base">
              <MessageSquare className="h-4 w-4 text-primary" />
              对话内容
              {record.preview ? <span className="text-xs font-normal text-text-tertiary">开发预览记录</span> : null}
            </div>

            {conversationError ? (
              <Alert variant="destructive" className="px-3 py-2">
                <AlertTitle>完整对话加载失败</AlertTitle>
                <AlertDescription>当前显示使用记录中保存的问题与回答。</AlertDescription>
              </Alert>
            ) : null}

            {conversationLoading && embeddedMessages.length === 0 ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
              </div>
            ) : messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((message) => <ConversationRow key={message.id} message={message} />)}
              </div>
            ) : (
              <div className="space-y-4">
                <ConversationRow message={{ id: "question", message_type: "question", content: record.question || "暂无问题内容", created_at: record.used_at }} />
                <ConversationRow message={{ id: "answer", message_type: "answer", content: record.answer || "暂无回答内容", created_at: record.used_at }} />
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
