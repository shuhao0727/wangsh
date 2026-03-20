/**
 * useChatStore — 聊天状态管理
 * 从 index.tsx 抽取消息、会话、流式状态
 */
import { useCallback, useState, useRef } from "react";
import type { Message, ConversationSummary, WorkflowGroup, WorkflowNode } from "../types";

export function useChatStore() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [currentStreamingMessageId, setCurrentStreamingMessageId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null);
  const [workflowGroups, setWorkflowGroups] = useState<WorkflowGroup[]>([]);

  const [sessions, setSessions] = useState<ConversationSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const addUserMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const addAgentMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setWorkflowGroups([]);
  }, []);

  const startStreaming = useCallback((agentMessageId: string) => {
    setStreamingContent("");
    setCurrentStreamingMessageId(agentMessageId);
    setIsStreaming(true);
    setStreamStartTime(Date.now());
  }, []);

  const updateStreamingContent = useCallback((text: string) => {
    setStreamingContent(text);
  }, []);

  const finalizeStreaming = useCallback((agentMessageId: string, finalText: string, agentId: string) => {
    const finalMsg: Message = {
      id: agentMessageId,
      content: finalText,
      sender: "agent",
      timestamp: new Date().toISOString(),
      agentId,
    };
    setMessages(prev => [...prev, finalMsg]);
    setStreamingContent("");
    setCurrentStreamingMessageId(null);
    setIsStreaming(false);
  }, []);

  const stopStreaming = useCallback(() => {
    setStreamingContent("");
    setCurrentStreamingMessageId(null);
    setIsStreaming(false);
  }, []);

  return {
    // 状态
    messages,
    setMessages,
    streamingContent,
    currentStreamingMessageId,
    isStreaming,
    streamStartTime,
    workflowGroups,
    setWorkflowGroups,
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    // 操作
    addUserMessage,
    addAgentMessage,
    clearMessages,
    startStreaming,
    updateStreamingContent,
    finalizeStreaming,
    stopStreaming,
  };
}
