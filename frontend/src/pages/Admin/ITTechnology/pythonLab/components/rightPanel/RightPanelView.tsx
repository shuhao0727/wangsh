import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Space, Switch, Tabs, Tag, Tooltip, Typography } from "antd";
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
  UnorderedListOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { TimerDisplay } from "@components/TimerDisplay";
import useAuth from "@hooks/useAuth";
import { validatePythonLite } from "../../flow/python_sync";
import { pythonlabSyntaxApi, type PythonLabSyntaxError } from "../../services/pythonlabDebugApi";
import { MonacoPythonEditor } from "../MonacoPythonEditor";
import XtermTerminal from "../XtermTerminal";
import { FloatingPopup } from "../FloatingPopup";
import { getNextActiveTabOnPipelineModeToggle, type RightPanelTabKey } from "../rightPanelTabPolicy";
import type { RightPanelProps } from "./types";
import { DebugTab } from "./DebugTab";
import { PipelineTab } from "./PipelineTab";
import { SessionManagerModal } from "./SessionManagerModal";

const { Text } = Typography;

export function RightPanel(props: RightPanelProps) {
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
    structuredEmphasisLog,
    onToggleStructuredEmphasisLog,
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

  const pipelineEnabled = !!pipelineMode;
  const prevPipelineEnabledRef = useRef<boolean>(pipelineEnabled);
  useEffect(() => {
    const prevPipelineMode = prevPipelineEnabledRef.current;
    const nextPipelineMode = pipelineEnabled;
    prevPipelineEnabledRef.current = nextPipelineMode;

    const nextActive = getNextActiveTabOnPipelineModeToggle({ prevPipelineMode, nextPipelineMode, activeTab });
    if (nextActive !== activeTab) setActiveTab(nextActive);
  }, [activeTab, pipelineEnabled]);

  const [backendSyntax, setBackendSyntax] = useState<{ ok: boolean; errors?: PythonLabSyntaxError[] }>({ ok: true });
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
      } catch {
      } finally {
        setCheckingSyntax(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [code]);

  const validation = useMemo(() => validatePythonLite(code), [code]);
  const isSyntaxOk = validation.ok && backendSyntax.ok;
  const syntaxErrorText = !validation.ok ? "格式错误" : !backendSyntax.ok ? backendSyntax.errors?.[0]?.message || "语法错误" : "语法正确";

  const statusColor = runner.status === "error" ? "red" : runner.status === "running" ? "blue" : runner.status === "paused" ? "orange" : "default";
  const statusText = runner.status === "error" ? "异常" : runner.status === "running" ? "运行中" : runner.status === "paused" ? "暂停" : "空闲";

  const timerContent = (
    <div style={{ paddingRight: 12, color: "rgba(0,0,0,0.45)", fontSize: 12 }}>
      <TimerDisplay startTime={runner.startTime} isRunning={runner.status === "running" || runner.status === "starting"} initialElapsed={runner.elapsedTime} prefix="运行时间: " alwaysShow={true} />
    </div>
  );

  const firstError = runner.error ?? runnerError ?? null;

  const toolButtonStyle = { width: 32, height: 32, padding: 0, borderRadius: 6 } as React.CSSProperties;
  const canStep = runner.status === "paused";
  const canRun = runner.status !== "running";

  useEffect(() => {
    if (runner.status === "starting" || runner.status === "error") setActiveTab("terminal");
  }, [runner.status]);
  useEffect(() => {
    if (runner.status === "paused") setActiveTab("debug");
  }, [runner.status]);
  useEffect(() => {
    if (firstError) setActiveTab("terminal");
  }, [firstError]);
  useEffect(() => {
    if (runner.stdout.length > 0) setActiveTab("terminal");
  }, [runner.stdout.length]);

  useEffect(() => {
    if (codeMode === "auto") setCode(generated.python);
  }, [generated, codeMode, setCode]);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const clampEditorHeight = (hostH: number, desired: number) => {
    const minH = 140;
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
      <Card
        title={
          <Space>
            <CodeOutlined style={{ color: "#1890ff" }} />
            <span style={{ fontWeight: 600 }}>Python</span>
            <Tag color={isSyntaxOk ? "success" : "error"} bordered={false}>
              {checkingSyntax ? "检查中..." : syntaxErrorText}
            </Tag>
            <Tag color={statusColor} bordered={false}>
              {statusText}
            </Tag>
          </Space>
        }
        extra={
          <Space>
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
            <Space size={6}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                流水线
              </Text>
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
          onChange={(next) => {
            setCodeMode("manual");
            setCode(next);
          }}
          syntaxErrors={backendSyntax.errors}
        />
      </Card>

      <Card bordered={false} style={{ flexShrink: 0, borderRadius: 0, borderBottom: "1px solid #f0f0f0" }} styles={{ body: { padding: "8px 12px" } }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Space size={4}>
            <Tooltip title="运行 (Run)">
              <Button type="text" icon={<PlayCircleOutlined style={{ color: !canRun ? undefined : "#52c41a", fontSize: 18 }} />} onClick={onRun} disabled={!canRun} style={toolButtonStyle} />
            </Tooltip>
            <Tooltip title="暂停 (Pause)">
              <Button
                type="text"
                icon={<PauseCircleOutlined style={{ color: runner.status === "running" ? "#faad14" : undefined, fontSize: 18 }} />}
                onClick={onPause}
                disabled={runner.status !== "running"}
                style={toolButtonStyle}
              />
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
            <Button type="text" icon={<UnorderedListOutlined />} onClick={() => setSessionsOpen(true)}>
              会话
            </Button>
          </Space>
        </div>
        {firstError && (
          <div style={{ marginTop: 8, padding: "8px 12px", background: "#fff2f0", border: "1px solid #ffccc7", borderRadius: 4 }}>
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
        <div style={{ position: "absolute", top: -3, bottom: -3, width: "100%", cursor: "row-resize", zIndex: 10 }} />
      </div>

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
                  structuredEmphasisLog={structuredEmphasisLog}
                  onToggleStructuredEmphasisLog={onToggleStructuredEmphasisLog}
                  onToggleBreakpoint={onToggleBreakpoint}
                  onSetBreakpointEnabled={onSetBreakpointEnabled}
                  onSetBreakpointCondition={onSetBreakpointCondition}
                  onSetBreakpointHitCount={onSetBreakpointHitCount}
                  onAddWatch={onAddWatch}
                  onRemoveWatch={onRemoveWatch}
                />
              ),
            },
            {
              key: "pipeline",
              label: "流水线",
              icon: <EyeOutlined />,
              children: (
                <PipelineTab
                  pipelineEnabled={pipelineEnabled}
                  canEdit={canEdit}
                  onTogglePipelineMode={onTogglePipelineMode}
                  pseudocode={pseudocode}
                  pseudocodeLoading={pseudocodeLoading}
                  pseudocodeError={pseudocodeError}
                  tidyResult={tidyResult}
                  onApplyTidy={onApplyTidy}
                  beautifyParams={beautifyParams}
                  setBeautifyParams={setBeautifyParams}
                  beautifyResult={beautifyResult}
                  beautifyLoading={beautifyLoading}
                  beautifyError={beautifyError}
                  onRefreshBeautify={onRefreshBeautify}
                  onApplyBeautify={onApplyBeautify}
                  canvasRoutingStyle={canvasRoutingStyle}
                  setCanvasRoutingStyle={setCanvasRoutingStyle}
                  ruleSet={ruleSet}
                  setRuleSet={setRuleSet}
                  experimentId={experimentId}
                />
              ),
            },
          ]}
        />
      </div>

      <SessionManagerModal open={sessionsOpen} onClose={() => setSessionsOpen(false)} />

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
          />
        </div>
      </FloatingPopup>
    </div>
  );
}
