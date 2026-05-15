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

  return (
    <AdminPage scrollable={false}>
      <AdminFilterBar>
        {stats && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary-soft px-2.5 h-9">
              <span className="text-text-tertiary">用户</span>
              <span className="font-semibold text-primary tabular-nums">{stats.total}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--ws-color-success-soft)] px-2.5 h-9">
              <span className="text-text-tertiary">激活</span>
              <span className="font-semibold tabular-nums" style={{ color: "var(--ws-color-success)" }}>{stats.active}</span>
            </span>
            {stats.inactive > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--ws-color-surface-2)] px-2.5 h-9">
                <span className="text-text-tertiary">禁用</span>
                <span className="font-semibold text-text-base tabular-nums">{stats.inactive}</span>
              </span>
            )}
            {!compact && stats.by_role && Object.entries(stats.by_role).map(([role, count]) => {
              const label = role === "student" ? "学生" : role === "teacher" ? "教师" : role === "admin" ? "管理" : role === "super_admin" ? "超管" : role;
              return (
                <span key={role} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--ws-color-surface-2)] px-2.5 h-9">
                  <span className="text-text-tertiary">{label}</span>
                  <span className="font-semibold text-text-base tabular-nums">{count}</span>
                </span>
              );
            })}
          </div>
        )}
        {stats && <div className="mx-1 h-6 w-px bg-border-secondary" />}
        <div className="relative w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="搜索用户..."
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
          <SelectTrigger className="w-[120px]">
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
          <SelectTrigger className="w-[120px]">
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

        <div className="flex-1" />

        <Button variant="ghost" size="icon" onClick={actions.handleReset} aria-label="重置">
          <RotateCcw className="h-4 w-4" />
        </Button>

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

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.csv,.txt"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            await actions.handleFileUpload(file);
            e.currentTarget.value = "";
          }}
        />
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
            onClick={actions.handleBatchDelete}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            删除 ({state.selectedRowKeys.length})
          </Button>
        ) : null}

        <Button onClick={actions.handleAddUser}>
          <Plus className="h-4 w-4" />
          添加用户
        </Button>
      </AdminFilterBar>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 flex flex-col">
          <AdminTablePanel
            loading={state.loading}
            isEmpty={state.users.length === 0}
            emptyDescription={state.searchKeyword ? "未找到匹配的用户" : "暂无用户数据"}
            emptyAction={<Button onClick={actions.handleAddUser}>添加第一个用户</Button>}
          >
            <DataTable table={table} tableClassName="min-w-[980px]" />
          </AdminTablePanel>
        </div>
        {state.users.length > 0 ? (
          <div className="mt-2 flex justify-end border-t border-border-secondary pt-3">
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
    </AdminPage>
  );
};

export default AdminUsers;
