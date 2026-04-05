import React, { useMemo, useState } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Maximize2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import type { RunnerState } from "../../hooks/useDapRunner";

type ColumnLike = {
  title?: React.ReactNode;
  dataIndex?: string;
  key?: string;
  width?: number | string;
  ellipsis?: boolean;
  render?: (value: any, record: any, index: number) => React.ReactNode;
};

const CompactDataTable: React.FC<{
  rows: any[];
  columns: ColumnLike[];
  rowKey: string;
  emptyText: string;
}> = ({ rows, columns, rowKey, emptyText }) => {
  const tableColumns = useMemo<ColumnDef<any>[]>(
    () =>
      columns.map((col, index): ColumnDef<any> => ({
        id: String(col.key || col.dataIndex || index),
        header: () => <>{col.title ?? ""}</>,
        accessorFn: (row: any) => (col.dataIndex ? row?.[col.dataIndex] : row),
        size: typeof col.width === "number" ? col.width : undefined,
        meta: {
          className: col.ellipsis ? "max-w-[260px] truncate" : undefined,
        },
        cell: ({ row }) => {
          const raw = col.dataIndex ? row.original?.[col.dataIndex] : undefined;
          const rendered =
            typeof col.render === "function"
              ? col.render(raw, row.original, row.index)
              : raw;
          return rendered as React.ReactNode;
        },
      })),
    [columns],
  );

  const table = useReactTable({
    data: rows.map((row, index) => ({ ...row, __rowKey: String(row?.[rowKey] ?? index) })),
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.__rowKey,
  });

  return (
    <DataTable
      table={table}
      tableClassName="text-xs"
      emptyState={<div className="h-12 text-center text-text-tertiary">{emptyText}</div>}
    />
  );
};

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
                return changed ? <span className="font-bold text-primary">{content}</span> : content;
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
        render: (_: any, r: { expr: string }) => (
          <Button variant="destructive" size="sm" onClick={() => onRemoveWatch(r.expr)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        ),
      },
    ],
    [onRemoveWatch]
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">变量</span>
          {showExpandButton !== false ? (
            <Button variant="ghost" size="sm" onClick={onExpand}>
              <Maximize2 className="h-4 w-4" />
              调试器放大
            </Button>
          ) : null}
        </div>
        <CompactDataTable
          rows={Array.isArray(runner.variables) ? runner.variables : []}
          columns={Array.isArray(enhancedVariableColumns) ? (enhancedVariableColumns as ColumnLike[]) : []}
          rowKey="name"
          emptyText="暂无变量"
        />
        <span className="font-semibold">表达式</span>
        <div className="flex gap-2">
          <Input
            id="pythonlab-watch-expression-input"
            name="pythonlab-watch-expression-input"
            aria-label="调试表达式输入框"
            placeholder="添加表达式..."
            value={watchInput}
            onChange={(e) => setWatchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (watchInput.trim()) {
                onAddWatch(watchInput.trim());
                setWatchInput("");
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (watchInput.trim()) {
                onAddWatch(watchInput.trim());
                setWatchInput("");
              }
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <CompactDataTable
          rows={Array.isArray(runner.watchResults) ? runner.watchResults : []}
          columns={watchColumns as ColumnLike[]}
          rowKey="expr"
          emptyText="暂无表达式"
        />
        {!runner.watchResults.length && runner.watchExprs.length > 0 && (
          <div className="py-2 text-center text-xs text-text-tertiary">等待下次暂停时计算...</div>
        )}
      </div>
    </div>
  );
}
