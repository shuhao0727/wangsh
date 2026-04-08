import * as React from "react"
import { flexRender, type Row, type Table as TanStackTable } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
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
      className={cn("overflow-auto rounded-md border border-border", className)}
      style={style}
    >
      <Table
        className={cn(
          tableClassName,
          "[&_thead_th]:h-10 [&_tbody_td]:py-2.5",
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
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2 text-sm text-text-secondary", className)}>
      <span className="mr-1 whitespace-nowrap text-text-tertiary">共 {total} 条</span>
      <select
        className="h-9 rounded-lg border border-border-secondary bg-background px-3 text-sm text-text-base outline-none transition-colors hover:border-border focus:border-primary/50"
        value={pageSize}
        onChange={(event) => onPageChange(1, Number(event.target.value))}
      >
        {pageSizeOptions.map((size) => (
          <option key={size} value={size}>
            {size} / 页
          </option>
        ))}
      </select>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 px-3 text-sm text-text-secondary hover:text-text-base"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        上一页
      </Button>
      <span className="min-w-[3.5rem] text-center text-sm font-medium text-text-base">
        {currentPage}/{totalPages}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 px-3 text-sm text-text-secondary hover:text-text-base"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        下一页
      </Button>
    </div>
  )
}

export { DataTable, DataTablePagination }
