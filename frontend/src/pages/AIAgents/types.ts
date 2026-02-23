// AI智能体页面类型定义

// 定义智能体类型
export interface Agent {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  status: "online" | "offline";
}

// 定义消息类型
export interface Message {
  id: string;
  content: string;
  sender: "user" | "agent";
  timestamp: string;
  agentId: string;
}

export interface WorkflowNode {
  id: string;
  name: string;
  status: "started" | "finished" | "error";
  detail?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface WorkflowGroup {
  id: string;
  label: string;
  nodes: WorkflowNode[];
  messageId?: string;
}

export interface ConversationSummary {
  session_id: string;
  agent_id: number;
  display_agent_name?: string;
  display_user_name?: string;
  last_at: string;
  turns: number;
  preview?: string;
}

// 智能体侧边栏Props
export interface AgentSidebarProps {
  agents: Agent[];
  currentAgent: Agent | null;
  sessions: ConversationSummary[];
  currentSessionId: string | null;
  historyVisible: boolean;
  onAgentChange: (agentId: string) => void;
  onToggleSidebar: () => void;
  onStartNewConversation: () => void;
  onSelectSession: (sessionId: string) => void;
}

// 对话区域Props
export interface ChatAreaProps {
  currentAgent: Agent | null;
  messages: Message[];
  workflowGroups?: WorkflowGroup[];
  inputMessage: string;
  historyVisible: boolean;
  isAuthenticated: boolean;
  isStudent: boolean;
  userDisplayName?: string;
  isStreaming?: boolean;
  streamingContent?: string; // 新增：流式生成内容（独立于messages）
  currentStreamingMessageId?: string | null; // 新增：当前正在流式生成的消息ID
  streamSeconds?: number;
  onStopStream?: () => void;
  onSendMessage: () => void;
  onInputChange: (value: string) => void;
  onToggleSidebar: () => void;
}

// 消息气泡Props
export interface MessageBubbleProps {
  message: Message;
  currentAgent: Agent;
}

// 智能体选择器Props
export interface AgentSelectorProps {
  agents: Agent[];
  currentAgent: Agent;
  onAgentChange: (agentId: string) => void;
}
