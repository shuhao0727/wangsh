import React, { useEffect, useMemo, useRef } from "react";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

// 配置 monaco-editor loader 使用本地 monaco 实例
loader.config({ monaco });

export function MonacoPythonEditor(props: {
  value: string;
  onChange: (next: string) => void;
  activeLine?: number | null;
  revealLine?: number | null;
  breakpoints?: { line: number; enabled: boolean }[];
  onToggleBreakpoint?: (line: number) => void;
  syntaxErrors?: { line: number; col: number; message: string; endLine?: number | null; endCol?: number | null; source?: string }[];
}) {
  const { value, onChange, activeLine, revealLine, breakpoints, onToggleBreakpoint, syntaxErrors } = props;

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const bpDecoIdsRef = useRef<string[]>([]);
  const activeDecoIdsRef = useRef<string[]>([]);
  const lastRevealLineRef = useRef<number | null>(null);

  const bpMap = useMemo(() => new Map((breakpoints ?? []).map((b) => [b.line, b.enabled] as const)), [breakpoints]);
  const focusLine = revealLine ?? activeLine ?? null;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const next: monaco.editor.IModelDeltaDecoration[] = [];
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

    const next: monaco.editor.IModelDeltaDecoration[] = [];
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
    <div className="wsMonacoRoot" style={{ display: "flex", flex: 1, minHeight: 240, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(0,0,0,0.08)" }}>
      <style>{`
        .wsMonacoRoot .monaco-editor .margin-view-overlays .glyph-margin {
          width: 14px !important;
        }
        .wsMonacoRoot .monaco-editor .margin-view-overlays .line-numbers {
          left: 14px !important;
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
          background: #ff4d4f;
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
      <Editor
        defaultLanguage="python"
        theme="vs"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        options={{
          glyphMargin: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          tabSize: 4,
          insertSpaces: true,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 12,
          lineHeight: 22,
          padding: { top: 12, bottom: 12 },
          fixedOverflowWidgets: true,
          renderLineHighlight: "none",
          lineNumbersMinChars: 2,
          lineDecorationsWidth: 4,
          automaticLayout: true,
          quickSuggestions: { other: true, comments: false, strings: false },
          wordBasedSuggestions: "off",
          acceptSuggestionOnEnter: "off",
        }}
        onMount={(editor) => {
          editorRef.current = editor;
          const model = editor.getModel();
          if (model) monaco.editor.setModelLanguage(model, "python");
          editor.onMouseDown((e) => {
            const type = e.target.type;
            const isGutter =
              type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN || type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS;
            if (!isGutter) return;
            const line = e.target.position?.lineNumber;
            if (!line) return;
            onToggleBreakpoint?.(line);
          });
        }}
      />
    </div>
  );
}
