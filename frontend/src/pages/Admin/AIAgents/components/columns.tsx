/**
 * AI智能体表格列配置 - 适配后端API
 */
import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  KeyRound,
  Eye,
  Pencil,
  Trash2,
  Zap,
  Cloud,
  Cable,
  Bot,
} from "lucide-react";
import dayjs from "dayjs";
import type { AIAgent } from "@services/znt/types";
import { HoverTip } from "@components/Common/HoverTip";

const typeConfig: Record<
  string,
  {
    text: string;
    icon: React.ReactNode;
    variant?: React.ComponentProps<typeof Badge>["variant"];
    className?: string;
  }
> = {
  general: {
    text: "通用",
    icon: <Bot className="h-3 w-3" />,
    variant: "info",
  },
  openai: {
    text: "OpenAI",
    icon: <Zap className="h-3 w-3" />,
    variant: "info",
  },
  dify: {
    text: "Dify",
    icon: <Cloud className="h-3 w-3" />,
    variant: "purple",
  },
  custom: {
    text: "自定义",
    icon: <Cable className="h-3 w-3" />,
    variant: "success",
  },
  azure: {
    text: "Azure",
    icon: <Cloud className="h-3 w-3" />,
    variant: "cyan",
  },
  anthropic: {
    text: "Anthropic",
    icon: <Zap className="h-3 w-3" />,
    variant: "warning",
  },
  system: {
    text: "系统",
    icon: <Cable className="h-3 w-3" />,
    variant: "purple",
  },
};

const getTypeConfig = (agentType: string) => {
  return (
    typeConfig[agentType] || {
      text: agentType,
      icon: <Cable className="h-3 w-3" />,
      variant: "outline" as const,
    }
  );
};

const formatApiKey = (agent: AIAgent): string => {
  if (!agent.has_api_key) return "未配置";
  if (agent.api_key_last4) return `****${agent.api_key_last4}`;
  return "已配置";
};

export const getAgentColumns = (
  handleEdit: (record: AIAgent) => void,
  handleDelete: (id: number) => void,
  handleToggleActive: (id: number, isActive: boolean) => void,
  handleViewDetails: (record: AIAgent) => void,
  handleTestAgent: (id: number, name: string) => void,
): ColumnDef<AIAgent>[] => [
  {
    id: "name",
    header: "名称",
    accessorFn: (row) => row.agent_name || row.name,
    size: 260,
    meta: {
      headerClassName: "w-[260px] min-w-[260px]",
      cellClassName: "w-[260px] min-w-[260px] align-top",
    },
    cell: ({ row }) => {
      const record = row.original;
      const displayName = record.agent_name || record.name;
      return (
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-content-center rounded-md bg-primary/10 text-primary">
            {record.agent_type === "dify" ? (
              <Cloud className="h-5 w-5" />
            ) : (
              <Zap className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 text-sm font-semibold text-text-base break-words">
              {displayName}
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "agent_type",
    header: "类型",
    accessorKey: "agent_type",
    size: 132,
    meta: {
      headerClassName: "w-[132px] min-w-[132px]",
      cellClassName: "w-[132px] min-w-[132px] align-top whitespace-nowrap",
    },
    cell: ({ row }) => {
      const config = getTypeConfig(row.original.agent_type);
      return (
        <Badge variant={config.variant} className={["whitespace-nowrap", config.className].filter(Boolean).join(" ")}>
          {config.icon}
          {config.text}
        </Badge>
      );
    },
  },
  {
    id: "description",
    header: "描述",
    accessorKey: "description",
    size: 360,
    meta: {
      headerClassName: "min-w-[320px]",
      cellClassName: "min-w-[320px] max-w-[520px] align-top",
    },
    cell: ({ row }) => {
      const value = (row.original.description || "").trim();
      if (!value) return <span className="text-text-tertiary">无</span>;
      return (
        <span
          title={value}
          className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
        >
          {value}
        </span>
      );
    },
  },
  {
    id: "api_key",
    header: "API密钥",
    accessorKey: "api_key",
    size: 156,
    meta: {
      headerClassName: "w-[156px] min-w-[156px]",
      cellClassName: "w-[156px] min-w-[156px] align-top whitespace-nowrap",
    },
    cell: ({ row }) => {
      const record = row.original;
      return (
        <HoverTip title={record.has_api_key ? "已保存API密钥" : "未配置API密钥"}>
          <div>
            <Badge
              variant={record.has_api_key ? "warning" : "outline"}
              className="whitespace-nowrap"
            >
              <KeyRound className="h-3 w-3" />
              {formatApiKey(record)}
            </Badge>
          </div>
        </HoverTip>
      );
    },
  },
  {
    id: "status",
    header: "状态",
    accessorFn: (row) => row.status ?? row.is_active,
    size: 140,
    meta: {
      headerClassName: "w-[140px] min-w-[140px]",
      cellClassName: "w-[140px] min-w-[140px] align-top whitespace-nowrap",
    },
    cell: ({ row }) => {
      const record = row.original;
      const isActive = record.status ?? record.is_active;
      return (
        <div className="flex items-center gap-xs">
          <Switch
            checked={isActive}
            onCheckedChange={(checked) => handleToggleActive(record.id, checked)}
          />
          <span className="text-xs text-text-tertiary">{isActive ? "启用" : "停用"}</span>
        </div>
      );
    },
  },
  {
    id: "created_at",
    header: "创建时间",
    accessorKey: "created_at",
    size: 132,
    meta: {
      headerClassName: "w-[132px] min-w-[132px]",
      cellClassName: "w-[132px] min-w-[132px] align-top whitespace-nowrap",
    },
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">
        {dayjs(row.original.created_at).format("YYYY-MM-DD")}
      </span>
    ),
  },
  {
    id: "action",
    header: "操作",
    // 宽度依据：本列 cell 是 flex + gap-1 + whitespace-nowrap，内有 4 个图标按钮
    // （查看/编辑/测试连接/删除），必须按内容最小宽度定宽，否则按钮行会被压缩或溢出。
    // 实测（浏览器内按下列 class 复刻，根字号取项目上限 15px = 1rem）：
    //   单个按钮 h-[--ws-control-height-sm] px-3 + size-4 图标 ≈ 37.5px → 4 个 = 150px
    //   按钮间 3 个 gap-1(0.25rem = 3.75px) = 11.25px
    //   TableCell 左右内边距 px-3 = 22.5px
    //   合计 ≈ 183.6px → 取整 184px
    // 根字号为 clamp(14px, 0.12vw + 13px, 15px)，窄屏降到 14px 时内容约 171.5px，
    // 故 184px 在整体区间内都不会挤压；小于此值 nowrap 内容会溢出压到相邻列。
    size: 184,
    meta: {
      headerClassName: "w-[184px] min-w-[184px]",
      cellClassName: "w-[184px] min-w-[184px] align-top whitespace-nowrap",
    },
    cell: ({ row }) => {
      const record = row.original;
      return (
        <TooltipProvider delayDuration={120}>
          <div className="flex items-center gap-2xs whitespace-nowrap">
            <HoverTip title="查看详情">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewDetails(record)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </HoverTip>
            <HoverTip title="编辑">
              <Button variant="ghost" size="sm" onClick={() => handleEdit(record)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </HoverTip>
            <HoverTip title="测试连接">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleTestAgent(record.id, record.name)}
              >
                <Zap className="h-4 w-4 text-[var(--ws-color-warning)]" />
              </Button>
            </HoverTip>
            <HoverTip title="删除">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(record.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </HoverTip>
          </div>
        </TooltipProvider>
      );
    },
  },
];
