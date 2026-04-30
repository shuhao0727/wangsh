import * as React from "react"
import { flexRender, type Row, type Table as TanStackTable } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type DataTableProps<TData> = {
  table: TanStackTable<TData>
  className?: string
  style?: React.CSSProperties
  tableClassName?: string
  emptyState?: React.ReactNode
  getRowClassName?: (row: Row<TData>) => string | undefined
  onRowClick?: (row: Row<TData>) => void
}

type DataTableColumnMeta = {
  className?: string
  headerClassName?: string
  cellClassName?: string
}

const getColumnMeta = (meta: unknown): DataTableColumnMeta | undefined => {
  return meta as DataTableColumnMeta | undefined
}

const getHeaderClassName = (meta: unknown) => {
  const columnMeta = getColumnMeta(meta)
  return columnMeta?.headerClassName ?? columnMeta?.className
}

const getCellClassName = (meta: unknown) => {
  const columnMeta = getColumnMeta(meta)
  return columnMeta?.cellClassName ?? columnMeta?.className
}

const defaultEmptyState = (
  <div className="px-4 py-10 text-center text-sm text-text-tertiary">暂无数据</div>
)

function DataTable<TData>({
  table,
  className,
  style,
  tableClassName,
  emptyState = defaultEmptyState,
  getRowClassName,
  onRowClick,
}: DataTableProps<TData>) {
  const headerGroups = table.getHeaderGroups()
  const rows = table.getRowModel().rows
  const columnCount = table.getVisibleLeafColumns().length || 1

  return (
    <div
      className={cn("overflow-hidden rounded-md border border-border", className)}
      style={style}
    >
      <Table
        className={cn(
          tableClassName,
          "[&_thead_th]:h-[var(--ws-control-height)] [&_tbody_td]:py-2.5",
        )}
      >
        <TableHeader>
          {headerGroups.map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(getHeaderClassName(header.column.columnDef.meta))}
                  style={{
                    width: header.getSize() > 0 ? header.getSize() : undefined,
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={getRowClassName?.(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                {...(onRowClick
                  ? {
                      role: "button",
                      tabIndex: 0,
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      },
                    }
                  : {})}
              >
                {row.getVisibleCells().map((cell) => {
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(getCellClassName(cell.column.columnDef.meta))}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columnCount}>{emptyState}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

type DataTablePaginationProps = {
  currentPage: number
  totalPages: number
  total: number
  pageSize: number
  pageSizeOptions?: number[]
  onPageChange: (page: number, pageSize?: number) => void
  className?: string
}

function DataTablePagination({
  currentPage,
  totalPages,
  total,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  className,
}: DataTablePaginationProps) {
  const displayTotalPages = Math.max(1, totalPages)

  const changePage = React.useCallback(
    (nextPage: number, nextPageSize?: number) => {
      const normalizedPageSize = nextPageSize ?? pageSize
      if (!Number.isFinite(normalizedPageSize) || normalizedPageSize <= 0) return
      const normalizedTotalPages = Math.max(1, Math.ceil(total / normalizedPageSize))
      const normalizedPage = Math.min(Math.max(1, nextPage), normalizedTotalPages)
      if (normalizedPage === currentPage && normalizedPageSize === pageSize) return
      onPageChange(normalizedPage, normalizedPageSize === pageSize ? undefined : normalizedPageSize)
    },
    [currentPage, pageSize, total, onPageChange],
  )

  const createClickPageHandler = React.useCallback(
    (nextPage: number) =>
      (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
        event.stopPropagation()
        changePage(nextPage)
      },
    [changePage],
  )

  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2 text-sm text-text-secondary", className)}>
      <span className="mr-1 whitespace-nowrap text-text-tertiary">共 {total} 条</span>
      <Select value={String(pageSize)} onValueChange={(value) => changePage(1, Number(value))}>
        <SelectTrigger className="w-[6.5rem] border-border-secondary text-text-base" aria-label="每页条数">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {pageSizeOptions.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size} / 页
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="sm"
        className="h-[var(--ws-control-height)] px-3 text-sm text-text-secondary hover:text-text-base"
        disabled={currentPage <= 1}
        onClick={createClickPageHandler(currentPage - 1)}
        aria-label="上一页"
      >
        上一页
      </Button>
      <span className="min-w-[3.5rem] text-center text-sm font-medium text-text-base">
        {currentPage}/{displayTotalPages}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-[var(--ws-control-height)] px-3 text-sm text-text-secondary hover:text-text-base"
        disabled={currentPage >= displayTotalPages}
        onClick={createClickPageHandler(currentPage + 1)}
        aria-label="下一页"
      >
        下一页
      </Button>
    </div>
  )
}

export { DataTable, DataTablePagination }
