import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bug,
  Code,
  Terminal,
  Maximize2,
  FastForward,
  LogIn,
  LogOut,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ChevronRight,
  Eye,
  Plus,
  Minus,
  Zap,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { validatePythonLite } from "../../flow/python_sync";
import { pythonlabSyntaxApi, type PythonLabSyntaxError } from "../../services/pythonlabDebugApi";
import { MonacoPythonEditor } from "../MonacoPythonEditor";
import XtermTerminal from "../XtermTerminal";
import PyodideTerminal from "../PyodideTerminal";
import { FloatingPopup } from "../FloatingPopup";
// import { AIAssistantModal } from "../AIAssistantModal";
import type { RightPanelTabKey } from "../rightPanelTabPolicy";
import { useCode } from "../../stores/CodeStore";
import { useFlow } from "../../stores/FlowStore";
import { useRunnerActions } from "../../stores/RunnerActionsStore";
import { useUI, VARIABLE_COLUMNS } from "../../stores/UIStore";
import { DebugTab } from "./DebugTab";
import { PipelineTab } from "./PipelineTab";
import { wsUrl } from "../../hooks/dapRunnerHelpers";
import { useWsAccessToken } from "../../hooks/useWsAccessToken";
import { getTerminalModeHint } from "./terminalHint";
import { resolveDebugControlMatrix } from "../../adapters/debugCapabilityMap";
import { logger } from "@services/logger";

function PanelTooltip({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

export const RightPanel = React.memo(function RightPanel() {
  const codeCtx = useCode();
  const flowCtx = useFlow();
  const ra = useRunnerActions();
  const ui = useUI();
  const revealLine = ui.revealLine;
  const variableColumns = VARIABLE_COLUMNS;
  const {
    runner,
    debugCapabilities,
    runnerError,
    lastLaunchMode,
    terminalBridge,
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
    autoOptimizeCode: _autoOptimizeCode,
    setAutoOptimizeCode: _setAutoOptimizeCode,
    onOptimizeCode,
  } = ra;
  const {
    code,
    setCode,
    codeMode,
    setCodeMode,
    generated,
    flowDiagnostics: _flowDiagnostics,
    flowExpandFunctions: _flowExpandFunctions,
    setFlowExpandFunctions: _setFlowExpandFunctions,
    rebuildFlowFromCode,
  } = codeCtx;
  const _flow = { nodes: flowCtx.nodes, edges: flowCtx.edges };

  const [editorOpen, setEditorOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  // const [aiOpen, setAiOpen] = useState(false);
  // const [aiAnchorRect, setAiAnchorRect] = useState<DOMRect | null>(null);
  const [activeTab, setActiveTab] = useState<RightPanelTabKey>("terminal");
  const [rebuildError, setRebuildError] = useState<string | null>(null);

  const [editorFontSize, setEditorFontSize] = useState(13);
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

  const firstError = rebuildError ?? runner.error ?? runnerError ?? null;
  const wsToken = useWsAccessToken();
  const terminalWsUrl = runner.sessionId && wsToken.status === "ready" && wsToken.token
    ? wsUrl(`/api/v1/debug/sessions/${runner.sessionId}/terminal`, wsToken.token)
    : undefined;

  const controlMatrix = useMemo(() => resolveDebugControlMatrix(runner.status, debugCapabilities), [debugCapabilities, runner.status]);
  const visibleWarnings = useMemo(() => {
    if (!Array.isArray(runner.warnings)) return [];
    return runner.warnings.filter((w) => !w.startsWith("断点：已下发 "));
  }, [runner.warnings]);
  const terminalModeHint = useMemo(() => {
    return getTerminalModeHint({ sessionId: runner.sessionId, status: runner.status, lastLaunchMode });
  }, [lastLaunchMode, runner.sessionId, runner.status]);
  const softNoticeClass = {
    success: "mt-2 rounded-lg border border-border-secondary bg-[var(--ws-color-success-soft)] px-3 py-2",
    warning: "mt-2 rounded-lg border border-border-secondary bg-[var(--ws-color-warning-soft)] px-3 py-2",
    info: "mt-2 rounded-lg border border-border-secondary bg-[var(--ws-color-info-soft)] px-3 py-2",
    error: "mt-2 rounded-lg border border-border-secondary bg-[var(--ws-color-error-soft)] px-3 py-2",
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
    if (runner.sourceMismatch && rebuildFlowFromCode) {
      try {
        await rebuildFlowFromCode();
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
  const recoveredBlankCodeRef = useRef(false);
  useEffect(() => {
    if (recoveredBlankCodeRef.current) return;
    if (code.trim()) {
      recoveredBlankCodeRef.current = true;
      return;
    }
    const fallback = generated.python?.trim() ?? "";
    if (!fallback) return;
    setCodeMode("auto");
    setCode(generated.python);
    recoveredBlankCodeRef.current = true;
  }, [code, generated.python, setCode, setCodeMode]);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const readStoredEditorHeight = (): number | null => {
    try {
      const raw = localStorage.getItem("python_lab_editor_height");
      const value = raw ? Number(raw) : NaN;
      if (Number.isFinite(value) && value > 100) return value;
    } catch {}
    return null;
  };
  const clampEditorHeight = (hostH: number, desired: number) => {
    const minH = 160;
    const minBottomPanelH = 240; // 控制栏 + tabs + 终端最小高度
    const maxH = hostH > 0 ? Math.max(minH, hostH - minBottomPanelH) : 900;
    return Math.max(minH, Math.min(maxH, desired));
  };
  const [isEditorHeightLocked, setIsEditorHeightLocked] = useState(() => readStoredEditorHeight() !== null);
  const [editorHeight, setEditorHeight] = useState(() => {
    const storedHeight = readStoredEditorHeight();
    if (storedHeight !== null) return storedHeight;
    return 320;
  });
  useEffect(() => {
    if (!isEditorHeightLocked) return;
    try {
      localStorage.setItem("python_lab_editor_height", String(Math.round(editorHeight)));
    } catch {}
  }, [editorHeight, isEditorHeightLocked]);
  useEffect(() => {
    const host = panelRef.current;
    if (!host) return;
    let raf = 0;
    // 延迟一帧确保父容器已完成布局
    const run = () => {
      const hostH = host.getBoundingClientRect().height;
      if (hostH > 0) {
        setEditorHeight((h) => {
          const desired = isEditorHeightLocked ? h : hostH * 0.38;
          const clamped = clampEditorHeight(hostH, desired);
          return Math.abs(clamped - h) < 1 ? h : clamped;
        });
      }
    };
    // 多等一帧确保布局稳定
    raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(run);
    });
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
  }, [isEditorHeightLocked]);

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
    setIsEditorHeightLocked(true);
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
    <TooltipProvider delayDuration={120}>
      <div ref={panelRef} className="h-full flex flex-col border-l border-l-border bg-surface">
        <div
          className="flex min-h-[160px] flex-shrink flex-col overflow-hidden border-b border-b-border-secondary border-l border-l-border"
          style={{
            height: editorHeight,
          }}
        >
          <div
            className="flex min-h-12 items-center justify-between border-b border-b-border-secondary px-3"
          >
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              <Code className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-semibold flex-shrink-0">Python</span>
              <Badge
                variant={isSyntaxOk ? "success" : "danger"}
                className="m-0 h-[20px] flex-shrink-0 px-2 text-[11px] font-semibold leading-4"
              >
                {isSyntaxOk ? "语法正确" : "语法错误"}
              </Badge>
              {runner.sourceMismatch && (
                <PanelTooltip title={runner.sourceMismatchMessage || "流程图与运行代码版本不一致"}>
                  <Badge variant="warning" className="m-0 h-[20px] flex-shrink-0 px-2 text-[11px] font-semibold leading-4">
                    映射失配
                  </Badge>
                </PanelTooltip>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <div className="mr-2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={editorFontSize <= 10}
                  onClick={() => setEditorFontSize((s) => Math.max(10, s - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <PanelTooltip title={`字体大小: ${editorFontSize}px`}>
                  <span
                    className="select-none text-xs text-text-secondary"
                    style={{ minWidth: 24, textAlign: "center", display: "inline-block" }}
                  >
                    {editorFontSize}
                  </span>
                </PanelTooltip>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={editorFontSize >= 32}
                  onClick={() => setEditorFontSize((s) => Math.min(32, s + 1))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <PanelTooltip title="立即优化代码">
                <Button variant="ghost" size="sm" onClick={onOptimizeCode}>
                  <Zap className="h-4 w-4" />
                </Button>
              </PanelTooltip>
              <PanelTooltip title="放大编辑器">
                <Button variant="ghost" size="sm" onClick={() => setEditorOpen(true)}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </PanelTooltip>
              <PanelTooltip title="从流程图同步">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCodeMode("auto");
                    setCode(generated.python);
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </PanelTooltip>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
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
        </div>

        <div className="flex-shrink-0 border-b border-b-border-secondary border-l border-l-border px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <PanelTooltip title="运行 (Run)">
                <Button
                  variant="ghost"
                  type="button"
                  className="h-8 w-8 rounded-md p-0"
                  disabled={(runner.status as string) === "starting" || (!controlMatrix.run && (runner.status as string) !== "starting" && runner.status !== "running" && runner.status !== "paused")}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    logger.debug("Run button clicked in RightPanelView");
                    clearTerminalUiSafely();
                    onRun([]);
                  }}
                >
                  {(runner.status as string) === "starting"
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <PlayCircle className="text-lg" style={{ color: !controlMatrix.run ? undefined : "var(--ws-color-success)" }} />}
                </Button>
              </PanelTooltip>
              <PanelTooltip
                title={
                  !controlMatrix.debug
                    ? "请等待当前执行完成"
                    : runner.breakpoints.filter((b) => b.enabled).length === 0
                      ? "请先在代码左侧行号处点击设置断点，再启动调试"
                      : "调试 (Debug)"
                }
              >
                <Button
                  variant="ghost"
                  className="h-8 w-8 rounded-md p-0"
                  onClick={handleDebugClick}
                  disabled={!controlMatrix.debug}
                >
                  <Bug className="text-lg" style={{ color: !controlMatrix.debug ? undefined : runner.sourceMismatch ? "var(--ws-color-warning)" : runner.breakpoints.filter((b) => b.enabled).length === 0 ? "var(--ws-color-text-tertiary)" : "var(--ws-color-primary)" }} />
                </Button>
              </PanelTooltip>
              {runner.sourceMismatch && (
                <PanelTooltip title={runner.sourceMismatchMessage || "流程图与运行代码版本不一致，请重建流程图映射"}>
                  <Button
                    variant="ghost"
                    className="h-8 w-8 rounded-md p-0"
                    onClick={async () => {
                      setRebuildError(null);
                      try {
                        await rebuildFlowFromCode?.();
                      } catch (e: any) {
                        setRebuildError(e?.message || "流程图重建失败，请修复代码后重试");
                      }
                    }}
                  >
                    <RefreshCw className="text-lg" style={{ color: "var(--ws-color-warning)" }} />
                  </Button>
                </PanelTooltip>
              )}
              <PanelTooltip title="暂停 (Pause)">
                <Button
                  variant="ghost"
                  className="h-8 w-8 rounded-md p-0"
                  onClick={onPause}
                  disabled={!controlMatrix.pause}
                >
                  <PauseCircle className="text-lg" style={{ color: runner.status === "running" ? "var(--ws-color-warning)" : undefined }} />
                </Button>
              </PanelTooltip>
              <PanelTooltip title="继续 (Continue)">
                <Button variant="ghost" className="h-8 w-8 rounded-md p-0" onClick={onContinue} disabled={!controlMatrix.continue}>
                  <FastForward className="text-lg" />
                </Button>
              </PanelTooltip>
              <div className="mx-2 h-4 w-px bg-border" />
              <PanelTooltip title="单步跳过 (Step Over)">
                <Button variant="ghost" className="h-8 w-8 rounded-md p-0" onClick={onStepOver} disabled={!controlMatrix.stepOver}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </PanelTooltip>
              <PanelTooltip title="单步进入 (Step Into)">
                <Button variant="ghost" className="h-8 w-8 rounded-md p-0" onClick={onStepInto} disabled={!controlMatrix.stepInto}>
                  <LogIn className="h-4 w-4" />
                </Button>
              </PanelTooltip>
              <PanelTooltip title="单步跳出 (Step Out)">
                <Button variant="ghost" className="h-8 w-8 rounded-md p-0" onClick={onStepOut} disabled={!controlMatrix.stepOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </PanelTooltip>
              <div className="mx-2 h-4 w-px bg-border" />
              <PanelTooltip title="重置/停止 (Reset)">
                <Button variant="destructive" className="h-8 w-8 rounded-md p-0" onClick={onReset}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </PanelTooltip>
            </div>
          </div>
          {visibleWarnings.length > 0 && (
            <div className={softNoticeClass.info}>
              {visibleWarnings.slice(0, 3).map((w, i) => (
                <div key={i} className="text-xs text-text-secondary">
                  {w}
                </div>
              ))}
            </div>
          )}
          {firstError && (
            <div className={softNoticeClass.error}>
              <span className="text-xs text-destructive">{firstError}</span>
            </div>
          )}
        </div>

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

      <div className="flex-1 min-h-0 flex flex-col border-l border-l-border bg-surface" style={{ minHeight: 120 }}>
        <Tabs
          value={activeTab}
          onValueChange={(k) => setActiveTab(k as RightPanelTabKey)}
          className="h-full flex flex-col"
        >
          <TabsList className="h-9 w-full justify-start rounded-none border-b border-[color:var(--ws-color-border-secondary)] bg-transparent p-1">
            <TabsTrigger value="terminal" className="h-7 gap-1.5 rounded-md px-2 py-1 text-xs data-[state=active]:shadow-none">
              <Terminal className="h-4 w-4" />
              终端交互
            </TabsTrigger>
            <TabsTrigger value="debug" className="h-7 gap-1.5 rounded-md px-2 py-1 text-xs data-[state=active]:shadow-none">
              <Bug className="h-4 w-4" />
              调试器
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="h-7 gap-1.5 rounded-md px-2 py-1 text-xs data-[state=active]:shadow-none">
              <Eye className="h-4 w-4" />
              参考
            </TabsTrigger>
          </TabsList>

          <TabsContent value="terminal" className="mt-0 flex-1 min-h-0 overflow-hidden p-1">
            <div className="flex h-full flex-col bg-surface p-1">
              <div className="flex-1 min-h-0">
                {terminalBridge ? (
                  <PyodideTerminal ref={terminalUiRef as any} bridge={terminalBridge} fontSize={editorFontSize} showLineNumbers />
                ) : terminalWsUrl ? (
                  <XtermTerminal ref={terminalUiRef as any} wsUrl={terminalWsUrl} fontSize={editorFontSize} showLineNumbers />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-sm text-text-tertiary">
                      {!runner.sessionId
                        ? terminalModeHint
                        : wsToken.status === "loading" || wsToken.status === "idle"
                          ? "正在准备登录态..."
                          : wsToken.error || "登录已过期，请重新登录"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="debug" className="mt-0 flex-1 min-h-0 overflow-hidden">
            <DebugTab
              runner={runner}
              variableColumns={variableColumns}
              onAddWatch={onAddWatch}
              onRemoveWatch={onRemoveWatch}
              onExpand={() => setDebugOpen(true)}
            />
          </TabsContent>
          <TabsContent value="pipeline" className="mt-0 flex-1 min-h-0 overflow-hidden">
            <PipelineTab
              beautifyResult={beautifyResult}
              beautifyLoading={beautifyLoading}
              beautifyError={beautifyError}
              onRefreshBeautify={onRefreshBeautify}
            />
          </TabsContent>
        </Tabs>
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
        <div className="h-full flex flex-col">
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
        <div className="h-full overflow-hidden flex flex-col">
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
    </TooltipProvider>
  );
});
