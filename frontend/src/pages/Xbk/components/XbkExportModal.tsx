import { showMessage } from "@/lib/toast";
import React, { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { formatXbkClassName } from "../className";

interface XbkExportModalProps {
  open: boolean;
  onCancel: () => void;
  filters: {
    year?: number;
    term?: "上学期" | "下学期";
    grade?: "高一" | "高二";
    class_name?: string;
  };
}

export const XbkExportModal: React.FC<XbkExportModalProps> = ({ open, onCancel, filters }) => {
  const [exportType, setExportType] = useState<XbkExportType>("course-selection");
  const [yearStart, setYearStart] = useState<number | undefined>(undefined);
  const [yearEnd, setYearEnd] = useState<number | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  const getErrorMsg = (e: any, defaultMsg: string) => {
    const detail = e?.response?.data?.detail;
    if (Array.isArray(detail)) return detail.map((err: any) => err.msg).join("; ");
    if (typeof detail === "object") return JSON.stringify(detail);
    return detail || defaultMsg;
  };

  const handleExport = async () => {
    if (!yearStart || !yearEnd) {
      showMessage.warning("请填写学年（起止年份）");
      return;
    }
    if (!Number.isInteger(yearStart) || !Number.isInteger(yearEnd)) {
      showMessage.warning("学年必须为整数年份");
      return;
    }
    if (yearStart < 2000 || yearStart > 2100 || yearEnd < 2000 || yearEnd > 2100) {
      showMessage.warning("学年年份范围不正确（建议填写4位年份，如 2025-2026）");
      return;
    }
    if (yearEnd <= yearStart) {
      showMessage.warning("学年结束年份必须大于开始年份");
      return;
    }
    if (exportType === "distribution" && !filters.grade) {
      showMessage.warning("请先选择年级（用于各班分发表表头）");
      return;
    }

    setExporting(true);
    try {
      const blob = await xbkDataApi.exportTables({
        export_type: exportType,
        year: filters.year || 2026,
        term: filters.term || "上学期",
        grade: filters.grade,
        class_name: filters.class_name,
        yearStart,
        yearEnd,
      });
      const filename = `xbk_${exportType}_${filters.year || "all"}_${filters.term || "all"}_${filters.grade || "all"}.xlsx`;
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
    } catch (e: any) {
      showMessage.error(getErrorMsg(e, "导出失败（需要管理员登录）"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>导出数据</DialogTitle>
          <DialogDescription className="sr-only">
            选择导出类型和学年范围，生成当前筛选条件下的 XBK 导出文件。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="ws-modal-label">导出类型</div>
            <Select value={exportType} onValueChange={(v) => setExportType(v as XbkExportType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="course-selection">学生选课表</SelectItem>
                <SelectItem value="teacher-distribution">教师分发表</SelectItem>
                <SelectItem value="distribution">各班分发表</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="ws-modal-label">学年 (如 2025-2026)</div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="起"
                min={2000}
                max={2100}
                step={1}
                value={yearStart ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setYearStart(v ? Number(v) : undefined);
                }}
              />
              <span>-</span>
              <Input
                type="number"
                placeholder="止"
                min={2000}
                max={2100}
                step={1}
                value={yearEnd ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setYearEnd(v ? Number(v) : undefined);
                }}
              />
            </div>
          </div>

          <div className="ws-modal-hint">
            <p>• 将按当前筛选导出：{filters.year || "全部年份"} · {filters.term || "全部学期"} · {filters.grade || "全部年级"}{filters.class_name ? ` · ${formatXbkClassName(filters.grade, filters.class_name)}` : ""}</p>
            <p>• 学期将按当前筛选的学期写入导出文件标题。</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={exporting}>
            取消
          </Button>
          <Button type="button" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            导出
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
