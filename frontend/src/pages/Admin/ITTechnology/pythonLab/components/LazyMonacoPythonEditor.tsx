import React, { Suspense } from "react";
import type { MonacoPythonEditorProps } from "./MonacoPythonEditor";

const MonacoPythonEditor = React.lazy(() =>
  import("./MonacoPythonEditor").then((module) => ({
    default: module.MonacoPythonEditor,
  })),
);

function MonacoEditorFallback({ fontSize = 14 }: { fontSize?: number }) {
  return (
    <div className="flex h-full items-center justify-center text-xs text-text-secondary">
      正在加载编辑器...
      <span className="sr-only">字体大小 {fontSize}</span>
    </div>
  );
}

export function LazyMonacoPythonEditor(props: MonacoPythonEditorProps) {
  return (
    <Suspense fallback={<MonacoEditorFallback fontSize={props.fontSize} />}>
      <MonacoPythonEditor {...props} />
    </Suspense>
  );
}
