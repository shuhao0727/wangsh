export const DIFFICULTY_LABELS: Record<string, { label: string; variant: string }> = {
  beginner: { label: "入门", variant: "success" },
  intermediate: { label: "中级", variant: "warning" },
  advanced: { label: "高级", variant: "danger" },
  expert: { label: "专家", variant: "info" },
};

export const RESOURCE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  book: { label: "书籍", color: "var(--ws-color-primary)" },
  course: { label: "课程", color: "var(--ws-color-success)" },
  paper: { label: "论文", color: "var(--ws-color-purple, #8B5CF6)" },
  website: { label: "网站", color: "var(--ws-color-info, #3B82F6)" },
  competition: { label: "竞赛", color: "var(--ws-color-warning)" },
  community: { label: "社区", color: "var(--ws-color-info, #3B82F6)" },
  github: { label: "GitHub", color: "#24292E" },
};

// Tab label helpers
export const AGENT_TOOL_CATEGORY_LABELS: Record<string, string> = {
  "核心框架": "核心框架",
  "开发工具": "开发工具",
  "MCP生态": "MCP 生态",
  "向量数据库": "向量数据库",
  "可观测性": "可观测性",
};
