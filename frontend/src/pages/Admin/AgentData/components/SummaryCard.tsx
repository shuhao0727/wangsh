import React from "react";

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value, hint }) => (
  <div className="flex items-center gap-3 rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-border/30 px-5 py-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:border-primary/20">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">{icon}</span>
    <div className="min-w-0 flex-1">
      <div className="text-xl font-bold leading-none tabular-nums text-text-base">{value}</div>
      <div className="mt-1 text-xs font-medium text-text-secondary">{label}</div>
      <div className="mt-0.5 truncate text-[11px] text-text-tertiary">{hint}</div>
    </div>
  </div>
);

export default SummaryCard;
