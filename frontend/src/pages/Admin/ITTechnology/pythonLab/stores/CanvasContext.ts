import { createContext, useContext } from "react";
import type React from "react";

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

export const CanvasCtx = createContext<CanvasApi | null>(null);

export function useCanvas(): CanvasApi {
  const ctx = useContext(CanvasCtx);
  if (!ctx) throw new Error("useCanvas must be used within CanvasProvider");
  return ctx;
}
