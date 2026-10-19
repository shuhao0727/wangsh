export const CATEGORY_LABELS: Record<string, string> = {
  "python-libs": "Python 核心库",
  "ml-frameworks": "ML 框架",
  "data-tools": "数据工具",
  visualization: "可视化",
  deployment: "模型部署",
  "experiment-tracking": "实验追踪",
  "llm-tools": "LLM 工具",
  "cloud-platforms": "云平台",
  // 保留旧兼容键
  "dev-env": "开发环境",
  "data-processing": "数据处理",
  "ml-lib": "经典 ML 库",
  "dl-framework": "深度学习框架",
  "llm-ecosystem": "大模型生态",
  inference: "推理与部署",
  "vector-db": "向量数据库",
  mlops: "MLOps",
};

export const DIFFICULTY_LABELS: Record<string, { label: string; variant: string }> = {
  beginner: { label: "入门", variant: "success" },
  intermediate: { label: "中级", variant: "warning" },
  advanced: { label: "高级", variant: "danger" },
  expert: { label: "专家", variant: "info" },
};

export const RESOURCE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  book: { label: "书籍", color: "var(--ws-color-primary)" },
  course: { label: "课程", color: "var(--ws-color-success)" },
  paper: { label: "论文", color: "var(--ws-color-purple)" },
  website: { label: "网站", color: "var(--ws-color-info)" },
  competition: { label: "竞赛", color: "var(--ws-color-warning)" },
  community: { label: "社区", color: "var(--ws-tag-orange)" },
  github: { label: "GitHub", color: "var(--ws-color-purple)" },
};
