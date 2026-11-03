export type { Experiment, ToolItem, ResourceItem } from "../../shared-types";

export interface AgentLearningProgress {
  stages: {
    stage: number;
    name: string;
    completed: number;
    total: number;
    status: "not_started" | "in_progress" | "completed";
  }[];
  overall_progress: number;
  total_completed: number;
  total_items: number;
  notes?: string;
}

// ─── Tool & Resource interfaces ──────────────────────────────────────────
