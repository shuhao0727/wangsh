import React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Props = {
  open: boolean;
  toc: any[];
  onClose: () => void;
  onJump: (it: any) => void;
};

export default function TypstTocDrawer({ open, toc, onClose, onJump }: Props) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-[min(86vw,420px)] sm:max-w-[420px]">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle>目录</SheetTitle>
        </SheetHeader>
        <div className="px-6 py-4">
          {toc?.length ? (
            <div className="flex flex-col gap-2">
              {toc.map((it: any, idx: number) => {
                const indentLevel = Math.max(0, (it.level || 1) - 1);
                return (
                  <div key={idx} style={{ paddingLeft: `calc(${indentLevel} * var(--ws-space-2))` }}>
                    <Button variant="link" className="h-auto p-0" onClick={() => onJump(it)}>
                      {it.text}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="text-sm text-text-secondary">暂无目录（可能没有 heading 或未成功编译）</span>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
