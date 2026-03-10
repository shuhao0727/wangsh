import React, { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css"; // Import KaTeX CSS
import { Card, Avatar, Button, Space, Tag, Tooltip, Flex, Typography, Input, Spin, Collapse } from "antd";
import { HistoryOutlined, SendOutlined, UserOutlined, ClockCircleOutlined, BranchesOutlined, SettingOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { ChatAreaProps, Message, WorkflowGroup } from "./types";
import { logger } from "@services/logger";
import { TimerDisplay } from "@components/TimerDisplay";
import { normalizeMarkdown } from "@utils/normalizeMarkdown";
import "./ChatArea.css";

const { Text } = Typography;
const { TextArea } = Input;

const ThinkingBubble = () => (
  <div className="thinking-bubble">
    <div className="thinking-dots">
      <div className="thinking-dot" style={{ animationDelay: '0s' }} />
      <div className="thinking-dot" style={{ animationDelay: '0.2s' }} />
      <div className="thinking-dot" style={{ animationDelay: '0.4s' }} />
    </div>
    <span style={{ fontSize: 12, opacity: 0.8 }}>思考中...</span>
  </div>
);

// Markdown components definition (stable reference)
const markdownComponents: any = {
  p: ({ children }: any) => (
    <div style={{ margin: 0, lineHeight: 1.6 }}>{children}</div>
  ),
  h1: ({ children }: any) => (
    <div style={{ fontSize: 16, fontWeight: 600, margin: 0, lineHeight: 1.6 }}>
      {children}
    </div>
  ),
  h2: ({ children }: any) => (
    <div style={{ fontSize: 14, fontWeight: 600, margin: 0, lineHeight: 1.6 }}>
      {children}
    </div>
  ),
  h3: ({ children }: any) => (
    <div style={{ fontSize: 13, fontWeight: 600, margin: 0, lineHeight: 1.6 }}>
      {children}
    </div>
  ),
  ul: ({ children }: any) => (
    <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.6, listStylePosition: "inside" }}>
      {children}
    </ul>
  ),
  ol: ({ children }: any) => (
    <ol style={{ margin: 0, paddingLeft: 16, lineHeight: 1.6, listStylePosition: "inside" }}>
      {children}
    </ol>
  ),
  li: ({ children }: any) => (
    <li style={{ margin: 0, padding: 0, lineHeight: 1.6 }}>
      {children}
    </li>
  ),
  code: ({ children }: any) => (
    <code>{children}</code>
  ),
  pre: ({ children }: any) => (
    <pre>{children}</pre>
  ),
  a: ({ children, href }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "var(--ws-color-primary)" }}
    >
      {children}
    </a>
  ),
  hr: () => null,
};

// Memoized MessageBubble component
const MessageBubble = React.memo<{
  message: Message;
  currentAgent: any;
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
        ? "#1677ff"
        : type === "node"
          ? "#722ed1"
          : type === "finish"
            ? "#52c41a"
            : type === "error"
              ? "#ff4d4f"
              : currentAgent.color;
    const icon =
      type === "start"
        ? <BranchesOutlined />
        : type === "node"
          ? <SettingOutlined />
        : type === "finish"
            ? <CheckCircleOutlined />
            : type === "error"
              ? <CloseCircleOutlined />
              : currentAgent.icon;
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
      <div style={{ marginTop: 8, marginBottom: 12 }}>
        <Collapse
          ghost
          defaultActiveKey={workflowGroups.map((g) => g.id)}
          expandIconPosition="end"
          items={workflowGroups.map((group) => ({
            key: group.id,
            label: (() => {
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <BranchesOutlined />
                  <Text type="secondary">{group.label}</Text>
                  <Text type="secondary">节点 {count}</Text>
                  <Text type="secondary">耗时 {durationText}</Text>
                </div>
              );
            })(),
            children:
              group.nodes.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  暂无节点
                </Text>
              ) : (
                <div style={{ paddingLeft: 12, borderLeft: "2px solid #f0f0f0" }}>
                  {group.nodes.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "4px 0",
                        fontSize: 13,
                      }}
                    >
                      <Tag
                        color={
                          n.status === "finished"
                            ? "success"
                            : n.status === "error"
                              ? "error"
                              : "processing"
                        }
                        style={{ margin: 0, minWidth: 48, textAlign: "center", border: "none" }}
                        variant="filled"
                      >
                        {n.status === "finished"
                          ? "完成"
                          : n.status === "error"
                            ? "错误"
                            : "执行中"}
                      </Tag>

                      <Text strong style={{ minWidth: 100 }}>
                        {n.name}
                      </Text>

                      <Text type="secondary" style={{ fontSize: 12, color: "#999" }}>
                        {n.startedAt ? dayjs(n.startedAt).format("HH:mm:ss") : ""}
                        {n.finishedAt
                          ? ` → ${dayjs(n.finishedAt).format("HH:mm:ss")}`
                          : ""}
                      </Text>
                    </div>
                  ))}
                </div>
              ),
          }))}
        />
      </div>
    );
  };

  return (
    <div className={`message-bubble-container ${isUser ? 'user' : 'agent'}`}>
      <div className={`message-content-wrapper ${isUser ? 'user' : 'agent'}`}>
        <Avatar
          size={32}
          icon={isUser ? <UserOutlined /> : (wf ? wf.icon : currentAgent.icon)}
          style={{
            backgroundColor: isUser
              ? "#1890ff"
              : (wf ? wf.color : currentAgent.color),
            flexShrink: 0,
          }}
        />
        <div className={`message-bubble ${isUser ? 'user' : 'agent'}`}>
          <div style={{ marginBottom: "4px" }}>
            <Text
              strong
              style={{
                fontSize: "12px",
                color: isUser ? "#1890ff" : (wf ? wf.color : currentAgent.color),
              }}
            >
              {isUser ? displayName : (wf ? wf.label : currentAgent.name)}
            </Text>
            <Text
              style={{
                fontSize: "10px",
                color: "#999",
                marginLeft: "8px",
              }}
            >
              <ClockCircleOutlined /> {formatTimestamp(message.timestamp)}
            </Text>
          </div>
          {wf ? (
            <div>
              {wf.detail ? (
                <>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--ws-color-text-secondary)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    <Button
                      type="link"
                      size="small"
                      onClick={() => setExpanded(!expanded)}
                      style={{ padding: 0 }}
                    >
                      {expanded ? "收起详情" : "查看详情"}
                    </Button>
                  </div>
                  {expanded && (
                    <div
                      style={{
                        marginTop: 8,
                        background: "var(--ws-color-surface-2)",
                        border: `1px solid ${wf.color}`,
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontSize: "12px",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {wf.detail}
                    </div>
                  )}
                </>
              ) : (
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: "12px",
                    color: "var(--ws-color-text-secondary)",
                  }}
                >
                  {message.content}
                </div>
              )}
            </div>
          ) : (
            <>
              {!isUser && renderWorkflowGroups()}
              {isThinking ? (
                <div style={{ padding: '8px 4px', color: currentAgent.color }}>
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
  isStudent,
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
      <Card
        style={{
          height: "100%",
          minHeight: 0,
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
        styles={{
          body: {
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: 0,
            overflow: "hidden",
          },
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <Spin size="large" />
          <Text style={{ marginTop: 16 }}>正在加载智能体...</Text>
        </div>
      </Card>
    );
  }

  // 获取当前智能体的消息
  // 使用 String() 转换以兼容数字/字符串类型的 ID
  const currentAgentMessages = messages.filter(
    (msg) => String(msg.agentId) === String(currentAgent.id),
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
    <Card
      className="chat-area-card"
      bordered={false}
      style={{
        height: "100%",
        minHeight: 0,
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "transparent",
      }}
      styles={{
        body: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
        },
      }}
    >
      {/* 对话头部 */}
      <div className="chat-header">
        <Space size="small">
          {!historyVisible && (
            <Tooltip title="显示侧边栏">
              <Button icon={<HistoryOutlined />} onClick={onToggleSidebar} type="text" />
            </Tooltip>
          )}
          <Avatar
            size={32}
            icon={currentAgent.icon}
            style={{ backgroundColor: currentAgent.color }}
          />
          <Space size="small" align="center" style={{ marginLeft: 4 }}>
            <Text strong style={{ fontSize: 15, color: currentAgent.color }}>
              {currentAgent.name}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {currentAgent.description}
            </Text>
          </Space>
          <Tag 
            color={currentAgent.status === "online" ? "success" : "default"} 
            style={{ marginLeft: 8, fontSize: 10, lineHeight: '18px' }}
            variant="filled"
          >
            {currentAgent.status === "online" ? "在线" : "离线"}
          </Tag>
        </Space>
        <Space>
          {isStreaming && (
            <>
              <Tag color="processing">
                <TimerDisplay 
                  startTime={streamStartTime || null} 
                  isRunning={true} 
                  prefix="执行中 "
                />
              </Tag>
              <Button size="small" danger onClick={onStopStream}>
                停止
              </Button>
            </>
          )}
          <Text type="secondary">共 {visibleMessages.length} 条消息</Text>
        </Space>
      </div>

      {/* 消息列表 - 固定高度，带滚动条 */}
      <div
        ref={messageListRef}
        className="chat-message-list"
      >
        {visibleMessages.map((message) => {
          const messageWorkflows =
            workflowGroups?.filter((group) => group.messageId === message.id) || [];
          return (
            <MessageBubble
              key={message.id}
              message={message}
              currentAgent={currentAgent}
              workflowGroups={messageWorkflows}
              userDisplayName={userDisplayName}
            />
          );
        })}
        {/* 渲染正在流式生成的内容 */}
        {isStreaming && (
            <MessageBubble
              message={{
                id: 'streaming-temp',
                content: streamingContent || "",
                sender: 'agent',
                timestamp: new Date().toISOString(),
                agentId: currentAgent.id
              }}
              currentAgent={currentAgent}
              workflowGroups={workflowGroups?.filter((group) => group.messageId === currentStreamingMessageId)}
              userDisplayName={userDisplayName}
              isThinking={!streamingContent}
            />
        )}
      </div>

      {/* 输入区域 */}
      <div className="chat-input-area">
        <Space orientation="vertical" style={{ width: "100%" }}>
          <TextArea
            id="message-input"
            value={inputMessage}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={`向${currentAgent.name}发送消息...`}
            autoSize={{ minRows: 2, maxRows: 6 }}
            onKeyDown={handleKeyPress}
            style={{ width: "100%" }}
          />
          <Flex justify="space-between" align="center">
            <Space>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                Enter发送，Shift+Enter换行
              </Text>
            </Space>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSendMessageWithAuth}
              disabled={!inputMessage.trim() || isStreaming}
            >
              发送
            </Button>
          </Flex>
        </Space>
      </div>
    </Card>
  );
};

export default ChatArea;
