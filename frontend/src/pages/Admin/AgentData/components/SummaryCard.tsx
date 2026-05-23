import React from "react";

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value, hint }) => (
  <div className="flex items-center gap-3 rounded-lg border border-border-secondary bg-surface px-3 py-2 shadow-sm">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">{icon}</span>
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-medium text-text-tertiary">{label}</span>
        <span className="text-lg font-semibold leading-none tabular-nums text-text-base">{value}</span>
      </div>
      <div className="mt-0.5 truncate text-[11px] text-text-tertiary">{hint}</div>
    </div>
  </div>
);

export default SummaryCard;
