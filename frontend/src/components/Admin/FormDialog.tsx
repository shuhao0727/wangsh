import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { AdminDialog } from "./AdminDialog";

type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  visuallyHiddenDescription?: string;
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  /** 提交按钮文案 */
  submitLabel?: string;
  /** 取消按钮文案 */
  cancelLabel?: string;
  /** 提交中状态 */
  submitting?: boolean;
  /** 禁用提交（表单校验未通过等） */
  submitDisabled?: boolean;
  /** 隐藏取消按钮 */
  hideCancel?: boolean;
  /** 额外的 footer 操作（放在取消/提交之间） */
  footerExtra?: React.ReactNode;
  className?: string;
};

/**
 * 标准表单弹窗。统一 footer 布局：取消 | extra | 提交，
 * 提交中自动禁用按钮并显示 loading。
 */
export const FormDialog: React.FC<FormDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  visuallyHiddenDescription,
  children,
  onSubmit,
  submitLabel = "保存",
  cancelLabel = "取消",
  submitting = false,
  submitDisabled = false,
  hideCancel = false,
  footerExtra,
  className,
}) => {
  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      visuallyHiddenDescription={visuallyHiddenDescription}
      className={className}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">{children}</div>

        <div className="flex items-center justify-end gap-2 border-t border-border-secondary pt-4">
          {footerExtra}
          <div className="flex-1" />
          {!hideCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {cancelLabel}
            </Button>
          )}
          <Button type="submit" size="sm" disabled={submitting || submitDisabled}>
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </form>
    </AdminDialog>
  );
};
