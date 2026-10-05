import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Bot,
  BookOpen,
  Code2,
  MessageSquare,
  User,
} from "lucide-react";
import AgentSidebar from "./AgentSidebar";
import ChatArea from "./ChatArea";
import GroupDiscussionPanel from "./GroupDiscussionPanel";
import AssessmentPanel from "./AssessmentPanel";
import ClassroomPanel from "./ClassroomPanel";
import AgentErrorBoundary from "./AgentErrorBoundary";
import useAuth from "@hooks/useAuth";
import { useAdminSSE } from "@hooks/useAdminSSE";
import { useBreakpoint } from "@/hooks/useBreakpoint";
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
import { useStreamEngine } from "./hooks/useStreamEngine";

const STREAM_IDLE_TIMEOUT_MS = 120_000;

const getStreamErrorMessage = (errorCode: string | undefined, fallback: string): string => {
  switch (errorCode) {
    case "dify_empty_answer":
    case "empty_answer":
      return "Dify 未返回有效答案，请稍后重试";
    case "dify_rate_limited":
    case "provider_busy":
    case "concurrency_unavailable":
      return "当前 AI 服务繁忙，请稍后重试";
    case "dify_upstream_error":
      return "Dify 服务暂时不可用，请稍后重试";
    case "dify_stream_incomplete":
      return "Dify 流式响应未完成，请稍后重试";
    case "dify_stream_interrupted":
      return "Dify 流式连接中断，请稍后重试";
    case "session_invalid":
      return "登录状态已失效，请重新登录";
    case "session_revalidation_unavailable":
      return "暂时无法核验登录状态，请稍后重试";
    default:
      return fallback;
  }
};

const generateSessionId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// 侧边栏一次拉取并展示的会话条数。
//
// 这个值只决定「侧边栏显示多少条」，不决定「能恢复哪些会话」：
// 恢复「上次会话」时若记录的会话已滑出这个窗口，会单独探测一次（见 loadSessionsAndMaybeRestore），
// 因此保持精简不会造成用户的选择被静默丢弃。
const SESSION_LIST_LIMIT = 5;

/**
 * 用探测到的消息，为「滑出列表窗口的会话」补一份摘要。
 *
 * 侧边栏是照摘要列表渲染的，而列表只拉最近几条；不补这一条的话，
 * 主区能恢复它的内容、侧边栏却既看不到它、也点不中它
 * （handleSelectSession 会因「不在 sessions 里」直接 return）。
 *
 * 各字段刻意对齐后端 list_user_conversations 的口径，保证这条摘要在列表里不显突兀：
 *   preview = 最新一条回答（为空则退回最新一条提问），并同样截断到 80 字符；
 *   turns   = 提问条数；last_at = 最后一条消息的时间。
 */
const toSummaryFromMessages = (
  sessionId: string,
  agentId: number,
  messages: Array<{ content: string; message_type: string; created_at: string }>,
): ConversationSummary => {
  // 详情接口按 created_at 升序返回，故末尾即最新
  const lastOf = (type: string) =>
    [...messages].reverse().find((m) => m.message_type === type);
  // 回答内容后端已做过 sanitize（agent_conversations._sanitize_conversation_row），此处直接使用
  const rawPreview = (lastOf("answer")?.content || lastOf("question")?.content || "").trim();
  const preview = rawPreview.length > 80 ? `${rawPreview.slice(0, 80)}…` : rawPreview;

  return {
    session_id: sessionId,
    agent_id: agentId,
    // 取最新一条消息的时间作为该会话的排序依据（与后端 max(created_at) 一致）
    last_at: messages.reduce(
      (latest, m) =>
        new Date(m.created_at).getTime() > new Date(latest).getTime() ? m.created_at : latest,
      messages[0].created_at,
    ),
    turns: messages.filter((m) => m.message_type === "question").length,
    preview: preview || undefined,
  };
};

const AIAgentsPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // 统一认证状态
  const auth = useAuth();

  // 登录模态框状态
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

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

  // All history reads share one generation, including automatic restoration.
  const historyRequest = useRef(0);
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "error" | "readonly">("idle");

  const historyStatusMessage = historyStatus === "loading"
    ? "历史记录加载中…"
    : historyStatus === "readonly"
      ? "该历史会话仅可查看，请新建会话后发送"
      : "历史记录加载失败，请重新选择会话或新建会话";

  // Invalidate before passive effects/promises can publish another identity's data.
  useLayoutEffect(() => {
    historyRequest.current += 1;
    setMessages([]);
    setSessions([]);
    setCurrentSessionId(null);
    setWorkflowGroups([]);
    setHistoryStatus("idle");
    setStreamingContent("");
    setCurrentStreamingMessageId(null);
    setIsStreaming(false);
    return () => { historyRequest.current += 1; };
  }, [auth.isAuthenticated, auth.user?.id, currentAgent?.id]);

  // 输入消息
  const [inputMessage, setInputMessage] = useState("");

  // 对话历史可见性
  const [historyVisible, setHistoryVisible] = useState(!isMobile); // Default hidden on mobile
  const [workflowGroups, setWorkflowGroups] = useState<WorkflowGroup[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamingMessageId, setCurrentStreamingMessageId] = useState<string | null>(null);
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null);

  // 使用 useStreamEngine hook
  const { startStream: startStreamEngine, stopStream } = useStreamEngine();

  // 加载启用的智能体
  const loadAgents = useCallback(async () => {
    try {
      const response = await aiAgentsApi.getActiveAgents();
      const activeAgents: AIAgent[] = response.data || [];

      const mappedAgents: Agent[] = activeAgents.map((agent, index) => {
          // 根据索引分配图标和颜色
          const icons = [
            <BookOpen className="h-4 w-4" />,
            <Code2 className="h-4 w-4" />,
            <Bot className="h-4 w-4" />,
            <MessageSquare className="h-4 w-4" />,
          ];
          const colors = [
            "var(--ws-color-primary)",
            "var(--ws-color-success)",
            "var(--ws-color-secondary)",
            "var(--ws-color-warning)",
          ];

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
              icon: <BookOpen className="h-4 w-4" />,
              color: "var(--ws-color-primary)",
              status: "online",
            },
            {
              id: "code-tutor",
              name: "代码导师",
              description: "编程问题解答，代码审查与优化",
              icon: <Code2 className="h-4 w-4" />,
              color: "var(--ws-color-success)",
              status: "online",
            },
            {
              id: "contest-guide",
              name: "竞赛指导",
              description: "信息学竞赛题目解析与训练指导",
              icon: <Bot className="h-4 w-4" />,
              color: "var(--ws-color-secondary)",
              status: "offline",
            },
            {
              id: "document-analyzer",
              name: "文档分析",
              description: "文档内容提取、总结与分析",
              icon: <MessageSquare className="h-4 w-4" />,
              color: "var(--ws-color-warning)",
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
        showMessage.error("加载智能体列表失败，使用默认智能体");

        // 失败时使用默认智能体
        const defaultAgents: Agent[] = [
          {
            id: "study-assistant",
            name: "学习助手",
            description: "帮助你解决学习问题，提供学习建议",
            icon: <BookOpen className="h-4 w-4" />,
            color: "var(--ws-color-primary)",
            status: "online",
          },
          {
            id: "code-tutor",
            name: "代码导师",
            description: "编程问题解答，代码审查与优化",
            icon: <Code2 className="h-4 w-4" />,
            color: "var(--ws-color-success)",
            status: "online",
          },
        ];
        setAgents(defaultAgents);
        setCurrentAgent(defaultAgents[0]);
      }
  }, []);

  // 首次加载
  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  // 监听 agent_changed SSE 事件，自动刷新列表
  useAdminSSE("agent_changed", () => {
    void loadAgents();
  });

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
    if (!auth.isAuthenticated || !auth.user?.id) return;
    historyRequest.current += 1;
    setHistoryStatus("idle");
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
  }, [auth.isAuthenticated, auth.user?.id, getSessionStorageKey]);

  const loadSessionsAndMaybeRestore = useCallback(async (agent: Agent) => {
    if (!auth.isAuthenticated || !auth.user?.id) return;
    const agentIdNum = parseInt(String(agent.id), 10);
    if (!Number.isFinite(agentIdNum)) return;

    const request = ++historyRequest.current;
    setHistoryStatus("loading");
    setMessages([]);
    setWorkflowGroups([]);
    try {
      const listResp = await agentDataApi.listConversations({
        agent_id: agentIdNum,
        limit: SESSION_LIST_LIMIT,
      });
      if (request !== historyRequest.current) return;
      if (!listResp.success) throw new Error(listResp.message);
      // Do not assign orphaned/other-agent history to the current agent.
      const agentSessions = listResp.data.filter((session) => session.agent_id === agentIdNum);
      setSessions(agentSessions);

      let preferred: string | null = null;
      try {
        preferred = localStorage.getItem(getSessionStorageKey(agent.id));
      } catch {}

      // 恢复用户上次打开的会话。
      //
      // 分两种情况，区别在于「摘要列表对这条会话有没有表态」：
      //  1) 列表里有它 —— 以列表为准。只有 agent_id 归属本智能体才采纳，
      //     否则说明这是孤儿会话或别的智能体的会话，绝不能接进当前对话。
      //  2) 列表里没有它 —— 多半是被 limit 截掉了（侧边栏只拉最近几条，
      //     而写入侧是无条件落盘的）。此时单独探测一次，并按返回消息的 agent_id
      //     复核归属：该接口只按 user_id 过滤、不校验 agent，不核对就会把
      //     「同一用户在别的智能体下的会话」错认成本智能体的历史。
      const preferredSummary = preferred
        ? listResp.data.find((s) => s.session_id === preferred)
        : undefined;

      let selected: string | null = null;
      if (preferred) {
        if (preferredSummary) {
          if (preferredSummary.agent_id === agentIdNum) selected = preferred;
        } else {
          const probe = await agentDataApi.getConversationMessages(preferred);
          if (request !== historyRequest.current) return;
          if (probe.success && probe.data.length > 0 && probe.data.every((m) => m.agent_id === agentIdNum)) {
            selected = preferred;
            // 把这条会话补进列表，否则侧边栏既显示不出它、也点不中它。
            // 放在列表末尾：它会落到「本月/更早」分组，不挤占「今天」的位置。
            setSessions([
              ...agentSessions,
              toSummaryFromMessages(preferred, agentIdNum, probe.data),
            ]);
          }
        }
      }

      if (!selected) selected = agentSessions[0]?.session_id || null;

      if (!selected) {
        createNewConversation(agent);
        return;
      }

      setCurrentSessionId(selected);
      const msgResp = await agentDataApi.getConversationMessages(selected);
      if (request !== historyRequest.current) return;
      if (!msgResp.success) throw new Error(msgResp.message);

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
      setHistoryStatus("idle");
    } catch (error) {
      if (request !== historyRequest.current) return;
      setHistoryStatus("error");
      logger.error("加载历史记录失败:", error);
      showMessage.error("历史记录加载失败，请重新选择会话或新建会话");
    }
  }, [auth.isAuthenticated, auth.user?.id, createNewConversation, getSessionStorageKey]);

  useEffect(() => {
    if (!currentAgent) return;
    if (!auth.isAuthenticated) return;
    void loadSessionsAndMaybeRestore(currentAgent);
  }, [auth.isAuthenticated, currentAgent, loadSessionsAndMaybeRestore]);

  // 切换智能体
  const handleAgentChange = (agentId: string) => {
    historyRequest.current += 1;
    stopStream("navigation");
    setStreamingContent("");
    setCurrentStreamingMessageId(null);
    setIsStreaming(false);
    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      setCurrentAgent(agent);
      showMessage.success(`已切换到 ${agent.name}`);
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

    if (historyStatus !== "idle") {
      showMessage.warning(historyStatusMessage);
      return;
    }

    if (!content) {
      showMessage.warning("请输入消息内容");
      return;
    }

    // 检查是否还在加载状态
    if (auth.isLoading) {
      logger.debug("⏳ 系统正在加载中，阻止发送");
      showMessage.info("系统正在初始化，请稍后再试");
      return;
    }

    // 检查智能体是否已加载
    if (!currentAgent) {
      logger.debug("⚠️ 智能体未加载，阻止发送");
      showMessage.error("智能体未加载，请刷新页面");
      return;
    }

    if (!auth.isAuthenticated) {
      setDraftMessage(content);
      setLoginModalVisible(true);
      return;
    }

    if (!auth.user?.id) {
      showMessage.warning("用户信息加载中，请稍后发送");
      return;
    }

    const request = ++historyRequest.current;
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

      // 构建多轮对话上下文
      const contextMessages: Array<{ role: string; content: string }> = [];
      const recentMessages = messages.slice(-20);
      for (const msg of recentMessages) {
        if (msg.sender === "user") {
          contextMessages.push({ role: "user", content: msg.content });
        } else if (msg.sender === "agent" && msg.content) {
          contextMessages.push({ role: "assistant", content: msg.content });
        }
      }
      contextMessages.push({ role: "user", content });

      let currentGroupId = "";
      let usageSaved = false;

      const ensureGroup = () => {
        if (currentGroupId) return currentGroupId;
        const groupId = `wf-${Date.now()}-${Math.random()}`;
        currentGroupId = groupId;
        setWorkflowGroups((prev) => [
          ...prev,
          { id: groupId, label: `工作流 ${prev.length + 1}`, nodes: [], messageId: agentMessageId },
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
          prev.map((g) => (g.id === groupId ? { ...g, nodes: [...g.nodes, node] } : g))
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
                      ? { ...n, status: "finished", detail, finishedAt: new Date().toISOString() }
                      : n
                  ),
                }
              : g
          )
        );
      };

      const persistUsage = async (answerText: string) => {
        if (request !== historyRequest.current || usageSaved || !userMessage.content || !auth.isAuthenticated) return;
        usageSaved = true;
        try {
          await agentDataApi.createUsage({
            agent_id: parseInt(String(currentAgent.id), 10),
            user_id: auth.user?.id,
            question: userMessage.content,
            answer: answerText || "",
            session_id: activeSessionId,
            response_time_ms: Date.now() - streamStartedAt,
          });
          if (request !== historyRequest.current) return;
          setTimeout(() => {
            if (request !== historyRequest.current) return;
            agentDataApi.listConversations({
              agent_id: parseInt(String(currentAgent.id), 10),
              limit: SESSION_LIST_LIMIT,
            }).then(listResp => {
              if (request !== historyRequest.current) return;
              if (listResp.success) {
                const activeSummary = listResp.data.find((session) => session.session_id === activeSessionId);
                if (activeSummary && activeSummary.agent_id !== Number(currentAgent.id)) {
                  setHistoryStatus("readonly");
                }
                setSessions(listResp.data.filter((session) => session.agent_id === Number(currentAgent.id)));
              }
            }).catch(() => {});
          }, 1000);
        } catch (error) {
          logger.error("写入对话记录失败:", error);
        }
      };

      try {
        const token = auth.getToken();
        await startStreamEngine({
          url: `${config.apiUrl}/ai-agents/stream`,
          body: {
            agent_id: parseInt(String(currentAgent.id), 10),
            message: content,
            messages: contextMessages,
            user: auth.getDisplayName() || "guest",
            inputs: {},
          },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          callbacks: {
            onDelta: (text) => {
              if (request !== historyRequest.current) return;
              setStreamingContent(text);
            },
            onEnd: (fullText) => {
              if (request !== historyRequest.current) return;
              if (!fullText || !fullText.trim()) {
                const errMsg: Message = {
                  id: `err-${Date.now()}`,
                  content: "⚠️ 模型未返回内容",
                  sender: "agent",
                  timestamp: new Date().toISOString(),
                  agentId: currentAgent.id,
                };
                setMessages((prev) => [...prev, errMsg]);
                setStreamingContent("");
                setCurrentStreamingMessageId(null);
                setIsStreaming(false);
                return;
              }
              const finalMsg: Message = {
                id: agentMessageId,
                content: fullText,
                sender: "agent",
                timestamp: new Date().toISOString(),
                agentId: currentAgent.id,
              };
              setMessages((prev) => [...prev, finalMsg]);
              setStreamingContent("");
              setCurrentStreamingMessageId(null);
              setIsStreaming(false);
              void persistUsage(fullText);
            },
            onError: (errText, partialText, errorCode) => {
              if (request !== historyRequest.current) return;
              const displayError = getStreamErrorMessage(errorCode, errText);
              const errMsg: Message = {
                id: `err-${Date.now()}`,
                content: `⚠️ ${displayError}`,
                sender: "agent",
                timestamp: new Date().toISOString(),
                agentId: currentAgent.id,
              };
              const partial = partialText?.trim();
              setMessages((prev) => {
                if (!partial) return [...prev, errMsg];
                const partialMsg: Message = {
                  id: agentMessageId,
                  content: partial,
                  sender: "agent",
                  timestamp: new Date().toISOString(),
                  agentId: currentAgent.id,
                };
                return [...prev, partialMsg, errMsg];
              });
              setStreamingContent("");
              setCurrentStreamingMessageId(null);
              setIsStreaming(false);
            },
            onWorkflowStarted: (groupId) => {
              if (request !== historyRequest.current) return;
              currentGroupId = groupId;
              setWorkflowGroups((prev) => [
                ...prev,
                { id: groupId, label: `工作流 ${prev.length + 1}`, nodes: [], messageId: agentMessageId },
              ]);
            },
            onNodeStarted: (name) => { if (request === historyRequest.current) addNode(name); },
            onNodeFinished: (name, detail) => { if (request === historyRequest.current) finishNode(name, detail); },
          },
          timeoutMs: STREAM_IDLE_TIMEOUT_MS,
        });
      } catch (e: any) {
        if (request !== historyRequest.current) return;
        if (e?.name === "AbortError") return;
        const errMsg: Message = {
          id: `err-${Date.now()}`,
          content: e?.message || "网络错误",
          sender: "agent",
          timestamp: new Date().toISOString(),
          agentId: currentAgent.id,
        };
        setMessages((prev) => [...prev, errMsg]);
        setIsStreaming(false);
        setCurrentStreamingMessageId(null);
      }
    };
    void startStream();
  };

  // 停止流式响应
  const handleStopStream = () => {
    stopStream();
    setIsStreaming(false);
    setCurrentStreamingMessageId(null);
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
    stopStream("navigation");
    setStreamingContent("");
    setCurrentStreamingMessageId(null);
    setIsStreaming(false);
    createNewConversation(currentAgent);
    handleFocusInput();
  };

  const handleSelectSession = async (sessionId: string) => {
    if (!currentAgent || !auth.isAuthenticated || !auth.user?.id) return;
    if (!sessions.some((session) => session.session_id === sessionId && session.agent_id === Number(currentAgent.id))) return;
    const request = ++historyRequest.current;
    setHistoryStatus("loading");
    stopStream("navigation");
    setStreamingContent("");
    setCurrentStreamingMessageId(null);
    setIsStreaming(false);
    setCurrentSessionId(sessionId);
    setMessages([]);
    setWorkflowGroups([]);
    try {
      localStorage.setItem(getSessionStorageKey(currentAgent.id), sessionId);
    } catch {}
    try {
      const msgResp = await agentDataApi.getConversationMessages(sessionId);
      if (request !== historyRequest.current) return;
      if (!msgResp.success) throw new Error(msgResp.message);
      const mapped: Message[] = msgResp.data.map((m) => ({
        id: String(m.id),
        content: m.content,
        sender: m.message_type === "question" ? "user" : "agent",
        timestamp: m.created_at,
        agentId: currentAgent.id,
      }));
      setMessages(mapped);
      setHistoryStatus("idle");
    } catch (error) {
      if (request !== historyRequest.current) return;
      setHistoryStatus("error");
      logger.error("加载历史记录失败:", error);
      showMessage.error("历史记录加载失败，请重新选择会话或新建会话");
    }
  };

  useEffect(() => {
    if (!isStreaming) {
       // setStreamStartTime(null);
    }
  }, [isStreaming]);

  // 组件卸载时中止进行中的流式请求
  useEffect(() => {
    return () => {
      stopStream("unmount");
    };
  }, [stopStream]);

  // 登录处理函数
  const handleLogin = async () => {
    const username = loginUsername.trim();
    const password = loginPassword.trim();
    if (username.length < 2) {
      showMessage.warning("请输入至少2个字符的用户名/姓名");
      return;
    }
    if (password.length < 2) {
      showMessage.warning("请输入至少2个字符的密码/学号");
      return;
    }
    try {
      const result = await auth.login(username, password);
      if (result.success) {
        showMessage.success("登录成功！");
        setLoginModalVisible(false);
        setLoginUsername("");
        setLoginPassword("");

        // 登录成功后自动发送草稿消息
        if (draftMessage && currentAgent && result.user) {
          const draft = draftMessage.trim();
          if (draft) {
            logger.debug("📝 登录成功后自动发送草稿消息", draft);
            setDraftMessage("");
            void handleSendMessage(draft);
          } else {
            setDraftMessage("");
          }
        }
      } else {
        showMessage.error(result.error || "登录失败");
      }
    } catch (_error) {
      showMessage.error("登录过程中发生错误");
    }
  };

  // 关闭登录模态框
  const handleCloseLoginModal = () => {
    setLoginModalVisible(false);
    setDraftMessage("");
    setLoginUsername("");
    setLoginPassword("");
  };

  return (
    <AgentErrorBoundary>
    <div className="ai-agents-page w-full h-full flex flex-col overflow-hidden bg-surface">
      <GroupDiscussionPanel
        isAuthenticated={auth.isAuthenticated}
        isStudent={auth.isStudent()}
        isAdmin={auth.isAdmin()}
        userId={auth.user?.id}
        className={auth.user?.class_name ?? undefined}
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
        {/* Mobile Sidebar Sheet */}
        <Sheet
          open={isMobile && historyVisible}
          onOpenChange={(open) => setHistoryVisible(open)}
        >
          <SheetContent side="left" className="w-72 p-0 sm:max-w-72">
            <SheetHeader className="border-b border-[var(--ws-color-border-secondary)] px-4 py-3">
              <SheetTitle className="text-base">智能体列表</SheetTitle>
            </SheetHeader>
            <div className="flex-1 min-h-0">
              <AgentSidebar
                agents={agents}
                currentAgent={currentAgent}
                sessions={sessions}
                currentSessionId={currentSessionId}
                historyVisible={true}
                onAgentChange={(id) => { handleAgentChange(id); if (isMobile) setHistoryVisible(false); }}
                onToggleSidebar={() => setHistoryVisible(false)}
                onStartNewConversation={() => { handleStartNewConversation(); if (isMobile) setHistoryVisible(false); }}
                onSelectSession={(id) => { void handleSelectSession(id); if (isMobile) setHistoryVisible(false); }}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Desktop Sidebar */}
        {!isMobile && historyVisible && (
          <div className="w-72 flex-shrink-0 flex flex-col h-full bg-surface border-r border-[var(--ws-color-border-secondary)]">
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
            {historyStatus !== "idle" && (
              <div role="status" className="px-4 py-xs text-sm text-text-secondary">
                {historyStatusMessage}
              </div>
            )}
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
      <Dialog
        open={loginModalVisible}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseLoginModal();
          }
        }}
      >
        <DialogContent className="w-full sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-xs">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm"
                  style={{ background: "var(--ws-gradient-primary)" }}>
                  W
                </div>
                <span>登录</span>
              </div>
            </DialogTitle>
            <DialogDescription>登录后可继续与智能体对话。</DialogDescription>
          </DialogHeader>
          <div className="pt-[var(--ws-space-1)] space-y-[var(--ws-space-2)]">
            <div className="space-y-xs">
              <Label htmlFor="login-username">用户名/姓名</Label>
              <Input
                id="login-username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="管理员账号 或 学生姓名"
                autoComplete="username"
              />
            </div>
            <div className="space-y-xs">
              <Label htmlFor="login-password">密码/学号</Label>
              <Input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleLogin();
                  }
                }}
                placeholder="管理员密码 或 学号"
                autoComplete="current-password"
              />
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={() => void handleLogin()}
              disabled={auth.isLoading}
            >
              <User className="h-4 w-4" />
              {auth.isLoading ? "登录中..." : "登录"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </AgentErrorBoundary>
  );
};

export default AIAgentsPage;
