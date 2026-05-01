import React, { Suspense } from "react";
import type { DiffEditorProps } from "@monaco-editor/react";

const DiffEditor = React.lazy(async () => {
  const [{ configureMonaco }, module] = await Promise.all([
    import("@/lib/monacoSetup"),
    import("@monaco-editor/react"),
  ]);
  configureMonaco();
  return { default: module.DiffEditor };
});

export function LazyMonacoDiffEditor(props: DiffEditorProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-xs text-text-secondary">
          正在加载差异编辑器...
        </div>
      }
    >
      <DiffEditor {...props} />
    </Suspense>
  );
}
