import { showMessage } from "@/lib/toast";
import React, { useEffect, useRef, useState } from "react";
import { xbkDataApi } from "@services";
import type { XbkExportType } from "@services";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatXbkClassName } from "../className";

interface XbkExportModalProps {
  open: boolean;
  onCancel: () => void;
  filters: {
    year?: string;
    term?: "上学期" | "下学期";
    grade?: "高一" | "高二";
    class_name?: string;
  };
}

export const XbkExportModal: React.FC<XbkExportModalProps> = ({
  open,
  onCancel,
  filters,
}) => {
  const [exportType, setExportType] =
    useState<XbkExportType>("course-selection");
  const [exporting, setExporting] = useState(false);

  const exportLock = useRef(false);
  const session = useRef(0);
  const mounted = useRef(false);
  const hasRequiredFilters = Boolean(filters.year && filters.term);

  useEffect(() => {
    mounted.current = true;
    session.current += 1;
    return () => {
      mounted.current = false;
      session.current += 1;
    };
  }, [open, filters.year, filters.term, filters.grade, filters.class_name]);

  const getErrorMsg = async (e: unknown): Promise<string> => {
    const response = (
      e as { response?: { status?: number; data?: unknown } } | null
    )?.response;
    const fallback =
      response?.status === 401
        ? "登录已过期，请重新登录后导出"
        : response?.status === 403
          ? "没有导出权限，请使用管理员账号登录"
          : "导出失败，请检查网络或登录状态后重试";
    try {
      const data =
        response?.data instanceof Blob
          ? JSON.parse(await response.data.text())
          : response?.data;
      const detail = (data as { detail?: unknown } | null)?.detail;
      if (Array.isArray(detail)) {
        return (
          detail
            .map((err) =>
              typeof err?.msg === "string" ? err.msg : JSON.stringify(err),
            )
            .filter(Boolean)
            .join("; ") || fallback
        );
      }
      if (detail && typeof detail === "object") return JSON.stringify(detail);
      return typeof detail === "string" && detail.trim() ? detail : fallback;
    } catch {
      return fallback;
    }
  };

  const handleCancel = () => {
    if (!exportLock.current) onCancel();
  };

  const handleExport = async () => {
    if (exportLock.current || !open) return;
    if (!filters.year || !filters.term) {
      showMessage.warning("请选择具体的学年和学期");
      return;
    }

    exportLock.current = true;
    const exportSession = session.current;
    setExporting(true);
    try {
      const blob = await xbkDataApi.exportTables({
        export_type: exportType,
        year: filters.year,
        term: filters.term,
        grade: filters.grade,
        class_name: filters.class_name,
      });
      if (exportSession !== session.current) return;
      const filename = `xbk_${exportType}_${filters.year}_${filters.term}_${filters.grade || "all"}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showMessage.success("导出成功");
      onCancel();
    } catch (e: unknown) {
      if (exportSession !== session.current) return;
      const message = await getErrorMsg(e);
      if (exportSession !== session.current) return;
      showMessage.error(message);
    } finally {
      exportLock.current = false;
      if (mounted.current) setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleCancel()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>导出数据</DialogTitle>
          <DialogDescription className="sr-only">
            选择导出类型，生成当前学年、学期和班级筛选条件下的 XBK 导出文件。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!hasRequiredFilters ? (
            <Alert variant="warning">
              <AlertTitle>请选择具体的学年和学期</AlertTitle>
              <AlertDescription>
                导出操作必须先在筛选栏选择具体的学年和学期，当前不能提交导出。
              </AlertDescription>
            </Alert>
          ) : null}

          <div>
            <div className="ws-modal-label">导出类型</div>
            <Select
              disabled={exporting}
              value={exportType}
              onValueChange={(value) => {
                if (!exportLock.current) setExportType(value as XbkExportType);
              }}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="course-selection">学生选课表</SelectItem>
                <SelectItem value="teacher-distribution">教师分发表</SelectItem>
                <SelectItem value="distribution">各班分发表</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ws-modal-hint">
            <p>
              • 将按当前筛选导出：{filters.year || "未选择学年"} ·{" "}
              {filters.term || "未选择学期"} · {filters.grade || "全部年级"}
              {filters.class_name
                ? ` · ${formatXbkClassName(filters.grade, filters.class_name)}`
                : ""}
            </p>
            <p>• 学年与学期同时作为数据筛选条件和导出标题，不再重复填写。</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={exporting}
          >
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleExport}
            disabled={exporting || !hasRequiredFilters}
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            导出
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
