import React, { useEffect, useMemo, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  textareaRef?: React.MutableRefObject<any>;
};

export default function LineNumberedTextArea({ value, placeholder, onChange, onKeyDown, textareaRef }: Props) {
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const localTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const bindTextareaRef = (node: HTMLTextAreaElement | null) => {
    localTextareaRef.current = node;
    if (textareaRef) {
      textareaRef.current = node
        ? {
            textArea: node,
            resizableTextArea: { textArea: node },
          }
        : null;
    }
  };

  const lines = useMemo(() => {
    const n = Math.max(1, (value || "").split("\n").length);
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [value]);

  // 根据最大行号位数动态计算 gutter 宽度
  const gutterWidth = useMemo(() => {
    const digits = String(lines.length).length;
    // 每个数字约 8px（13px monospace），加左右 padding
    return Math.max(32, digits * 8 + 20);
  }, [lines.length]);

  useEffect(() => {
    const ta = localTextareaRef.current;
    if (!ta) return;
    const sync = () => {
      if (!gutterRef.current) return;
      gutterRef.current.scrollTop = ta.scrollTop;
    };
    sync();
    ta.addEventListener("scroll", sync, { passive: true });
    return () => ta.removeEventListener("scroll", sync as any);
  }, [textareaRef, value]);

  return (
    <div className="typst-ln-wrap">
      <div className="typst-ln-gutter" ref={gutterRef} style={{ width: gutterWidth, flex: `0 0 ${gutterWidth}px` }}>
        {lines.map((n) => (
          <div key={n} className="typst-ln">
            {n}
          </div>
        ))}
      </div>
      <div className="typst-ln-editor">
        <Textarea
          ref={bindTextareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="h-full min-h-0 resize-none border-0 bg-transparent text-sm font-mono shadow-none focus-visible:ring-0"
          style={{
            height: "100%",
            lineHeight: "22px",
          }}
        />
      </div>
    </div>
  );
}
