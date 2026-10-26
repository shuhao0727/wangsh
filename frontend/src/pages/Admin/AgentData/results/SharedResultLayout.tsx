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
  showTaskSheet?: boolean;
}

const SharedResultLayout: React.FC<SharedResultLayoutProps> = ({ detail, onDownload, exportOptions, children, summaryCards, showTaskSheet = true }) => {
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
  <div className="ws-task-result-shell flex h-screen flex-col">
    <header className="ws-task-result-header sticky top-0 z-10 flex shrink-0 items-center justify-between px-6">
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
              <div className="ws-task-result-export-menu absolute right-0 top-full z-50 mt-1 min-w-[140px] border border-border bg-surface py-1 animate-in fade-in zoom-in-95 duration-150">
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
      <div className="ws-task-result-content">
        {showTaskSheet && (detail.task_sheet ? <TaskSheetCollapsible taskSheet={detail.task_sheet} /> : (
          <div className="ws-task-result-task-sheet mb-4 border border-dashed bg-surface-2/60 px-4 py-3 text-xs text-text-tertiary text-center">
            未提供任务单内容
          </div>
        ))}
        {summaryCards && (
          <div className="ws-task-result-summary mb-5">
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
  <details className="ws-task-result-task-sheet mb-5 border bg-surface-2 px-4 py-2.5">
    <summary className="cursor-pointer select-none text-xs font-medium text-text-tertiary hover:text-text-secondary">
      任务单<span className="ml-2 font-normal text-text-tertiary/60">{taskSheet.slice(0, 60)}{taskSheet.length > 60 ? "..." : ""}</span>
    </summary>
    <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-base">{taskSheet}</div>
  </details>
);

export default SharedResultLayout;
