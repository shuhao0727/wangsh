import React, { useState, useRef, useEffect } from "react";
import { Input, Button, Typography, Space, Switch, App } from "antd";
import { RobotOutlined, SendOutlined, CodeOutlined } from "@ant-design/icons";
import { pythonlabFlowApi } from "../services/pythonlabDebugApi";
import ReactMarkdown from "react-markdown";
import { FloatingPopup } from "./FloatingPopup";

const { Text } = Typography;

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
  const { message } = App.useApp();
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
        message.error(res.error || "AI response failed");
        setMessages((prev) => [...prev, { role: "assistant", content: "Error: " + (res.error || "Unknown error") }]);
      }
    } catch (error) {
      message.error("Network error");
      setMessages((prev) => [...prev, { role: "assistant", content: "Error: Network error" }]);
    } finally {
      setLoading(false);
    }
  };

  const renderChat = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 12, borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        {messages.length === 0 && (
            <div style={{ textAlign: "center", marginTop: 40, color: "#999" }}>
                <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>我是你的 Python 实验室 AI 助手。</p>
                <p>开启上方“自动优化”开关，我将结合当前代码为你提供建议。</p>
            </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.map((item, index) => (
            <div key={index} style={{ display: "flex", justifyContent: item.role === "user" ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  maxWidth: "85%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: item.role === "user" ? "#0EA5E9" : "#FAFAFA",
                  color: item.role === "user" ? "#fff" : "#333",
                }}
              >
                {item.role === "user" ? (
                    item.content
                ) : (
                    <div className="markdown-body" style={{ fontSize: 14 }}>
                        <ReactMarkdown>{item.content}</ReactMarkdown>
                    </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>
      <div style={{ padding: 12, display: "flex", gap: 8 }}>
        <Input.TextArea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="输入你的问题..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={() => handleSend()} loading={loading} />
      </div>
    </div>
  );

  return (
    <FloatingPopup
      title={
          <Space>
              <RobotOutlined /> AI 助手
          </Space>
      }
      open={open}
      onClose={onClose}
      initialSize={{ w: 400, h: 600 }}
      anchorRect={anchorRect}
      resizable
      draggable
      scrollable={false}
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header / Toolbar */}
        <div style={{ 
            padding: "8px 12px", 
            borderBottom: "1px solid rgba(0,0,0,0.04)",
            display: "flex", 
            justifyContent: "space-between",
            alignItems: "center",
            background: "#fafafa"
        }}>
            <Space size={16}>
                <Space size={4}>
                    <CodeOutlined style={{ color: autoOptimizeCode ? "#0EA5E9" : "#999" }} />
                    <span style={{ fontSize: 12 }}>自动优化代码</span>
                    <Switch size="small" checked={autoOptimizeCode} onChange={handleAutoOptimizeCodeChange} />
                </Space>
            </Space>
        </div>

        {/* Chat Body */}
        <div style={{ flex: 1, overflow: "hidden" }}>
            {renderChat()}
        </div>
      </div>
    </FloatingPopup>
  );
};
