import React, { useMemo, useState } from "react";
import { Button, Input, Table, Typography } from "antd";
import { ExpandOutlined, PlusOutlined } from "@ant-design/icons";
import type { RunnerState } from "../../hooks/useDapRunner";

const { Text } = Typography;

function CloseXIcon(props: any) {
  return <span {...props}>x</span>;
}

export function DebugTab(props: {
  runner: RunnerState;
  variableColumns: any;
  onAddWatch: (expr: string) => void;
  onRemoveWatch: (expr: string) => void;
  onExpand?: () => void;
  showExpandButton?: boolean;
}) {
  const {
    runner,
    variableColumns,
    onAddWatch,
    onRemoveWatch,
    onExpand,
    showExpandButton,
  } = props;

  const [watchInput, setWatchInput] = useState("");

  const changedSet = useMemo(() => new Set<string>((runner.changedVars || []).map((x) => String(x))), [runner.changedVars]);
  const enhancedVariableColumns = useMemo(
    () =>
      Array.isArray(variableColumns)
        ? variableColumns.map((c: any) => {
            const key = String(c?.key ?? "");
            const dataIndex = String(c?.dataIndex ?? "");
            if (key !== "name" && dataIndex !== "name") return c;
            const baseRender = c?.render;
            return {
              ...c,
              render: (v: any, r: any, idx: number) => {
                const name = String(r?.name ?? v ?? "");
                const changed = changedSet.has(name);
                const content = typeof baseRender === "function" ? baseRender(v, r, idx) : name;
                return changed ? <span style={{ fontWeight: 700, color: "#0EA5E9" }}>{content}</span> : content;
              },
            };
          })
        : variableColumns,
    [changedSet, variableColumns]
  );

  const watchColumns = useMemo(
    () => [
      { title: "表达式", dataIndex: "expr", key: "expr", width: 120 },
      { title: "值", dataIndex: "value", key: "value", ellipsis: true },
      { title: "类型", dataIndex: "type", key: "type", width: 80 },
      {
        title: "",
        key: "actions",
        width: 50,
        render: (_: any, r: { expr: string }) => <Button size="small" type="text" danger icon={<CloseXIcon />} onClick={() => onRemoveWatch(r.expr)} />,
      },
    ],
    [onRemoveWatch]
  );

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div className="flex flex-col gap-3">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text className="font-semibold">变量</Text>
          {showExpandButton !== false ? (
            <Button size="small" type="text" icon={<ExpandOutlined />} onClick={onExpand}>
              调试器放大
            </Button>
          ) : null}
        </div>
        <Table
          size="small"
          pagination={false}
          dataSource={runner.variables}
          columns={enhancedVariableColumns}
          rowKey="name"
          locale={{ emptyText: "暂无变量" }}
        />
        <Text className="font-semibold">表达式</Text>
        <div className="flex gap-2">
          <Input
            id="pythonlab-watch-expression-input"
            name="pythonlab-watch-expression-input"
            aria-label="调试表达式输入框"
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
          locale={{ emptyText: "暂无表达式" }}
        />
        {!runner.watchResults.length && runner.watchExprs.length > 0 && (
          <div style={{ padding: "8px 0", color: "rgba(0,0,0,0.45)", fontSize: 12, textAlign: "center" }}>等待下次暂停时计算...</div>
        )}
      </div>
    </div>
  );
}
