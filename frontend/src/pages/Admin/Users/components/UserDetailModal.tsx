/**
 * 用户详情弹窗组件
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import dayjs from "dayjs";
import { UserDetailModalProps } from "../types";

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="space-y-1 rounded-md border border-border bg-surface-2 p-3">
    <div className="text-xs text-text-tertiary">{label}</div>
    <div className="text-sm text-text-base">{value}</div>
  </div>
);

const UserDetailModal: React.FC<UserDetailModalProps> = ({
  visible,
  currentUser,
  onCancel,
  onEdit,
}) => {
  if (!currentUser) return null;

  return (
    <Dialog open={visible} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>用户详情</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DetailItem label="ID" value={currentUser.id} />
          <DetailItem label="用户名" value={currentUser.username || "无"} />
          <DetailItem label="学号" value={currentUser.student_id || "无"} />
          <DetailItem label="姓名" value={currentUser.full_name || "无"} />
          <DetailItem
            label="学年"
            value={
              currentUser.study_year ? (
                <Badge variant="primarySubtle">
                  {currentUser.study_year}
                </Badge>
              ) : (
                "无"
              )
            }
          />
          <DetailItem
            label="班级"
            value={
              currentUser.class_name ? (
                <Badge variant="success">
                  {currentUser.class_name}
                </Badge>
              ) : (
                "无"
              )
            }
          />
          <DetailItem
            label="角色"
            value={
              <Badge variant="violet">
                {currentUser.role_code}
              </Badge>
            }
          />
          <DetailItem
            label="状态"
            value={
              <Badge
                variant={currentUser.is_active ? "success" : "danger"}
              >
                {currentUser.is_active ? "活跃" : "停用"}
              </Badge>
            }
          />
          <DetailItem
            label="创建时间"
            value={currentUser.created_at ? dayjs(currentUser.created_at).format("YYYY-MM-DD HH:mm") : "无"}
          />
          <DetailItem
            label="更新时间"
            value={currentUser.updated_at ? dayjs(currentUser.updated_at).format("YYYY-MM-DD HH:mm") : "无"}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            关闭
          </Button>
          <Button
            type="button"
            onClick={() => {
              onCancel();
              onEdit(currentUser);
            }}
          >
            编辑
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailModal;
