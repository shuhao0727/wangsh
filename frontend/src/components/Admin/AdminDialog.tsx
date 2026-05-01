import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type AdminDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** 移动端高度策略：full 全屏，auto 自适应 */
  mobileHeight?: "full" | "auto";
  className?: string;
  /** 当 DialogDescription 不需要视觉展示时，仍向屏幕阅读器提供 */
  visuallyHiddenDescription?: string;
};

/**
 * Admin 统一弹窗。确保每个 Dialog 都有可访问标题和描述，
 * 统一桌面/移动端宽度和高度行为。
 */
export const AdminDialog: React.FC<AdminDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  mobileHeight = "auto",
  className,
  visuallyHiddenDescription,
}) => {
  const resolvedDescription = description || visuallyHiddenDescription;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-y-auto sm:max-w-lg",
          mobileHeight === "full" && "h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[90vh]",
          className,
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {resolvedDescription ? (
            <DialogDescription className={!description ? "sr-only" : undefined}>
              {resolvedDescription}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
};
