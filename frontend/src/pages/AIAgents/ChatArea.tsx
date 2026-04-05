import React, { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css"; // Import KaTeX CSS
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { History, SendHorizonal, User, Clock, GitBranch, Settings, CircleCheck, CircleX, Loader2 } from "lucide-react";
import dayjs from "dayjs";
import type { ChatAreaProps, Message, WorkflowGroup, Agent } from "./types";
import { logger } from "@services/logger";
import { TimerDisplay } from "@components/TimerDisplay";
import { normalizeMarkdown } from "@utils/normalizeMarkdown";
import "./ChatArea.css";

const ThinkingBubble = () => (
  <div className="thinking-bubble">
    <div className="thinking-dots">
      <div className="thinking-dot" style={{ animationDelay: '0s' }} />
      <div className="thinking-dot" style={{ animationDelay: '0.2s' }} />
      <div className="thinking-dot" style={{ animationDelay: '0.4s' }} />
    </div>
    <span className="text-xs opacity-80">思考中...</span>
  </div>
);

// Markdown components definition (stable reference)
const markdownComponents: Components = {
  p: ({ children }) => (
    <div className="!m-0 leading-relaxed">{children}</div>
  ),
  h1: ({ children }) => (
    <div className="text-lg font-semibold !m-0 leading-relaxed">
      {children}
    </div>
  ),
  h2: ({ children }) => (
    <div className="text-base font-semibold !m-0 leading-relaxed">
      {children}
    </div>
  ),
  h3: ({ children }) => (
    <div className="text-sm font-semibold !m-0 leading-relaxed">
      {children}
    </div>
  ),
  ul: ({ children }) => (
    <ul className="!m-0 pl-4 leading-relaxed list-inside">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="!m-0 pl-4 leading-relaxed list-inside">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="!m-0 !p-0 leading-relaxed">
      {children}
    </li>
  ),
  code: ({ children }) => (
    <code>{children}</code>
  ),
  pre: ({ children }) => (
    <pre>{children}</pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary"
    >
      {children}
    </a>
  ),
  hr: () => null,
};

// Memoized MessageBubble component
const MessageBubble = React.memo<{
  message: Message;
  currentAgent: Agent | null;
  workflowGroups?: WorkflowGroup[];
  userDisplayName?: string;
  isThinking?: boolean;
}>(({ message, currentAgent, workflowGroups, userDisplayName, isThinking }) => {
  const [expanded, setExpanded] = React.useState(false);
  const formatTimestamp = (timestamp: string) => {
    return dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss");
  };

  const isUser = message.sender === "user";
  const displayName = userDisplayName?.trim() || "我";
  const isWorkflowEvent =
    !isUser &&
    message.content &&
    (message.content.startsWith("工作流启动") ||
      message.content.startsWith("工作流节点：") ||
      message.content.startsWith("节点完成：") ||
      message.content.includes("错误"));

  const parseWorkflow = () => {
    let type: "start" | "node" | "finish" | "error" | "other" = "other";
    let name = "";
    let detail = "";
    const txt = message.content;
    if (txt.startsWith("工作流启动")) type = "start";
    else if (txt.startsWith("工作流节点：")) {
      type = "node";
      name = txt.replace("工作流节点：", "");
    } else if (txt.startsWith("节点完成：")) {
      type = "finish";
      const m = txt.match(/^节点完成：(.+?)(（(.+?)）)?$/);
      if (m) {
        name = m[1] || "";
        detail = m[3] || "";
      }
    } else if (txt.includes("错误")) type = "error";

    const color =
      type === "start"
        ? "var(--ws-color-primary)"
        : type === "node"
          ? "var(--ws-color-purple)"
          : type === "finish"
            ? "var(--ws-color-success)"
            : type === "error"
              ? "var(--ws-color-error)"
              : currentAgent?.color;
    const icon =
      type === "start"
        ? <GitBranch className="h-4 w-4" />
        : type === "node"
          ? <Settings className="h-4 w-4" />
        : type === "finish"
            ? <CircleCheck className="h-4 w-4" />
            : type === "error"
              ? <CircleX className="h-4 w-4" />
              : currentAgent?.icon;
    const label =
      type === "start"
        ? "工作流启动"
        : type === "node"
          ? `节点：${name}`
          : type === "finish"
            ? `节点完成：${name}`
            : "事件";
    return { type, name, detail, color, icon, label };
  };
  const wf = isWorkflowEvent ? parseWorkflow() : null;

  const renderWorkflowGroups = () => {
    if (!workflowGroups || workflowGroups.length === 0) return null;
    return (
      <div className="mt-2 mb-3 space-y-2">
        {workflowGroups.map((group) => {
          const nodes = group.nodes || [];
          const count = nodes.length;
          const times = nodes
            .flatMap((n) => [n.startedAt, n.finishedAt])
            .filter(Boolean)
            .map((t) => dayjs(String(t)));
          let durationText = "--";
          if (times.length > 0) {
            const minTime = times.reduce(
              (min, t) => (t.isBefore(min) ? t : min),
              times[0],
            );
            const maxTime = times.reduce(
              (max, t) => (t.isAfter(max) ? t : max),
              times[0],
            );
            const seconds = Math.max(0, maxTime.diff(minTime, "second"));
            durationText = `${seconds}s`;
          }
          return (
            <details key={group.id} open className="overflow-hidden rounded-md border border-[var(--ws-color-border-secondary)] bg-surface">
              <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-text-tertiary">
                <GitBranch className="h-4 w-4" />
                <span>{group.label}</span>
                <span>节点 {count}</span>
                <span>耗时 {durationText}</span>
              </summary>
              <div className="px-3 pb-2">
                {nodes.length === 0 ? (
                  <p className="text-sm text-text-tertiary">暂无节点</p>
                ) : (
                  <div className="pl-3 border-l-2 border-[var(--ws-color-border-secondary)]">
                    {nodes.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-center gap-3 py-1 text-sm"
                      >
                        <Badge
                          variant={
                            n.status === "finished"
                              ? "success"
                              : n.status === "error"
                                ? "danger"
                                : "sky"
                          }
                          className="min-w-12 justify-center border-none"
                        >
                          {n.status === "finished"
                            ? "完成"
                            : n.status === "error"
                              ? "错误"
                              : "执行中"}
                        </Badge>

                        <span className="min-w-24 text-sm font-semibold">
                          {n.name}
                        </span>

                        <span className="text-sm text-text-tertiary">
                          {n.startedAt ? dayjs(n.startedAt).format("HH:mm:ss") : ""}
                          {n.finishedAt
                            ? ` → ${dayjs(n.finishedAt).format("HH:mm:ss")}`
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`message-bubble-container ${isUser ? 'user' : 'agent'}`}>
      <div className={`message-content-wrapper ${isUser ? 'user' : 'agent'}`}>
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback
            aria-label={isUser ? "用户头像" : `${currentAgent?.name || "智能体"}头像`}
            className="text-white"
            style={{
              backgroundColor: isUser
                ? "var(--ws-color-primary)"
                : (wf ? wf.color : currentAgent?.color),
            }}
          >
            {isUser ? <User className="h-4 w-4" /> : (wf ? wf.icon : currentAgent?.icon)}
          </AvatarFallback>
        </Avatar>
        <div className={`message-bubble ${isUser ? 'user' : 'agent'}`}>
          <div className="mb-1">
            <span
              className="text-sm font-semibold"
              style={{
                color: isUser ? "var(--ws-color-primary)" : (wf ? wf.color : currentAgent?.color),
              }}
            >
              {isUser ? displayName : (wf ? wf.label : currentAgent?.name)}
            </span>
            <span className="text-sm text-text-tertiary ml-[var(--ws-space-1)]">
              <Clock className="h-4 w-4 inline" /> {formatTimestamp(message.timestamp)}
            </span>
          </div>
          {wf ? (
            <div>
              {wf.detail ? (
                <>
                  <div
                    className="text-sm whitespace-pre-wrap break-words text-text-secondary"
                  >
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setExpanded(!expanded)}
                      className="h-auto p-0"
                    >
                      {expanded ? "收起详情" : "查看详情"}
                    </Button>
                  </div>
                  {expanded && (
                    <div
                      className="mt-2 px-3 py-2 rounded-lg text-sm whitespace-pre-wrap break-words"
                      style={{
                        background: "var(--ws-color-surface-2)",
                        border: `1px solid ${wf.color}`,
                      }}
                    >
                      {wf.detail}
                    </div>
                  )}
                </>
              ) : (
                <div
                  className="text-sm whitespace-pre-wrap break-words text-text-secondary"
                >
                  {message.content}
                </div>
              )}
            </div>
          ) : (
            <>
              {!isUser && renderWorkflowGroups()}
              {isThinking ? (
                <div className="px-2 py-1" style={{ color: currentAgent?.color }}>
                  <ThinkingBubble />
                </div>
              ) : (isUser || message.content) ? (
                <div className="markdown-body">
                  {isUser ? message.content : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={markdownComponents}
                    >
                      {normalizeMarkdown(message.content || "")}
                    </ReactMarkdown>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders unless necessary
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.isThinking === nextProps.isThinking &&
    prevProps.workflowGroups === nextProps.workflowGroups // This might need deeper comparison if array changes ref but content is same
  );
});

const ChatArea: React.FC<ChatAreaProps> = ({
  currentAgent,
  messages,
  workflowGroups,
  inputMessage,
  historyVisible,
  isAuthenticated,
  isStudent: _isStudent,
  userDisplayName,
  isStreaming,
  streamingContent, // 新增：流式内容
  currentStreamingMessageId,
  streamStartTime,
  onStopStream,
  onSendMessage,
  onInputChange,
  onToggleSidebar,
}) => {
  const messageListRef = useRef<HTMLDivElement>(null);

  // 自动滚动到最新消息
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // 如果当前智能体为null，显示加载状态或空状态
  if (!currentAgent) {
    return (
      <div className="h-full min-h-0 flex-1 flex flex-col">
        <div
          className="flex-1 flex items-center justify-center flex-col"
        >
          <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
          <span className="mt-4 block text-sm text-text-secondary">正在加载智能体...</span>
        </div>
      </div>
    );
  }

  // 获取当前智能体的消息
  // 使用 String() 转换以兼容数字/字符串类型的 ID
  const currentAgentMessages = messages.filter(
    (msg) => String(msg.agentId) === String(currentAgent?.id),
  );
  const isWorkflowMessage = (msg: Message) =>
    msg.sender !== "user" &&
    (msg.content.startsWith("工作流启动") ||
      msg.content.startsWith("工作流节点：") ||
      msg.content.startsWith("节点完成：") ||
      msg.content.includes("错误"));
  const visibleMessages = currentAgentMessages.filter(
    (msg) => !isWorkflowMessage(msg),
  );

  // 处理键盘事件
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    logger.debug("ChatArea.handleKeyPress", {
      key: e.key,
      shiftKey: e.shiftKey,
      isAuthenticated,
    });

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      logger.debug("ChatArea.handleKeyPress: onSendMessage");
      onSendMessage();
    }
  };

  // 增强的发送消息函数，添加第二层登录检查
  const handleSendMessageWithAuth = () => {
    logger.debug("ChatArea.handleSendMessageWithAuth", {
      isAuthenticated,
    });
    logger.debug("ChatArea: onSendMessage");
    onSendMessage();
  };

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* 对话头部 */}
        <div className="flex items-center justify-between px-[var(--ws-space-3)] py-[var(--ws-space-2)] flex-shrink-0 bg-surface border-b border-[var(--ws-color-border-secondary)] min-h-14">
          <div className="flex items-center gap-2">
            {!historyVisible && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" onClick={onToggleSidebar}>
                    <History className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>显示侧边栏</TooltipContent>
              </Tooltip>
            )}
            <Avatar className="h-8 w-8">
              <AvatarFallback
                aria-label={`${currentAgent?.name || "智能体"}头像`}
                className="text-white"
                style={{ backgroundColor: currentAgent?.color }}
              >
                {currentAgent?.icon}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2 ml-[var(--ws-space-1)]">
              <span className="text-base font-semibold" style={{ color: currentAgent?.color }}>
                {currentAgent?.name}
              </span>
              <span className="text-sm text-text-tertiary hidden sm:inline">
                {currentAgent?.description}
              </span>
            </div>
            <Badge
              variant={currentAgent?.status === "online" ? "success" : "neutral"}
              className="ml-1"
            >
              {currentAgent?.status === "online" ? "在线" : "离线"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {isStreaming && (
              <>
                <Badge variant="sky">
                  <TimerDisplay startTime={streamStartTime || null} isRunning={true} prefix="执行中 " />
                </Badge>
                <Button size="sm" variant="destructive" onClick={onStopStream}>停止</Button>
              </>
            )}
            <span className="text-sm text-text-tertiary">{visibleMessages.length} 条消息</span>
          </div>
        </div>

        {/* 消息列表 */}
        <div ref={messageListRef} className="flex-1 overflow-y-auto min-h-0 px-[var(--ws-space-3)] py-[var(--ws-space-3)] bg-surface-2">
          {visibleMessages.map((message) => {
            const messageWorkflows = workflowGroups?.filter((group) => group.messageId === message.id) || [];
            return (
              <MessageBubble key={message.id} message={message} currentAgent={currentAgent}
                workflowGroups={messageWorkflows} userDisplayName={userDisplayName} />
            );
          })}
          {isStreaming && (
            <MessageBubble
              message={{ id: 'streaming-temp', content: streamingContent || "", sender: 'agent', timestamp: new Date().toISOString(), agentId: currentAgent?.id }}
              currentAgent={currentAgent}
              workflowGroups={workflowGroups?.filter((group) => group.messageId === currentStreamingMessageId)}
              userDisplayName={userDisplayName}
              isThinking={!streamingContent && workflowGroups?.filter((group) => group.messageId === currentStreamingMessageId && group.nodes.length > 0).length === 0}
            />
          )}
        </div>

        {/* 输入区域 */}
        <div className="flex-shrink-0 px-[var(--ws-space-3)] pt-[var(--ws-space-2)] pb-[var(--ws-space-3)] bg-surface border-t border-[var(--ws-color-border-secondary)]">
          <Textarea
            id="message-input"
            aria-label="输入消息"
            value={inputMessage}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={`向${currentAgent?.name}发送消息...`}
            rows={2}
            onKeyDown={handleKeyPress}
            className="mb-2 min-h-[calc(var(--ws-control-height)*1.8)] max-h-[calc(var(--ws-control-height)*4)] resize-y"
          />
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-tertiary">Enter 发送，Shift+Enter 换行</span>
            <Button size="sm" onClick={handleSendMessageWithAuth}
              disabled={!inputMessage.trim() || isStreaming}>
              <SendHorizonal className="h-4 w-4" />发送
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ChatArea;
