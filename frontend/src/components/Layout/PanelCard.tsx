import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  title?: React.ReactNode;
  extra?: React.ReactNode;
  bodyPadding?: number | string;
};

const PanelCard: React.FC<Props> = ({ children, title, extra, bodyPadding = 12 }) => {
  return (
    <Card className="informatics-card overflow-hidden">
      {title || extra ? (
        <div className="panel-card-header flex items-center justify-between gap-[var(--ws-space-2)] border-b border-[var(--ws-color-border-secondary)] px-[var(--ws-space-2)] py-[var(--ws-space-2)]">
          <div className="min-w-0 flex-1">{title}</div>
          {extra ? <div className="shrink-0">{extra}</div> : null}
        </div>
      ) : null}
      <div
        className={cn("panel-card-body min-h-0 flex-1")}
        style={{ padding: bodyPadding }}
      >
        {children}
      </div>
    </Card>
  );
};

export default PanelCard;
