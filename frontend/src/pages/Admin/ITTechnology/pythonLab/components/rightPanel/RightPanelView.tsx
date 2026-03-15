import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Space, Tabs, Tag, Tooltip, Typography } from "antd";
import {
  BugOutlined,
  CodeOutlined,
  ConsoleSqlOutlined,
  ExpandOutlined,
  FastForwardOutlined,
  LoginOutlined,
  LogoutOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RightOutlined,
  EyeOutlined,
  PlusOutlined,
  MinusOutlined,
  RollbackOutlined,
  RobotOutlined,
  ThunderboltOutlined
} from "@ant-design/icons";
import { validatePythonLite } from "../../flow/python_sync";
import { pythonlabSyntaxApi, type PythonLabSyntaxError } from "../../services/pythonlabDebugApi";
import { MonacoPythonEditor } from "../MonacoPythonEditor";
import XtermTerminal from "../XtermTerminal";
import PyodideTerminal from "../PyodideTerminal";
import { FloatingPopup } from "../FloatingPopup";
// import { AIAssistantModal } from "../AIAssistantModal";
import type { RightPanelTabKey } from "../rightPanelTabPolicy";
import type { RightPanelProps } from "./types";
import { DebugTab } from "./DebugTab";
import { PipelineTab } from "./PipelineTab";
import { wsUrl } from "../../hooks/dapRunnerHelpers";
import { useWsAccessToken } from "../../hooks/useWsAccessToken";
import { getTerminalModeHint } from "./terminalHint";
import { resolveDebugControlMatrix } from "../../adapters/debugCapabilityMap";

const { Text } = Typography;

export const RightPanel = React.memo(function RightPanel(props: RightPanelProps) {
  const {
    generated,
    code,
    setCode,
    codeMode,
    setCodeMode,
    revealLine,
    variableColumns,
    runner,
    flow,
    debugCapabilities,
    runnerError,
    lastLaunchMode,
    terminalBridge,
    onRebuildFlowFromCode,
    onRun,
    onDebug,
    onContinue,
    onPause,
    onStepOver,
    onStepInto,
    onStepOut,
    onReset,
    onToggleBreakpoint,
    onAddWatch,
    onRemoveWatch,
    beautifyResult,
    beautifyLoading,
    beautifyError,
    onRefreshBeautify,
    onClearPendingOutput,
    autoOptimizeCode,
    setAutoOptimizeCode,
    onOptimizeCode,
  } = props;

  const [editorOpen, setEditorOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  // const [aiOpen, setAiOpen] = useState(false);
  // const [aiAnchorRect, setAiAnchorRect] = useState<DOMRect | null>(null);
  const [activeTab, setActiveTab] = useState<RightPanelTabKey>("terminal");
  const [rebuildError, setRebuildError] = useState<string | null>(null);

  const [editorFontSize, setEditorFontSize] = useState(14);
  const terminalUiRef = useRef<{ clear: () => void; ensureNewline: () => void; write: (d: string) => void } | null>(null);

  const [backendSyntax, setBackendSyntax] = useState<{ ok: boolean; errors?: PythonLabSyntaxError[] }>({ ok: true });

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!code.trim()) {
        setBackendSyntax({ ok: true });
        return;
      }
      try {
        const res = await pythonlabSyntaxApi.checkSyntax(code);
        setBackendSyntax({ ok: res.ok, errors: res.errors });
      } catch {
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [code]);

  const validation = useMemo(() => validatePythonLite(code), [code]);
  const isSyntaxOk = validation.ok && backendSyntax.ok;

  const statusColor = runner.status === "error" ? "red" : runner.status === "running" ? "blue" : runner.status === "paused" ? "orange" : "default";
  const statusText = useMemo(() => {
    switch (runner.status) {
      case "running": return "运行";
      case "paused": return "暂停";
      case "error": return "错误";
      default: return "空闲";
    }
  }, [runner.status]);

  const firstError = rebuildError ?? runner.error ?? runnerError ?? null;
  const wsToken = useWsAccessToken();
  const terminalWsUrl = runner.sessionId && wsToken.status === "ready" && wsToken.token
    ? wsUrl(`/api/v1/debug/sessions/${runner.sessionId}/terminal`, wsToken.token)
    : undefined;

  const toolButtonStyle = { width: 32, height: 32, padding: 0, borderRadius: 6 } as React.CSSProperties;
  const controlMatrix = useMemo(() => resolveDebugControlMatrix(runner.status, debugCapabilities), [debugCapabilities, runner.status]);
  const visibleWarnings = useMemo(() => {
    if (!Array.isArray(runner.warnings)) return [];
    return runner.warnings.filter((w) => !w.startsWith("断点：已下发 "));
  }, [runner.warnings]);
  const terminalModeHint = useMemo(() => {
    return getTerminalModeHint({ sessionId: runner.sessionId, status: runner.status, lastLaunchMode });
  }, [lastLaunchMode, runner.sessionId, runner.status]);
  const softNoticeStyle = {
    success: { marginTop: 8, padding: "8px 12px", background: "var(--ws-color-success-soft)", border: "1px solid var(--ws-color-border-secondary)", borderRadius: 8 },
    warning: { marginTop: 8, padding: "8px 12px", background: "var(--ws-color-warning-soft)", border: "1px solid var(--ws-color-border-secondary)", borderRadius: 8 },
    info: { marginTop: 8, padding: "8px 12px", background: "var(--ws-color-info-soft)", border: "1px solid var(--ws-color-border-secondary)", borderRadius: 8 },
    error: { marginTop: 8, padding: "8px 12px", background: "var(--ws-color-error-soft)", border: "1px solid var(--ws-color-border-secondary)", borderRadius: 8 },
  } as const;
  const clearTerminalUiSafely = () => {
    const ui = terminalUiRef.current;
    if (!ui || typeof ui.clear !== "function") return;
    try {
      ui.clear();
    } catch {}
  };
  const handleDebugClick = async () => {
    setRebuildError(null);
    if (runner.sourceMismatch && onRebuildFlowFromCode) {
      try {
        await onRebuildFlowFromCode();
      } catch (e: any) {
        setRebuildError(e?.message || "流程图重建失败，请修复代码后重试");
        return;
      }
    }
    clearTerminalUiSafely();
    onDebug();
  };

  useEffect(() => {
    if (runner.status === "starting" || runner.status === "error" || runner.status === "running") setActiveTab("terminal");
    if (runner.status === "paused") setActiveTab("debug");
  }, [runner.status]);
  useEffect(() => {
    if (firstError) setActiveTab("terminal");
  }, [firstError]);

  // Handle pending output from DAP (e.g. stdout/stderr captured by debugpy)
  useEffect(() => {
    const pending = runner.pendingOutput;
    if (pending && pending.length > 0) {
      const ui = terminalUiRef.current;
      if (ui && ui.write) {
        // Join multiple chunks to reduce calls
        ui.write(pending.join(""));
        // Clear them from state
        if (onClearPendingOutput) {
          onClearPendingOutput();
        }
      }
    }
  }, [runner.pendingOutput, onClearPendingOutput]);

  useEffect(() => {
    if (codeMode === "auto") setCode(generated.python);
  }, [generated, codeMode, setCode]);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const clampEditorHeight = (hostH: number, desired: number) => {
    const minH = 48; // Minimum height to fit the header
    const minBottomPanelH = 120;
    const maxH = hostH > 0 ? Math.max(minH, hostH - minBottomPanelH) : 900;
    return Math.max(minH, Math.min(maxH, desired));
  };
  const [editorHeight, setEditorHeight] = useState(() => {
    try {
      const raw = localStorage.getItem("python_lab_editor_height");
      const v = raw ? Number(raw) : NaN;
      if (Number.isFinite(v) && v > 100) return v;
    } catch {}
    return 320;
  });
  useEffect(() => {
    try {
      localStorage.setItem("python_lab_editor_height", String(Math.round(editorHeight)));
    } catch {}
  }, [editorHeight]);
  useEffect(() => {
    const host = panelRef.current;
    if (!host) return;
    let raf = 0;
    const run = () => {
      const hostH = host.getBoundingClientRect().height;
      setEditorHeight((h) => clampEditorHeight(hostH, h));
    };
    raf = window.requestAnimationFrame(run);
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        window.cancelAnimationFrame(raf);
        raf = window.requestAnimationFrame(run);
      });
      ro.observe(host);
      return () => {
        window.cancelAnimationFrame(raf);
        ro.disconnect();
      };
    }
    window.addEventListener("resize", run);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", run);
    };
  }, []);

  const resizeDragRef = useRef<{ sy: number; sh: number; pid: number } | null>(null);
  const resizeDragCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => {
      resizeDragCleanupRef.current?.();
      resizeDragCleanupRef.current = null;
      resizeDragRef.current = null;
    };
  }, []);
  const handleVerticalResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const host = panelRef.current;
    if (!host) return;
    resizeDragCleanupRef.current?.();
    resizeDragCleanupRef.current = null;
    resizeDragRef.current = { sy: e.clientY, sh: editorHeight, pid: e.pointerId };
    try {
      (e.currentTarget as any).setPointerCapture(e.pointerId);
    } catch {}

    const onMove = (ev: PointerEvent) => {
      const s = resizeDragRef.current;
      if (!s || ev.pointerId !== s.pid) return;
      const desired = s.sh + (ev.clientY - s.sy);
      const hostH = host.getBoundingClientRect().height;
      setEditorHeight(clampEditorHeight(hostH, desired));
    };
    const onUp = (ev: PointerEvent) => {
      const s = resizeDragRef.current;
      if (!s || ev.pointerId !== s.pid) return;
      resizeDragRef.current = null;
      resizeDragCleanupRef.current?.();
      resizeDragCleanupRef.current = null;
    };
    resizeDragCleanupRef.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <div ref={panelRef} style={{ height: "100%", display: "flex", flexDirection: "column", background: "#ffffff", borderLeft: "1px solid var(--ws-color-border)" }}>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <CodeOutlined style={{ color: "var(--ws-color-primary)", flexShrink: 0 }} />
            <span style={{ fontWeight: 600, flexShrink: 0 }}>Python</span>
            <Tag color={isSyntaxOk ? "success" : "error"} variant="filled" style={{ flexShrink: 0, margin: 0 }}>
              {isSyntaxOk ? "语法正确" : "语法错误"}
            </Tag>
            <Tag color={statusColor} variant="filled" style={{ flexShrink: 0, margin: 0 }}>
              {statusText}
            </Tag>
            {runner.sourceMismatch && (
              <Tooltip title={runner.sourceMismatchMessage || "流程图与运行代码版本不一致"}>
                <Tag color="warning" variant="filled" style={{ flexShrink: 0, margin: 0 }}>
                  映射失配
                </Tag>
              </Tooltip>
            )}
          </div>
        }
        extra={
          <Space>
            <Space size={2} style={{ marginRight: 8 }}>
              <Button 
                type="text" 
                size="small" 
                icon={<MinusOutlined />} 
                disabled={editorFontSize <= 10}
                onClick={() => setEditorFontSize(s => Math.max(10, s - 1))} 
              />
              <Tooltip title={`字体大小: ${editorFontSize}px`}>
                <span style={{ fontSize: 12, minWidth: 24, textAlign: 'center', color: 'var(--ws-color-text-secondary)', userSelect: 'none' }}>
                  {editorFontSize}
                </span>
              </Tooltip>
              <Button 
                type="text" 
                size="small" 
                icon={<PlusOutlined />} 
                disabled={editorFontSize >= 32}
                onClick={() => setEditorFontSize(s => Math.min(32, s + 1))} 
              />
            </Space>
            <Tooltip title="立即优化代码">
               <Button type="text" icon={<ThunderboltOutlined />} size="small" onClick={onOptimizeCode} />
            </Tooltip>
            <Tooltip title="放大编辑器">
              <Button type="text" icon={<ExpandOutlined />} size="small" onClick={() => setEditorOpen(true)} />
            </Tooltip>
            <Tooltip title="从流程图同步">
              <Button
                type="text"
                icon={<ReloadOutlined />}
                size="small"
                onClick={() => {
                  setCodeMode("auto");
                  setCode(generated.python);
                }}
              />
            </Tooltip>
          </Space>
        }
        variant="borderless"
        style={{ height: editorHeight, display: "flex", flexDirection: "column", minHeight: 48, flexShrink: 0, boxShadow: "none", borderBottom: "1px solid var(--ws-color-border-secondary)", borderLeft: "1px solid var(--ws-color-border)", overflow: "hidden" }}
        styles={{ body: { padding: 0, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }, header: { padding: "0 12px", minHeight: 48, borderBottom: "1px solid var(--ws-color-border-secondary)" } }}
      >
        <MonacoPythonEditor
          value={code}
          activeLine={runner.activeLine}
          revealLine={revealLine}
          breakpoints={runner.breakpoints}
          onToggleBreakpoint={onToggleBreakpoint}
          onChange={(next) => {
            setCodeMode("manual");
            setCode(next);
          }}
          syntaxErrors={backendSyntax.errors}
          fontSize={editorFontSize}
        />
      </Card>

      <Card variant="borderless" style={{ flexShrink: 0, borderRadius: 0, borderBottom: "1px solid var(--ws-color-border-secondary)", borderLeft: "1px solid var(--ws-color-border)" }} styles={{ body: { padding: "8px 12px" } }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Space size={4}>
            <Tooltip title="运行 (Run)">
              <Button
                type="text"
                htmlType="button"
                loading={runner.status === "starting"}
                icon={runner.status === "starting" ? null : <PlayCircleOutlined style={{ color: !controlMatrix.run ? undefined : "var(--ws-color-success)", fontSize: 18 }} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("Run button clicked in RightPanelView");
                  clearTerminalUiSafely();
                  onRun([]);
                }}
                disabled={!controlMatrix.run && runner.status !== "starting" && runner.status !== "running" && runner.status !== "paused"} // Force enabled for run/restart
                style={toolButtonStyle}
              />
            </Tooltip>
            <Tooltip title="调试 (Debug)">
              <Button
                type="text"
                icon={<BugOutlined style={{ color: !controlMatrix.debug ? undefined : runner.sourceMismatch ? "var(--ws-color-warning)" : "var(--ws-color-primary)", fontSize: 18 }} />}
                onClick={handleDebugClick}
                disabled={!controlMatrix.debug}
                style={toolButtonStyle}
              />
            </Tooltip>
            {runner.sourceMismatch && (
              <Tooltip title={runner.sourceMismatchMessage || "流程图与运行代码版本不一致，请重建流程图映射"}>
                <Button
                  type="text"
                  icon={<ReloadOutlined style={{ color: "var(--ws-color-warning)", fontSize: 18 }} />}
                  onClick={async () => {
                    setRebuildError(null);
                    try {
                      await onRebuildFlowFromCode?.();
                    } catch (e: any) {
                      setRebuildError(e?.message || "流程图重建失败，请修复代码后重试");
                    }
                  }}
                  style={toolButtonStyle}
                />
              </Tooltip>
            )}
            <Tooltip title="暂停 (Pause)">
              <Button
                type="text"
                icon={<PauseCircleOutlined style={{ color: runner.status === "running" ? "var(--ws-color-warning)" : undefined, fontSize: 18 }} />}
                onClick={onPause}
                disabled={!controlMatrix.pause}
                style={toolButtonStyle}
              />
            </Tooltip>
            <Tooltip title="继续 (Continue)">
              <Button type="text" icon={<FastForwardOutlined style={{ fontSize: 18 }} />} onClick={onContinue} disabled={!controlMatrix.continue} style={toolButtonStyle} />
            </Tooltip>
            <div style={{ width: 1, height: 16, background: "var(--ws-color-border-secondary)", margin: "0 8px" }} />
            <Tooltip title="单步跳过 (Step Over)">
              <Button type="text" icon={<RightOutlined />} onClick={onStepOver} disabled={!controlMatrix.stepOver} style={toolButtonStyle} />
            </Tooltip>
            <Tooltip title="单步进入 (Step Into)">
              <Button type="text" icon={<LoginOutlined />} onClick={onStepInto} disabled={!controlMatrix.stepInto} style={toolButtonStyle} />
            </Tooltip>
            <Tooltip title="单步跳出 (Step Out)">
              <Button type="text" icon={<LogoutOutlined />} onClick={onStepOut} disabled={!controlMatrix.stepOut} style={toolButtonStyle} />
            </Tooltip>
            <div style={{ width: 1, height: 16, background: "var(--ws-color-border-secondary)", margin: "0 8px" }} />
            <Tooltip title="重置/停止 (Reset)">
              <Button type="text" danger icon={<ReloadOutlined />} onClick={onReset} style={toolButtonStyle} />
            </Tooltip>
          </Space>
        </div>
        {visibleWarnings.length > 0 && (
          <div style={softNoticeStyle.info}>
            {visibleWarnings.slice(0, 3).map((w, i) => (
              <div key={i} style={{ fontSize: 12, color: "var(--ws-color-text-secondary)" }}>
                {w}
              </div>
            ))}
          </div>
        )}
        {firstError && (
          <div style={softNoticeStyle.error}>
            <Text type="danger" style={{ fontSize: 12 }}>
              {firstError}
            </Text>
          </div>
        )}
      </Card>

      <div
        onPointerDown={handleVerticalResize}
        style={{
          height: 1,
          background: "var(--ws-color-border-secondary)",
          cursor: "row-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          position: "relative",
          zIndex: 3,
          touchAction: "none",
        }}
      >
        <div style={{ position: "absolute", top: -3, bottom: -3, width: "100%", cursor: "row-resize", zIndex: 10 }} />
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#fff", borderLeft: "1px solid var(--ws-color-border)" }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as RightPanelTabKey)}
          type="card"
          size="small"
          destroyOnHidden
          className="pythonlab-rightpanel-tabs"
          style={{ height: "100%" }}
          items={[
            {
              key: "terminal",
              label: "终端交互",
              icon: <ConsoleSqlOutlined />,
              children: (
                <div style={{ height: "100%", background: "#ffffff", padding: 4, display: "flex", flexDirection: "column" }}>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    {terminalBridge ? (
                      <PyodideTerminal ref={terminalUiRef as any} bridge={terminalBridge} fontSize={editorFontSize} showLineNumbers />
                    ) : terminalWsUrl ? (
                      <XtermTerminal ref={terminalUiRef as any} wsUrl={terminalWsUrl} fontSize={editorFontSize} showLineNumbers />
                    ) : (
                      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Text type="secondary">
                          {!runner.sessionId
                            ? terminalModeHint
                            : wsToken.status === "loading" || wsToken.status === "idle"
                              ? "正在准备登录态..."
                              : wsToken.error || "登录已过期，请重新登录"}
                        </Text>
                      </div>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: "debug",
              label: "调试器",
              icon: <BugOutlined />,
              children: (
                <DebugTab
                  runner={runner}
                  variableColumns={variableColumns}
                  onAddWatch={onAddWatch}
                  onRemoveWatch={onRemoveWatch}
                  onExpand={() => setDebugOpen(true)}
                />
              ),
            },
            {
              key: "pipeline",
              label: "参考",
              icon: <EyeOutlined />,
              children: (
                <PipelineTab
                  beautifyResult={beautifyResult}
                  beautifyLoading={beautifyLoading}
                  beautifyError={beautifyError}
                  onRefreshBeautify={onRefreshBeautify}
                />
              ),
            },
          ]}
        />
      </div>
      <FloatingPopup
        title="Python 编辑器"
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        initialSize={{
          w: typeof window !== "undefined" ? window.innerWidth * 0.3 : 600,
          h: typeof window !== "undefined" ? window.innerHeight * 0.3 : 400,
        }}
        resizable
        draggable
        scrollable={false}
      >
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <MonacoPythonEditor
            value={code}
            activeLine={runner.activeLine}
            revealLine={revealLine}
            breakpoints={runner.breakpoints}
            onToggleBreakpoint={onToggleBreakpoint}
            onChange={(next) => {
              setCodeMode("manual");
              setCode(next);
            }}
            syntaxErrors={backendSyntax.errors}
            fontSize={editorFontSize}
          />
        </div>
      </FloatingPopup>
      <FloatingPopup
        title="调试器"
        open={debugOpen}
        onClose={() => setDebugOpen(false)}
        initialSize={{
          w: typeof window !== "undefined" ? window.innerWidth * 0.36 : 720,
          h: typeof window !== "undefined" ? window.innerHeight * 0.48 : 540,
        }}
        resizable
        draggable
        scrollable={false}
      >
        <div style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <DebugTab
            runner={runner}
            variableColumns={variableColumns}
            onAddWatch={onAddWatch}
            onRemoveWatch={onRemoveWatch}
            showExpandButton={false}
          />
        </div>
      </FloatingPopup>
      {/* <AIAssistantModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        code={code}
        flow={flow}
        anchorRect={aiAnchorRect}
        autoOptimizeCode={autoOptimizeCode}
        setAutoOptimizeCode={setAutoOptimizeCode}
      /> */}
    </div>
  );
});
