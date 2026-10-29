/**
 * 用户管理主页面
 * 使用自定义Hook和组件架构
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  type ColumnDef,
  type RowSelectionState,
  type Updater,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";

import { useUsers } from "./hooks/useUsers";
import { useUsersStats } from "@hooks/queries/useUsersQuery";
import { getUserColumns } from "./columns";
import UserForm from "./components/UserForm";
import UserDetailModal from "./components/UserDetailModal";
import { roleOptions, statusOptions } from "./data";
import type { User } from "./types";
import { AdminPage, AdminTablePanel, AdminFilterBar } from "@components/Admin";
import { ConfirmDialog } from "@components/Common/ConfirmDialog";
import { PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";
import { useBreakpoint } from "@hooks/useBreakpoint";

const AdminUsers: React.FC = () => {
  const { state, actions, closeForm, closeDetail } = useUsers();
  const { data: stats } = useUsersStats();
  const screens = useBreakpoint();
  const compact = !screens.lg;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  // 批量删除是破坏性且不可撤销的：点击后直接删掉选中的全部用户，
  // 与单条删除相比影响面更大，必须同样先确认。
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const {
    handleEdit,
    handleView,
    setSelectedRowKeys,
  } = actions;

  const handleDeleteRequest = useCallback((id: number) => setDeleteTarget(id), []);

  const baseColumns = useMemo(
    () =>
      getUserColumns({
        handleEdit,
        handleDelete: handleDeleteRequest,
        handleView,
      }),
    [handleEdit, handleView, handleDeleteRequest],
  );

  const rowSelection = useMemo<RowSelectionState>(() => {
    const selectedIds = new Set(state.selectedRowKeys.map((id) => String(id)));
    return state.users.reduce<RowSelectionState>((acc, user) => {
      const id = String(user.id);
      if (selectedIds.has(id)) {
        acc[id] = true;
      }
      return acc;
    }, {});
  }, [state.selectedRowKeys, state.users]);

  const handleRowSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      const nextSelection =
        typeof updater === "function" ? updater(rowSelection) : updater;
      const nextKeys = Object.keys(nextSelection)
        .filter((key) => nextSelection[key])
        .map((key) => Number(key));
      setSelectedRowKeys(nextKeys);
    },
    [setSelectedRowKeys, rowSelection],
  );

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              aria-label="选择当前页全部用户"
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
              }
              onCheckedChange={(checked) =>
                table.toggleAllPageRowsSelected(checked === true)
              }
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              aria-label={`选择用户 ${row.original.full_name}`}
              checked={row.getIsSelected()}
              onCheckedChange={(checked) => row.toggleSelected(checked === true)}
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
        size: 44,
        meta: { className: "w-[44px] align-middle" },
      },
      ...baseColumns,
    ],
    [baseColumns],
  );

  const table = useReactTable({
    data: state.users,
    columns,
    state: { rowSelection },
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    onRowSelectionChange: handleRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
  const hasActiveFilters =
    Boolean(state.searchKeyword) ||
    state.roleFilter !== undefined ||
    state.statusFilter !== undefined ||
    state.selectedRowKeys.length > 0;

  return (
    <AdminPage scrollable={false}>
      <AdminFilterBar className="mb-0 flex-none flex-col items-stretch gap-2.5 py-2">
        {stats && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border-secondary pb-2 text-xs">
            <span className="inline-flex items-baseline gap-1.5">
              <span className="text-text-secondary">用户</span>
              <span className="font-semibold text-primary tabular-nums">{stats.total}</span>
            </span>
            <span className="inline-flex items-baseline gap-1.5 border-l border-border-secondary pl-4">
              <span className="text-text-secondary">激活</span>
              <span className="font-semibold tabular-nums text-text-base">{stats.active}</span>
            </span>
            {stats.inactive > 0 && (
              <span className="inline-flex items-baseline gap-1.5 border-l border-border-secondary pl-4">
                <span className="text-text-secondary">禁用</span>
                <span className="font-semibold text-text-base tabular-nums">{stats.inactive}</span>
              </span>
            )}
            {!compact && stats.by_role && Object.entries(stats.by_role).map(([role, count]) => {
              const label = role === "student" ? "学生" : role === "teacher" ? "教师" : role === "admin" ? "管理" : role === "super_admin" ? "超管" : role;
              return (
                <span key={role} className="inline-flex items-baseline gap-1.5 border-l border-border-secondary pl-4">
                  <span className="text-text-secondary">{label}</span>
                  <span className="font-semibold text-text-base tabular-nums">{count}</span>
                </span>
              );
            })}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.csv,.txt"
          onChange={async (e) => {
            const input = e.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            try {
              await actions.handleFileUpload(file);
            } finally {
              input.value = "";
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-[1_1_460px] flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                aria-label="搜索用户姓名、学号或用户名"
                placeholder="搜索用户姓名、学号或用户名"
                value={state.searchKeyword}
                className="pl-9"
                onChange={(e) => actions.handleSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    actions.handleSearch((e.target as HTMLInputElement).value);
                  }
                }}
              />
            </div>

            <Select
              value={state.roleFilter ?? "__all__"}
              onValueChange={(value) =>
                actions.handleRoleFilter(value === "__all__" ? undefined : value)
              }
            >
              <SelectTrigger className="h-[var(--ws-control-height)] w-[calc(50%-4px)] sm:w-[116px]" aria-label="按角色筛选">
                <SelectValue placeholder="角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部角色</SelectItem>
                {roleOptions.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={state.statusFilter === undefined ? "__all__" : String(state.statusFilter)}
              onValueChange={(value) => {
                if (value === "__all__") {
                  actions.handleStatusFilter(undefined);
                  return;
                }
                actions.handleStatusFilter(value === "true");
              }}
            >
              <SelectTrigger className="h-[var(--ws-control-height)] w-[calc(50%-4px)] sm:w-[116px]" aria-label="按用户状态筛选">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部状态</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={String(status.value)} value={String(status.value)}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters ? (
              <Button variant="ghost" size="icon" onClick={actions.handleReset} aria-label="重置筛选和选择" title="重置筛选和选择">
                <RotateCcw className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-border-secondary pt-2 sm:ml-auto sm:w-auto sm:flex-nowrap sm:border-t-0 sm:pt-0 sm:pl-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost">
                  <Download className="h-4 w-4" />
                  模板
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => actions.handleDownloadTemplate("xlsx")}>
                  下载 XLSX 模板
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.handleDownloadTemplate("csv")}>
                  下载 CSV 模板
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              aria-label="导入用户"
              title="导入用户"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
            </Button>

            {state.selectedRowKeys.length > 0 ? (
              <Button
                variant="ghost"
                onClick={() => setBatchDeleteOpen(true)}
                className="text-destructive"
                disabled={state.loading}
              >
                <Trash2 className="h-4 w-4" />
                删除 ({state.selectedRowKeys.length})
              </Button>
            ) : null}

            <Button onClick={actions.handleAddUser}>
              <Plus className="h-4 w-4" />
              添加用户
            </Button>
          </div>
        </div>
      </AdminFilterBar>

      <div className="flex min-h-0 flex-1 flex-col">
        <AdminTablePanel
          loading={state.loading}
          isEmpty={state.users.length === 0}
          emptyDescription={state.searchKeyword ? "未找到匹配的用户" : "暂无用户数据"}
        >
          <DataTable table={table} tableClassName="!min-w-[1044px]" />
        </AdminTablePanel>
        {state.users.length > 0 ? (
          <div className="flex shrink-0 justify-end border-t border-border-secondary bg-surface py-2">
            <DataTablePagination
              currentPage={state.currentPage}
              totalPages={totalPages}
              total={state.total}
              pageSize={state.pageSize}
              pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
              onPageChange={actions.handlePageChange}
            />
          </div>
        ) : null}
      </div>

      <UserForm
        visible={state.formVisible}
        editingUser={state.editingUser}
        onSubmit={actions.handleFormSubmit}
        onCancel={closeForm}
      />

      <UserDetailModal
        visible={state.detailVisible}
        currentUser={state.currentUser}
        onCancel={closeDetail}
        onEdit={actions.handleEdit}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="确认删除"
        description={
          deleteTarget !== null
            ? `确定要删除用户【${state.users.find((u) => u.id === deleteTarget)?.full_name ?? ""}】吗？`
            : ""
        }
        confirmText="删除"
        variant="destructive"
        onConfirm={async () => {
          if (deleteTarget !== null) {
            await actions.handleDelete(deleteTarget);
            setDeleteTarget(null);
          }
        }}
      />
      <ConfirmDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        title="确认批量删除"
        description={`确定要删除选中的 ${state.selectedRowKeys.length} 个用户吗？此操作不可撤销。`}
        confirmText="删除"
        variant="destructive"
        loading={state.loading}
        onConfirm={async () => {
          await actions.handleBatchDelete();
          setBatchDeleteOpen(false);
        }}
      />
    </AdminPage>
  );
};

export default AdminUsers;
