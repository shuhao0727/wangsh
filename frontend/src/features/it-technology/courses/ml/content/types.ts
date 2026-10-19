/** 机器学习学习板块内置内容。 */

export type StageStatus = "pending" | "in-progress" | "completed";
export interface RoadmapStage {
  id: string;
  name: string;
  duration: string;
  topics: string[];
  milestones: string[];
  status: StageStatus;
  prerequisites?: string[];
  skills_gained?: string[];
  color?: string;
}

export interface KnowledgeNode {
  id: string;
  label: string;
  children?: KnowledgeNode[];
  description?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  estimated_hours?: number;
  related_chapters?: string[];
}

export interface Experiment {
  name: string;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  data: string;
  tools: string[];
  skills: string[];
  goal: string;
  estimated_time?: string;
  deliverables?: string;
  steps?: string[];
  code?: string;
  expected_output?: string;
  reflection?: string[];
  download_url?: string;
  data_source?: string;
  dataset_url?: string;
  dataset_format?: string;
  answer_format?: string;
  estimatedMinutes?: number;
  notebookUrl?: string;
}

export interface ToolItem {
  name: string;
  description: string;
  category: string;
  url?: string;
  difficulty?: "beginner" | "intermediate" | "advanced" | "expert";
  best_for?: string;
  pip_install?: string;
  related_experiments?: string[];
  gettingStarted?: string;
  pricing?: string;
}

export interface ResourceItem {
  title: string;
  type: "book" | "course" | "paper" | "website" | "competition" | "community" | "github" | "video" | "blog";
  description: string;
  url: string;
  rating?: number;
  difficulty_level?: "beginner" | "intermediate" | "advanced" | "expert";
  best_for?: string;
  author?: string;
  language?: string;
}
