import React from "react";

const CollapsibleSection: React.FC<{
  title: string; icon?: string; badge?: string; accent?: "warning" | "primary";
  defaultExpanded?: boolean; children: React.ReactNode;
}> = ({ title, icon, badge, accent = "primary", defaultExpanded = true, children }) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const accentBorder = accent === "warning" ? "border-[var(--ws-color-warning)]/20" : "border-primary/20";
  const accentBg = accent === "warning" ? "bg-[var(--ws-color-warning)]/8" : "bg-primary/5";
  const accentText = accent === "warning" ? "text-[var(--ws-color-warning)]" : "text-primary";
  return (
    <section className={`rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] border px-5 py-4 ${accentBorder}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-lg">{icon}</span>}
          <h2 className="text-base font-semibold text-text-base">{title}</h2>
          {badge && <span className={`rounded-full ${accentBg} px-2 py-0.5 text-xs font-medium ${accentText}`}>{badge}</span>}
        </div>
        <button type="button" onClick={() => setExpanded((v) => !v)} className="rounded-md px-2 py-1 text-xs text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-secondary">
          {expanded ? "收起 ▲" : "展开 ▼"}
        </button>
      </div>
      {expanded && children}
    </section>
  );
};

export default CollapsibleSection;
