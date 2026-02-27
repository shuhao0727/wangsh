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

const { Text, Title } = Typography;
const { TextArea } = Input;

const ThinkingBubble = () => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 20 }}>
    <style>
      {`
        @keyframes jump {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}
    </style>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 6, height: 6, background: 'currentColor', borderRadius: '50%', animation: 'jump 1s infinite 0s' }} />
      <div style={{ width: 6, height: 6, background: 'currentColor', borderRadius: '50%', animation: 'jump 1s infinite 0.2s' }} />
      <div style={{ width: 6, height: 6, background: 'currentColor', borderRadius: '50%', animation: 'jump 1s infinite 0.4s' }} />
    </div>
    <span style={{ fontSize: 12, opacity: 0.8 }}>思考中...</span>
  </div>
);

const normalizeMarkdown = (text: string) => {
  let s = (text || "").replace(/\r\n/g, "\n");
  const lines = s.split("\n");
  const cleaned: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const stripped = trimmed
      .replace(/[\s\u3000]+/g, "")
      .replace(/[*_`#>\-–—•·]+/g, "");
    if (!stripped) continue;
    cleaned.push(trimmed);
  }

  const escaped = cleaned.map((line) => {
    const m = line.match(/^(\d+)\.\s+(.*)$/);
    if (m) return `${m[1]}\\. ${m[2]}`;
    if (/^[-*]\s+/.test(line)) return `\\${line}`;
    return line;
  });

  return escaped.join("  \n").trim();
};

// 消息气泡组件
const MessageBubble: React.FC<{
  message: Message;
  currentAgent: any;
  workflowGroups?: WorkflowGroup[];
  userDisplayName?: string;
  isThinking?: boolean;
}> = ({ message, currentAgent, workflowGroups, userDisplayName, isThinking }) => {
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
                        bordered={false}
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
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: "14px",
      }}
    >
      <div
        style={{
          maxWidth: "74%",
          display: "flex",
          flexDirection: isUser ? "row-reverse" : "row",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <Avatar
          size={32}
          icon={isUser ? <UserOutlined /> : (wf ? wf.icon : currentAgent.icon)}
          style={{
            backgroundColor: isUser
              ? "#1890ff" // Consistent blue for user avatar
              : (wf ? wf.color : currentAgent.color),
            flexShrink: 0,
          }}
        />
        <div
          style={{
            background: isUser
              ? "#e6f7ff" // Softer blue background for user
              : "#ffffff", // White background for agent
            color: "#2c3e50", // Dark text for readability
            padding: "14px 18px",
            borderRadius: isUser ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)", // Softer shadow
            border: isUser ? "1px solid #bae7ff" : "1px solid #f0f0f0", // Subtle border
          }}
        >
          <div style={{ marginBottom: "4px" }}>
            <Text
              strong
              style={{
                fontSize: "12px",
                color: isUser ? "#1890ff" : (wf ? wf.color : currentAgent.color), // Colored name
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
                <div
                  style={{
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                    lineHeight: 1.6,
                    fontSize: 14,
                  }}
                >
                  {isUser ? message.content : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        p: ({ children }) => (
                          <div style={{ margin: 0, lineHeight: 1.6 }}>{children}</div>
                        ),
                        h1: ({ children }) => (
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 600,
                              margin: 0,
                              lineHeight: 1.6,
                            }}
                          >
                            {children}
                          </div>
                        ),
                        h2: ({ children }) => (
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              margin: 0,
                              lineHeight: 1.6,
                            }}
                          >
                            {children}
                          </div>
                        ),
                        h3: ({ children }) => (
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              margin: 0,
                              lineHeight: 1.6,
                            }}
                          >
                            {children}
                          </div>
                        ),
                        ul: ({ children }) => (
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: 16,
                              lineHeight: 1.6,
                              listStylePosition: "inside",
                            }}
                          >
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol
                            style={{
                              margin: 0,
                              paddingLeft: 16,
                              lineHeight: 1.6,
                              listStylePosition: "inside",
                            }}
                          >
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li style={{ margin: 0, padding: 0, lineHeight: 1.6 }}>
                            {children}
                          </li>
                        ),
                        code: ({ children }) => (
                          <code
                            style={{
                              background: "var(--ws-color-surface-2)",
                              borderRadius: 4,
                              padding: "0 4px",
                              fontSize: 12,
                              lineHeight: 1.2,
                            }}
                          >
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre
                            style={{
                              background: "var(--ws-color-surface-2)",
                              padding: "4px 8px",
                              borderRadius: 6,
                              overflowX: "auto",
                              margin: "0 0 4px 0",
                              lineHeight: 1.2,
                            }}
                          >
                            {children}
                          </pre>
                        ),
                        a: ({ children, href }) => (
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
                      }}
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
};

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // 如果当前智能体为null，显示加载状态或空状态
  if (!currentAgent) {
    return (
      <Card
        style={{
          height: "100%",
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
      style={{
        height: "100%",
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
      {/* 对话头部 */}
      <div
        style={{
          padding: "10px 24px",
          borderBottom: "1px solid var(--ws-color-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
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
            bordered={false}
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
        style={{
          flex: 1,
          padding: "20px 24px",
          overflowY: "auto",
          background: "#fafafa", // Very light grey background for chat area
          minHeight: 0, 
        }}
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
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div
        style={{
          padding: "12px 24px",
          borderTop: "1px solid var(--ws-color-border)",
          flexShrink: 0,
        }}
      >
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
