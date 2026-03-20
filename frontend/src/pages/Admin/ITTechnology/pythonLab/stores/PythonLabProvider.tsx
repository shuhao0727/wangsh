import React from "react";
import { CanvasProvider } from "./CanvasStore";
import { FlowProvider } from "./FlowStore";
import { DebugProvider } from "./DebugStore";
import { UIProvider } from "./UIStore";

export function PythonLabProvider({ children }: { children: React.ReactNode }) {
  return (
    <CanvasProvider>
      <FlowProvider>
        <DebugProvider>
          <UIProvider>
            {children}
          </UIProvider>
        </DebugProvider>
      </FlowProvider>
    </CanvasProvider>
  );
}
