import React from "react";
import { TabsContent } from "@/components/ui/tabs";

// Docker attach is a live stream: unmounting on a tab switch loses prompts and
// output. Keep backend terminals connected and measurable, but never focusable
// or exposed to assistive technology while the debugger/reference tab is active.
export function TerminalTabContent({ active, keepConnected, children }: {
  active: boolean;
  keepConnected: boolean;
  children: React.ReactNode;
}) {
  return (
    <TabsContent
      value="terminal"
      forceMount={keepConnected ? true : undefined}
      aria-hidden={!active}
      inert={!active}
      className={`absolute inset-0 mt-0 min-h-0 overflow-hidden p-1 ${active ? "" : "invisible pointer-events-none"}`}
    >
      {children}
    </TabsContent>
  );
}
