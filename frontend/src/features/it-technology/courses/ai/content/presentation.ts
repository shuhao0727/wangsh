export const CATEGORY_LABELS: Record<string, string> = {
  "llm-platforms": "LLM 平台",
  "dev-frameworks": "开发框架",
  "vector-dbs": "向量数据库",
  "image-gen": "图像生成",
  "agent-frameworks": "Agent 框架",
  evaluation: "评估与监控",
  "cloud-platforms": "云平台",
};

export const DIFFICULTY_LABELS: Record<string, { label: string; variant: string }> = {
  beginner: { label: "入门", variant: "success" },
  intermediate: { label: "中级", variant: "warning" },
  advanced: { label: "高级", variant: "danger" },
  expert: { label: "专家", variant: "info" },
};
// Mindmap content now in chapters/mindmap.md (loaded via ?raw import above)

export const RESOURCE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  book: { label: "书籍", color: "var(--ws-color-primary)" },
  course: { label: "课程", color: "var(--ws-color-success)" },
  paper: { label: "论文", color: "var(--ws-color-purple)" },
  website: { label: "网站", color: "var(--ws-color-info)" },
  competition: { label: "竞赛", color: "var(--ws-color-warning)" },
  community: { label: "社区", color: "var(--ws-tag-orange)" },
  github: { label: "GitHub", color: "var(--ws-color-purple)" },
};
