export interface Experiment {
  name: string;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  data: string;
  tools: string[];
  skills: string[];
  goal: string;
  estimated_time: string;
  deliverables: string;
  steps?: string[];
  code?: string;
  expected_output?: string;
  reflection?: string[];
  download_url?: string;
  data_source?: string;
}

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

export interface ToolItem {
  name: string;
  description: string;
  category: string;
  url?: string;
  difficulty?: "beginner" | "intermediate" | "advanced" | "expert";
  best_for?: string;
  pip_install?: string;
  related_experiments?: string[];
}

export interface ResourceItem {
  title: string;
  type: "book" | "course" | "paper" | "website" | "competition" | "community" | "github";
  description: string;
  url: string;
  rating?: number;
  difficulty_level?: "beginner" | "intermediate" | "advanced" | "expert";
  best_for?: string;
}
