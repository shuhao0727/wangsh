import { showMessage } from "@/lib/toast";
import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, Code, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { pythonlabFlowApi } from "../services/pythonlabCodeApi";
import ReactMarkdown from "react-markdown";
import { FloatingPopup } from "./FloatingPopup";
import { cn } from "@/lib/utils";

interface AIAssistantModalProps {
  open: boolean;
  onClose: () => void;
  code: string;
  anchorRect?: DOMRect | null;
  autoOptimizeCode?: boolean;
  setAutoOptimizeCode?: (v: boolean) => void;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ 
    open, 
    onClose, 
    code, 
    anchorRect,
    autoOptimizeCode,
    setAutoOptimizeCode,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handleAutoOptimizeCodeChange = setAutoOptimizeCode ?? (() => {});

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async (content: string = inputValue) => {
    if (!content.trim()) return;

    const newMessages = [...messages, { role: "user", content } as ChatMessage];
    setMessages(newMessages);
    setInputValue("");
    setLoading(true);

    try {
      let contextInstructions = "";
      if (autoOptimizeCode) {
          contextInstructions += `\n【当前 Python 代码】\n${code}\n`;
          contextInstructions += `\n【要求】如果需要输出代码，只能输出纯 Python 代码，不要解释，不要 Markdown 代码块标记。`;
      }

      const finalMessages = [...newMessages];
      if (contextInstructions) {
          const lastMsg = finalMessages[finalMessages.length - 1];
          finalMessages[finalMessages.length - 1] = {
              ...lastMsg,
              content: `${lastMsg.content}\n\n--- 自动注入上下文 ---${contextInstructions}`
          };
      }

      const res = await pythonlabFlowApi.chatWithAI(finalMessages);
      
      if (res.message) {
        setMessages((prev) => [...prev, { role: "assistant", content: res.message! }]);
      } else {
        showMessage.error(res.error || "AI response failed");
        setMessages((prev) => [...prev, { role: "assistant", content: "Error: " + (res.error || "Unknown error") }]);
      }
    } catch (_error) {
      showMessage.error("Network error");
      setMessages((prev) => [...prev, { role: "assistant", content: "Error: Network error" }]);
    } finally {
      setLoading(false);
    }
  };

  const renderChat = () => (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto border-b border-border-secondary p-3">
        {messages.length === 0 && (
          <div className="mt-10 text-center text-text-tertiary">
            <Bot className="mx-auto mb-4 h-12 w-12" />
            <p>我是你的 Python 实验室 AI 助手。</p>
            <p>开启上方“自动优化”开关，我将结合当前代码为你提供建议。</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {messages.map((item, index) => (
            <div
              key={index}
              className={cn("flex", item.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                  item.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-2 text-text-base",
                )}
              >
                {item.role === "user" ? (
                  item.content
                ) : (
                  <div className="markdown-body text-sm">
                    <ReactMarkdown>{item.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>
      <div className="flex gap-2 p-3">
        <Textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="输入你的问题..."
          aria-label="输入你的问题"
          rows={2}
          className="max-h-[120px] min-h-[44px] resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button onClick={() => handleSend()} disabled={loading} aria-label="发送消息">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <FloatingPopup
      title={
        <div className="inline-flex items-center gap-1.5">
          <Bot className="h-4 w-4" /> AI 助手
        </div>
      }
      open={open}
      onClose={onClose}
      initialSize={{ w: 400, h: 600 }}
      anchorRect={anchorRect}
      resizable
      draggable
      scrollable={false}
    >
      <div className="flex h-full flex-col">
        {/* Header / Toolbar */}
        <div className="flex items-center justify-between border-b border-border-secondary bg-surface-2 px-3 py-2">
          <div className="inline-flex items-center gap-2">
            <Code className={cn("h-4 w-4", autoOptimizeCode ? "text-primary" : "text-text-tertiary")} />
            <span className="text-xs">自动优化代码</span>
            <Switch checked={autoOptimizeCode} onCheckedChange={handleAutoOptimizeCodeChange} />
          </div>
        </div>

        {/* Chat Body */}
        <div className="flex-1 overflow-hidden">
          {renderChat()}
        </div>
      </div>
    </FloatingPopup>
  );
};
