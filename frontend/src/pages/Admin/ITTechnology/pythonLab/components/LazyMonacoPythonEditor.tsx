import React, { Suspense } from "react";
import type { MonacoPythonEditorProps } from "./MonacoPythonEditor";
import { Skeleton } from "@/components/ui/skeleton";

const MonacoPythonEditor = React.lazy(() =>
  import("./MonacoPythonEditor").then((module) => ({
    default: module.MonacoPythonEditor,
  })),
);

function MonacoEditorSkeleton() {
  return (
    <div className="flex h-full flex-col gap-2 p-3" role="status" aria-label="正在加载代码编辑器">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/4" />
      <div className="mt-3 flex items-center gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-12" />
      </div>
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/5" />
      <div className="mt-2 flex items-center gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-3 w-1/2" />
      <div className="mt-auto text-xs text-text-tertiary">
        正在加载代码编辑器...
      </div>
    </div>
  );
}

export function LazyMonacoPythonEditor(props: MonacoPythonEditorProps) {
  return (
    <Suspense fallback={<MonacoEditorSkeleton />}>
      <MonacoPythonEditor {...props} />
    </Suspense>
  );
}
