import React, { useEffect, useMemo, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  id?: string;
  value?: string;
  placeholder?: string;
  onChange?: (next: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
};

export default function LineNumberedMarkdownTextArea({ id, value, placeholder, onChange, onKeyDown }: Props) {
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const lines = useMemo(() => {
    const n = Math.max(1, (value || "").split("\n").length);
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [value]);

  const gutterWidth = useMemo(() => {
    const digits = String(lines.length).length;
    return Math.max(32, digits * 8 + 20);
  }, [lines.length]);

  useEffect(() => {
    const ta = textareaRef.current;
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
      <div className="md-ln-gutter" ref={gutterRef} style={{ width: gutterWidth, flex: `0 0 ${gutterWidth}px` }}>
        {lines.map((n) => (
          <div key={n} className="md-ln">
            {n}
          </div>
        ))}
      </div>
      <div className="md-ln-editor">
        <Textarea
          ref={textareaRef}
          id={id}
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="h-full min-h-0 resize-none border-0 bg-transparent text-sm font-mono shadow-none focus-visible:ring-0"
          style={{
            height: "100%",
            lineHeight: "24px",
          }}
        />
      </div>
    </div>
  );
}
