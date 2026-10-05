import React from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  maxWidth?: number;
  /** 自定义 className（覆盖默认间距） */
  className?: string;
  scrollable?: boolean;
};

const AdminPage: React.FC<Props> = ({
  children,
  maxWidth,
  className,
  scrollable = true,
}) => {
  return (
    <div
      className={cn(
        "ws-admin-page",
        "w-full flex-1 mx-auto min-h-0 h-full flex flex-col",
        "p-panel-padding",
        scrollable ? "overflow-auto" : "overflow-hidden",
        className
      )}
      style={{
        maxWidth: maxWidth ? maxWidth : "var(--ws-shell-max-width)",
      }}
    >
      {children}
    </div>
  );
};

export default AdminPage;
