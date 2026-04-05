/**
 * 用户管理表格列配置
 */

import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eye, Pencil, Trash2 } from "lucide-react";
import dayjs from "dayjs";
import type { User, ColumnConfigProps } from "./types";

export const getUserColumns = (props: ColumnConfigProps): ColumnDef<User>[] => {
  const { handleEdit, handleDelete, handleView } = props;

  return [
    {
      id: "student_id",
      header: "学号",
      accessorKey: "student_id",
      size: 120,
      meta: { headerClassName: "w-[120px]", cellClassName: "w-[120px] align-top" },
      cell: ({ row }) => row.original.student_id || "-",
    },
    {
      id: "full_name",
      header: "姓名",
      accessorKey: "full_name",
      size: 120,
      meta: { headerClassName: "w-[120px]", cellClassName: "w-[120px] align-top" },
      cell: ({ row }) => row.original.full_name || "-",
    },
    {
      id: "study_year",
      header: "学年",
      accessorKey: "study_year",
      size: 120,
      meta: { headerClassName: "w-[120px]", cellClassName: "w-[120px] align-top" },
      cell: ({ row }) =>
        row.original.study_year ? (
          <Badge variant="primarySubtle">
            {row.original.study_year}
          </Badge>
        ) : (
          "-"
        ),
    },
    {
      id: "class_name",
      header: "班级",
      accessorKey: "class_name",
      size: 140,
      meta: { headerClassName: "w-[140px]", cellClassName: "w-[140px] align-top" },
      cell: ({ row }) =>
        row.original.class_name ? (
          <Badge variant="success">
            {row.original.class_name}
          </Badge>
        ) : (
          "-"
        ),
    },
    {
      id: "is_active",
      header: "状态",
      accessorKey: "is_active",
      size: 90,
      meta: { headerClassName: "w-[90px]", cellClassName: "w-[90px] align-top" },
      cell: ({ row }) => (
        <Badge
          variant={row.original.is_active ? "success" : "danger"}
        >
          {row.original.is_active ? "活跃" : "停用"}
        </Badge>
      ),
    },
    {
      id: "updated_at",
      header: "更新时间",
      accessorKey: "updated_at",
      size: 160,
      meta: { headerClassName: "w-[160px]", cellClassName: "w-[160px] align-top" },
      cell: ({ row }) =>
        row.original.updated_at
          ? dayjs(row.original.updated_at).format("YYYY-MM-DD HH:mm")
          : "-",
    },
    {
      id: "action",
      header: "操作",
      size: 150,
      meta: { headerClassName: "w-[150px]", cellClassName: "w-[150px] align-top" },
      cell: ({ row }) => {
        const record = row.original;
        return (
          <TooltipProvider delayDuration={120}>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => handleView(record)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>查看详情</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(record)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>编辑</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`确定要删除用户【${record.full_name}】吗？`)) {
                        handleDelete(record.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>删除</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        );
      },
    },
  ];
};
