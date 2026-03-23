import React, { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useForceRender } from "./hooks/useForceRender";
import {
  App,
  Button,
  Modal,
  Form,
  Input,
  Grid,
  Drawer,
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
import AssessmentPanel from "./AssessmentPanel";
import ClassroomPanel from "./ClassroomPanel";
import AgentErrorBoundary from "./AgentErrorBoundary";
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

const STREAM_TIMEOUT_MS = 120_000;

const generateSessionId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const AIAgentsPage: React.FC = () => {
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

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
  // 新增：流式生成内容（独立于messages，避免高频更新历史记录）
  const [streamingContent, setStreamingContent] = useState<string>("");
  
  const [sessions, setSessions] = useState<ConversationSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // 输入消息
  const [inputMessage, setInputMessage] = useState("");

  // 对话历史可见性
  const [historyVisible, setHistoryVisible] = useState(!isMobile); // Default hidden on mobile
  const [workflowGroups, setWorkflowGroups] = useState<WorkflowGroup[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamingMessageId, setCurrentStreamingMessageId] = useState<string | null>(null);
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null); // Replace streamSeconds with startTime
  const streamAbortRef = useRef<AbortController | null>(null);
  const forceRender = useForceRender();

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
          const colors = ["#0EA5E9", "#10B981", "#6366F1", "#F59E0B"];

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
              color: "#0EA5E9",
              status: "online",
            },
            {
              id: "code-tutor",
              name: "代码导师",
              description: "编程问题解答，代码审查与优化",
              icon: <CodeOutlined />,
              color: "#10B981",
              status: "online",
            },
            {
              id: "contest-guide",
              name: "竞赛指导",
              description: "信息学竞赛题目解析与训练指导",
              icon: <RobotOutlined />,
              color: "#6366F1",
              status: "offline",
            },
            {
              id: "document-analyzer",
              name: "文档分析",
              description: "文档内容提取、总结与分析",
              icon: <MessageOutlined />,
              color: "#F59E0B",
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
            color: "#0EA5E9",
            status: "online",
          },
          {
            id: "code-tutor",
            name: "代码导师",
            description: "编程问题解答，代码审查与优化",
            icon: <CodeOutlined />,
            color: "#10B981",
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
    const newSessionId = generateSessionId();
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
  const handleSendMessage = (text?: string) => {
    const content = (text ?? inputMessage).trim();
    logger.debug("🔍 handleSendMessage 被调用", {
      inputMessage: content,
      isAuthenticated: auth.isAuthenticated,
      isStudent: auth.isStudent(),
      isLoading: auth.isLoading,
      currentAgent: currentAgent ? currentAgent.name : "null",
    });

    if (!content) {
      message.warning("请输入消息内容");
      return;
    }

    // 检查是否还在加载状态
    if (auth.isLoading) {
      logger.debug("⏳ 系统正在加载中，阻止发送");
      message.info("系统正在初始化，请稍后再试");
      return;
    }

    // 检查智能体是否已加载
    if (!currentAgent) {
      logger.debug("⚠️ 智能体未加载，阻止发送");
      message.error("智能体未加载，请刷新页面");
      return;
    }

    if (!auth.isAuthenticated) {
      setDraftMessage(content);
      setLoginModalVisible(true);
      return;
    }

    logger.debug("✅ 已登录，发送消息并开启SSE");
    const activeSessionId = currentSessionId || generateSessionId();
    if (!currentSessionId) {
      setCurrentSessionId(activeSessionId);
      try {
        localStorage.setItem(getSessionStorageKey(currentAgent.id), activeSessionId);
      } catch {}
    }
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content,
      sender: "user",
      timestamp: new Date().toISOString(),
      agentId: currentAgent.id,
    };
    const agentMessageId = `agent-${Date.now() + 1}`;
    // 初始不添加空消息，改用 streamingContent 渲染
    setMessages((prev) => [...prev, userMessage]);
    setStreamingContent(""); // 重置流式内容
    setCurrentStreamingMessageId(agentMessageId); // 设置当前流式消息ID
    setInputMessage("");

    const startStream = async () => {
      setStreamStartTime(Date.now());
      setIsStreaming(true);
      const streamStartedAt = Date.now();
      const controller = new AbortController();
      streamAbortRef.current = controller;
      // 120 秒超时：合并用户手动取消 + 自动超时
      const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
      // 构建多轮对话上下文（最近 10 轮）
      const contextMessages: Array<{ role: string; content: string }> = [];
      const recentMessages = messages.slice(-20); // 最多取最近 20 条（10 轮对话）
      for (const msg of recentMessages) {
        if (msg.sender === "user") {
          contextMessages.push({ role: "user", content: msg.content });
        } else if (msg.sender === "agent" && msg.content) {
          contextMessages.push({ role: "assistant", content: msg.content });
        }
      }
      // 加上当前用户消息
      contextMessages.push({ role: "user", content });

      const body = {
        agent_id: parseInt(String(currentAgent.id), 10),
        message: content,
        messages: contextMessages,
        user: auth.getDisplayName() || "guest",
        inputs: {},
      };
      let finalText = "";
      let usageSaved = false;
      let finalized = false;
      
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
          // 延迟刷新列表，避免后端写入延迟
          setTimeout(() => {
              agentDataApi.listConversations({
                agent_id: parseInt(String(currentAgent.id), 10),
                limit: 5,
              }).then(listResp => {
                if (listResp.success) setSessions(listResp.data);
              }).catch(() => {});
          }, 1000);
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
        
        const addNode = (name: string, startedAt?: number) => {
          const groupId = ensureGroup();
          const node: WorkflowNode = {
            id: `${groupId}-${name}-${Date.now()}`,
            name,
            status: "started",
            startedAt: startedAt ? new Date(startedAt * 1000).toISOString() : new Date().toISOString(),
          };
          setWorkflowGroups((prev) =>
            prev.map((g) =>
              g.id === groupId ? { ...g, nodes: [...g.nodes, node] } : g,
            ),
          );
        };

        const finishNode = (name: string, finishedAt?: number, detail?: string) => {
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
                            finishedAt: finishedAt ? new Date(finishedAt * 1000).toISOString() : new Date().toISOString(),
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
          setStreamingContent(text);
        };
        
        // 结束时将完整消息合并到 messages
        const finalizeMessage = (finalText: string) => {
            if (finalized) return;
            finalized = true;
            const finalMsg: Message = {
              id: agentMessageId,
              content: finalText,
              sender: "agent",
              timestamp: new Date().toISOString(),
              agentId: currentAgent.id,
            };
            setMessages(prev => [...prev, finalMsg]);
            setStreamingContent(""); // 清空流式状态
            setCurrentStreamingMessageId(null);
            setIsStreaming(false); // 停止计时器
        };
        
        if (!res.ok) {
          const errText = `流式接口错误: HTTP ${res.status}`;
          markError(errText);
          finalizeMessage(`⚠️ ${errText}`);
          setStreamingContent("");
          await persistUsage("");
          return;
        }
        
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          // 逐个处理事件，每个事件之间让出控制权确保浏览器渲染
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
              await forceRender(() => {
                setWorkflowGroups((prev) => [
                  ...prev,
                  {
                    id: groupId,
                    label: `工作流 ${prev.length + 1}`,
                    nodes: [],
                    messageId: agentMessageId,
                  },
                ]);
              });
            } else if (eventType === "node_started") {
              const name = getNodeName();
              const startedAt = payload?.data?.created_at || payload?.created_at;
              await forceRender(() => {
                addNode(String(name), startedAt);
              });
            } else if (eventType === "node_finished") {
              const name = getNodeName();
              const finishedAt = payload?.data?.finished_at || payload?.finished_at;
              const summary = getAnswerText() || payload?.summary || payload?.result || "";
              await forceRender(() => {
                finishNode(String(name), finishedAt, summary ? String(summary) : undefined);
              });
            } else if (eventType === "workflow_finished") {
              const final = getAnswerText();
              if (final) {
                finalText = String(final);
                updateAgentText(finalText);
              }
              finalizeMessage(finalText);
              await persistUsage(finalText);
            } else if (eventType === "message_delta") {
              const delta = getAnswerText() || payload?.delta || "";
              if (delta) {
                finalText += String(delta);
                await forceRender(() => {
                  updateAgentText(finalText);
                });
              }
            } else if (eventType === "message") {
              // Dify 流式 message 事件的 answer 是增量 delta，需要累加
              const delta = getAnswerText();
              if (delta) {
                finalText += String(delta);
                await forceRender(() => {
                  updateAgentText(finalText);
                });
              }
            } else if (eventType === "message_end") {
              const text = getAnswerText();
              if (text) {
                finalText = String(text);
                updateAgentText(finalText);
              }
              finalizeMessage(finalText);
              await persistUsage(finalText);
            } else if (eventType === "error") {
              const rawError = payload?.error ? String(payload.error) : "";
              const status = payload?.provider_status ? Number(payload.provider_status) : undefined;
              const detail = payload?.detail ? String(payload.detail) : "";
              let errText = payload?.message ? String(payload.message) : "";
              if (!errText) {
                if (rawError === "provider_status_429" || status === 429) {
                  errText = "上游服务返回 429（限流/额度不足）。请稍后重试，或更换 API Key/提升额度";
                } else if (rawError) {
                  errText = rawError;
                } else {
                  errText = "对话发生错误";
                }
              }
              if (detail && detail !== errText) {
                errText = `${errText}\n${detail}`;
              }
              markError(errText);
              // 将错误信息作为 agent 消息显示给用户
              finalText = `⚠️ ${errText}`;
              finalizeMessage(finalText);
              await persistUsage("");
            } else {
              const fallback = getAnswerText();
              if (fallback) {
                finalText += String(fallback);
                updateAgentText(finalText);
              }
            }
          }
        }
        // 如果是正常结束循环（done=true）且未触发过 finalize，这里做一次兜底
        if (!finalized && finalText) {
            finalizeMessage(finalText);
            await persistUsage(finalText);
        }
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
        clearTimeout(timeoutId);
        streamAbortRef.current = null;
        setIsStreaming(false);
        setCurrentStreamingMessageId(null);
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

  // Ensure sidebar is closed when switching to mobile, or open on desktop if desired
  useEffect(() => {
    if (isMobile) {
      setHistoryVisible(false);
    } else {
      setHistoryVisible(true);
    }
  }, [isMobile]);

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
    // Clean up startTime when streaming stops if needed, or keep it
    if (!isStreaming) {
       // setStreamStartTime(null); // Optional: clear timer on stop
    }
  }, [isStreaming]);

  // 组件卸载时中止进行中的流式请求
  useEffect(() => {
    return () => {
      if (streamAbortRef.current) {
        streamAbortRef.current.abort();
      }
    };
  }, []);

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
          const draft = draftMessage.trim();
          if (draft) {
            logger.debug("📝 登录成功后自动发送草稿消息", draft);
            setDraftMessage("");
            handleSendMessage(draft);
          } else {
            setDraftMessage("");
          }
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
    <AgentErrorBoundary>
    <div className="w-full h-full flex flex-col overflow-hidden bg-white">
      <GroupDiscussionPanel
        isAuthenticated={auth.isAuthenticated}
        isStudent={auth.isStudent()}
        isAdmin={auth.isAdmin()}
        userId={auth.user?.id}
      />
      <AssessmentPanel
        isAuthenticated={auth.isAuthenticated}
        isStudent={auth.isStudent()}
        isAdmin={auth.isAdmin()}
        userId={auth.user?.id}
      />
      <ClassroomPanel
        isAuthenticated={auth.isAuthenticated}
        isStudent={auth.isStudent()}
        isAdmin={auth.isAdmin()}
        userId={auth.user?.id}
      />
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Mobile Drawer */}
        <Drawer
          title="智能体列表"
          placement="left"
          onClose={() => setHistoryVisible(false)}
          open={isMobile && historyVisible}
          width={280}
          styles={{ body: { padding: 0 } }}
        >
          <AgentSidebar
            agents={agents}
            currentAgent={currentAgent}
            sessions={sessions}
            currentSessionId={currentSessionId}
            historyVisible={true}
            onAgentChange={(id) => { handleAgentChange(id); if (isMobile) setHistoryVisible(false); }}
            onToggleSidebar={() => setHistoryVisible(false)}
            onStartNewConversation={() => { handleStartNewConversation(); if (isMobile) setHistoryVisible(false); }}
            onSelectSession={(id) => { handleSelectSession(id); if (isMobile) setHistoryVisible(false); }}
          />
        </Drawer>

        {/* Desktop Sidebar */}
        {!isMobile && historyVisible && (
          <div className="w-[280px] flex-shrink-0 flex flex-col h-full bg-white border-r border-black/[0.04]">
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
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 min-w-0 flex flex-col h-full">
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <ChatArea
              messages={messages}
              currentAgent={currentAgent}
              workflowGroups={workflowGroups}
              inputMessage={inputMessage}
              historyVisible={historyVisible}
              isAuthenticated={auth.isAuthenticated}
              isStudent={auth.isStudent()}
              userDisplayName={auth.getDisplayName() || undefined}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
              currentStreamingMessageId={currentStreamingMessageId}
              streamStartTime={streamStartTime}
              onStopStream={handleStopStream}
              onSendMessage={handleSendMessage}
              onInputChange={setInputMessage}
              onToggleSidebar={handleToggleSidebar}
            />
          </div>
        </div>
      </div>

      {/* 登录弹窗 */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm"
              style={{ background: "linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)" }}>
              W
            </div>
            <span>登录</span>
          </div>
        }
        open={loginModalVisible}
        onCancel={handleCloseLoginModal}
        footer={null}
        destroyOnHidden
        width={400}
      >
        <div className="pt-2">
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
              <Input placeholder="管理员账号 或 学生姓名" size="large" />
            </Form.Item>
            <Form.Item
              label="密码/学号"
              name="password"
              rules={[
                { required: true, message: "请输入密码/学号" },
                { min: 2, message: "至少2个字符" },
              ]}
            >
              <Input.Password placeholder="管理员密码 或 学号" size="large" />
            </Form.Item>
            <Form.Item className="mb-0">
              <Button type="primary" htmlType="submit" block size="large"
                loading={auth.isLoading} icon={<UserOutlined />}>
                登录
              </Button>
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </div>
    </AgentErrorBoundary>
  );
};

export default AIAgentsPage;
