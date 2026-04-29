import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BarChart3,
  Copy,
  Pencil,
  Play,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Activity } from "@services/classroom";
import { ANALYSIS_STATUS_MAP } from "../utils";

const STATUS_MAP: Record<Activity["status"], { label: string; dotClass: string }> = {
  draft: { label: "草稿", dotClass: "bg-text-tertiary" },
  active: { label: "进行中", dotClass: "bg-[var(--ws-color-info)]" },
  ended: { label: "已结束", dotClass: "bg-[var(--ws-color-success)]" },
};

export interface ActivityColumnHandlers {
  handleEdit: (record: Activity) => void;
  handleDelete: (record: Activity) => void;
  handleStart: (id: number) => void;
  handleEnd: (id: number) => void;
  handleRestart: (id: number) => void;
  handleDuplicate: (id: number) => void;
  openDetail: (record: Activity) => void;
  onConfirm: (message: string, onOk: () => void) => void;
}

const rowActionButton = (
  title: string,
  icon: React.ReactNode,
  onClick: () => void,
  options?: { danger?: boolean; disabled?: boolean },
) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn(options?.danger ? "text-destructive hover:text-destructive" : "")}
        disabled={options?.disabled}
        onClick={onClick}
      >
        {icon}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{title}</TooltipContent>
  </Tooltip>
);

const statusBadge = (status: Activity["status"]) => {
  const item = STATUS_MAP[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 text-xs text-text-secondary">
      <span className={cn("inline-block h-2 w-2 rounded-full", item.dotClass)} />
      {item.label}
    </span>
  );
};

const analysisBadge = (analysisStatus?: string | null) => {
  if (!analysisStatus) return <span className="text-xs text-text-tertiary">—</span>;
  const info = ANALYSIS_STATUS_MAP[analysisStatus] || {
    variant: "neutral" as const,
    text: analysisStatus,
  };
  return <Badge variant={info.variant} className="text-xs">{info.text}</Badge>;
};

export const getActivityColumns = (handlers: ActivityColumnHandlers): ColumnDef<Activity>[] => {
  const { handleEdit, handleDelete, handleStart, handleEnd, handleRestart, handleDuplicate, openDetail, onConfirm } = handlers;
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
          }
          onCheckedChange={(checked) =>
            table.toggleAllPageRowsSelected(checked === true)
          }
          aria-label="全选当前页活动"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(checked === true)}
          aria-label={`选择活动 ${row.original.title}`}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 42,
      meta: { className: "w-[42px]" },
    },
    {
      id: "id",
      header: "ID",
      accessorKey: "id",
      size: 64,
      meta: { className: "w-[64px]" },
    },
    {
      id: "title",
      header: "标题",
      accessorKey: "title",
      meta: { className: "min-w-[180px]" },
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
    },
    {
      id: "type",
      header: "类型",
      size: 100,
      meta: { className: "w-[100px]" },
      cell: ({ row }) => (
        <Badge
          variant={row.original.activity_type === "vote" ? "info" : "success"}
        >
          {row.original.activity_type === "vote" ? "投票" : "填空"}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "状态",
      size: 110,
      meta: { className: "w-[110px]" },
      cell: ({ row }) => statusBadge(row.original.status),
    },
    {
      id: "analysis",
      header: "分析",
      size: 110,
      meta: { className: "w-[110px]" },
      cell: ({ row }) => analysisBadge(row.original.analysis_status),
    },
    {
      id: "time_limit",
      header: "时限",
      size: 90,
      meta: { className: "w-[90px]" },
      cell: ({ row }) =>
        row.original.time_limit > 0 ? `${row.original.time_limit}s` : "无限",
    },
    {
      id: "response_count",
      header: "参与",
      size: 80,
      meta: { className: "w-[80px]" },
      cell: ({ row }) => (
        <span
          className={
            row.original.response_count
              ? "font-semibold text-primary"
              : "text-text-tertiary"
          }
        >
          {row.original.response_count ?? 0}
        </span>
      ),
    },
    {
      id: "actions",
      header: "操作",
      size: 260,
      meta: { className: "w-[260px]" },
      cell: ({ row }) => {
        const record = row.original;
        const isDraft = record.status === "draft";
        const isActive = record.status === "active";
        const isEnded = record.status === "ended";
        return (
          <div className="flex items-center gap-1">
            {!isActive
              ? rowActionButton("编辑", <Pencil className="h-4 w-4" />, () => handleEdit(record))
              : null}
            {isDraft
              ? rowActionButton("开始", <Play className="h-4 w-4" />, () => {
                  onConfirm("确认开始活动？", () => { handleStart(record.id); });
                })
              : null}
            {isActive
              ? rowActionButton(
                  "结束",
                  <Square className="h-4 w-4" />,
                  () => {
                    onConfirm("确认结束活动？", () => { handleEnd(record.id); });
                  },
                  { danger: true },
                )
              : null}
            {isEnded
              ? rowActionButton("重新开始", <RotateCcw className="h-4 w-4" />, () => {
                  onConfirm("重新开始将清除所有答题记录，确认？", () => { handleRestart(record.id); });
                })
              : null}
            {isEnded
              ? rowActionButton("复制为新草稿", <Copy className="h-4 w-4" />, () => {
                  handleDuplicate(record.id);
                })
              : null}
            {!isActive
              ? rowActionButton(
                  "删除",
                  <Trash2 className="h-4 w-4" />,
                  () => {
                    onConfirm("确认删除？", () => { handleDelete(record); });
                  },
                  { danger: true },
                )
              : null}
            {rowActionButton("详情", <BarChart3 className="h-4 w-4" />, () => openDetail(record))}
          </div>
        );
      },
    },
  ];
};
