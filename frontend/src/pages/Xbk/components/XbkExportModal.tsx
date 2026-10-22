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
import type { XbkGrade } from "../grades";

interface XbkExportModalProps {
  open: boolean;
  /** 由点击的导出按钮决定，弹窗内不再提供切换 */
  exportType: XbkExportType;
  onCancel: () => void;
  filters: {
    year?: string;
    term?: "上学期" | "下学期";
    grade?: XbkGrade;
    class_name?: string;
  };
}

/** 每种导出类型的标题、说明与内容要点 */
const EXPORT_META: Record<
  XbkExportType,
  { label: string; description: string; points: string[] }
> = {
  "course-selection": {
    label: "学生选课表",
    description:
      "按班级分工作表，学生可在表中填写课程代码；用于下发、回收后整册回导。",
    points: [
      "年级/班级筛选生效时只导出匹配班级；用于整册回导前请清除年级和班级筛选。",
      "课程目录工作表包含全部有效课程及其限报人数。",
    ],
  },
  distribution: {
    label: "各班分发表",
    description: "按班级汇总每门课程的选课学生名单，用于班级层面张贴或分发。",
    points: ["支持年级、班级筛选；未筛选时导出全部班级。"],
  },
  "teacher-distribution": {
    label: "教师分发表",
    description:
      "按课程汇总选修学生名单，并附点名签名栏，用于任课教师课堂点名。",
    points: ["每个课程一个工作表，按课程代码排序。"],
  },
};

export const XbkExportModal: React.FC<XbkExportModalProps> = ({
  open,
  exportType,
  onCancel,
  filters,
}) => {
  const meta = EXPORT_META[exportType];
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
          <DialogTitle>导出{meta.label}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
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

          <div className="ws-modal-hint">
            <p>
              • 将按当前筛选导出：{filters.year || "未选择学年"} ·{" "}
              {filters.term || "未选择学期"} · {filters.grade || "全部年级"}
              {filters.class_name
                ? ` · ${formatXbkClassName(filters.grade, filters.class_name)}`
                : ""}
            </p>
            <p>• 学年与学期同时作为数据筛选条件和导出标题，不再重复填写。</p>
            {meta.points.map((point) => (
              <p key={point}>• {point}</p>
            ))}
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
