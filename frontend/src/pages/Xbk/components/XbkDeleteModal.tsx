import React, { useState } from "react";
import { Modal, Select, Alert, Space, message } from "antd";
import { xbkDataApi } from "@services";

const { Option } = Select;

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
      message.error("删除操作必须先在上方筛选栏选择具体的年份和学期");
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
      message.success(`删除完成，共 ${res.deleted} 条`);
      onSuccess();
    } catch (e: any) {
      message.error(getErrorMsg(e, "删除失败（需要管理员登录）"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      title="删除数据（彻底删除）"
      open={open}
      onCancel={onCancel}
      onOk={handleDelete}
      confirmLoading={deleting}
      okButtonProps={{ danger: true }}
      okText="确认删除"
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Alert
          type="warning"
          showIcon
          message="该操作为物理删除，不可恢复"
          description="删除“学生名单/选课目录”时会同时删除其关联的选课结果，避免出现孤立数据。"
        />
        
        <div>
          <div className="ws-modal-label">删除范围</div>
          <Select value={deleteType} style={{ width: "100%" }} onChange={setDeleteType}>
            <Option value="all">全部</Option>
            <Option value="students">学生名单</Option>
            <Option value="courses">选课目录</Option>
            <Option value="selections">选课结果</Option>
          </Select>
        </div>

        <div className="ws-modal-hint">
          将按当前筛选条件删除数据：{filters.year || "全部年份"} · {filters.term || "全部学期"} · {filters.grade || "全部年级"}
        </div>
      </Space>
    </Modal>
  );
};
