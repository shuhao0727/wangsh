import React, { useState, useMemo } from "react";
import { CanvasCtx, type CanvasApi } from "./CanvasContext";

export function CanvasProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [panMode, setPanMode] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [followTick, setFollowTick] = useState(0);
  const [interactionFlag, setInteractionFlag] = useState(false);
  const [canvasBusy, setCanvasBusy] = useState(false);
  const [autoLayout, setAutoLayout] = useState(false);

  const api = useMemo<CanvasApi>(
    () => ({ scale, offsetX, offsetY, panMode, followMode, followTick, interactionFlag, canvasBusy, autoLayout, setScale, setOffsetX, setOffsetY, setPanMode, setFollowMode, setFollowTick, setInteractionFlag, setCanvasBusy, setAutoLayout }),
    [scale, offsetX, offsetY, panMode, followMode, followTick, interactionFlag, canvasBusy, autoLayout]
  );

  return <CanvasCtx.Provider value={api}>{children}</CanvasCtx.Provider>;
}
