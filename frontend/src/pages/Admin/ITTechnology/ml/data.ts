/** 机器学习学习板块类型定义与数据入口。 */
export type StageStatus = "pending" | "in-progress" | "completed";

export interface RoadmapStage {
  id: string;
  name: string;
  duration: string;
  topics: string[];
  milestones: string[];
  status: StageStatus;
  color?: string;
}

export interface KnowledgeNode {
  id: string;
  label: string;
  children?: KnowledgeNode[];
  description?: string;
}

export interface Experiment {
  name: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  data: string;
  tools: string[];
  skills: string[];
  goal?: string;
  steps?: string[];
  code?: string;
  expectedOutput?: string;
  datasetUrl?: string;
  notebookUrl?: string;
  estimatedMinutes?: number;
}

export interface ToolItem {
  name: string;
  description: string;
  category: string;
  url?: string;
  gettingStarted?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  pricing?: string;
}

export interface ResourceItem {
  title: string;
  type: "book" | "course" | "github" | "competition" | "video" | "paper" | "blog";
  description: string;
  url: string;
  rating?: number;
  author?: string;
  language?: "zh" | "en";
}

export { ROADMAP_STAGES } from "./roadmap";
export { KNOWLEDGE_TREE } from "./knowledge";
export { EXPERIMENTS } from "./experiments";
export { TOOLS_DATA, CATEGORY_LABELS, DIFFICULTY_LABELS } from "./tools";
export { RESOURCES_DATA, RESOURCE_TYPE_CONFIG } from "./resources";
