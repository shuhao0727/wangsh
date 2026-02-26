import React, { useEffect, useMemo, useRef } from "react";
import { Input } from "antd";

const { TextArea } = Input;

type Props = {
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  textareaRef?: React.MutableRefObject<any>;
};

export default function LineNumberedTextArea({ value, placeholder, onChange, onKeyDown, textareaRef }: Props) {
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const lines = useMemo(() => {
    const n = Math.max(1, (value || "").split("\n").length);
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [value]);

  useEffect(() => {
    const ta: HTMLTextAreaElement | null = textareaRef?.current?.resizableTextArea?.textArea || null;
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
      <div className="typst-ln-gutter" ref={gutterRef}>
        {lines.map((n) => (
          <div key={n} className="typst-ln">
            {n}
          </div>
        ))}
      </div>
      <div className="typst-ln-editor">
        <TextArea
          ref={textareaRef as any}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          style={{
            height: "100%",
            resize: "none",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        />
      </div>
    </div>
  );
}

