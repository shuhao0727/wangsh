import React from "react";
import type { FlowNodeShape } from "../types";
import { shapeColor } from "../flow/ports";

export function ShapeIcon({ shape }: { shape: FlowNodeShape }) {
  const c = shapeColor(shape);
  if (shape === "start_end") {
    return (
      <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
        <rect x="2" y="3" width="32" height="18" rx="9" stroke={c} strokeWidth="2" />
      </svg>
    );
  }
  if (shape === "process") {
    return (
      <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
        <rect x="3" y="3" width="30" height="18" rx="4" stroke={c} strokeWidth="2" />
      </svg>
    );
  }
  if (shape === "decision") {
    return (
      <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
        <path d="M18 2 L34 12 L18 22 L2 12 Z" stroke={c} strokeWidth="2" />
      </svg>
    );
  }
  if (shape === "io") {
    return (
      <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
        <path d="M10 3 H33 L26 21 H3 Z" stroke={c} strokeWidth="2" fill="none" />
      </svg>
    );
  }
  if (shape === "subroutine") {
    return (
      <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
        <rect x="3" y="3" width="30" height="18" rx="4" stroke={c} strokeWidth="2" />
        <path d="M9 5 V19" stroke={c} strokeWidth="2" />
        <path d="M27 5 V19" stroke={c} strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
      <circle cx="18" cy="12" r="9" stroke={c} strokeWidth="2" />
    </svg>
  );
}
