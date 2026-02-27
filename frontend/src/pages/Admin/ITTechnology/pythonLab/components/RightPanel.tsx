import React, { useMemo, useRef, useState, useEffect } from "react";
import { Badge, Button, Card, Divider, Empty, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Tooltip, Tabs, Typography, Collapse } from "antd";
import {
  CodeOutlined,
  ConsoleSqlOutlined,
  ExpandOutlined,
  FastBackwardOutlined,
  FastForwardOutlined,
  FunctionOutlined,
  LoginOutlined,
  PauseCircleOutlined,
  NodeIndexOutlined,
  LogoutOutlined,
  PlayCircleOutlined,
  RightOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
  BugOutlined,
  EyeOutlined,
  PlusOutlined,
  CaretRightOutlined,
  DeleteOutlined
} from "@ant-design/icons";
import { MonacoPythonEditor } from "./MonacoPythonEditor";
import XtermTerminal from "./XtermTerminal"; // Import XtermTerminal
import { TimerDisplay } from "@components/TimerDisplay"; // Import global TimerDisplay
import { validatePythonLite } from "../flow/python_sync";
import type { RunnerState } from "../hooks/useDapRunner";
import { pythonlabSessionApi, type PythonLabSessionMeta } from "../services/pythonlabSessionApi";
import { pythonlabSyntaxApi, type PythonLabFlowDiagnostic, type PythonLabPseudocodeParseResponse } from "../services/pythonlabDebugApi";
import type { FlowTidyResult } from "../flow/tidy";
import type { FlowBeautifyParams, FlowBeautifyResult } from "../flow/beautify";
import type { PythonLabRuleSetV1 } from "../pipeline/rules";
import { PipelineRuleLibrary } from "./PipelineRuleLibrary";
import { getNextActiveTabOnPipelineModeToggle, type RightPanelTabKey } from "./rightPanelTabPolicy";
import "./RightPanel.css";
import useAuth from "@hooks/useAuth";
import { FloatingPopup } from "./FloatingPopup";

const { Text } = Typography;

export function RightPanel(props: {
  generated: { python: string };
  code: string;
  setCode: (v: string) => void;
  codeMode: "auto" | "manual";
  setCodeMode: (v: "auto" | "manual") => void;
  revealLine: number | null;
  variableColumns: any;
  runner: RunnerState;
  runnerError: string | null;
  flowDiagnostics?: PythonLabFlowDiagnostic[];
  flowExpandFunctions?: "all" | "top" | "none";
  setFlowExpandFunctions?: (v: "all" | "top" | "none") => void;
  onRun: () => void;
  onContinue: () => void;
  onPause: () => void;
  onStepOver: () => void;
  onStepInto: () => void;
  onStepOut: () => void;
  onReset: () => void;
  onToggleBreakpoint: (line: number) => void;
  onSetBreakpointEnabled: (line: number, enabled: boolean) => void;
  onSetBreakpointCondition: (line: number, condition: string) => void;
  onSetBreakpointHitCount: (line: number, hitCount: number | null) => void;
  onAddWatch: (expr: string) => void;
  onRemoveWatch: (expr: string) => void;
  onEvaluate: (expr: string) => Promise<{ ok: boolean; value?: string; type?: string; error?: string }>;
  onHistoryBack: () => void;
  onHistoryForward: () => void;
  onHistoryToLatest: () => void;
  onOpenTerminal: () => void;
  pipelineMode?: boolean;
  onTogglePipelineMode?: (v: boolean) => void;
  pseudocode?: PythonLabPseudocodeParseResponse | null;
  pseudocodeLoading?: boolean;
  pseudocodeError?: string | null;
  tidyResult?: FlowTidyResult | null;
  onApplyTidy?: () => void;
  beautifyParams?: FlowBeautifyParams;
  setBeautifyParams?: (next: FlowBeautifyParams) => void;
  beautifyResult?: FlowBeautifyResult | null;
  beautifyLoading?: boolean;
  beautifyError?: string | null;
  onRefreshBeautify?: () => void;
  onApplyBeautify?: (mode?: "nodes" | "nodes_edges") => void;
  canvasRoutingStyle?: "orthogonal" | "direct";
  setCanvasRoutingStyle?: (v: "orthogonal" | "direct") => void;
  ruleSet?: PythonLabRuleSetV1;
  setRuleSet?: (next: PythonLabRuleSetV1) => void;
  experimentId?: string;
}) {
  const {
    generated,
    code,
    setCode,
    codeMode,
    setCodeMode,
    revealLine,
    variableColumns,
    runner,
    runnerError,
    flowDiagnostics,
    flowExpandFunctions,
    setFlowExpandFunctions,
    onRun,
    onContinue,
    onPause,
    onStepOver,
    onStepInto,
    onStepOut,
    onReset,
    onToggleBreakpoint,
    onSetBreakpointEnabled,
    onSetBreakpointCondition,
    onSetBreakpointHitCount,
    onAddWatch,
    onRemoveWatch,
    onEvaluate,
    onHistoryBack,
    onHistoryForward,
    onHistoryToLatest,
    onOpenTerminal, // We might ignore this if we embed terminal
    pipelineMode,
    onTogglePipelineMode,
    pseudocode,
    pseudocodeLoading,
    pseudocodeError,
    tidyResult,
    onApplyTidy,
    beautifyParams,
    setBeautifyParams,
    beautifyResult,
    beautifyLoading,
    beautifyError,
    onRefreshBeautify,
    onApplyBeautify,
    canvasRoutingStyle,
    setCanvasRoutingStyle,
    ruleSet,
    setRuleSet,
    experimentId,
  } = props;

  const auth = useAuth();
  const canEdit = auth.isAdmin();

  const [editorOpen, setEditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<RightPanelTabKey>("terminal");
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessions, setSessions] = useState<PythonLabSessionMeta[]>([]);
  const [debugViewerOpen, setDebugViewerOpen] = useState(false);
  const [pipelineViewerOpen, setPipelineViewerOpen] = useState(false);
  const [pipelineSvgScale, setPipelineSvgScale] = useState(1);
  const pipelineSvgBoxRef = useRef<HTMLDivElement | null>(null);
  const pipelineSvgDragRef = useRef<{ sx: number; sy: number; sl: number; st: number } | null>(null);
  const [fullGraphViewerOpen, setFullGraphViewerOpen] = useState(false);
  const [fullGraphScale, setFullGraphScale] = useState(1);
  const fullGraphBoxRef = useRef<HTMLDivElement | null>(null);
  const fullGraphDragRef = useRef<{ sx: number; sy: number; sl: number; st: number } | null>(null);
  const [applyBeautifyMode, setApplyBeautifyMode] = useState<"nodes" | "nodes_edges">("nodes");
  const sessionsRefreshInFlightRef = useRef(false);
  const sessionsLastRefreshAtRef = useRef(0);
  const pipelineEnabled = !!pipelineMode;
  const prevPipelineEnabledRef = useRef<boolean>(pipelineEnabled);
  useEffect(() => {
    const prevPipelineMode = prevPipelineEnabledRef.current;
    const nextPipelineMode = pipelineEnabled;
    prevPipelineEnabledRef.current = nextPipelineMode;

    const nextActive = getNextActiveTabOnPipelineModeToggle({
      prevPipelineMode,
      nextPipelineMode,
      activeTab,
    });
    if (nextActive !== activeTab) setActiveTab(nextActive);
  }, [activeTab, pipelineEnabled]);

  // Validation & Status
  const [backendSyntax, setBackendSyntax] = useState<{ ok: boolean; errors?: any[] }>({ ok: true });
  const [checkingSyntax, setCheckingSyntax] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!code.trim()) {
        setBackendSyntax({ ok: true });
        return;
      }
      setCheckingSyntax(true);
      try {
        const res = await pythonlabSyntaxApi.checkSyntax(code);
        setBackendSyntax({ ok: res.ok, errors: res.errors });
      } catch (e) {
        // ignore network error
      } finally {
        setCheckingSyntax(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [code]);

  const validation = useMemo(() => validatePythonLite(code), [code]);
  const isSyntaxOk = validation.ok && backendSyntax.ok;
  const syntaxErrorText = !validation.ok 
    ? "格式错误" 
    : !backendSyntax.ok 
      ? (backendSyntax.errors?.[0]?.message || "语法错误")
      : "语法正确";

  const runnerTagColor = runner.ok ? "green" : "red";
  const statusColor = runner.status === "error" ? "red" : runner.status === "running" ? "blue" : runner.status === "paused" ? "orange" : "default";
  const statusText = runner.status === "error" ? "异常" : runner.status === "running" ? "运行中" : runner.status === "paused" ? "暂停" : "空闲";
  // 使用独立的 TimerDisplay 组件，避免主组件频繁渲染
  const timerContent = (
      <div style={{ paddingRight: 12, color: "rgba(0,0,0,0.45)", fontSize: 12 }}>
         <TimerDisplay 
            startTime={runner.startTime} 
            isRunning={runner.status === "running"} 
            initialElapsed={runner.elapsedTime} 
            prefix="运行时间: "
         />
      </div>
  );

  // Error handling
  const firstError = (runner.error) ?? runnerError ?? null;

  // Buttons state
  const toolButtonStyle = { width: 32, height: 32, padding: 0, borderRadius: 6 } as React.CSSProperties;
  const canStep = runner.status === "paused";
  const canRun = runner.status !== "running";

  useEffect(() => {
    if (runner.status === "starting" || runner.status === "error") {
      setActiveTab("terminal");
    }
  }, [runner.status]);

  useEffect(() => {
    if (runner.status === "paused") {
      setActiveTab("debug");
    }
  }, [runner.status]);

  useEffect(() => {
    if (firstError) setActiveTab("terminal");
  }, [firstError]);

  useEffect(() => {
    if (runner.stdout.length > 0) setActiveTab("terminal");
  }, [runner.stdout.length]);

  // Breakpoint Columns
  const breakpointColumns = [
      { title: "行", dataIndex: "line", key: "line", width: 60 },
      {
        title: "启用",
        dataIndex: "enabled",
        key: "enabled",
        width: 60,
        render: (v: boolean, r: { line: number; enabled: boolean }) => <Switch size="small" checked={v} onChange={(next) => onSetBreakpointEnabled(r.line, next)} />,
      },
      {
        title: "条件",
        dataIndex: "condition",
        key: "condition",
        render: (v: string | undefined, r: { line: number; condition?: string }) => (
          <Input size="small" placeholder="如 i==3" value={v ?? ""} onChange={(e) => onSetBreakpointCondition(r.line, e.target.value)} />
        ),
      },
      {
         title: "命中", dataIndex: "hitCount", key: "hitCount", width: 70,
         render: (v: number | undefined, r: { line: number; hitCount?: number }) => (
            <InputNumber size="small" min={1} placeholder="N" value={v} onChange={(next) => onSetBreakpointHitCount(r.line, typeof next === "number" ? next : null)} style={{width: "100%"}} />
         )
      },
      {
        title: "", key: "actions", width: 50,
        render: (_: any, r: { line: number }) => <Button size="small" type="text" danger icon={<CloseOutlined />} onClick={() => onToggleBreakpoint(r.line)} />
      }
  ];

  const [watchInput, setWatchInput] = useState("");

  // Default active keys for Debug Info panel
  const [activeDebugKeys, setActiveDebugKeys] = useState<string[]>(['variables', 'watch']);

  const refreshSessions = async () => {
    if (sessionsRefreshInFlightRef.current) return;
    const now = Date.now();
    if (now - sessionsLastRefreshAtRef.current < 1200) return;
    sessionsRefreshInFlightRef.current = true;
    sessionsLastRefreshAtRef.current = now;
    setSessionsLoading(true);
    try {
      const resp = await pythonlabSessionApi.list();
      setSessions(resp.items || []);
    } catch {
    } finally {
      setSessionsLoading(false);
      sessionsRefreshInFlightRef.current = false;
    }
  };

  // Watch Columns
  const watchColumns = [
      { title: "表达式", dataIndex: "expr", key: "expr", width: 120 },
      { title: "值", dataIndex: "value", key: "value", ellipsis: true },
      { title: "类型", dataIndex: "type", key: "type", width: 80 },
      { 
          title: "", key: "actions", width: 50,
          render: (_: any, r: { expr: string }) => <Button size="small" type="text" danger icon={<CloseOutlined />} onClick={() => onRemoveWatch(r.expr)} />
      }
  ];

  // Debug Info Panel (Variables + Watch + Breakpoints)
  const renderDebugPanel = () => (
      <div style={{ height: "100%", overflowY: "auto" }}>
      <Collapse
          activeKey={activeDebugKeys}
          onChange={(keys) => setActiveDebugKeys(typeof keys === 'string' ? [keys] : keys)}
          bordered={false}
          expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
          style={{ background: 'transparent' }}
          items={[
              {
                  key: 'variables',
                  label: <Space><FunctionOutlined /><span>变量 (Variables)</span></Space>,
                  children: (
                      <Table 
                          size="small" 
                          pagination={false} 
                          dataSource={runner.variables} 
                          columns={variableColumns} 
                          rowKey="name"
                          scroll={{ x: 'max-content' }}
                      />
                  ),
                  style: { borderBottom: '1px solid #f0f0f0' }
              },
              {
                  key: 'watch',
                  label: <Space><EyeOutlined /><span>监视 (Watch)</span></Space>,
                  children: (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                           <div style={{ display: "flex", gap: 8 }}>
                              <Input 
                                  size="small" 
                                  placeholder="添加表达式..." 
                                  value={watchInput} 
                                  onChange={(e) => setWatchInput(e.target.value)} 
                                  onPressEnter={() => {
                                      if (watchInput.trim()) {
                                          onAddWatch(watchInput.trim());
                                          setWatchInput("");
                                      }
                                  }}
                              />
                              <Button size="small" icon={<PlusOutlined />} onClick={() => {
                                   if (watchInput.trim()) {
                                          onAddWatch(watchInput.trim());
                                          setWatchInput("");
                                   }
                              }} />
                           </div>
                           <Table 
                                size="small" 
                                pagination={false} 
                                dataSource={runner.watchResults} 
                                columns={watchColumns} 
                                rowKey="expr"
                                locale={{ emptyText: "暂无监视表达式" }}
                                scroll={{ x: 'max-content' }}
                            />
                            {(!runner.watchResults.length && runner.watchExprs.length > 0) && (
                                <div style={{ padding: "8px 0", color: "rgba(0,0,0,0.45)", fontSize: 12, textAlign: "center" }}>
                                    等待下次暂停时计算...
                                </div>
                            )}
                      </div>
                  ),
                  style: { borderBottom: '1px solid #f0f0f0' }
              },
              {
                  key: 'breakpoints',
                  label: <Space><NodeIndexOutlined /><span>断点 (Breakpoints)</span></Space>,
                  children: (
                      <Table 
                          size="small" 
                          pagination={false} 
                          dataSource={runner.breakpoints} 
                          columns={breakpointColumns} 
                          rowKey="line"
                          scroll={{ x: 'max-content' }}
                      />
                  ),
                  style: { borderBottom: 'none' }
              }
          ]}
      />
      </div>
  );

  // Refresh breakpoints and sessions when code changes or resets
  useEffect(() => {
      // If code changed externally (e.g. example switch), we should ensure breakpoints are valid
      // But more importantly, if the example changes, we might want to reset the runner
      // Since runner state is in useDapRunner, we rely on the parent to handle "example change" -> "reset runner"
      // However, we can listen to "generated" prop changes to auto-update
      if (codeMode === "auto") {
          setCode(generated.python);
      }
  }, [generated, codeMode, setCode]);

  // Resizable state
  const panelRef = useRef<HTMLDivElement | null>(null);
  const clampEditorHeight = (hostH: number, desired: number) => {
    const minH = 140;
    // 增加底部预留空间，确保调试面板至少有 200px 可见
    const minBottomPanelH = 200; 
    const maxH = hostH > 0 ? Math.max(minH, hostH - minBottomPanelH) : 900;
    return Math.max(minH, Math.min(maxH, desired));
  };
  const [editorHeight, setEditorHeight] = useState(() => {
    try {
      const raw = localStorage.getItem("python_lab_editor_height");
      const v = raw ? Number(raw) : NaN;
      if (Number.isFinite(v) && v > 100) return v;
    } catch {}
    return 320; // 默认稍微减小一点，留更多空间给调试器
  });
  const [panelWidth, setPanelWidth] = useState(400); // This would need to be lifted up if controlling parent width, 
                                                     // but assuming this component is inside a container, 
                                                     // we can't easily resize width from here without context.
                                                     // However, the user asked for "mark 3 can resize width".
                                                     // We will implement vertical resize first (mark 2).
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

  // Mark 1: Change title
  // Mark 2: Vertical resize handle
  const resizeDragRef = useRef<{ sy: number; sh: number; pid: number } | null>(null);
  const handleVerticalResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const host = panelRef.current;
    if (!host) return;
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
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <div ref={panelRef} style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0, overflow: "hidden" }}>
      {/* 1. Code Editor Section */}
      <Card 
        title={
            <Space>
                <CodeOutlined style={{ color: '#1890ff' }} /> 
                <span style={{ fontWeight: 600 }}>Python</span>
                <Tag color={isSyntaxOk ? "success" : "error"} bordered={false}>{checkingSyntax ? "检查中..." : syntaxErrorText}</Tag>
                <Tag color={statusColor} bordered={false}>{statusText}</Tag>
            </Space>
        }
        extra={
            <Space>
                 <Tooltip title="放大编辑器">
                    <Button type="text" icon={<ExpandOutlined />} size="small" onClick={() => setEditorOpen(true)} />
                 </Tooltip>
                 <Tooltip title="从流程图同步">
                    <Button type="text" icon={<ReloadOutlined />} size="small" onClick={() => { setCodeMode("auto"); setCode(generated.python); }} />
                 </Tooltip>
                 <Space size={6}>
                    <Text type="secondary" style={{ fontSize: 12 }}>流水线</Text>
                    <Switch size="small" checked={!!pipelineMode} onChange={(v) => onTogglePipelineMode?.(v)} />
                 </Space>
            </Space>
        }
        bordered={false}
        style={{ height: editorHeight, display: "flex", flexDirection: "column", minHeight: 100, flexShrink: 0, boxShadow: "none", borderBottom: "1px solid #f0f0f0" }}
        styles={{ body: { padding: 0, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, header: { padding: "0 12px", minHeight: 48 } }}
      >
         <MonacoPythonEditor
            value={code}
            activeLine={runner.activeLine}
            revealLine={revealLine}
            breakpoints={runner.breakpoints}
            onToggleBreakpoint={onToggleBreakpoint}
            onChange={(next) => { setCodeMode("manual"); setCode(next); }}
            syntaxErrors={backendSyntax.errors}
         />
      </Card>

      {/* 2. Control Toolbar */}
      <Card 
        bordered={false}
        style={{ flexShrink: 0, borderRadius: 0, borderBottom: "1px solid #f0f0f0" }} 
        styles={{ body: { padding: "8px 12px" } }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Space size={4}>
                <Tooltip title="运行 (Run)">
                    <Button type="text" icon={<PlayCircleOutlined style={{ color: !canRun ? undefined : '#52c41a', fontSize: 18 }} />} onClick={onRun} disabled={!canRun} style={toolButtonStyle} />
                </Tooltip>
                <Tooltip title="暂停 (Pause)">
                    <Button type="text" icon={<PauseCircleOutlined style={{ color: runner.status === "running" ? '#faad14' : undefined, fontSize: 18 }} />} onClick={onPause} disabled={runner.status !== "running"} style={toolButtonStyle} />
                </Tooltip>
                <Tooltip title="继续 (Continue)">
                    <Button type="text" icon={<FastForwardOutlined style={{ fontSize: 18 }} />} onClick={onContinue} disabled={runner.status !== "paused"} style={toolButtonStyle} />
                </Tooltip>
                <div style={{ width: 1, height: 16, background: "#f0f0f0", margin: "0 8px" }} />
                <Tooltip title="单步跳过 (Step Over)">
                    <Button type="text" icon={<RightOutlined />} onClick={onStepOver} disabled={!canStep} style={toolButtonStyle} />
                </Tooltip>
                <Tooltip title="单步进入 (Step Into)">
                    <Button type="text" icon={<LoginOutlined />} onClick={onStepInto} disabled={!canStep} style={toolButtonStyle} />
                </Tooltip>
                <Tooltip title="单步跳出 (Step Out)">
                    <Button type="text" icon={<LogoutOutlined />} onClick={onStepOut} disabled={!canStep} style={toolButtonStyle} />
                </Tooltip>
                <div style={{ width: 1, height: 16, background: "#f0f0f0", margin: "0 8px" }} />
                <Tooltip title="重置/停止 (Reset)">
                    <Button type="text" danger icon={<ReloadOutlined />} onClick={onReset} style={toolButtonStyle} />
                </Tooltip>
            </Space>
            
            <Space>
                 <Button type="text" icon={<UnorderedListOutlined />} onClick={() => { setSessionsOpen(true); refreshSessions(); }}>会话</Button>
            </Space>
        </div>
        {firstError && (
            <div style={{ marginTop: 8, padding: "8px 12px", background: "#fff2f0", border: "1px solid #ffccc7", borderRadius: 4 }}>
                <Text type="danger" style={{ fontSize: 12 }}>{firstError}</Text>
            </div>
        )}
      </Card>

      <div
        onPointerDown={handleVerticalResize}
        style={{
          height: 1,
          background: "#f0f0f0",
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
        <div style={{ position: 'absolute', top: -3, bottom: -3, width: '100%', cursor: 'row-resize', zIndex: 10 }} />
      </div>

      {/* 3. Output & Variables Section */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#fff" }}>
         <Tabs 
            activeKey={activeTab} 
            onChange={(k) => setActiveTab(k as RightPanelTabKey)} 
            type="card" 
            size="small"
            className="pythonlab-rightpanel-tabs"
            style={{ height: "100%" }}
            tabBarExtraContent={timerContent}
            items={[
                {
                    key: "terminal",
                    label: "终端输出",
                    icon: <ConsoleSqlOutlined />,
                    children: (
                        <div style={{ height: "100%", background: "#ffffff", padding: 4 }}>
                            <XtermTerminal output={runner.stdout} />
                        </div>
                    )
                },
                {
                    key: "debug",
                    label: "调试器",
                    icon: <BugOutlined />,
                    children: (
                        <div style={{ height: "100%", overflow: "auto", padding: 0 }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 12px 0" }}>
                              <Button
                                size="small"
                                icon={<ExpandOutlined />}
                                onClick={() => setDebugViewerOpen(true)}
                              >
                                放大查看
                              </Button>
                            </div>
                            {renderDebugPanel()}
                        </div>
                    )
                },
                {
                  key: "pipeline",
                  label: "流水线",
                  icon: <EyeOutlined />,
                  children: !pipelineEnabled ? (
                    <div style={{ height: "100%", overflow: "auto", padding: 12 }}>
                      <Empty
                        description={
                          <div style={{ display: "grid", gap: 6 }}>
                            <div>流水线模式已关闭</div>
                            <Text type="secondary">开启后可在此预览伪代码、Tidy 与 Graphviz 布局。</Text>
                          </div>
                        }
                      >
                        <Button type="primary" disabled={!onTogglePipelineMode} onClick={() => onTogglePipelineMode?.(true)}>
                          开启流水线
                        </Button>
                      </Empty>
                    </div>
                  ) : (
                    <div style={{ height: "100%", overflow: "auto", padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ fontWeight: 600 }}>流水线模式</div>
                        <Button
                          size="small"
                          icon={<ExpandOutlined />}
                          onClick={() => {
                            setPipelineSvgScale(1);
                            setPipelineViewerOpen(true);
                          }}
                        >
                          放大查看
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            setFullGraphScale(1);
                            setFullGraphViewerOpen(true);
                          }}
                        >
                          完整流程图
                        </Button>
                      </div>
                      <div style={{ color: "rgba(0,0,0,0.65)", marginBottom: 12 }}>
                        原始代码 → 伪代码 → 流程图（Raw/Tidy/Beautify）
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        {ruleSet && setRuleSet && experimentId ? (
                          <PipelineRuleLibrary
                            experimentId={experimentId}
                            ruleSet={ruleSet}
                            setRuleSet={setRuleSet}
                            currentTidy={tidyResult ? { raw: tidyResult.raw.stats, tidy: tidyResult.tidy.stats, log: tidyResult.log } : null}
                            currentBeautify={beautifyResult ? { stats: beautifyResult.stats, metrics: beautifyResult.metrics } : null}
                          />
                        ) : (
                          <Text type="secondary">规则库未就绪</Text>
                        )}
                      </div>
                      <Card size="small" title="伪代码" styles={{ body: { padding: 10 } }}>
                        {pseudocodeLoading ? (
                          <Text type="secondary">加载中…</Text>
                        ) : pseudocodeError ? (
                          <div style={{ display: "grid", gap: 6 }}>
                            <Text type="danger">{pseudocodeError}</Text>
                            <Text type="secondary">可尝试：检查语法、点击“从流程图同步”、或重新进入示例。</Text>
                          </div>
                        ) : pseudocode ? (
                          <div style={{ display: "grid", gap: 10 }}>
                            <div>
                              <div style={{ fontWeight: 600, marginBottom: 6 }}>输入</div>
                              {pseudocode.input.items.length ? (
                                <div style={{ display: "grid", gap: 4 }}>
                                  {pseudocode.input.items.map((it, idx) => (
                                    <div key={idx} style={{ display: "flex", gap: 8 }}>
                                      <Text type="secondary">-</Text>
                                      <Text>{it.text}</Text>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <Text type="secondary">无</Text>
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, marginBottom: 6 }}>处理</div>
                              {pseudocode.process.items.length ? (
                                <div style={{ display: "grid", gap: 4 }}>
                                  {pseudocode.process.items.map((it, idx) => (
                                    <div key={idx} style={{ display: "flex", gap: 8 }}>
                                      <Text type="secondary">{idx + 1}.</Text>
                                      <Text>{it.text}</Text>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <Text type="secondary">无</Text>
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, marginBottom: 6 }}>输出</div>
                              {pseudocode.output.items.length ? (
                                <div style={{ display: "grid", gap: 4 }}>
                                  {pseudocode.output.items.map((it, idx) => (
                                    <div key={idx} style={{ display: "flex", gap: 8 }}>
                                      <Text type="secondary">-</Text>
                                      <Text>{it.text}</Text>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <Text type="secondary">无</Text>
                              )}
                            </div>
                            <div style={{ display: "grid", gap: 8 }}>
                              <div style={{ fontWeight: 600 }}>转换信息</div>
                              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                <Tag color={pseudocode.reversibility.level === "high" ? "green" : pseudocode.reversibility.level === "medium" ? "orange" : "red"}>
                                  可逆性 {pseudocode.reversibility.score.toFixed(2)}
                                </Tag>
                                <Text type="secondary">Parser: {pseudocode.parserVersion}</Text>
                              </div>
                              {pseudocode.reversibility.reasons?.length ? (
                                <div style={{ display: "grid", gap: 4 }}>
                                  {pseudocode.reversibility.reasons.map((r, idx) => (
                                    <div key={idx} style={{ display: "flex", gap: 8 }}>
                                      <Text type="secondary">-</Text>
                                      <Text>{r}</Text>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <div style={{ display: "grid", gap: 8 }}>
                              <div style={{ fontWeight: 600 }}>规则使用</div>
                              <Table
                                size="small"
                                pagination={false}
                                dataSource={pseudocode.rulesUsed}
                                rowKey="id"
                                columns={[
                                  { title: "ID", dataIndex: "id", key: "id", width: 160 },
                                  { title: "次数", dataIndex: "count", key: "count", width: 70 },
                                  { title: "说明", dataIndex: "description", key: "description", ellipsis: true },
                                ]}
                                locale={{ emptyText: "暂无" }}
                                scroll={{ x: "max-content" }}
                              />
                            </div>
                            <div style={{ display: "grid", gap: 8 }}>
                              <div style={{ fontWeight: 600 }}>信息损失点</div>
                              <Table
                                size="small"
                                pagination={false}
                                dataSource={pseudocode.lossPoints}
                                rowKey={(r) => `${r.code}-${r.message}-${r.range?.startLine ?? 0}-${r.range?.startCol ?? 0}`}
                                columns={[
                                  { title: "代码", dataIndex: "code", key: "code", width: 150 },
                                  { title: "说明", dataIndex: "message", key: "message", ellipsis: true },
                                  {
                                    title: "位置",
                                    key: "pos",
                                    width: 90,
                                    render: (_: any, r: any) => (
                                      <Text type="secondary">
                                        {typeof r?.range?.startLine === "number" ? `${r.range.startLine}:${r.range.startCol ?? 0}` : "-"}
                                      </Text>
                                    ),
                                  },
                                ]}
                                locale={{ emptyText: "暂无" }}
                                scroll={{ x: "max-content" }}
                              />
                            </div>
                          </div>
                        ) : (
                          <Text type="secondary">暂无数据（画布为空或后端解析失败）</Text>
                        )}
                      </Card>
                      <div style={{ height: 10 }} />
                      <Card
                        size="small"
                        title="Tidy（整理）"
                        extra={
                          <Button size="small" type="primary" onClick={() => onApplyTidy?.()} disabled={!tidyResult}>
                            应用到画布
                          </Button>
                        }
                        styles={{ body: { padding: 10 } }}
                      >
                        {tidyResult ? (
                          <div style={{ display: "grid", gap: 10 }}>
                            <div style={{ display: "grid", gap: 6 }}>
                              <div style={{ fontWeight: 600 }}>指标</div>
                              <Table
                                size="small"
                                pagination={false}
                                dataSource={[
                                  {
                                    key: "nodeCount",
                                    name: "节点数",
                                    raw: tidyResult.raw.stats.nodeCount,
                                    tidy: tidyResult.tidy.stats.nodeCount,
                                  },
                                  {
                                    key: "edgeCount",
                                    name: "边数",
                                    raw: tidyResult.raw.stats.edgeCount,
                                    tidy: tidyResult.tidy.stats.edgeCount,
                                  },
                                  {
                                    key: "cross",
                                    name: "交叉边数",
                                    raw: tidyResult.raw.stats.crossingCount,
                                    tidy: tidyResult.tidy.stats.crossingCount,
                                  },
                                  {
                                    key: "depth",
                                    name: "近似决策深度",
                                    raw: tidyResult.raw.stats.approxMaxDecisionDepth,
                                    tidy: tidyResult.tidy.stats.approxMaxDecisionDepth,
                                  },
                                  {
                                    key: "crit",
                                    name: "关键路径节点数",
                                    raw: tidyResult.raw.stats.criticalPathNodeCount,
                                    tidy: tidyResult.tidy.stats.criticalPathNodeCount,
                                  },
                                ]}
                                columns={[
                                  { title: "指标", dataIndex: "name", key: "name" },
                                  { title: "Raw", dataIndex: "raw", key: "raw", width: 90 },
                                  { title: "Tidy", dataIndex: "tidy", key: "tidy", width: 90 },
                                ]}
                                locale={{ emptyText: "暂无" }}
                                scroll={{ x: "max-content" }}
                              />
                            </div>
                            <div style={{ display: "grid", gap: 6 }}>
                              <div style={{ fontWeight: 600 }}>变换记录</div>
                              <Table
                                size="small"
                                pagination={false}
                                dataSource={tidyResult.log.map((x, i) => ({ ...x, key: `${x.ruleId}-${i}` }))}
                                columns={[
                                  { title: "规则", dataIndex: "ruleId", key: "ruleId", width: 160 },
                                  { title: "说明", dataIndex: "description", key: "description", ellipsis: true },
                                ]}
                                locale={{ emptyText: "暂无" }}
                                scroll={{ x: "max-content" }}
                              />
                            </div>
                          </div>
                        ) : (
                          <Text type="secondary">暂无数据（画布为空或暂未生成可整理结果）</Text>
                        )}
                      </Card>
                      <div style={{ height: 10 }} />
                      <Card
                        size="small"
                        title="Beautify（Graphviz）"
                        extra={
                          <Space>
                            <Button size="small" onClick={() => onRefreshBeautify?.()} disabled={!pipelineEnabled}>
                              重新渲染
                            </Button>
                            <Select
                              size="small"
                              style={{ width: 118 }}
                              value={applyBeautifyMode}
                              onChange={(v) => setApplyBeautifyMode(v)}
                              options={[
                                { label: "仅应用节点", value: "nodes" },
                                { label: "节点+连线", value: "nodes_edges" },
                              ]}
                            />
                            <Button size="small" type="primary" onClick={() => onApplyBeautify?.(applyBeautifyMode)} disabled={!beautifyResult}>
                              应用布局到画布
                            </Button>
                          </Space>
                        }
                        styles={{ body: { padding: 10 } }}
                      >
                        <div style={{ display: "grid", gap: 10 }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <Text type="secondary">方向</Text>
                            <Select
                              size="small"
                              style={{ width: 90 }}
                              value={beautifyParams?.rankdir ?? "TB"}
                              onChange={(v) => {
                                if (!beautifyParams || !setBeautifyParams) return;
                                setBeautifyParams({ ...beautifyParams, rankdir: v });
                              }}
                              disabled={!canEdit}
                              options={[
                                { label: "TB", value: "TB" },
                                { label: "LR", value: "LR" },
                              ]}
                            />
                            <Text type="secondary">引擎</Text>
                            <Select
                              size="small"
                              style={{ width: 100 }}
                              value={(beautifyParams as any)?.engine ?? "dot"}
                              onChange={(v) => {
                                if (!beautifyParams || !setBeautifyParams) return;
                                setBeautifyParams({ ...(beautifyParams as any), engine: v } as any);
                              }}
                              disabled={!canEdit}
                              options={[
                                { label: "dot", value: "dot" },
                                { label: "neato", value: "neato" },
                                { label: "fdp", value: "fdp" },
                              ]}
                            />
                            <Text type="secondary">连线</Text>
                            <Select
                              size="small"
                              style={{ width: 120 }}
                              value={(beautifyParams as any)?.splines ?? "spline"}
                              onChange={(v) => {
                                if (!beautifyParams || !setBeautifyParams) return;
                                setBeautifyParams({ ...(beautifyParams as any), splines: v } as any);
                              }}
                              disabled={!canEdit}
                              options={[
                                { label: "spline", value: "spline" },
                                { label: "polyline", value: "polyline" },
                                { label: "ortho", value: "ortho" },
                              ]}
                            />
                            <Text type="secondary">合并同向</Text>
                            <Switch
                              size="small"
                              checked={!!(beautifyParams as any)?.concentrate}
                              onChange={(v) => {
                                if (!beautifyParams || !setBeautifyParams) return;
                                setBeautifyParams({ ...(beautifyParams as any), concentrate: v } as any);
                              }}
                              disabled={!canEdit}
                            />
                            <Text type="secondary">节点间距</Text>
                            <InputNumber
                              size="small"
                              min={0.05}
                              max={2.5}
                              step={0.05}
                              style={{ width: 110 }}
                              value={beautifyParams?.nodesep ?? 0.35}
                              onChange={(v) => {
                                if (!beautifyParams || !setBeautifyParams) return;
                                const n = typeof v === "number" ? v : beautifyParams.nodesep;
                                setBeautifyParams({ ...beautifyParams, nodesep: n });
                              }}
                              disabled={!canEdit}
                            />
                            <Text type="secondary">层间距</Text>
                            <InputNumber
                              size="small"
                              min={0.05}
                              max={3.5}
                              step={0.05}
                              style={{ width: 110 }}
                              value={beautifyParams?.ranksep ?? 0.55}
                              onChange={(v) => {
                                if (!beautifyParams || !setBeautifyParams) return;
                                const n = typeof v === "number" ? v : beautifyParams.ranksep;
                                setBeautifyParams({ ...beautifyParams, ranksep: n });
                              }}
                              disabled={!canEdit}
                            />
                            <Text type="secondary">字体大小</Text>
                            <InputNumber
                              size="small"
                              min={8}
                              max={22}
                              step={1}
                              style={{ width: 110 }}
                              value={(beautifyParams as any)?.fontSize ?? 12}
                              onChange={(v) => {
                                if (!beautifyParams || !setBeautifyParams) return;
                                const n = typeof v === "number" ? v : (beautifyParams as any).fontSize ?? 12;
                                setBeautifyParams({ ...(beautifyParams as any), fontSize: n } as any);
                              }}
                              disabled={!canEdit}
                            />
                            <Text type="secondary">边距</Text>
                            <InputNumber
                              size="small"
                              min={0}
                              max={1.5}
                              step={0.05}
                              style={{ width: 110 }}
                              value={(beautifyParams as any)?.pad ?? 0.15}
                              onChange={(v) => {
                                if (!beautifyParams || !setBeautifyParams) return;
                                const n = typeof v === "number" ? v : (beautifyParams as any).pad ?? 0.15;
                                setBeautifyParams({ ...(beautifyParams as any), pad: n } as any);
                              }}
                              disabled={!canEdit}
                            />
                            <Text type="secondary">画布连线</Text>
                            <Select
                              size="small"
                              style={{ width: 120 }}
                              value={canvasRoutingStyle ?? "orthogonal"}
                              onChange={(v) => setCanvasRoutingStyle?.(v as any)}
                              disabled={!canEdit}
                              options={[
                                { label: "横平竖直", value: "orthogonal" },
                                { label: "直接连线", value: "direct" },
                              ]}
                            />
                          </div>

                          {beautifyLoading ? (
                            <Text type="secondary">渲染中…（首次加载 wasm 可能较慢）</Text>
                          ) : beautifyError ? (
                            <div style={{ display: "grid", gap: 6 }}>
                              <Text type="danger">Graphviz 渲染失败：{beautifyError}</Text>
                              <Text type="secondary">可尝试：点击“重新渲染”，或刷新页面后重试。</Text>
                            </div>
                          ) : beautifyResult ? (
                            <>
                              <Table
                                size="small"
                                pagination={false}
                                dataSource={beautifyResult.metrics.map((m) => ({ ...m, key: m.name }))}
                                columns={[
                                  { title: "指标", dataIndex: "name", key: "name", width: 120, render: (v: any) => {
                                      const k = String(v || "");
                                      const map: Record<string, string> = { nodes: "节点数", crossings: "交叉数", contrast: "对比度", flowAngle: "流向偏差" };
                                      return map[k] ?? k;
                                    } 
                                  },
                                  { title: "值", dataIndex: "value", key: "value", width: 90 },
                                  { title: "阈值", dataIndex: "thresholdText", key: "thresholdText", width: 100 },
                                  {
                                    title: "结果",
                                    key: "pass",
                                    width: 80,
                                    render: (_: any, r: any) => <Tag color={r.pass ? "green" : "red"}>{r.pass ? "PASS" : "FAIL"}</Tag>,
                                  },
                                ]}
                                locale={{ emptyText: "暂无" }}
                                scroll={{ x: "max-content" }}
                              />
                              <div style={{ border: "1px solid #f0f0f0", borderRadius: 8, padding: 8, background: "#fff", overflow: "auto", maxHeight: 420 }}>
                                <div dangerouslySetInnerHTML={{ __html: beautifyResult.svg }} />
                              </div>
                            </>
                          ) : (
                            <Text type="secondary">暂无数据（画布为空或暂未生成可渲染结果）</Text>
                          )}
                        </div>
                      </Card>
                    </div>
                  ),
                },
            ]}
         />
      </div>

      {/* Session Manager Modal */}
      <Modal title="会话管理" open={sessionsOpen} onCancel={() => setSessionsOpen(false)} footer={null} width={700}>
         <Table 
            dataSource={sessions} 
            loading={sessionsLoading}
            rowKey="session_id"
            columns={[
                { title: "ID", dataIndex: "session_id", width: 200, ellipsis: true },
                { title: "状态", dataIndex: "status", width: 100 },
                { title: "端口", dataIndex: "dap_port", width: 100 },
                { 
                    title: "操作", 
                    render: (_, r) => <Button danger size="small" onClick={async () => { await pythonlabSessionApi.stop(r.session_id); refreshSessions(); }}>停止</Button> 
                }
            ]}
         />
         <div style={{ marginTop: 16, textAlign: "right" }}>
             <Button onClick={refreshSessions} style={{ marginRight: 8 }}>刷新</Button>
             <Button danger onClick={async () => { await pythonlabSessionApi.cleanup(); refreshSessions(); }}>一键清理所有</Button>
         </div>
      </Modal>

      {/* Editor Popup (Resizable) */}
      <FloatingPopup 
        title="Python 编辑器" 
        open={editorOpen} 
        onClose={() => setEditorOpen(false)} 
        initialSize={{ 
            w: typeof window !== 'undefined' ? window.innerWidth * 0.30 : 600, 
            h: typeof window !== 'undefined' ? window.innerHeight * 0.30 : 400 
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
                onChange={(next) => { setCodeMode("manual"); setCode(next); }}
                syntaxErrors={backendSyntax.errors}
             />
         </div>
      </FloatingPopup>

      <FloatingPopup open={pipelineViewerOpen} title="流水线（放大查看）" initialSize={{ w: 980, h: 720 }} onClose={() => setPipelineViewerOpen(false)}>
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              background: "#ffffff",
              borderBottom: "1px solid var(--ws-color-border)",
              paddingBottom: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontWeight: 600 }}>原始代码 → 伪代码 → 流程图（Raw/Tidy/Beautify）</div>
              <Space>
                <Button size="small" onClick={() => setPipelineSvgScale((s) => Math.max(0.02, Number((s - 0.1).toFixed(2))))}>
                  -
                </Button>
                <Text type="secondary">{Math.round(pipelineSvgScale * 100)}%</Text>
                <Button size="small" onClick={() => setPipelineSvgScale((s) => Math.min(3, Number((s + 0.1).toFixed(2))))}>
                  +
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    const host = pipelineSvgBoxRef.current;
                    if (!host) return;
                    const svg = host.querySelector("svg") as any;
                    if (!svg) return;
                    const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
                    const w = vb && vb.width ? Number(vb.width) : svg.getBBox ? Number(svg.getBBox().width) : 0;
                    if (!Number.isFinite(w) || w <= 0) return;
                    const scale = Math.max(0.01, Math.min(6, host.clientWidth / w));
                    setPipelineSvgScale(Number(scale.toFixed(2)));
                    host.scrollLeft = 0;
                    host.scrollTop = 0;
                  }}
                >
                  适配宽度
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    const host = pipelineSvgBoxRef.current;
                    if (!host) return;
                    const svg = host.querySelector("svg") as any;
                    if (!svg) return;
                    const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
                    const h = vb && vb.height ? Number(vb.height) : svg.getBBox ? Number(svg.getBBox().height) : 0;
                    if (!Number.isFinite(h) || h <= 0) return;
                    const scale = Math.max(0.01, Math.min(6, host.clientHeight / h));
                    setPipelineSvgScale(Number(scale.toFixed(2)));
                    host.scrollLeft = 0;
                    host.scrollTop = 0;
                  }}
                >
                  适配高度
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    const host = pipelineSvgBoxRef.current;
                    if (!host) return;
                    const svg = host.querySelector("svg") as any;
                    if (!svg) return;
                    const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
                    const w = vb && vb.width ? Number(vb.width) : svg.getBBox ? Number(svg.getBBox().width) : 0;
                    const h = vb && vb.height ? Number(vb.height) : svg.getBBox ? Number(svg.getBBox().height) : 0;
                    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
                    const scale = Math.max(0.01, Math.min(6, Math.min(host.clientWidth / w, host.clientHeight / h)));
                    setPipelineSvgScale(Number(scale.toFixed(2)));
                    host.scrollLeft = 0;
                    host.scrollTop = 0;
                  }}
                >
                  适配全图
                </Button>
                <Button size="small" onClick={() => setPipelineSvgScale(1)}>
                  重置
                </Button>
              </Space>
            </div>
          </div>

          <div style={{ marginBottom: 4 }}>
            {ruleSet && setRuleSet && experimentId ? (
              <PipelineRuleLibrary
                experimentId={experimentId}
                ruleSet={ruleSet}
                setRuleSet={setRuleSet}
                currentTidy={tidyResult ? { raw: tidyResult.raw.stats, tidy: tidyResult.tidy.stats, log: tidyResult.log } : null}
                currentBeautify={beautifyResult ? { stats: beautifyResult.stats, metrics: beautifyResult.metrics } : null}
              />
            ) : null}
          </div>

          <Collapse
            size="small"
            defaultActiveKey={["beautify"]}
            items={[
              {
                key: "pseudocode",
                label: "伪代码",
                children: pseudocodeLoading ? (
                  <Text type="secondary">加载中…</Text>
                ) : pseudocodeError ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <Text type="danger">{pseudocodeError}</Text>
                    <Text type="secondary">可尝试：检查语法、点击“从流程图同步”、或重新进入示例。</Text>
                  </div>
                ) : pseudocode ? (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: "18px" }}>
                    {JSON.stringify(pseudocode, null, 2)}
                  </pre>
                ) : (
                  <Text type="secondary">暂无数据</Text>
                ),
              },
              {
                key: "tidy",
                label: "Tidy（整理）",
                children: tidyResult ? (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: "18px" }}>
                    {JSON.stringify({ stats: { raw: tidyResult.raw.stats, tidy: tidyResult.tidy.stats }, log: tidyResult.log }, null, 2)}
                  </pre>
                ) : (
                  <Text type="secondary">暂无数据</Text>
                ),
              },
              {
                key: "beautify",
                label: "Beautify（Graphviz）",
                children: beautifyLoading ? (
                  <Text type="secondary">渲染中…</Text>
                ) : beautifyError ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <Text type="danger">Graphviz 渲染失败：{beautifyError}</Text>
                    <Text type="secondary">可尝试：点击“重新渲染”，或刷新页面后重试。</Text>
                  </div>
                ) : beautifyResult ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={beautifyResult.metrics.map((m) => ({ ...m, key: m.name }))}
                      columns={[
                        { title: "指标", dataIndex: "name", key: "name", width: 120, render: (v: any) => {
                            const k = String(v || "");
                            const map: Record<string, string> = { nodes: "节点数", crossings: "交叉数", contrast: "对比度", flowAngle: "流向偏差" };
                            return map[k] ?? k;
                          } 
                        },
                        { title: "值", dataIndex: "value", key: "value", width: 90 },
                        { title: "阈值", dataIndex: "thresholdText", key: "thresholdText", width: 100 },
                        { title: "结果", key: "pass", width: 80, render: (_: any, r: any) => <Tag color={r.pass ? "green" : "red"}>{r.pass ? "PASS" : "FAIL"}</Tag> },
                      ]}
                      locale={{ emptyText: "暂无" }}
                      scroll={{ x: "max-content" }}
                    />
                    <div
                      ref={pipelineSvgBoxRef}
                      style={{ border: "1px solid #f0f0f0", borderRadius: 8, padding: 8, background: "#fff", overflow: "auto", height: 520, cursor: "grab" }}
                      onPointerDown={(evt) => {
                        const host = pipelineSvgBoxRef.current;
                        if (!host) return;
                        pipelineSvgDragRef.current = { sx: evt.clientX, sy: evt.clientY, sl: host.scrollLeft, st: host.scrollTop };
                        (evt.currentTarget as HTMLElement).setPointerCapture(evt.pointerId);
                      }}
                      onPointerMove={(evt) => {
                        const host = pipelineSvgBoxRef.current;
                        const d = pipelineSvgDragRef.current;
                        if (!host || !d) return;
                        host.scrollLeft = d.sl - (evt.clientX - d.sx);
                        host.scrollTop = d.st - (evt.clientY - d.sy);
                      }}
                      onPointerUp={() => {
                        pipelineSvgDragRef.current = null;
                      }}
                    >
                      <div style={{ transform: `scale(${pipelineSvgScale})`, transformOrigin: "0 0" }} dangerouslySetInnerHTML={{ __html: beautifyResult.svg }} />
                    </div>
                  </div>
                ) : (
                  <Text type="secondary">暂无数据</Text>
                ),
              },
            ]}
          />
        </div>
      </FloatingPopup>

      <FloatingPopup open={fullGraphViewerOpen} title="完整流程图（Graphviz）" initialSize={{ w: 1020, h: 760 }} onClose={() => setFullGraphViewerOpen(false)} scrollable={false}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              background: "#ffffff",
              borderBottom: "1px solid var(--ws-color-border)",
              paddingBottom: 10,
              flexShrink: 0,
            }}
          >
            <Space>
              <Button size="small" onClick={() => setFullGraphScale((s) => Math.max(0.02, Number((s - 0.1).toFixed(2))))}>-</Button>
              <Text type="secondary">{Math.round(fullGraphScale * 100)}%</Text>
              <Button size="small" onClick={() => setFullGraphScale((s) => Math.min(6, Number((s + 0.1).toFixed(2))))}>+</Button>
              <Button
                size="small"
                onClick={() => {
                  const host = fullGraphBoxRef.current;
                  if (!host || !beautifyResult) return;
                  const svg = host.querySelector("svg") as any;
                  if (!svg) return;
                  const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
                  const w = vb && vb.width ? Number(vb.width) : svg.getBBox ? Number(svg.getBBox().width) : 0;
                  const h = vb && vb.height ? Number(vb.height) : svg.getBBox ? Number(svg.getBBox().height) : 0;
                  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
                  const scale = Math.max(0.01, Math.min(6, Math.min(host.clientWidth / w, host.clientHeight / h)));
                  setFullGraphScale(Number(scale.toFixed(2)));
                  host.scrollLeft = 0;
                  host.scrollTop = 0;
                }}
              >
                适配全图
              </Button>
              <Button size="small" onClick={() => setFullGraphScale(1)}>重置</Button>
            </Space>
          </div>

          <div
            ref={fullGraphBoxRef}
            style={{ border: "1px solid #f0f0f0", borderRadius: 8, padding: 8, background: "#fff", overflow: "auto", flex: 1, minHeight: 0, cursor: "grab" }}
            onPointerDown={(evt) => {
              const host = fullGraphBoxRef.current;
              if (!host) return;
              (evt.currentTarget as HTMLElement).setPointerCapture(evt.pointerId);
              fullGraphDragRef.current = { sx: evt.clientX, sy: evt.clientY, sl: host.scrollLeft, st: host.scrollTop };
            }}
            onPointerMove={(evt) => {
              const host = fullGraphBoxRef.current;
              const d = fullGraphDragRef.current;
              if (!host || !d) return;
              host.scrollLeft = d.sl - (evt.clientX - d.sx);
              host.scrollTop = d.st - (evt.clientY - d.sy);
            }}
            onPointerUp={() => {
              fullGraphDragRef.current = null;
            }}
          >
            {beautifyResult ? (
              <div style={{ transform: `scale(${fullGraphScale})`, transformOrigin: "0 0" }} dangerouslySetInnerHTML={{ __html: beautifyResult.svg }} />
            ) : (
              <Text type="secondary">暂无 Graphviz 数据（请先运行 Beautify）</Text>
            )}
          </div>
        </div>
      </FloatingPopup>
      <FloatingPopup open={debugViewerOpen} title="调试器（放大查看）" initialSize={{ w: 900, h: 680 }} onClose={() => setDebugViewerOpen(false)}>
        <div style={{ height: "100%" }}>
          {renderDebugPanel()}
        </div>
      </FloatingPopup>
    </div>
  );
}

// Helper icon
function CloseOutlined(props: any) {
    return <span {...props}>x</span>
}
