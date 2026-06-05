import React from "react";

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value, hint }) => (
  <div className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/90 px-5 py-4 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-primary/10 transition-transform group-hover:scale-105">{icon}</span>
    <div className="min-w-0 flex-1">
      <div className="text-xl font-bold leading-none tabular-nums text-text-base">{value}</div>
      <div className="mt-1 text-xs font-medium text-text-secondary">{label}</div>
      <div className="mt-0.5 truncate text-[11px] text-text-tertiary">{hint}</div>
    </div>
  </div>
);

export default SummaryCard;
