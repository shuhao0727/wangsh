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
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export function useStreamEngine() {
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (options: StreamOptions) => {
    const { url, body, callbacks, headers: extraHeaders, timeoutMs = 120_000 } = options;

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
      } else if (eventType === "message") {
        // Dify 流式 message 事件的 answer 是增量 delta，需要累加
        const delta = getAnswerText(payload);
        if (delta) {
          fullText += String(delta);
          callbacks.onDelta(fullText);
        }
      } else if (eventType === "message_end") {
        const text = getAnswerText(payload);
        if (text) {
          fullText = String(text);
          callbacks.onDelta(fullText);
        }
        finish();
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
      // 使用 XHR 实现真正的流式读取
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.setRequestHeader("Accept", "text/event-stream");
        if (extraHeaders) {
          Object.entries(extraHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        }
        xhr.withCredentials = true;

        const parser = createParser(handleEvent);
        let processedLength = 0;

        // 监听 abort 信号
        controller.signal.addEventListener("abort", () => xhr.abort());

        // 关键：onprogress 每次收到数据都触发
        xhr.onprogress = () => {
          const newText = xhr.responseText.substring(processedLength);
          processedLength = xhr.responseText.length;
          if (newText) {
            parser.feed(newText);
          }
        };

        xhr.onload = () => {
          // 处理剩余数据
          const remaining = xhr.responseText.substring(processedLength);
          if (remaining) {
            parser.feed(remaining);
          }
          if (!finished && fullText) {
            finish();
          }
          resolve();
        };

        xhr.onerror = () => reject(new Error("网络错误"));
        xhr.onabort = () => resolve();
        xhr.send(JSON.stringify(body));
      });
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
