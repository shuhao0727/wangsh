import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "antd";

export function PythonCodeEditor(props: {
  value: string;
  onChange: (next: string) => void;
  activeLine?: number | null;
  revealLine?: number | null;
  breakpoints?: { line: number; enabled: boolean }[];
  onToggleBreakpoint?: (line: number) => void;
}) {
  const { value, onChange, activeLine, revealLine, breakpoints, onToggleBreakpoint } = props;
  const textAreaRef = useRef<any>(null);
  const gutterRef = useRef<HTMLPreElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const scrollDragRef = useRef<{ startY: number; baseTop: number; maxTop: number; maxScroll: number } | null>(null);
  const [scrollUi, setScrollUi] = useState<{ thumbTop: number; thumbH: number; visible: boolean }>({ thumbTop: 0, thumbH: 40, visible: false });

  const lineCount = useMemo(() => Math.max(1, value.split("\n").length), [value]);
  const lineNumbers = useMemo(() => Array.from({ length: lineCount }, (_, i) => i + 1), [lineCount]);
  const gutterWidth = useMemo(() => Math.max(52, 20 + Math.max(2, String(lineCount).length) * 12), [lineCount]);

  const gutter = useMemo(() => {
    const bp = new Map((breakpoints ?? []).map((b) => [b.line, b.enabled] as const));
    return (
      <>
        {lineNumbers.map((n) => (
          <div
            key={n}
            onClick={() => onToggleBreakpoint?.(n)}
            style={{
              height: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 6,
              cursor: onToggleBreakpoint ? "pointer" : "default",
              background: activeLine === n ? "rgba(22,119,255,0.10)" : undefined,
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                border: bp.has(n) ? "2px solid #ff4d4f" : "2px solid transparent",
                background: bp.has(n) ? (bp.get(n) ? "#ff4d4f" : "transparent") : "transparent",
                boxSizing: "border-box",
              }}
            />
            <span>{n}</span>
          </div>
        ))}
      </>
    );
  }, [activeLine, breakpoints, lineNumbers, onToggleBreakpoint]);

  const highlight = useMemo(() => {
    const kw = new Set([
      "and",
      "as",
      "assert",
      "break",
      "class",
      "continue",
      "def",
      "del",
      "elif",
      "else",
      "except",
      "False",
      "finally",
      "for",
      "from",
      "global",
      "if",
      "import",
      "in",
      "is",
      "lambda",
      "None",
      "nonlocal",
      "not",
      "or",
      "pass",
      "raise",
      "return",
      "True",
      "try",
      "while",
      "with",
      "yield",
    ]);
    const builtins = new Set(["print", "input", "len", "range", "int", "float", "str", "list", "dict", "set", "tuple", "sum", "min", "max"]);
    const tokenize = (line: string) => {
      const out: { t: string; k: "kw" | "bi" | "num" | "str" | "com" | "op" | "id" | "ws" }[] = [];
      let i = 0;
      while (i < line.length) {
        const ch = line[i];
        if (ch === " " || ch === "\t") {
          let j = i + 1;
          while (j < line.length && (line[j] === " " || line[j] === "\t")) j += 1;
          out.push({ t: line.slice(i, j), k: "ws" });
          i = j;
          continue;
        }
        if (ch === "#") {
          out.push({ t: line.slice(i), k: "com" });
          break;
        }
        if (ch === "'" || ch === '"') {
          const q = ch;
          let j = i + 1;
          while (j < line.length) {
            if (line[j] === "\\" && j + 1 < line.length) {
              j += 2;
              continue;
            }
            if (line[j] === q) {
              j += 1;
              break;
            }
            j += 1;
          }
          out.push({ t: line.slice(i, j), k: "str" });
          i = j;
          continue;
        }
        if ((ch >= "0" && ch <= "9") || (ch === "." && i + 1 < line.length && line[i + 1] >= "0" && line[i + 1] <= "9")) {
          let j = i + 1;
          while (j < line.length) {
            const c = line[j];
            if ((c >= "0" && c <= "9") || c === "." || c === "_" || c === "e" || c === "E" || c === "+" || c === "-") j += 1;
            else break;
          }
          out.push({ t: line.slice(i, j), k: "num" });
          i = j;
          continue;
        }
        if ((ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch === "_") {
          let j = i + 1;
          while (j < line.length) {
            const c = line[j];
            if ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c === "_") j += 1;
            else break;
          }
          const t = line.slice(i, j);
          out.push({ t, k: kw.has(t) ? "kw" : builtins.has(t) ? "bi" : "id" });
          i = j;
          continue;
        }
        out.push({ t: ch, k: "op" });
        i += 1;
      }
      return out;
    };
    const color = (k: string) => {
      if (k === "kw") return "#7c3aed";
      if (k === "bi") return "#2563eb";
      if (k === "num") return "#16a34a";
      if (k === "str") return "#ea580c";
      if (k === "com") return "rgba(0,0,0,0.35)";
      if (k === "op") return "rgba(0,0,0,0.55)";
      return "rgba(0,0,0,0.88)";
    };
    const lines = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
    return (
      <code>
        {lines.map((ln, idx) => {
          const toks = tokenize(ln);
          return (
            <span key={idx} style={{ display: "block", height: 22, background: activeLine === idx + 1 ? "rgba(22,119,255,0.10)" : undefined }}>
              {toks.length
                ? toks.map((tk, j) => (
                    <span key={j} style={{ color: color(tk.k) }}>
                      {tk.t}
                    </span>
                  ))
                : "\u00A0"}
            </span>
          );
        })}
      </code>
    );
  }, [activeLine, value]);

  useEffect(() => {
    const line = revealLine ?? activeLine ?? null;
    if (!line) return;
    const el = textAreaRef.current?.resizableTextArea?.textArea as HTMLTextAreaElement | undefined;
    if (!el) return;
    const lineH = 22;
    const padTop = 12;
    const targetTop = (line - 1) * lineH;
    const viewTop = el.scrollTop;
    const viewBottom = viewTop + el.clientHeight - padTop * 2;
    if (targetTop < viewTop || targetTop > viewBottom - lineH) {
      el.scrollTop = Math.max(0, targetTop - lineH * 2);
      if (gutterRef.current) gutterRef.current.scrollTop = el.scrollTop;
      if (highlightRef.current) highlightRef.current.scrollTop = el.scrollTop;
    }
  }, [activeLine, revealLine]);

  const syncScrollTop = (nextTop: number) => {
    const el = textAreaRef.current?.resizableTextArea?.textArea as HTMLTextAreaElement | undefined;
    if (!el) return;
    el.scrollTop = nextTop;
    if (gutterRef.current) gutterRef.current.scrollTop = el.scrollTop;
    if (highlightRef.current) highlightRef.current.scrollTop = el.scrollTop;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    const trackH = el.clientHeight;
    const minThumb = 28;
    const thumbH = maxScroll > 0 ? Math.max(minThumb, Math.round((el.clientHeight / el.scrollHeight) * trackH)) : trackH;
    const maxTop = Math.max(0, trackH - thumbH);
    const thumbTop = maxScroll > 0 ? Math.round((el.scrollTop / maxScroll) * maxTop) : 0;
    setScrollUi({ thumbTop, thumbH, visible: maxScroll > 0 });
  };

  useEffect(() => {
    const el = textAreaRef.current?.resizableTextArea?.textArea as HTMLTextAreaElement | undefined;
    if (!el) return;
    syncScrollTop(el.scrollTop);
  }, [value]);

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 240, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(0,0,0,0.08)" }}>
      <pre
        ref={gutterRef}
        style={{
          margin: 0,
          width: gutterWidth,
          padding: "12px 12px",
          background: "rgba(0,0,0,0.02)",
          color: "rgba(0,0,0,0.45)",
          textAlign: "right",
          userSelect: "none",
          overflow: "hidden",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 12,
          lineHeight: "22px",
        }}
      >
        {gutter}
      </pre>
      <div style={{ flex: 1, position: "relative" }}>
        <pre
          ref={highlightRef}
          style={{
            position: "absolute",
            inset: 0,
            margin: 0,
            padding: "12px 12px",
            overflow: "hidden",
            whiteSpace: "pre",
            pointerEvents: "none",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 12,
            lineHeight: "22px",
          }}
        >
          {highlight}
        </pre>
        <Input.TextArea
          ref={textAreaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={() => {
            const el = textAreaRef.current?.resizableTextArea?.textArea as HTMLTextAreaElement | undefined;
            if (!el || !gutterRef.current) return;
            gutterRef.current.scrollTop = el.scrollTop;
            if (highlightRef.current) highlightRef.current.scrollTop = el.scrollTop;
            syncScrollTop(el.scrollTop);
          }}
          rows={12}
          spellCheck={false}
          style={{
            border: 0,
            borderRadius: 0,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            flex: 1,
            padding: "12px 12px",
            fontSize: 12,
            lineHeight: "22px",
            minHeight: 240,
            resize: "none",
            background: "transparent",
            color: "transparent",
            caretColor: "rgba(0,0,0,0.9)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 6,
            bottom: 8,
            width: 10,
            borderRadius: 999,
            background: scrollUi.visible ? "rgba(0,0,0,0.04)" : "transparent",
            pointerEvents: scrollUi.visible ? "auto" : "none",
          }}
          onPointerDown={(e) => {
            const el = textAreaRef.current?.resizableTextArea?.textArea as HTMLTextAreaElement | undefined;
            if (!el) return;
            const trackH = el.clientHeight - 16;
            const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
            const maxTop = Math.max(0, trackH - scrollUi.thumbH);
            const clickY = e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top - 8;
            const nextThumbTop = Math.max(0, Math.min(maxTop, Math.round(clickY - scrollUi.thumbH / 2)));
            const nextScroll = maxTop > 0 ? Math.round((nextThumbTop / maxTop) * maxScroll) : 0;
            syncScrollTop(nextScroll);
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 8 + scrollUi.thumbTop,
              left: 1,
              right: 1,
              height: scrollUi.thumbH,
              borderRadius: 999,
              background: "rgba(0,0,0,0.28)",
              cursor: "pointer",
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const el = textAreaRef.current?.resizableTextArea?.textArea as HTMLTextAreaElement | undefined;
              if (!el) return;
              const trackH = el.clientHeight - 16;
              const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
              const maxTop = Math.max(0, trackH - scrollUi.thumbH);
              scrollDragRef.current = { startY: e.clientY, baseTop: scrollUi.thumbTop, maxTop, maxScroll };
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const d = scrollDragRef.current;
              if (!d) return;
              const dy = e.clientY - d.startY;
              const nextThumbTop = Math.max(0, Math.min(d.maxTop, Math.round(d.baseTop + dy)));
              const nextScroll = d.maxTop > 0 ? Math.round((nextThumbTop / d.maxTop) * d.maxScroll) : 0;
              syncScrollTop(nextScroll);
            }}
            onPointerUp={() => {
              scrollDragRef.current = null;
            }}
          />
        </div>
      </div>
    </div>
  );
}
