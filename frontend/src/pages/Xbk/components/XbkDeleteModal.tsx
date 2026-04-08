import { showMessage } from "@/lib/toast";
import React, { useState } from "react";
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
    year?: number;
    term?: "上学期" | "下学期";
    grade?: "高一" | "高二";
    class_name?: string;
  };
}

export const XbkDeleteModal: React.FC<XbkDeleteModalProps> = ({ open, onCancel, onSuccess, filters }) => {
  const [deleteType, setDeleteType] = useState<"all" | "students" | "courses" | "selections">("all");
  const [deleting, setDeleting] = useState(false);

  const getErrorMsg = (e: any, defaultMsg: string) => {
    const detail = e?.response?.data?.detail;
    if (Array.isArray(detail)) return detail.map((err: any) => err.msg).join("; ");
    if (typeof detail === "object") return JSON.stringify(detail);
    return detail || defaultMsg;
  };

  const handleDelete = async () => {
    if (!filters.year || !filters.term) {
      showMessage.error("删除操作必须先在上方筛选栏选择具体的年份和学期");
      return;
    }
    setDeleting(true);
    try {
      const res = await xbkDataApi.deleteData({
        scope: deleteType,
        year: filters.year,
        term: filters.term,
        grade: filters.grade,
        class_name: filters.class_name,
      });
      showMessage.success(`删除完成，共 ${res.deleted} 条`);
      onSuccess();
    } catch (e: any) {
      showMessage.error(getErrorMsg(e, "删除失败（需要管理员登录）"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>删除数据（彻底删除）</DialogTitle>
          <DialogDescription className="sr-only">
            根据当前筛选条件执行不可恢复的物理删除，请确认删除范围后再提交。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Alert className="border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning-soft)] text-[var(--ws-color-warning)] [&>svg]:text-[var(--ws-color-warning)]">
            <AlertTitle>该操作为物理删除，不可恢复</AlertTitle>
            <AlertDescription>删除“学生名单/选课目录”时会同时删除其关联的选课结果，避免出现孤立数据。</AlertDescription>
          </Alert>

          <div>
            <Label className="ws-modal-label">删除范围</Label>
            <Select value={deleteType} onValueChange={(v) => setDeleteType(v as typeof deleteType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="students">学生名单</SelectItem>
                <SelectItem value="courses">选课目录</SelectItem>
                <SelectItem value="selections">选课结果</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ws-modal-hint">
            将按当前筛选条件删除数据：{filters.year || "全部年份"} · {filters.term || "全部学期"} · {filters.grade || "全部年级"}
            {filters.class_name ? ` · ${formatXbkClassName(filters.grade, filters.class_name)}` : ""}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={deleting}>
            取消
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
