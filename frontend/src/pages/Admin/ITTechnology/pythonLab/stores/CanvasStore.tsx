import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export interface CanvasApi {
  scale: number;
  offsetX: number;
  offsetY: number;
  panMode: boolean;
  followMode: boolean;
  followTick: number;
  interactionFlag: boolean;
  canvasBusy: boolean;
  autoLayout: boolean;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  setOffsetX: React.Dispatch<React.SetStateAction<number>>;
  setOffsetY: React.Dispatch<React.SetStateAction<number>>;
  setPanMode: React.Dispatch<React.SetStateAction<boolean>>;
  setFollowMode: React.Dispatch<React.SetStateAction<boolean>>;
  setFollowTick: React.Dispatch<React.SetStateAction<number>>;
  setInteractionFlag: React.Dispatch<React.SetStateAction<boolean>>;
  setCanvasBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setAutoLayout: React.Dispatch<React.SetStateAction<boolean>>;
}

const CanvasCtx = createContext<CanvasApi | null>(null);

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

export function useCanvas(): CanvasApi {
  const ctx = useContext(CanvasCtx);
  if (!ctx) throw new Error("useCanvas must be used within CanvasProvider");
  return ctx;
}
