/** 人工智能探索内置内容。 */

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


/** 人工智能实验项目（面向高中生） */
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
