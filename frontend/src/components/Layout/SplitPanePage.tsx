import React from "react";

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
  leftWidth?: number;
  gap?: number;
  alignItems?: "start" | "stretch";
  className?: string;
  style?: React.CSSProperties;
};

const SplitPanePage: React.FC<Props> = ({ left, right, leftWidth = 420, gap = 24, alignItems = "start", className, style }) => {
  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `${leftWidth}px minmax(0, 1fr)`,
        gap,
        alignItems,
        ...style,
      }}
    >
      <div style={{ minWidth: 0, minHeight: 0, height: "100%" }}>{left}</div>
      <div style={{ minWidth: 0, minHeight: 0, height: "100%" }}>{right}</div>
    </div>
  );
};

export default SplitPanePage;
