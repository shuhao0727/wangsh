import type { Experiment } from "../types";
import { beginnerExperiments } from "./beginner";
import { intermediateExperiments } from "./intermediate";
import { advancedExperiments } from "./advanced";
import { expertExperiments } from "./expert";

export const EXPERIMENTS: Record<string, Experiment[]> = {
  beginner: beginnerExperiments,
  intermediate: intermediateExperiments,
  advanced: advancedExperiments,
  expert: expertExperiments,
};
