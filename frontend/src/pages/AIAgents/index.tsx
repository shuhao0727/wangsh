import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Row,
  Col,
  Button,
  message,
  Modal,
  Form,
  Input,
} from "antd";
import {
  RobotOutlined,
  MessageOutlined,
  CodeOutlined,
  BookOutlined,
  UserOutlined,
} from "@ant-design/icons";
import AgentSidebar from "./AgentSidebar";
import ChatArea from "./ChatArea";
import GroupDiscussionPanel from "./GroupDiscussionPanel";
import useAuth from "@hooks/useAuth";
import type {
  Agent,
  Message,
  WorkflowGroup,
  WorkflowNode,
  ConversationSummary,
} from "./types";
import { aiAgentsApi, agentDataApi } from "@services/agents";
import type { AIAgent } from "@services/znt/types";
import { config } from "@services";
import { logger } from "@services/logger";

const AIAgentsPage: React.FC = () => {
  // 统一认证状态
  const auth = useAuth();

  // 登录模态框状态
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [loginForm] = Form.useForm();

  // 智能体列表
  const [agents, setAgents] = useState<Agent[]>([]);

  // 当前选中的智能体
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);

  // 对话消息列表 - 初始为空，登录后才显示
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ConversationSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // 输入消息
  const [inputMessage, setInputMessage] = useState("");

  // 对话历史可见性
  const [historyVisible, setHistoryVisible] = useState(true);
  const [workflowGroups, setWorkflowGroups] = useState<WorkflowGroup[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamSeconds, setStreamSeconds] = useState(0);
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  // 加载启用的智能体
  useEffect(() => {
    const loadAgents = async () => {
      try {
        // 获取所有启用的智能体
        const response = await aiAgentsApi.getActiveAgents();
        const activeAgents: AIAgent[] = response.data || [];

        // 映射后端智能体到前端Agent类型
        const mappedAgents: Agent[] = activeAgents.map((agent, index) => {
          // 根据索引分配图标和颜色
          const icons = [
            <BookOutlined />,
            <CodeOutlined />,
            <RobotOutlined />,
            <MessageOutlined />,
          ];
          const colors = ["#1890ff", "#52c41a", "#722ed1", "#fa8c16"];

          const iconIndex = index % icons.length;

          // 确保name字段不为undefined，使用agent_name或name作为回退
          const agentName =
            agent.agent_name || agent.name || `智能体${agent.id}`;

          return {
            id: agent.id.toString(),
            name: agentName,
            description: agent.description || `${agent.agent_type} 智能体`,
            icon: icons[iconIndex],
            color: colors[iconIndex],
            status: agent.status ? "online" : "offline",
          };
        });

        // 如果后端没有智能体，使用默认的模拟智能体（可选）
        if (mappedAgents.length === 0) {
          const defaultAgents: Agent[] = [
            {
              id: "study-assistant",
              name: "学习助手",
              description: "帮助你解决学习问题，提供学习建议",
              icon: <BookOutlined />,
              color: "#1890ff",
              status: "online",
            },
            {
              id: "code-tutor",
              name: "代码导师",
              description: "编程问题解答，代码审查与优化",
              icon: <CodeOutlined />,
              color: "#52c41a",
              status: "online",
            },
            {
              id: "contest-guide",
              name: "竞赛指导",
              description: "信息学竞赛题目解析与训练指导",
              icon: <RobotOutlined />,
              color: "#722ed1",
              status: "offline",
            },
            {
              id: "document-analyzer",
              name: "文档分析",
              description: "文档内容提取、总结与分析",
              icon: <MessageOutlined />,
              color: "#fa8c16",
              status: "online",
            },
          ];
          setAgents(defaultAgents);
          setCurrentAgent(defaultAgents[0]);
        } else {
          setAgents(mappedAgents);
          setCurrentAgent(mappedAgents[0]);
        }
      } catch (error) {
        logger.error("加载智能体列表失败:", error);
        message.error("加载智能体列表失败，使用默认智能体");

        // 失败时使用默认智能体
        const defaultAgents: Agent[] = [
          {
            id: "study-assistant",
            name: "学习助手",
            description: "帮助你解决学习问题，提供学习建议",
            icon: <BookOutlined />,
            color: "#1890ff",
            status: "online",
          },
          {
            id: "code-tutor",
            name: "代码导师",
            description: "编程问题解答，代码审查与优化",
            icon: <CodeOutlined />,
            color: "#52c41a",
            status: "online",
          },
        ];
        setAgents(defaultAgents);
        setCurrentAgent(defaultAgents[0]);
      } finally {}
    };

    loadAgents();
  }, []);

  // 监听认证状态变化，登录后显示欢迎消息
  useEffect(() => {
    if (
      auth.isAuthenticated &&
      messages.length === 0 &&
      currentAgent
    ) {
      // 登录成功后显示欢迎消息（不再限制学生角色）
      const welcomeMessage: Message = {
        id: `welcome-${Date.now()}`,
        content: `你好！我是${currentAgent.name}，有什么可以帮助你的吗？`,
        sender: "agent",
        timestamp: new Date().toISOString(),
        agentId: currentAgent.id,
      };
      setMessages([welcomeMessage]);
    } else if (!auth.isAuthenticated) {
      // 未登录时清空消息
      setMessages([]);
      setSessions([]);
      setCurrentSessionId(null);
    }
  }, [auth.isAuthenticated, currentAgent, messages.length]);

  const getSessionStorageKey = useCallback(
    (agentId: string) => {
      const uid = auth.user?.id ? String(auth.user.id) : "guest";
      return `znt:chat:last_session:${uid}:${agentId}`;
    },
    [auth.user?.id],
  );

  const createNewConversation = useCallback((agent: Agent) => {
    const newSessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setCurrentSessionId(newSessionId);
    try {
      localStorage.setItem(getSessionStorageKey(agent.id), newSessionId);
    } catch {}
    setWorkflowGroups([]);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        content: `你好！我是${agent.name}，有什么可以帮助你的吗？`,
        sender: "agent",
        timestamp: new Date().toISOString(),
        agentId: agent.id,
      },
    ]);
  }, [getSessionStorageKey]);

  const loadSessionsAndMaybeRestore = useCallback(async (agent: Agent) => {
    if (!auth.isAuthenticated) return;
    const agentIdNum = parseInt(String(agent.id), 10);
    if (!Number.isFinite(agentIdNum)) return;

    const listResp = await agentDataApi.listConversations({
      agent_id: agentIdNum,
      limit: 5,
    });
    if (!listResp.success) return;
    setSessions(listResp.data);

    let preferred: string | null = null;
    try {
      preferred = localStorage.getItem(getSessionStorageKey(agent.id));
    } catch {}

    const selected =
      (preferred && listResp.data.find((s) => s.session_id === preferred)?.session_id) ||
      listResp.data[0]?.session_id ||
      null;

    if (!selected) {
      createNewConversation(agent);
      return;
    }

    setCurrentSessionId(selected);
    const msgResp = await agentDataApi.getConversationMessages(selected);
    if (!msgResp.success) return;

    const mapped: Message[] = msgResp.data.map((m) => ({
      id: String(m.id),
      content: m.content,
      sender: m.message_type === "question" ? "user" : "agent",
      timestamp: m.created_at,
      agentId: agent.id,
    }));
    setMessages(mapped.length ? mapped : [
      {
        id: `welcome-${Date.now()}`,
        content: `你好！我是${agent.name}，有什么可以帮助你的吗？`,
        sender: "agent",
        timestamp: new Date().toISOString(),
        agentId: agent.id,
      },
    ]);
  }, [auth.isAuthenticated, createNewConversation, getSessionStorageKey]);

  useEffect(() => {
    if (!currentAgent) return;
    if (!auth.isAuthenticated) return;
    loadSessionsAndMaybeRestore(currentAgent);
  }, [auth.isAuthenticated, currentAgent, loadSessionsAndMaybeRestore]);

  // 切换智能体
  const handleAgentChange = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      setCurrentAgent(agent);
      message.success(`已切换到 ${agent.name}`);
      setWorkflowGroups([]);
      setMessages([]);
      setSessions([]);
      setCurrentSessionId(null);

      // 检查是否已登录
      if (!auth.isAuthenticated) {
        logger.debug("🔒 切换智能体：未登录，不添加欢迎消息");
        // 未登录时清空消息
        setMessages([]);
        return;
      }
    }
  };

  // 发送消息
  const handleSendMessage = () => {
    logger.debug("🔍 handleSendMessage 被调用", {
      inputMessage: inputMessage.trim(),
      isAuthenticated: auth.isAuthenticated,
      isStudent: auth.isStudent(),
      isLoading: auth.isLoading,
      currentAgent: currentAgent ? currentAgent.name : "null",
    });

    if (!inputMessage.trim()) {
      message.warning("请输入消息内容");
      return;
    }

    // 检查是否还在加载状态
    if (auth.isLoading) {
      logger.debug("⏳ 系统正在加载中，阻止发送");
      message.info("系统正在初始化，请稍后再试");
      return;
    }

    // 放宽登录限制：未登录也允许发送（后端流式不强制鉴权）

    // 检查智能体是否已加载
    if (!currentAgent) {
      logger.debug("⚠️ 智能体未加载，阻止发送");
      message.error("智能体未加载，请刷新页面");
      return;
    }

    logger.debug("✅ 已登录，发送消息并开启SSE");
    const activeSessionId = currentSessionId || (
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    if (!currentSessionId) {
      setCurrentSessionId(activeSessionId);
      try {
        localStorage.setItem(getSessionStorageKey(currentAgent.id), activeSessionId);
      } catch {}
    }
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: inputMessage,
      sender: "user",
      timestamp: new Date().toISOString(),
      agentId: currentAgent.id,
    };
    const agentMessageId = `agent-${Date.now() + 1}`;
    const agentMessage: Message = {
      id: agentMessageId,
      content: "",
      sender: "agent",
      timestamp: new Date().toISOString(),
      agentId: currentAgent.id,
    };
    setMessages((prev) => [...prev, userMessage, agentMessage]);
    setInputMessage("");

    const startStream = async () => {
      setStreamSeconds(0);
      setIsStreaming(true);
      const streamStartedAt = Date.now();
      const controller = new AbortController();
      streamAbortRef.current = controller;
      const body = {
        agent_id: parseInt(String(currentAgent.id), 10),
        message: userMessage.content,
        user: auth.getDisplayName() || "guest",
        inputs: {},
      };
      let finalText = "";
      let usageSaved = false;
      const persistUsage = async (answerText: string) => {
        if (usageSaved || !userMessage.content) return;
        if (!auth.isAuthenticated) return;
        usageSaved = true;
        try {
          await agentDataApi.createUsage({
            agent_id: parseInt(String(currentAgent.id), 10),
            user_id: auth.user?.id,
            question: userMessage.content,
            answer: answerText || "",
            session_id: activeSessionId,
            response_time_ms: Date.now() - streamStartedAt,
            used_at: new Date().toISOString(),
          });
          const listResp = await agentDataApi.listConversations({
            agent_id: parseInt(String(currentAgent.id), 10),
            limit: 5,
          });
          if (listResp.success) setSessions(listResp.data);
        } catch (error) {
          logger.error("写入对话记录失败:", error);
        }
      };
      try {
        const res = await fetch(`${config.apiUrl}/ai-agents/stream`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "Cache-Control": "no-cache",
          },
          signal: controller.signal,
          body: JSON.stringify(body),
        });
        const reader = res.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let currentGroupId = "";
        const ensureGroup = () => {
          if (currentGroupId) return currentGroupId;
          const groupId = `wf-${Date.now()}-${Math.random()}`;
          currentGroupId = groupId;
          setWorkflowGroups((prev) => [
            ...prev,
            {
              id: groupId,
              label: `工作流 ${prev.length + 1}`,
              nodes: [],
              messageId: agentMessageId,
            },
          ]);
          return groupId;
        };
        const addNode = (name: string) => {
          const groupId = ensureGroup();
          const node: WorkflowNode = {
            id: `${groupId}-${name}-${Date.now()}`,
            name,
            status: "started",
            startedAt: new Date().toISOString(),
          };
          setWorkflowGroups((prev) =>
            prev.map((g) =>
              g.id === groupId ? { ...g, nodes: [...g.nodes, node] } : g,
            ),
          );
        };
        const finishNode = (name: string, detail?: string) => {
          const groupId = ensureGroup();
          setWorkflowGroups((prev) =>
            prev.map((g) =>
              g.id === groupId
                ? {
                    ...g,
                    nodes: g.nodes.map((n) =>
                      n.name === name
                        ? {
                            ...n,
                            status: "finished",
                            detail,
                            finishedAt: new Date().toISOString(),
                          }
                        : n,
                    ),
                  }
                : g,
            ),
          );
        };
        const markError = (msg: string) => {
          const groupId = ensureGroup();
          const node: WorkflowNode = {
            id: `${groupId}-error-${Date.now()}`,
            name: "错误",
            status: "error",
            detail: msg,
          };
          setWorkflowGroups((prev) =>
            prev.map((g) =>
              g.id === groupId ? { ...g, nodes: [...g.nodes, node] } : g,
            ),
          );
        };
        const updateAgentText = (text: string) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === agentMessageId ? { ...m, content: text } : m,
            ),
          );
        };
        if (!res.ok) {
          const errText = `流式接口错误: HTTP ${res.status}`;
          markError(errText);
          await persistUsage(finalText);
          return;
        }
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";
          for (const part of parts) {
            const lines = part.split("\n");
            let eventType = "";
            let dataStr = "";
            for (const line of lines) {
              if (line.startsWith("event:")) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                dataStr += line.slice(5).trim();
              }
            }
            let payload: any = null;
            try {
              payload = dataStr ? JSON.parse(dataStr) : null;
            } catch {
              payload = { text: dataStr };
            }
            if (!eventType && payload && payload.event) {
              eventType = String(payload.event);
            }
            const getNodeName = () => {
              const d = payload?.data || payload;
              return (
                d?.title ||
                d?.node_name ||
                d?.node_id ||
                d?.name ||
                d?.id ||
                "节点"
              );
            };
            const getAnswerText = () => {
              const d = payload?.data || payload;
              return (
                d?.answer ||
                d?.text ||
                d?.content ||
                d?.outputs?.answer ||
                d?.outputs?.text ||
                d?.outputs?.content ||
                ""
              );
            };
            if (eventType === "workflow_started") {
              const groupId = `wf-${Date.now()}-${Math.random()}`;
              currentGroupId = groupId;
              setWorkflowGroups((prev) => [
                ...prev,
                {
                  id: groupId,
                  label: `工作流 ${prev.length + 1}`,
                  nodes: [],
                  messageId: agentMessageId,
                },
              ]);
            } else if (eventType === "node_started") {
              const name = getNodeName();
              addNode(String(name));
            } else if (eventType === "node_finished") {
              const name = getNodeName();
              const summary = getAnswerText() || payload?.summary || payload?.result || "";
              finishNode(String(name), summary ? String(summary) : undefined);
            } else if (eventType === "workflow_finished") {
              const final = getAnswerText();
              if (final) {
                finalText = String(final);
                updateAgentText(finalText);
              }
              await persistUsage(finalText);
            } else if (eventType === "message_delta") {
              const delta = getAnswerText() || payload?.delta || "";
              if (delta) {
                finalText += String(delta);
                updateAgentText(finalText);
              }
            } else if (eventType === "message") {
              const text = getAnswerText();
              if (text) {
                finalText = String(text);
                updateAgentText(finalText);
              }
            } else if (eventType === "message_end") {
              const text = getAnswerText();
              if (text) {
                finalText = String(text);
                updateAgentText(finalText);
              }
              await persistUsage(finalText);
            } else if (eventType === "error") {
              const errText = payload?.message || payload?.error || "对话发生错误";
              markError(String(errText));
            } else {
              const fallback = getAnswerText();
              if (fallback) {
                finalText += String(fallback);
                updateAgentText(finalText);
              }
            }
          }
        }
        await persistUsage(finalText);
      } catch (e: any) {
        if (e?.name === "AbortError") {
          return;
        }
        const errMsg: Message = {
          id: `err-${Date.now()}`,
          content: e?.message || "网络错误",
          sender: "agent",
          timestamp: new Date().toISOString(),
          agentId: currentAgent.id,
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        streamAbortRef.current = null;
        setIsStreaming(false);
      }
    };
    startStream();
  };

  // 聚焦输入框
  const handleFocusInput = () => {
    const input = document.getElementById("message-input");
    input?.focus();
  };

  // 切换侧边栏可见性
  const handleToggleSidebar = () => {
    setHistoryVisible(!historyVisible);
  };

  const handleStartNewConversation = () => {
    if (!currentAgent) return;
    createNewConversation(currentAgent);
    handleFocusInput();
  };

  const handleSelectSession = async (sessionId: string) => {
    if (!currentAgent) return;
    if (!auth.isAuthenticated) return;
    setCurrentSessionId(sessionId);
    try {
      localStorage.setItem(getSessionStorageKey(currentAgent.id), sessionId);
    } catch {}
    const msgResp = await agentDataApi.getConversationMessages(sessionId);
    if (!msgResp.success) return;
    const mapped: Message[] = msgResp.data.map((m) => ({
      id: String(m.id),
      content: m.content,
      sender: m.message_type === "question" ? "user" : "agent",
      timestamp: m.created_at,
      agentId: currentAgent.id,
    }));
    setWorkflowGroups([]);
    setMessages(mapped);
  };

  const handleStopStream = () => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
    }
    setIsStreaming(false);
    message.info("已取消当前对话");
  };

  useEffect(() => {
    if (isStreaming) {
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
      }
      streamTimerRef.current = setInterval(() => {
        setStreamSeconds((prev) => prev + 1);
      }, 1000);
    } else if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    return () => {
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
      }
    };
  }, [isStreaming]);

  // 登录处理函数
  const handleLogin = async (values: {
    username: string;
    password: string;
  }) => {
    try {
      const result = await auth.login(values.username, values.password);
      if (result.success) {
        message.success("登录成功！");
        setLoginModalVisible(false);
        loginForm.resetFields();

        // 登录成功后自动发送草稿消息
        if (draftMessage && currentAgent && auth.isAuthenticated) {
          logger.debug("📝 登录成功后自动发送草稿消息", draftMessage);
          setInputMessage(draftMessage);
          setDraftMessage("");

          // 直接发送消息
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            content: draftMessage,
            sender: "user",
            timestamp: new Date().toISOString(),
            agentId: currentAgent.id,
          };

          const aiMessage: Message = {
            id: `agent-${Date.now()}`,
            content: `已收到你的消息："${draftMessage}"。我是${currentAgent.name}，正在思考如何回答...`,
            sender: "agent",
            timestamp: new Date().toISOString(),
            agentId: currentAgent.id,
          };

          setMessages([...messages, userMessage, aiMessage]);
        }
      } else {
        message.error(result.error || "登录失败");
      }
    } catch (error) {
      message.error("登录过程中发生错误");
    }
  };

  // 关闭登录模态框
  const handleCloseLoginModal = () => {
    setLoginModalVisible(false);
    setDraftMessage("");
  };

  return (
    <div
      className="ai-agents-page"
      style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <GroupDiscussionPanel
        isAuthenticated={auth.isAuthenticated}
        isStudent={auth.isStudent()}
        isAdmin={auth.isAdmin()}
      />
      <Row gutter={[24, 24]}>
        {/* 左侧：智能体列表和对话历史 */}
        {historyVisible && (
          <Col xs={24} md={8} lg={6}>
            <AgentSidebar
              agents={agents}
              currentAgent={currentAgent}
              sessions={sessions}
              currentSessionId={currentSessionId}
              historyVisible={historyVisible}
              onAgentChange={handleAgentChange}
              onToggleSidebar={handleToggleSidebar}
              onStartNewConversation={handleStartNewConversation}
              onSelectSession={handleSelectSession}
            />
          </Col>
        )}

        {/* 右侧：对话区域 */}
        <Col
          xs={24}
          md={historyVisible ? 16 : 24}
          lg={historyVisible ? 18 : 24}
        >
          <ChatArea
            currentAgent={currentAgent}
            messages={messages}
            workflowGroups={workflowGroups}
            inputMessage={inputMessage}
            historyVisible={historyVisible}
            isAuthenticated={auth.isAuthenticated}
            isStudent={auth.isStudent()}
            userDisplayName={auth.getDisplayName() || undefined}
            isStreaming={isStreaming}
            streamSeconds={streamSeconds}
            onStopStream={handleStopStream}
            onSendMessage={handleSendMessage}
            onInputChange={setInputMessage}
            onToggleSidebar={handleToggleSidebar}
          />
        </Col>
      </Row>

      {/* 统一登录模态框 */}
      <Modal
        title="登录"
        open={loginModalVisible}
        onCancel={handleCloseLoginModal}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={loginForm}
          name="login"
          onFinish={handleLogin}
          layout="vertical"
          autoComplete="off"
        >
          <Form.Item
            label="用户名/姓名"
            name="username"
            rules={[
              { required: true, message: "请输入用户名/姓名" },
              { min: 2, message: "至少2个字符" },
            ]}
          >
            <Input placeholder="请输入用户名（管理员）或姓名（学生）" />
          </Form.Item>

          <Form.Item
            label="密码/学号"
            name="password"
            rules={[
              { required: true, message: "请输入密码/学号" },
              { min: 2, message: "至少2个字符" },
            ]}
          >
            <Input.Password placeholder="请输入密码（管理员）或学号（学生）" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={auth.isLoading}
              icon={<UserOutlined />}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AIAgentsPage;
