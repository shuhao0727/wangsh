import type { AgentLearningProgress } from "./types";

// Tab 6: 默认进度数据（fallback）
export const defaultProgress: AgentLearningProgress = {
  stages: [
    { stage: 1, name: "Agent 基础概念", completed: 0, total: 15, status: "not_started" },
    { stage: 2, name: "单 Agent 开发", completed: 0, total: 16, status: "not_started" },
    { stage: 3, name: "多 Agent 系统", completed: 0, total: 17, status: "not_started" },
    { stage: 4, name: "生产级 Agent", completed: 0, total: 16, status: "not_started" },
    { stage: 5, name: "前沿探索", completed: 0, total: 17, status: "not_started" },
  ],
  overall_progress: 0,
  total_completed: 0,
  total_items: 81,
};
