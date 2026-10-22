import { showMessage } from "@/lib/toast";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import {
  FULL_ACADEMIC_YEAR_RE,
  isValidAcademicYear,
  normalizeAcademicYear,
} from "../academicYear";
import { XBK_GRADES } from "../grades";

/** 年级“不设置”在 Radix Select 中的哨兵值（Select 不接受 undefined 作为 value） */
const GRADE_UNSET = "__unset__";

interface XbkImportModalProps {
  open: boolean;
  /** 导入对象：由点击的按钮决定，弹窗内不再提供切换 */
  scope: XbkScope;
  onCancel: () => void;
  /** 导入成功时回传弹窗实际使用的学年/学期，供上层同步筛选栏 */
  onSuccess: (applied: { year?: string; term?: string }) => void;
  filters: {
    year?: string;
    term?: string;
    grade?: (typeof XBK_GRADES)[number];
  };
  /** 学期候选项与筛选栏同源（meta.terms），不写死两项 */
  termOptions?: string[];
}

/** 每种导入对象的标题、说明与字段要求 */
const SCOPE_META: Record<
  XbkScope,
  { label: string; description: string; fields: string; notes: string[] }
> = {
  students: {
    label: "学生名单",
    description:
      "导入或更新学生名册。同一学年、学期内按学号识别学生，已存在则更新，不存在则新增。",
    fields: "学年、学期、年级、班级、学号、姓名、性别",
    notes: [
      "学号须在同一学期跨年级、跨班级唯一，不能使用班内序号。",
      "已有选课记录的学生不会被删除，仅更新名册字段。",
    ],
  },
  courses: {
    label: "课程目录",
    description:
      "导入或更新课程目录。按课程代码识别课程，已存在则更新容量、地点等信息。",
    fields:
      "学年、学期、年级、课程代码、课程名称、课程负责人、限报人数、上课地点",
    notes: [
      "课程代码在同一学年、学期内必须唯一。",
      "调小限报人数不会清退已选该课的学生，需另行处理超额选课。",
    ],
  },
  selections: {
    label: "选课记录",
    description:
      "导入或更新选课结果。按学号与课程代码匹配，写入学生的实际选课关系。",
    fields: "学年、学期、年级、学号、姓名、课程代码",
    notes: [
      "文件中的每个学号必须先存在于学生名册，课程代码必须先存在于课程目录。",
      "同一学生同一学期只能有一条有效选课记录。",
      "整册按班级修改选课请使用“导入选课表”。",
    ],
  },
};

export const XbkImportModal: React.FC<XbkImportModalProps> = ({
  open,
  scope,
  onCancel,
  onSuccess,
  filters,
  termOptions = [],
}) => {
  const meta = SCOPE_META[scope];
  const [importScope, setImportScope] = useState<XbkScope>(scope);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [fileVersion, setFileVersion] = useState(0);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<XbkImportPreview | null>(null);
  const [importResult, setImportResult] = useState<XbkImportResult | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  // 学年使用本地草稿态：只有完整合法时才写入 committedYear，避免逐字符触发预检
  const [yearDraft, setYearDraft] = useState(filters.year ?? "");
  const [committedYear, setCommittedYear] = useState(filters.year);
  const [importTerm, setImportTerm] = useState<string>(
    filters.term || "上学期",
  );
  // 年级是可选的标签字段；默认跟随筛选栏，筛选栏也没有时留空（不设置）
  const [selectedGrade, setSelectedGrade] = useState<
    (typeof XBK_GRADES)[number] | undefined
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
      year: committedYear?.trim() || undefined,
      term: importTerm || undefined,
      grade: selectedGrade,
      open,
    }),
    [
      importFile,
      fileVersion,
      importScope,
      committedYear,
      importTerm,
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
  // 学期候选：优先使用调用方传入的 meta.terms；为空时退回两项并补上当前值
  const termChoices = useMemo(() => {
    const source = termOptions.length > 0 ? termOptions : ["上学期", "下学期"];
    const values = Array.from(
      new Set(source.map((term) => String(term).trim()).filter(Boolean)),
    );
    if (importTerm && !values.includes(importTerm)) values.unshift(importTerm);
    return values;
  }, [importTerm, termOptions]);

  const clearPreview = () => {
    // Invalidate immediately, before effect cleanup (file/type changes can happen together).
    previewRequest.current += 1;
    setPreview(null);
    setPreviewContext(null);
    setPreviewLoading(false);
    setImportResult(null);
    setError(null);
  };

  /** 提交合法学年：变化时才清空旧预览并重新预检 */
  const commitYear = (raw: string) => {
    const normalized = normalizeAcademicYear(raw) ?? undefined;
    if (normalized === committedYear) return;
    clearPreview();
    setCommittedYear(normalized);
  };

  useEffect(() => {
    session.current += 1;
    setImportScope(scope);
    setYearDraft(filters.year ?? "");
    setCommittedYear(filters.year);
    setImportTerm(filters.term || "上学期");
    setSelectedGrade(filters.grade);
    setImportFile(null);
    setPreview(null);
    setPreviewContext(null);
    setImportResult(null);
    setError(null);
    return () => {
      session.current += 1;
    };
  }, [open, scope, filters.year, filters.term, filters.grade]);

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

  const yearInvalid =
    yearDraft.trim().length > 0 && !isValidAcademicYear(yearDraft);
  // 学年草稿合法但尚未提交时（例如只输入了纯年份 2026），等失焦/回车再预检
  const yearPending = yearDraft.trim() !== (committedYear ?? "").trim();
  // 非法或未提交的学年都不发起预检，避免后端 422 和重复上传文件
  const previewReady = !yearInvalid && !yearPending;

  useEffect(() => {
    const request = ++previewRequest.current;
    let active = true;
    setPreview(null);
    setPreviewContext(null);
    setImportResult(null);
    if (open && importFile && previewReady) setError(null);
    setPreviewLoading(Boolean(open && importFile && previewReady));
    if (open && importFile && previewReady) {
      void (async () => {
        try {
          const res = await xbkDataApi.previewImport({
            scope: importScope,
            year: context.year,
            term: context.term,
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
    selectedGrade,
    previewReady,
  ]);

  const canImport =
    open &&
    Boolean(importFile) &&
    !yearInvalid &&
    !yearPending &&
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
        year: context.year,
        term: context.term,
        grade: selectedGrade,
        skip_invalid: skipInvalid,
        file: importFile,
      });
      if (importSession !== session.current) return;
      setImportResult(res);
      showMessage.success(
        `导入完成：处理 ${res.processed} 行（新增 ${res.inserted}，更新 ${res.updated}，无效 ${res.invalid}）`,
      );
      // 回传弹窗实际使用的学年/学期，供上层同步筛选栏后重载
      onSuccess({ year: context.year, term: context.term });
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
          <DialogTitle>导入{meta.label}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface-2 p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
              <div>
                <label
                  htmlFor="xbk-import-year"
                  className="text-xs text-text-tertiary"
                >
                  学年
                </label>
                <Input
                  id="xbk-import-year"
                  className="mt-1 h-[var(--ws-control-height)] text-sm"
                  value={yearDraft}
                  placeholder="如 2026-2027"
                  disabled={importing}
                  onChange={(e) => {
                    if (importLock.current) return;
                    // 只更新草稿：逐字符输入不会触发预检，也不会重复上传文件
                    const next = e.target.value;
                    setYearDraft(next);
                    // 完整格式只提交一次（一次预检）；纯年份等失焦/回车再补全
                    if (FULL_ACADEMIC_YEAR_RE.test(next.trim())) {
                      commitYear(next);
                    }
                  }}
                  onBlur={() => {
                    // 失焦或回车时才提交合法学年（纯 4 位年份自动补全）
                    if (importLock.current) return;
                    const normalized = normalizeAcademicYear(yearDraft);
                    if (normalized) {
                      setYearDraft(normalized);
                      commitYear(normalized);
                    } else if (!yearDraft.trim() && committedYear) {
                      clearPreview();
                      setCommittedYear(undefined);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="xbk-import-term"
                  className="text-xs text-text-tertiary"
                >
                  学期
                </label>
                <Select
                  disabled={importing}
                  value={importTerm}
                  onValueChange={(v) => {
                    if (importLock.current) return;
                    clearPreview();
                    setImportTerm(v);
                  }}
                >
                  <SelectTrigger
                    id="xbk-import-term"
                    className="mt-1 h-[var(--ws-control-height)] w-full text-sm"
                    aria-label="学期"
                  >
                    <SelectValue placeholder="选择学期" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* 学期候选项来自 meta.terms，与筛选栏同源，支持“暑期课程”等自定义学期 */}
                    {termChoices.map((term) => (
                      <SelectItem key={term} value={term}>
                        {term}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label
                  htmlFor="xbk-import-grade"
                  className="text-xs text-text-tertiary"
                >
                  年级
                </label>
                <Select
                  disabled={importing}
                  value={selectedGrade ?? GRADE_UNSET}
                  onValueChange={(v) => {
                    if (importLock.current) return;
                    clearPreview();
                    // 恢复“不设置”：此时不传 grade，由文件中的年级列决定
                    setSelectedGrade(
                      v === GRADE_UNSET
                        ? undefined
                        : (v as (typeof XBK_GRADES)[number]),
                    );
                  }}
                >
                  <SelectTrigger
                    id="xbk-import-grade"
                    className="mt-1 h-[var(--ws-control-height)] w-full text-sm"
                    aria-label="年级"
                  >
                    <SelectValue placeholder="选择年级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GRADE_UNSET}>不设置</SelectItem>
                    {XBK_GRADES.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {yearInvalid ? (
              <Alert variant="warning" className="mt-3">
                <AlertTitle>学年格式不正确</AlertTitle>
                <AlertDescription>
                  请输入 YYYY-YYYY 格式的学年，例如 2026-2027；只填 4 位年份（如
                  2026）会自动补全。
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-text-tertiary">
                文件含“学年 / 学期 / 年级”列时以文件为准，缺失时使用此处填写的内容。
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                disabled={importing}
              >
                <Download className="h-3.5 w-3.5" />
                下载{meta.label}模板
              </Button>
            </div>
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
            <p>• 字段要求：{meta.fields}。</p>
            <p>
              • 年级为可选标签：留空时使用文件中的“年级”列；两者都没有则导入失败。
            </p>
            {meta.notes.map((note) => (
              <p key={note}>• {note}</p>
            ))}
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
