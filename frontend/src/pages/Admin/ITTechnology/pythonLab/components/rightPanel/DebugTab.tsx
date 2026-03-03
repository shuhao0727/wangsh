import React, { useState } from "react";
import { Button, Collapse, Input, InputNumber, Space, Switch, Table } from "antd";
import { CaretRightOutlined, ExpandOutlined, EyeOutlined, FunctionOutlined, NodeIndexOutlined, PlusOutlined } from "@ant-design/icons";
import type { RunnerState } from "../../hooks/useDapRunner";
import { FloatingPopup } from "../FloatingPopup";

function CloseXIcon(props: any) {
  return <span {...props}>x</span>;
}

export function DebugTab(props: {
  runner: RunnerState;
  variableColumns: any;
  structuredEmphasisLog?: boolean;
  onToggleStructuredEmphasisLog?: (v: boolean) => void;
  onToggleBreakpoint: (line: number) => void;
  onSetBreakpointEnabled: (line: number, enabled: boolean) => void;
  onSetBreakpointCondition: (line: number, condition: string) => void;
  onSetBreakpointHitCount: (line: number, hitCount: number | null) => void;
  onAddWatch: (expr: string) => void;
  onRemoveWatch: (expr: string) => void;
}) {
  const {
    runner,
    variableColumns,
    structuredEmphasisLog,
    onToggleStructuredEmphasisLog,
    onToggleBreakpoint,
    onSetBreakpointEnabled,
    onSetBreakpointCondition,
    onSetBreakpointHitCount,
    onAddWatch,
    onRemoveWatch,
  } = props;

  const [debugViewerOpen, setDebugViewerOpen] = useState(false);
  const [watchInput, setWatchInput] = useState("");
  const [activeDebugKeys, setActiveDebugKeys] = useState<string[]>(["variables", "watch"]);

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
      title: "命中",
      dataIndex: "hitCount",
      key: "hitCount",
      width: 70,
      render: (v: number | undefined, r: { line: number; hitCount?: number }) => (
        <InputNumber
          size="small"
          min={1}
          placeholder="N"
          value={v}
          onChange={(next) => onSetBreakpointHitCount(r.line, typeof next === "number" ? next : null)}
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "",
      key: "actions",
      width: 50,
      render: (_: any, r: { line: number }) => <Button size="small" type="text" danger icon={<CloseXIcon />} onClick={() => onToggleBreakpoint(r.line)} />,
    },
  ];

  const watchColumns = [
    { title: "表达式", dataIndex: "expr", key: "expr", width: 120 },
    { title: "值", dataIndex: "value", key: "value", ellipsis: true },
    { title: "类型", dataIndex: "type", key: "type", width: 80 },
    {
      title: "",
      key: "actions",
      width: 50,
      render: (_: any, r: { expr: string }) => <Button size="small" type="text" danger icon={<CloseXIcon />} onClick={() => onRemoveWatch(r.expr)} />,
    },
  ];

  const renderDebugPanel = () => (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0" }}>
        <Space size={10} style={{ width: "100%", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>结构化强调日志</span>
          <Switch
            size="small"
            checked={!!structuredEmphasisLog}
            onChange={(v) => {
              if (onToggleStructuredEmphasisLog) onToggleStructuredEmphasisLog(v);
            }}
          />
        </Space>
        <div style={{ marginTop: 6, fontSize: 12, color: "rgba(0,0,0,0.45)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
          <Space size={12} wrap>
            <span>activeLine={runner.activeLine ?? "-"}</span>
            <span>activeNodeId={runner.activeNodeId ?? "-"}</span>
            <span>focusRole={runner.activeFocusRole ?? "-"}</span>
          </Space>
        </div>
      </div>
      <Collapse
        activeKey={activeDebugKeys}
        onChange={(keys) => setActiveDebugKeys(typeof keys === "string" ? [keys] : keys)}
        bordered={false}
        expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
        style={{ background: "transparent" }}
        items={[
          {
            key: "variables",
            label: (
              <Space>
                <FunctionOutlined />
                <span>变量 (Variables)</span>
              </Space>
            ),
            children: (
              <Table
                size="small"
                pagination={false}
                dataSource={runner.variables}
                columns={variableColumns}
                rowKey="name"
                scroll={{ x: "max-content" }}
              />
            ),
            style: { borderBottom: "1px solid #f0f0f0" },
          },
          {
            key: "watch",
            label: (
              <Space>
                <EyeOutlined />
                <span>监视 (Watch)</span>
              </Space>
            ),
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
                  <Button
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      if (watchInput.trim()) {
                        onAddWatch(watchInput.trim());
                        setWatchInput("");
                      }
                    }}
                  />
                </div>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={runner.watchResults}
                  columns={watchColumns}
                  rowKey="expr"
                  locale={{ emptyText: "暂无监视表达式" }}
                  scroll={{ x: "max-content" }}
                />
                {!runner.watchResults.length && runner.watchExprs.length > 0 && (
                  <div style={{ padding: "8px 0", color: "rgba(0,0,0,0.45)", fontSize: 12, textAlign: "center" }}>等待下次暂停时计算...</div>
                )}
              </div>
            ),
            style: { borderBottom: "1px solid #f0f0f0" },
          },
          {
            key: "breakpoints",
            label: (
              <Space>
                <NodeIndexOutlined />
                <span>断点 (Breakpoints)</span>
              </Space>
            ),
            children: <Table size="small" pagination={false} dataSource={runner.breakpoints} columns={breakpointColumns} rowKey="line" scroll={{ x: "max-content" }} />,
            style: { borderBottom: "none" },
          },
        ]}
      />
    </div>
  );

  return (
    <>
      <div style={{ height: "100%", overflow: "auto", padding: 0 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 12px 0" }}>
          <Button size="small" icon={<ExpandOutlined />} onClick={() => setDebugViewerOpen(true)}>
            放大查看
          </Button>
        </div>
        {renderDebugPanel()}
      </div>
      <FloatingPopup open={debugViewerOpen} title="调试器（放大查看）" initialSize={{ w: 900, h: 680 }} onClose={() => setDebugViewerOpen(false)}>
        <div style={{ height: "100%" }}>{renderDebugPanel()}</div>
      </FloatingPopup>
    </>
  );
}
