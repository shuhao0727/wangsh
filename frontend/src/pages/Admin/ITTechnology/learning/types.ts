export type LearningModuleKey = "ml" | "ai" | "agents";

export type LearningSectionKey =
  | "roadmap"
  | "knowledge"
  | "experiments"
  | "tools"
  | "resources"
  | "prompt"
  | "ethics"
  | "frameworks"
  | "core-tech"
  | "raw";

export type LearningStageStatus = "pending" | "in-progress" | "completed";

export interface LearningContentItem<TContent = Record<string, unknown>> {
  id?: number;
  module_key: LearningModuleKey;
  section_key: LearningSectionKey;
  item_key: string;
  title: string;
  summary?: string | null;
  content: TContent;
  tags?: string[];
  difficulty?: string | null;
  sort_order?: number;
  enabled?: boolean;
  source_type?: "built-in" | "database" | "admin";
}

export interface LearningProgressState {
  stageStatus: Record<string, LearningStageStatus>;
  completedItems: Record<string, boolean>;
  favoriteItems: Record<string, boolean>;
  notesByItem: Record<string, string>;
  moduleNotes: string;
  updatedAt?: string;
}

export const createEmptyLearningProgress = (): LearningProgressState => ({
  stageStatus: {},
  completedItems: {},
  favoriteItems: {},
  notesByItem: {},
  moduleNotes: "",
});

export interface LearningBookReference {
  title: string;
  source?: string;
  note: string;
  url?: string;
}

export interface LearningBookExperiment {
  title: string;
  goal: string;
  steps: string[];
  output: string;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
}

export interface LearningBookChapter {
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  goals: string[];
  markdown: string;
  checklist: string[];
  experiments: LearningBookExperiment[];
  glossary: { term: string; definition: string }[];
  references: LearningBookReference[];
}

export interface LearningBook {
  moduleKey: LearningModuleKey;
  title: string;
  subtitle: string;
  description: string;
  audience: string;
  outcomes: string[];
  chapters: LearningBookChapter[];
}
