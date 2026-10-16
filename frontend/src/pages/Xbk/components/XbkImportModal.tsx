import { showMessage } from "@/lib/toast";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
    year?: string;
    term?: "上学期" | "下学期";
    grade?: "高一" | "高二";
  };
}

export const XbkImportModal: React.FC<XbkImportModalProps> = ({
  open,
  onCancel,
  onSuccess,
  filters,
}) => {
  const [importScope, setImportScope] = useState<XbkScope>("students");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [fileVersion, setFileVersion] = useState(0);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<XbkImportPreview | null>(null);
  const [importResult, setImportResult] = useState<XbkImportResult | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<
    "高一" | "高二" | undefined
  >(filters.grade);
  const [error, setError] = useState<string | null>(null);
  const previewRequest = useRef(0);
  const importLock = useRef(false);
  const session = useRef(0);
  const context = useMemo(
    () => ({
      file: importFile,
      fileVersion,
      scope: importScope,
      year: filters.year,
      term: filters.term,
      grade: selectedGrade,
      open,
    }),
    [
      importFile,
      fileVersion,
      importScope,
      filters.year,
      filters.term,
      selectedGrade,
      open,
    ],
  );
  const [previewContext, setPreviewContext] = useState<typeof context | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewHeaders = useMemo(
    () => (preview?.columns || []).slice(0, 12),
    [preview],
  );
  const previewRows = useMemo(
    () => (preview?.preview || []) as Record<string, unknown>[],
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

  const clearPreview = () => {
    // Invalidate immediately, before effect cleanup (file/type changes can happen together).
    previewRequest.current += 1;
    setPreview(null);
    setPreviewContext(null);
    setPreviewLoading(false);
    setImportResult(null);
    setError(null);
  };

  useEffect(() => {
    session.current += 1;
    setSelectedGrade(filters.grade);
    setImportFile(null);
    setPreview(null);
    setPreviewContext(null);
    setImportResult(null);
    setError(null);
    return () => {
      session.current += 1;
    };
  }, [open, filters.grade]);

  const getErrorMsg = (e: unknown, defaultMsg: string): string => {
    const detail = (e as { response?: { data?: { detail?: unknown } } } | null)
      ?.response?.data?.detail;
    if (Array.isArray(detail)) {
      return (
        detail
          .map((err) =>
            typeof err?.msg === "string" ? err.msg : JSON.stringify(err),
          )
          .join("; ") || defaultMsg
      );
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    return typeof detail === "string" && detail ? detail : defaultMsg;
  };

  const handleDownloadTemplate = async () => {
    if (importLock.current) return;
    try {
      const blob = await xbkDataApi.downloadTemplate({
        scope: importScope,
        grade: selectedGrade,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xbk_${importScope}_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      showMessage.error(getErrorMsg(e, "下载模板失败（需要管理员登录）"));
    }
  };

  useEffect(() => {
    const request = ++previewRequest.current;
    let active = true;
    setPreview(null);
    setPreviewContext(null);
    setImportResult(null);
    if (open && importFile) setError(null);
    setPreviewLoading(Boolean(open && importFile));
    if (open && importFile) {
      void (async () => {
        try {
          const res = await xbkDataApi.previewImport({
            scope: importScope,
            year: filters.year,
            term: filters.term,
            grade: selectedGrade,
            file: importFile,
          });
          if (!active || request !== previewRequest.current) return;
          setPreview(res);
          setPreviewContext(context);
        } catch (e: unknown) {
          if (!active || request !== previewRequest.current) return;
          const message = getErrorMsg(
            e,
            "预检失败，请检查文件或网络后重新选择文件",
          );
          setError(message);
          showMessage.error(message);
        } finally {
          if (active && request === previewRequest.current)
            setPreviewLoading(false);
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [
    context,
    open,
    importFile,
    importScope,
    filters.year,
    filters.term,
    selectedGrade,
  ]);

  const canImport =
    open &&
    Boolean(importFile) &&
    previewContext === context &&
    !previewLoading &&
    Boolean(
      preview &&
      preview.valid_rows > 0 &&
      (skipInvalid || preview.invalid_rows === 0),
    ) &&
    !importing &&
    !importResult;

  const handleImport = async () => {
    if (importLock.current || !canImport || !importFile) return;
    // A ref closes the double-click gap before React commits disabled controls.
    importLock.current = true;
    const importSession = session.current;
    setImporting(true);
    setError(null);
    try {
      const res = await xbkDataApi.importData({
        scope: importScope,
        year: filters.year,
        term: filters.term,
        grade: selectedGrade,
        skip_invalid: skipInvalid,
        file: importFile,
      });
      if (importSession !== session.current) return;
      setImportResult(res);
      showMessage.success(
        `导入完成：处理 ${res.processed} 行（新增 ${res.inserted}，更新 ${res.updated}，无效 ${res.invalid}）`,
      );
      onSuccess();
    } catch (e: unknown) {
      if (importSession !== session.current) return;
      const message = getErrorMsg(e, "导入失败，请检查网络或登录状态后重试");
      setError(message);
      showMessage.error(message);
    } finally {
      importLock.current = false;
      setImporting(false);
    }
  };

  const handleCancel = () => {
    if (importLock.current) return;
    clearPreview();
    setImportFile(null);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleCancel()}>
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
            <Select
              disabled={importing}
              value={importScope}
              onValueChange={(v) => {
                if (importLock.current) return;
                clearPreview();
                setImportScope(v as XbkScope);
              }}
            >
              <SelectTrigger className="h-8 text-xs w-[140px]">
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
              disabled={importing}
              value={selectedGrade || "__none__"}
              onValueChange={(v) => {
                if (importLock.current) return;
                clearPreview();
                setSelectedGrade(
                  v === "__none__" ? undefined : (v as "高一" | "高二"),
                );
              }}
            >
              <SelectTrigger className="h-8 text-xs w-[120px]">
                <SelectValue placeholder="选择年级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">不设置</SelectItem>
                <SelectItem value="高一">高一</SelectItem>
                <SelectItem value="高二">高二</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              disabled={importing}
            >
              <Download className="h-3.5 w-3.5" />
              下载模板
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              aria-label="选择 Excel 文件"
              disabled={importing}
              onChange={(e) => {
                if (importLock.current) return;
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                // Cancelling the native picker preserves the last selected file.
                if (!file) return;
                clearPreview();
                if (!/\.(xlsx|xls|csv)$/i.test(file.name) || file.size === 0) {
                  setImportFile(null);
                  setError(
                    file.size === 0
                      ? "文件为空，请选择包含数据的 Excel 或 CSV 文件"
                      : "仅支持 .xlsx、.xls 或 .csv 文件，请选择正确的导入文件",
                  );
                  return;
                }
                setImportFile(file);
                setFileVersion((version) => version + 1);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={importing}
              onClick={() => {
                if (!importLock.current) fileInputRef.current?.click();
              }}
            >
              <Upload className="h-3.5 w-3.5" />
              选择 Excel 文件
            </Button>

            {importFile ? (
              <div className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-text-tertiary" />
                <span className="max-w-[340px] truncate">
                  {importFile.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  disabled={importing}
                  onClick={() => {
                    if (importLock.current) return;
                    clearPreview();
                    setImportFile(null);
                  }}
                >
                  移除
                </Button>
              </div>
            ) : null}

            <div className="inline-flex items-center gap-2">
              <Checkbox
                id="skip-invalid"
                disabled={importing}
                checked={skipInvalid}
                onCheckedChange={(checked) => {
                  if (!importLock.current) setSkipInvalid(checked === true);
                }}
              />
              <label
                htmlFor="skip-invalid"
                className="text-sm text-text-secondary"
              >
                跳过错误行并继续导入
              </label>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>操作未完成</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {previewLoading ? (
            <Alert className="border border-primary/20 bg-primary-soft">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <AlertTitle>正在预检文件…</AlertTitle>
            </Alert>
          ) : null}

          {preview && previewContext === context ? (
            <Alert
              className={
                preview.total_rows === 0
                  ? "border border-[var(--ws-color-warning)]/25 bg-[var(--ws-color-warning-soft)]"
                  : preview.invalid_rows > 0
                    ? "border border-[var(--ws-color-warning)]/25 bg-[var(--ws-color-warning-soft)]"
                    : "border border-[var(--ws-color-success)]/20 bg-[var(--ws-color-success-soft)]"
              }
            >
              <AlertTitle>
                共 {preview.total_rows} 行：可导入 {preview.valid_rows} 行，错误{" "}
                {preview.invalid_rows} 行
              </AlertTitle>
              <AlertDescription>
                {preview.total_rows === 0 ? (
                  <p>文件仅包含表头或空内容，请填写数据后再导入。</p>
                ) : preview.invalid_rows > 0 ? (
                  <div className="space-y-1">
                    {!skipInvalid ? (
                      <p>请修正错误行，或勾选“跳过错误行并继续导入”。</p>
                    ) : null}
                    {preview.errors.slice(0, 5).map((e) => (
                      <p key={e.row}>
                        第 {e.row} 行：{e.errors.join("；")}
                      </p>
                    ))}
                    {preview.errors.length > 5 ? (
                      <p>…更多错误请修正后重新预检</p>
                    ) : null}
                  </div>
                ) : (
                  <p>预检通过，可以导入</p>
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          {previewContext === context && previewRows.length ? (
            <DataTable
              table={previewTable}
              className="max-h-[360px]"
              tableClassName="min-w-full"
            />
          ) : null}

          {importResult ? (
            <Alert className="border border-[var(--ws-color-success)]/20 bg-[var(--ws-color-success-soft)]">
              <AlertTitle>
                导入完成：处理 {importResult.processed} 行（新增{" "}
                {importResult.inserted}，更新 {importResult.updated}，无效{" "}
                {importResult.invalid}）
              </AlertTitle>
            </Alert>
          ) : null}

          <div className="ws-modal-hint break-words leading-relaxed">
            <p>
              • 支持 Excel / CSV，推荐 .xlsx；旧版 .xls 若预检失败，请另存为
              .xlsx 或 CSV。
            </p>
            <p>
              • 每份文件仅限一个学年和学期；文件值优先，缺失时使用当前筛选值。
            </p>
            {importScope === "students" && (
              <p>• 学号须在同一学期跨年级、跨班级唯一，不能使用班内序号。</p>
            )}
            <p>
              •
              字段要求：学生名单（学年、学期、年级、班级、学号、姓名、性别）｜选课目录（学年、学期、年级、课程代码、课程名称、课程负责人、限报人数、上课地点）｜选课结果（学年、学期、年级、学号、姓名、课程代码）
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={importing}
          >
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleImport}
            disabled={!canImport || importing}
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
