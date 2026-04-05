import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { xbkDataApi } from "@services";
import type { XbkImportPreview, XbkImportResult, XbkScope } from "@services";

interface XbkImportModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  filters: {
    year?: number;
    term?: "上学期" | "下学期";
    grade?: "高一" | "高二";
  };
}

export const XbkImportModal: React.FC<XbkImportModalProps> = ({ open, onCancel, onSuccess, filters }) => {
  const [importScope, setImportScope] = useState<XbkScope>("students");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<XbkImportPreview | null>(null);
  const [importResult, setImportResult] = useState<XbkImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<"高一" | "高二" | undefined>(filters.grade);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewHeaders = useMemo(() => (preview?.columns || []).slice(0, 12), [preview]);
  const previewRows = useMemo(
    () => ((preview?.preview || []) as Record<string, unknown>[]),
    [preview],
  );
  const previewColumns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      previewHeaders.map((header) => ({
        id: header,
        header,
        accessorFn: (row) => row[header],
        meta: { className: "whitespace-nowrap" },
        cell: ({ row }) => (
          <span className="inline-block max-w-[220px] truncate">
            {String(row.original[header] ?? "")}
          </span>
        ),
      })),
    [previewHeaders],
  );
  const previewTable = useReactTable({
    data: previewRows,
    columns: previewColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (_row, index) => String(index),
  });

  useEffect(() => {
    if (!open) return;
    setSelectedGrade(filters.grade);
    setImportFile(null);
    setPreview(null);
    setImportResult(null);
  }, [open, filters.grade]);

  const getErrorMsg = (e: any, defaultMsg: string) => {
    const detail = e?.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((err: any) => err.msg).join("; ");
    }
    if (typeof detail === "object") {
      return JSON.stringify(detail);
    }
    return detail || defaultMsg;
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await xbkDataApi.downloadTemplate({ scope: importScope, grade: selectedGrade });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xbk_${importScope}_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      showMessage.error(getErrorMsg(e, "下载模板失败（需要管理员登录）"));
    }
  };

  const runPreview = useCallback(async (file: File) => {
    setPreviewLoading(true);
    try {
      const res = await xbkDataApi.previewImport({
        scope: importScope,
        year: filters.year,
        term: filters.term,
        grade: selectedGrade,
        file,
      });
      setPreview(res);
      setImportResult(null);
    } catch (e: any) {
      setPreview(null);
      setImportResult(null);
      showMessage.error(getErrorMsg(e, "预检失败（需要管理员登录）"));
    } finally {
      setPreviewLoading(false);
    }
  }, [filters.year, filters.term, selectedGrade, importScope]);

  useEffect(() => {
    if (open && importFile) {
      runPreview(importFile);
    }
  }, [importFile, open, runPreview]);

  const handleImport = async () => {
    if (!importFile) {
      showMessage.warning("请选择要导入的 Excel 文件");
      return;
    }
    setImporting(true);
    try {
      const res = await xbkDataApi.importData({
        scope: importScope,
        year: filters.year,
        term: filters.term,
        grade: selectedGrade,
        skip_invalid: skipInvalid,
        file: importFile,
      });
      setImportResult(res);
      showMessage.success(
        `导入完成：处理 ${res.processed} 行（新增 ${res.inserted}，更新 ${res.updated}，无效 ${res.invalid}）`,
      );
      onSuccess();
    } catch (e: any) {
      showMessage.error(getErrorMsg(e, "导入失败（需要管理员登录）"));
    } finally {
      setImporting(false);
    }
  };

  const canImport = Boolean(importFile) && !previewLoading && (preview ? preview.valid_rows > 0 : true);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto overflow-x-hidden sm:max-w-[780px]">
        <DialogHeader>
          <DialogTitle>导入数据</DialogTitle>
          <DialogDescription className="sr-only">
            上传并预检学生、课程或选课数据文件，确认后写入 XBK 数据库。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-text-tertiary">导入类型:</span>
            <Select value={importScope} onValueChange={(v) => setImportScope(v as XbkScope)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="students">学生名单</SelectItem>
                <SelectItem value="courses">选课目录</SelectItem>
                <SelectItem value="selections">选课结果</SelectItem>
              </SelectContent>
            </Select>

            <span className="text-sm text-text-tertiary">所属年级:</span>
            <Select
              value={selectedGrade || "__none__"}
              onValueChange={(v) => setSelectedGrade(v === "__none__" ? undefined : (v as "高一" | "高二"))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="选择年级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">不设置</SelectItem>
                <SelectItem value="高一">高一</SelectItem>
                <SelectItem value="高二">高二</SelectItem>
              </SelectContent>
            </Select>

            <Button type="button" variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4" />
              下载模板
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setImportFile(file);
                setPreview(null);
                setImportResult(null);
                if (e.currentTarget) {
                  e.currentTarget.value = "";
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              选择 Excel 文件
            </Button>

            {importFile ? (
              <div className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-text-tertiary" />
                <span className="max-w-[340px] truncate">{importFile.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setImportFile(null);
                    setPreview(null);
                    setImportResult(null);
                  }}
                >
                  移除
                </Button>
              </div>
            ) : null}

            <div className="inline-flex items-center gap-2">
              <Checkbox
                id="skip-invalid"
                checked={skipInvalid}
                onCheckedChange={(checked) => setSkipInvalid(checked === true)}
              />
              <label htmlFor="skip-invalid" className="text-sm text-text-secondary">
                跳过错误行并继续导入
              </label>
            </div>
          </div>

          {previewLoading ? (
            <Alert className="border border-primary/20 bg-primary-soft">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <AlertTitle>正在预检文件…</AlertTitle>
            </Alert>
          ) : null}

          {preview ? (
            <Alert
              className={
                preview.total_rows === 0
                  ? "border border-[var(--ws-color-warning)]/25 bg-[var(--ws-color-warning-soft)]"
                  :
                preview.invalid_rows > 0
                  ? "border border-[var(--ws-color-warning)]/25 bg-[var(--ws-color-warning-soft)]"
                  : "border border-[var(--ws-color-success)]/20 bg-[var(--ws-color-success-soft)]"
              }
            >
              <AlertTitle>
                共 {preview.total_rows} 行：可导入 {preview.valid_rows} 行，错误 {preview.invalid_rows} 行
              </AlertTitle>
              <AlertDescription>
                {preview.total_rows === 0 ? (
                  <p>文件仅包含表头或空内容，请填写数据后再导入。</p>
                ) : preview.invalid_rows > 0 ? (
                  <div className="space-y-1">
                    {preview.errors.slice(0, 5).map((e) => (
                      <p key={e.row}>第 {e.row} 行：{e.errors.join("；")}</p>
                    ))}
                    {preview.errors.length > 5 ? <p>…更多错误请修正后重新预检</p> : null}
                  </div>
                ) : (
                  <p>预检通过，可以导入</p>
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          {previewRows.length ? (
            <DataTable
              table={previewTable}
              className="max-h-[360px]"
              tableClassName="min-w-full"
            />
          ) : null}

          {importResult ? (
            <Alert className="border border-[var(--ws-color-success)]/20 bg-[var(--ws-color-success-soft)]">
              <AlertTitle>
                导入完成：处理 {importResult.processed} 行（新增 {importResult.inserted}，更新 {importResult.updated}，无效 {importResult.invalid}）
              </AlertTitle>
            </Alert>
          ) : null}

          <div className="ws-modal-hint break-words leading-relaxed">
            <p>• 会优先使用你当前筛选的 年份/学期/年级 作为默认值（Excel里也可包含“年份/学期/年级”列）。</p>
            <p>• 字段要求：学生名单（年份、学期、年级、班级、学号、姓名、性别）｜选课目录（年份、学期、年级、课程代码、课程名称、课程负责人、限报人数、上课地点）｜选课结果（年份、学期、年级、学号、姓名、课程代码）</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={importing}>
            取消
          </Button>
          <Button type="button" onClick={handleImport} disabled={!canImport || importing}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
