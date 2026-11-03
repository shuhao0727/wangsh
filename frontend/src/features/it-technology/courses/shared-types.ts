/**
 * 课程内容共享类型。
 *
 * `ai/` 与 `agents/` 两个学习板块的实验、工具与资源结构完全一致，此前各自
 * 维护一份副本，改动容易只改一边。`ml/` 的 Experiment 有额外字段（数据集、
 * notebook 等），保持独立定义，不并入这里。
 */

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

/** 学习板块页签：三个课程页面共用同一套主/次页签取值。 */
export type TabKey = "book" | "knowledge" | "experiments" | "tools";
export type SectionKey = "steps" | "code" | "data" | "reflection";
