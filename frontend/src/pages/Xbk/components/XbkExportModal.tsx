import React, { useState } from "react";
import { Modal, Select, InputNumber, Space, message } from "antd";
import { xbkDataApi } from "@services";
import type { XbkExportType } from "@services";

const { Option } = Select;

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
      message.warning("请填写学年（起止年份）");
      return;
    }
    if (!Number.isInteger(yearStart) || !Number.isInteger(yearEnd)) {
      message.warning("学年必须为整数年份");
      return;
    }
    if (yearStart < 2000 || yearStart > 2100 || yearEnd < 2000 || yearEnd > 2100) {
      message.warning("学年年份范围不正确（建议填写4位年份，如 2025-2026）");
      return;
    }
    if (yearEnd <= yearStart) {
      message.warning("学年结束年份必须大于开始年份");
      return;
    }
    if (exportType === "distribution" && !filters.grade) {
      message.warning("请先选择年级（用于各班分发表表头）");
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
      message.success("导出成功");
      onCancel();
    } catch (e: any) {
      message.error(getErrorMsg(e, "导出失败（需要管理员登录）"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      title="导出数据"
      open={open}
      confirmLoading={exporting}
      onCancel={onCancel}
      onOk={handleExport}
      okText="导出"
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <div>
          <div style={{ marginBottom: 8 }}>导出类型</div>
          <Select value={exportType} style={{ width: "100%" }} onChange={setExportType}>
            <Option value="course-selection">学生选课表</Option>
            <Option value="teacher-distribution">教师分发表</Option>
            <Option value="distribution">各班分发表</Option>
          </Select>
        </div>
        
        <div>
          <div style={{ marginBottom: 8 }}>学年 (如 2025-2026)</div>
          <Space>
            <InputNumber
              placeholder="起"
              style={{ width: 120 }}
              value={yearStart}
              min={2000}
              max={2100}
              precision={0}
              onChange={(v) => setYearStart(typeof v === "number" ? v : undefined)}
            />
            <span>-</span>
            <InputNumber
              placeholder="止"
              style={{ width: 120 }}
              value={yearEnd}
              min={2000}
              max={2100}
              precision={0}
              onChange={(v) => setYearEnd(typeof v === "number" ? v : undefined)}
            />
          </Space>
        </div>

        <div style={{ color: "var(--ws-color-text-secondary)", fontSize: "var(--ws-text-sm)" }}>
          <p>• 将按当前筛选导出：{filters.year || "全部年份"} · {filters.term || "全部学期"} · {filters.grade || "全部年级"}{filters.class_name ? ` · ${filters.class_name}` : ""}</p>
          <p>• 学期将按当前筛选的学期写入导出文件标题。</p>
        </div>
      </Space>
    </Modal>
  );
};
