/**
 * 用户管理主页面
 * 使用自定义Hook和组件架构
 */

import React, { useCallback, useMemo, useRef } from "react";
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
import { getUserColumns } from "./columns";
import UserForm from "./components/UserForm";
import UserDetailModal from "./components/UserDetailModal";
import { roleOptions, statusOptions } from "./data";
import type { User } from "./types";
import { AdminPage, AdminTablePanel } from "@components/Admin";
import { PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";

const AdminUsers: React.FC = () => {
  const { state, actions, closeForm, closeDetail } = useUsers();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const baseColumns = useMemo(
    () =>
      getUserColumns({
        handleEdit: actions.handleEdit,
        handleDelete: actions.handleDelete,
        handleView: actions.handleView,
      }),
    [actions.handleDelete, actions.handleEdit, actions.handleView],
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
      actions.setSelectedRowKeys(nextKeys);
    },
    [actions.setSelectedRowKeys, rowSelection],
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
      <div className="mb-4 flex flex-wrap items-center gap-2">
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
          defaultValue="__all__"
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
          defaultValue="__all__"
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

        <Button variant="ghost" size="icon" onClick={actions.handleReset} title="重置">
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
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <AdminTablePanel
            loading={state.loading}
            isEmpty={state.users.length === 0}
            emptyDescription={state.searchKeyword ? "未找到匹配的用户" : "暂无用户数据"}
            emptyAction={<Button onClick={actions.handleAddUser}>添加第一个用户</Button>}
          >
            <DataTable table={table} className="h-full" tableClassName="min-w-[980px]" />
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
    </AdminPage>
  );
};

export default AdminUsers;
