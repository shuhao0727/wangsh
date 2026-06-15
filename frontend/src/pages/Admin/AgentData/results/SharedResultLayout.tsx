import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Download, ChevronDown, FileText } from "lucide-react";
import dayjs from "dayjs";
import { Button } from "@/components/ui/button";
import type { TaskAnalysisDetail } from "../types";

interface ExportOption {
  label: string;
  ext: string;
  action: () => void;
}

interface SharedResultLayoutProps {
  detail: TaskAnalysisDetail;
  onDownload?: () => void;
  exportOptions?: ExportOption[];
  children: React.ReactNode;
  summaryCards?: React.ReactNode;
}

const SharedResultLayout: React.FC<SharedResultLayoutProps> = ({ detail, onDownload, exportOptions, children, summaryCards }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
  <div className="flex h-screen flex-col bg-[radial-gradient(circle_at_top_left,var(--ws-color-primary-muted)_0,transparent_34%),linear-gradient(180deg,var(--ws-color-bg),var(--ws-color-surface))]">
    <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border-secondary bg-surface/85 px-6 py-3 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => window.close()}><ArrowLeft className="mr-1 h-4 w-4" />关闭</Button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight">{detail.title || "任务分析"}</h1>
          <p className="text-xs text-text-tertiary">{detail.created_at ? dayjs(detail.created_at).format("YYYY-MM-DD HH:mm") : ""}</p>
        </div>
      </div>
      <div className="relative flex items-center gap-1" ref={dropdownRef}>
        {exportOptions && exportOptions.length > 0 ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setShowDropdown((v) => !v)} className="bg-surface">
              <Download className="mr-1 h-4 w-4" />导出 <ChevronDown className="ml-0.5 h-3 w-3" />
            </Button>
            {showDropdown && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-border bg-surface shadow-xl py-1 animate-in fade-in zoom-in-95 duration-150">
                {exportOptions.map((opt) => (
                  <button
                    key={opt.label}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-base hover:bg-surface-2 transition-colors"
                    onClick={() => { opt.action(); setShowDropdown(false); }}
                  >
                    <FileText className="h-3.5 w-3.5 text-text-tertiary" />
                    {opt.label} <span className="ml-auto text-xs text-text-tertiary">.{opt.ext}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : onDownload ? (
          <Button variant="ghost" size="sm" onClick={onDownload}><Download className="mr-1 h-4 w-4" />下载</Button>
        ) : null}
      </div>
    </header>

    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1480px] px-6 py-8 lg:px-10">
        {detail.task_sheet ? <TaskSheetCollapsible taskSheet={detail.task_sheet} /> : (
          <div className="mb-4 rounded-lg border border-dashed border-border-secondary bg-surface-2/60 px-4 py-3 text-xs text-text-tertiary text-center">
            未提供任务单内容
          </div>
        )}
        {summaryCards && (
          <div className="mb-6">
            {summaryCards}
          </div>
        )}
        {children}
      </div>
    </div>
  </div>
  );
};

const TaskSheetCollapsible: React.FC<{ taskSheet: string }> = ({ taskSheet }) => (
  <details className="mb-5 rounded-lg border border-border-secondary bg-surface-2 px-4 py-2.5">
    <summary className="cursor-pointer select-none text-xs font-medium text-text-tertiary hover:text-text-secondary">
      任务单<span className="ml-2 font-normal text-text-tertiary/60">{taskSheet.slice(0, 60)}{taskSheet.length > 60 ? "..." : ""}</span>
    </summary>
    <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-base">{taskSheet}</div>
  </details>
);

export default SharedResultLayout;
