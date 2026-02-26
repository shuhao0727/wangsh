import React, { useEffect, useMemo, useRef } from "react";
import { Input } from "antd";

const { TextArea } = Input;

type Props = {
  id?: string;
  value?: string;
  placeholder?: string;
  onChange?: (next: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
};

export default function LineNumberedMarkdownTextArea({ id, value, placeholder, onChange, onKeyDown }: Props) {
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<any>(null);

  const lines = useMemo(() => {
    const n = Math.max(1, (value || "").split("\n").length);
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [value]);

  useEffect(() => {
    const ta: HTMLTextAreaElement | null = textareaRef.current?.resizableTextArea?.textArea || null;
    if (!ta) return;
    const sync = () => {
      if (!gutterRef.current) return;
      gutterRef.current.scrollTop = ta.scrollTop;
    };
    sync();
    ta.addEventListener("scroll", sync, { passive: true });
    return () => ta.removeEventListener("scroll", sync as any);
  }, [value]);

  return (
    <div className="md-ln-wrap">
      <div className="md-ln-gutter" ref={gutterRef}>
        {lines.map((n) => (
          <div key={n} className="md-ln">
            {n}
          </div>
        ))}
      </div>
      <div className="md-ln-editor">
        <TextArea
          ref={textareaRef}
          id={id}
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          style={{
            height: "100%",
            resize: "none",
            fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
            fontSize: "14px",
            lineHeight: 1.7,
          }}
        />
      </div>
    </div>
  );
}
