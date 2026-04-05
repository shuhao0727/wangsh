import React, { useEffect, useMemo, useRef, useState } from "react";
import Editor, { loader } from "@monaco-editor/react";
import type * as MonacoType from "monaco-editor";
import * as monaco from "monaco-editor";
import { shouldStopMonacoEditorKeyPropagation } from "../keyboardGuards";

// 使用本地 npm 包中的 Monaco，避免从 CDN (jsdelivr) 加载失败
loader.config({ monaco });

export const MonacoPythonEditor = React.memo(function MonacoPythonEditor(props: {
  value: string;
  onChange: (next: string) => void;
  activeLine?: number | null;
  revealLine?: number | null;
  breakpoints?: { line: number; enabled: boolean }[];
  onToggleBreakpoint?: (line: number) => void;
  syntaxErrors?: { line: number; col: number; message: string; endLine?: number | null; endCol?: number | null; source?: string }[];
  fontSize?: number;
}) {
  const { value, onChange, activeLine, revealLine, breakpoints, onToggleBreakpoint, syntaxErrors, fontSize = 14 } = props;

  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null);
  const bpDecoIdsRef = useRef<string[]>([]);
  const activeDecoIdsRef = useRef<string[]>([]);
  const lastRevealLineRef = useRef<number | null>(null);
  const [editorMounted, setEditorMounted] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);

  useEffect(() => {
    if (editorMounted) {
      setFallbackMode(false);
      return;
    }
    const t = window.setTimeout(() => {
      setFallbackMode(true);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [editorMounted]);

  const bpMap = useMemo(() => new Map((breakpoints ?? []).map((b) => [b.line, b.enabled] as const)), [breakpoints]);
  const focusLine = revealLine ?? activeLine ?? null;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const next: MonacoType.editor.IModelDeltaDecoration[] = [];
    for (const [line, enabled] of Array.from(bpMap.entries())) {
      if (!Number.isFinite(line) || line < 1) continue;
      next.push({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: enabled ? "wsMonacoBp" : "wsMonacoBpDisabled",
        },
      });
    }
    bpDecoIdsRef.current = editor.deltaDecorations(bpDecoIdsRef.current, next);
  }, [bpMap]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const next: MonacoType.editor.IModelDeltaDecoration[] = [];
    if (activeLine && Number.isFinite(activeLine) && activeLine >= 1) {
      next.push({
        range: new monaco.Range(activeLine, 1, activeLine, 1),
        options: {
          isWholeLine: true,
          className: "wsMonacoActiveLine",
          linesDecorationsClassName: "wsMonacoActiveLineMargin",
        },
      });
    }
    activeDecoIdsRef.current = editor.deltaDecorations(activeDecoIdsRef.current, next);
  }, [activeLine]);

  // Syntax Errors
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    if (syntaxErrors && syntaxErrors.length > 0) {
      const markers = syntaxErrors.map(err => ({
        startLineNumber: err.line,
        startColumn: err.col,
        endLineNumber: err.endLine || err.line,
        endColumn: (err.endCol || err.col) + 1,
        message: err.message,
        severity: monaco.MarkerSeverity.Error,
        source: err.source || "syntax"
      }));
      monaco.editor.setModelMarkers(model, "owner", markers);
    } else {
      monaco.editor.setModelMarkers(model, "owner", []);
    }
  }, [syntaxErrors]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!focusLine || !Number.isFinite(focusLine) || focusLine < 1) return;
    if (lastRevealLineRef.current === focusLine) return;
    lastRevealLineRef.current = focusLine;
    editor.revealLineInCenter(focusLine);
  }, [focusLine]);

  return (
    <div
      className="wsMonacoRoot"
      style={{
        position: "relative",
        display: "flex",
        flex: 1,
        minHeight: 0,
        height: "100%",
        borderRadius: 0,
        overflow: "hidden",
        border: "none",
        background: "#ffffff",
      }}
    >
      <style>{`
        .wsMonacoRoot .monaco-editor .margin-view-overlays .glyph-margin {
          width: 5px !important;
        }
        .wsMonacoRoot .monaco-editor .margin-view-overlays .line-numbers {
          left: 5px !important;
          width: 20px !important;
          text-align: right !important;
          padding-right: 2px !important;
          color: rgba(35, 120, 147, 0.6) !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
        }
        .wsMonacoRoot .monaco-editor .margin {
          background-color: #ffffff !important;
          border-right: 1px solid var(--ws-color-border-secondary) !important;
        }
        .wsMonacoBp {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
        }
        .wsMonacoBpDisabled {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
        }
        .wsMonacoBp::before {
          content: "";
          width: 4px;
          height: 4px;
          border-radius: 999px;
          background: #EF4444;
          box-shadow: 0 2px 6px rgba(255,77,79,0.25);
        }
        .wsMonacoBpDisabled::before {
          content: "";
          width: 4px;
          height: 4px;
          border-radius: 999px;
          box-sizing: border-box;
          border: 1px solid rgba(255,77,79,0.85);
          background: transparent;
        }
        .wsMonacoActiveLine {
          background: rgba(22,119,255,0.10);
        }
        .wsMonacoActiveLineMargin {
          background: rgba(22,119,255,0.10);
        }
      `}</style>
      {fallbackMode && (
        <textarea
          aria-label="python-code-fallback"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
            outline: "none",
            resize: "none",
            padding: "12px",
            fontSize: `${fontSize}px`,
            lineHeight: `${Math.round(fontSize * 1.35)}px`,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            background: "#fff",
            color: "var(--ws-color-text)",
            zIndex: 2,
          }}
        />
      )}
      <Editor
        height="100%"
        defaultLanguage="python"
        theme="vs"
        value={value}
        loading={
          <div className="flex h-full items-center justify-center text-xs text-text-secondary">
            正在加载编辑器...
          </div>
        }
        onChange={(v) => onChange(v ?? "")}
        options={{
          glyphMargin: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          tabSize: 4,
          insertSpaces: true,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: fontSize,
          lineHeight: Math.round(fontSize * 1.35),
          padding: { top: 12, bottom: 12 },
          fixedOverflowWidgets: true,
          renderLineHighlight: "none",
          lineNumbersMinChars: 1,
          lineDecorationsWidth: 0,
          automaticLayout: true,
          quickSuggestions: { other: true, comments: false, strings: false },
          wordBasedSuggestions: "off",
          acceptSuggestionOnEnter: "off",
        }}
        onMount={(editor) => {
          setEditorMounted(true);
          editorRef.current = editor;
          const model = editor.getModel();
          if (model) monaco.editor.setModelLanguage(model, "python");
          editor.onKeyDown((event) => {
            const browserEvent = event.browserEvent;
            if (!browserEvent) return;
            if (
              shouldStopMonacoEditorKeyPropagation({
                key: browserEvent.key,
                isComposing: browserEvent.isComposing,
                keyCode: browserEvent.keyCode,
              })
            ) {
              browserEvent.stopPropagation();
            }
          });
          editor.onMouseDown((e) => {
            const type = e.target.type;
            const isGutter =
              type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
              type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS;
            if (!isGutter) return;
            const line = e.target.position?.lineNumber;
            if (!line) return;
            onToggleBreakpoint?.(line);
          });
        }}
      />
    </div>
  );
});
