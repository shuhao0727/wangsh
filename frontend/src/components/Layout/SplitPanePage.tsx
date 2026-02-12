import React from "react";

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
  leftWidth?: number;
  gap?: number;
};

const SplitPanePage: React.FC<Props> = ({ left, right, leftWidth = 420, gap = 24 }) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `${leftWidth}px minmax(0, 1fr)`,
        gap,
        alignItems: "start",
      }}
    >
      <div style={{ minWidth: 0 }}>{left}</div>
      <div style={{ minWidth: 0 }}>{right}</div>
    </div>
  );
};

export default SplitPanePage;

