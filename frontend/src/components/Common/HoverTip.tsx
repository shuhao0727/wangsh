import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HoverTipProps {
  title?: React.ReactNode;
  children: React.ReactElement;
  contentClassName?: string;
}

export const HoverTip: React.FC<HoverTipProps> = ({
  title,
  children,
  contentClassName,
}) => (
  <TooltipProvider delayDuration={120}>
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className={contentClassName}>{title || "-"}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
