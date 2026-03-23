/**
 * useStreamEngine — 标准化 SSE 流式请求引擎
 * 替代 index.tsx 中 130 行手写 SSE 解析逻辑
 */
import { useCallback, useRef } from "react";
import { createParser } from "eventsource-parser";
import type { ParsedEvent, ReconnectInterval } from "eventsource-parser";

export interface StreamCallbacks {
  onDelta: (text: string) => void;
  onEnd: (fullText: string) => void;
  onError: (errText: string) => void;
  onWorkflowStarted?: (groupId: string) => void;
  onNodeStarted?: (name: string) => void;
  onNodeFinished?: (name: string, detail?: string) => void;
}

interface StreamOptions {
  url: string;
  body: Record<string, unknown>;
  callbacks: StreamCallbacks;
  timeoutMs?: number;
}

export function useStreamEngine() {
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (options: StreamOptions) => {
    const { url, body, callbacks, timeoutMs = 120_000 } = options;

    // 中止之前的请求
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // 超时信号
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let fullText = "";
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      callbacks.onEnd(fullText);
    };

    const handleEvent = (event: ParsedEvent | ReconnectInterval) => {
      if (event.type !== 'event') return;
      const eventType = event.event || "";
      let payload: any = null;
      try {
        payload = event.data ? JSON.parse(event.data) : null;
      } catch {
        payload = { text: event.data };
      }

      if (!eventType && payload?.event) {
        // 兼容 Dify 格式
        handleParsedEvent(String(payload.event), payload);
        return;
      }
      handleParsedEvent(eventType, payload);
    };

    const getAnswerText = (payload: any) => {
      const d = payload?.data || payload;
      return d?.answer || d?.text || d?.content || d?.outputs?.answer || d?.outputs?.text || d?.outputs?.content || "";
    };

    const handleParsedEvent = (eventType: string, payload: any) => {
      if (eventType === "message_delta") {
        const delta = getAnswerText(payload) || payload?.delta || "";
        if (delta) {
          fullText += String(delta);
          callbacks.onDelta(fullText);
        }
      } else if (eventType === "message" || eventType === "message_end") {
        const text = getAnswerText(payload);
        if (text) {
          fullText = String(text);
          callbacks.onDelta(fullText);
        }
        if (eventType === "message_end") {
          finish();
        }
      } else if (eventType === "workflow_started") {
        callbacks.onWorkflowStarted?.(payload?.workflow_run_id || `wf-${Date.now()}`);
      } else if (eventType === "node_started") {
        const name = payload?.data?.title || payload?.data?.node_name || "节点";
        callbacks.onNodeStarted?.(String(name));
      } else if (eventType === "node_finished") {
        const name = payload?.data?.title || payload?.data?.node_name || "节点";
        const summary = getAnswerText(payload) || payload?.summary || "";
        callbacks.onNodeFinished?.(String(name), summary ? String(summary) : undefined);
      } else if (eventType === "workflow_finished") {
        const final = getAnswerText(payload);
        if (final) {
          fullText = String(final);
          callbacks.onDelta(fullText);
        }
        finish();
      } else if (eventType === "error") {
        const errMsg = payload?.message || payload?.error || "对话发生错误";
        callbacks.onError(String(errMsg));
      } else {
        // 未知事件类型，尝试提取文本
        const fallback = getAnswerText(payload);
        if (fallback) {
          fullText += String(fallback);
          callbacks.onDelta(fullText);
        }
      }
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        },
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        callbacks.onError(`流式接口错误: HTTP ${res.status}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder("utf-8");
      const parser = createParser(handleEvent);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }

      // 流正常结束，如果还没 finish 则兜底
      if (!finished && fullText) {
        finish();
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      callbacks.onError(e?.message || "网络错误");
    } finally {
      clearTimeout(timeoutId);
      abortRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const isStreaming = useCallback(() => abortRef.current !== null, []);

  return { startStream, stopStream, isStreaming };
}
