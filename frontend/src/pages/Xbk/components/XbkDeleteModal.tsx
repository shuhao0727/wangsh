import { showMessage } from "@/lib/toast";
import React, { useEffect, useRef, useState } from "react";
import { xbkDataApi } from "@services";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatXbkClassName } from "../className";

interface XbkDeleteModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  filters: {
    year?: string;
    term?: "上学期" | "下学期";
    grade?: "高一" | "高二";
    class_name?: string;
  };
}

export const XbkDeleteModal: React.FC<XbkDeleteModalProps> = ({
  open,
  onCancel,
  onSuccess,
  filters,
}) => {
  const [deleteType, setDeleteType] = useState<
    "all" | "students" | "courses" | "selections"
  >("all");
  const [deleting, setDeleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteLock = useRef(false);
  const session = useRef(0);
  const hasClassFilter = Boolean(filters.class_name);
  const blockedScope =
    hasClassFilter && (deleteType === "all" || deleteType === "courses");
  const hasRequiredFilters = Boolean(filters.year && filters.term);
  const canDelete =
    open && hasRequiredFilters && !blockedScope && !deleting && !completed;

  useEffect(() => {
    session.current += 1;
    setCompleted(false);
    setError(null);
    return () => {
      session.current += 1;
    };
  }, [open]);

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

  const handleCancel = () => {
    if (!deleteLock.current) onCancel();
  };

  const handleDelete = async () => {
    if (deleteLock.current || !canDelete) return;
    // Guard the interval before React commits the disabled state.
    deleteLock.current = true;
    const deleteSession = session.current;
    setError(null);
    setDeleting(true);
    try {
      const res = await xbkDataApi.deleteData({
        scope: deleteType,
        year: filters.year,
        term: filters.term,
        grade: filters.grade,
        class_name: filters.class_name,
      });
      if (deleteSession !== session.current) return;
      setCompleted(true);
      showMessage.success(`删除完成，共 ${res.deleted} 条`);
      onSuccess();
    } catch (e: unknown) {
      if (deleteSession !== session.current) return;
      const message = getErrorMsg(e, "删除失败，请检查网络或登录状态后重试");
      setError(message);
      showMessage.error(message);
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleCancel()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>删除数据（彻底删除）</DialogTitle>
          <DialogDescription className="sr-only">
            根据当前筛选条件执行不可恢复的物理删除，请确认删除范围后再提交。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Alert className="border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning-soft)] text-[var(--ws-color-warning)] [&>svg]:text-[var(--ws-color-warning)]">
            <AlertTitle>该操作为物理删除，不可恢复</AlertTitle>
            <AlertDescription>
              删除“学生名单/选课目录”时会同时删除其关联的选课结果，避免出现孤立数据。
            </AlertDescription>
          </Alert>

          {hasClassFilter ? (
            <Alert variant="warning">
              <AlertTitle>班级筛选不能用于删除共享课程</AlertTitle>
              <AlertDescription>
                课程目录为年级共享数据。按班级删除“全部”或“选课目录”会影响其他班级，因此这两个范围已禁用。
                当前删除范围不会自动更改；请手动选择“学生名单”或“选课结果”。如需删除共享课程，请先取消本弹窗并清除班级筛选，再确认范围。
              </AlertDescription>
            </Alert>
          ) : null}

          {!hasRequiredFilters ? (
            <Alert variant="warning">
              <AlertTitle>请选择具体的学年和学期</AlertTitle>
              <AlertDescription>
                删除操作必须先在筛选栏选择具体的学年和学期；当前不能提交删除。
              </AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>删除未完成</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {completed ? (
            <Alert>
              <AlertTitle>本次删除已完成</AlertTitle>
              <AlertDescription>
                如需再次删除，请关闭弹窗并重新确认筛选条件和删除范围。
              </AlertDescription>
            </Alert>
          ) : null}

          <div>
            <Label htmlFor="xbk-delete-scope" className="ws-modal-label">
              删除范围
            </Label>
            <Select
              disabled={deleting || completed}
              value={deleteType}
              onValueChange={(v) => {
                if (deleteLock.current || completed) return;
                if (hasClassFilter && (v === "all" || v === "courses")) return;
                setDeleteType(v as typeof deleteType);
                setError(null);
              }}
            >
              <SelectTrigger
                id="xbk-delete-scope"
                className="w-full h-8 text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" disabled={hasClassFilter}>
                  全部
                </SelectItem>
                <SelectItem value="students">学生名单</SelectItem>
                <SelectItem value="courses" disabled={hasClassFilter}>
                  选课目录
                </SelectItem>
                <SelectItem value="selections">选课结果</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ws-modal-hint">
            将按当前筛选条件删除数据：{filters.year || "未选择学年"} ·{" "}
            {filters.term || "未选择学期"} · {filters.grade || "全部年级"}
            {filters.class_name
              ? ` · ${formatXbkClassName(filters.grade, filters.class_name)}`
              : ""}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={deleting}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={!canDelete}
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
