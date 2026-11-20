import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/ui/data-table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UserImportResult } from "@services/users";

export default function ImportResultDialog({ result, onClose }: {
  result: UserImportResult;
  onClose: () => void;
}) {
  const [{ page, pageSize }, setPagination] = useState({ page: 1, pageSize: 20 });
  const first = (page - 1) * pageSize;
  const totalPages = Math.ceil(result.errors.length / pageSize);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>用户导入结果</DialogTitle>
          <DialogDescription>
            新增 {result.imported_count}，更新 {result.updated_count}，失败 {result.error_count}。
            表头后的第一条记录编号为 1，CSV 模板说明也计入编号，空行跳过。
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-[45dvh] space-y-2 overflow-y-auto break-words text-sm">
          {result.errors.slice(first, first + pageSize).map((row) => (
            <li key={row.row_number} className="rounded-md border border-border-secondary p-2">
              <div className="font-medium">第 {row.row_number} 行{row.student_id && ` · ${row.student_id}`}{row.full_name && ` · ${row.full_name}`}</div>
              <div className="text-text-secondary">{row.message || "该行导入失败"}</div>
            </li>
          ))}
        </ul>
        {result.errors.length > 20 && (
          <DataTablePagination
            currentPage={page}
            totalPages={totalPages}
            total={result.errors.length}
            pageSize={pageSize}
            onPageChange={(nextPage, size) => setPagination({ page: nextPage, pageSize: size ?? pageSize })}
          />
        )}
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">关闭</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
