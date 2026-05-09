/**
 * 机器学习学习板块
 *
 * 完整的学习知识体系展示平台，包含：
 * - 学习路线图 (Roadmap)
 * - 知识图谱 (Knowledge Map)
 * - 实验体系 (Experiments)
 * - 工具平台 (Tools)
 * - 学习资源 (Resources)
 * - 学习进度 (Progress)
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AdminPage } from "@/components/Admin";
import { api } from "@services";
import { showMessage } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  EXPERIMENTS,
  KNOWLEDGE_TREE,
  RESOURCE_TYPE_CONFIG,
  RESOURCES_DATA,
  ROADMAP_STAGES,
  TOOLS_DATA,
  type Experiment,
  type KnowledgeNode,
  type ResourceItem,
  type RoadmapStage,
  type StageStatus,
  type ToolItem,
} from "./data";
import { fetchLearningContentPayload, filterByKeyword } from "../learning/helpers";
import { BookReader } from "../learning/BookReader";
import { ML_BOOK } from "./book";
import { mlBookPublicApi } from "@/services/ml/books";
import type { LearningBook } from "../learning/types";

import {
  Map,
  FlaskConical,
  Wrench,
  BookOpen,
  BarChart3,
  Route,
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Star,
  Clock,
  Target,
  Layers,
  BookMarked,
  Trophy,
  Sparkles,
  Brain,
  GraduationCap,
  Building2,
  Zap,
  Database,
  Code2,
  FileText,
  MessageSquare,
  ListChecks,
} from "lucide-react";

// ────────────────────────────────────────
// 类型定义与内置数据
// ────────────────────────────────────────

type TabKey = "book" | "roadmap" | "knowledge" | "experiments" | "tools" | "resources" | "progress";

interface NormalizedProgress {
  stages: Record<string, StageStatus>;
  notes: string;
  overall_percent: number;
  completedItems: Record<string, boolean>;
  favoriteItems: Record<string, boolean>;
  completedChapters: Record<string, boolean>;
  favoriteChapters: Record<string, boolean>;
}

interface AdminMLLearningProps {
  embedded?: boolean;
}

interface MLLearningContentPayload {
  roadmapStages?: RoadmapStage[];
  knowledgeTree?: KnowledgeNode[];
  experiments?: Record<string, Experiment[]>;
  tools?: ToolItem[];
  resources?: ResourceItem[];
  book?: typeof ML_BOOK;
}

// ────────────────────────────────────────
// 子组件
// ────────────────────────────────────────

/** 阶段状态图标 */
const StageIcon: React.FC<{ status: StageStatus }> = ({ status }) => {
  if (status === "completed") return <CheckCircle2 className="h-5 w-5 text-[var(--ws-color-success)]" />;
  if (status === "in-progress") return <Clock className="h-5 w-5 text-[var(--ws-color-warning)]" />;
  return <Circle className="h-5 w-5 text-text-tertiary" />;
};

/** 可折叠知识树节点 */
const TreeNode: React.FC<{ node: KnowledgeNode; depth?: number; onNavigate?: (nodeId: string) => void }> = ({ node, depth = 0, onNavigate }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  const handleClick = () => {
    if (onNavigate) onNavigate(node.id);
    if (hasChildren) setExpanded(!expanded);
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--ws-color-surface-2)]",
          depth === 0 && "font-semibold text-text-base",
          depth === 1 && "font-medium text-text-secondary",
          depth >= 2 && "text-text-tertiary",
        )}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <span className="inline-block w-3.5 shrink-0" />
        )}
        <span className="flex-1">{node.label}</span>
        {onNavigate && <ExternalLink className="ml-1 h-3 w-3 shrink-0 text-text-tertiary opacity-40" />}
        {node.description && depth >= 1 && (
          <span className="hidden truncate text-xs text-text-tertiary lg:inline-block max-w-[200px]">
            {node.description}
          </span>
        )}
      </button>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────
// 主组件
// ────────────────────────────────────────

const normalizeTab = (tab: string | null): TabKey => {
  if (tab === "book" || tab === "roadmap" || tab === "knowledge" || tab === "experiments" || tab === "tools" || tab === "resources" || tab === "progress") return tab;
  return "book";
};

const CATEGORY_ICON_BY_KEY: Record<string, React.ReactNode> = {
  "dev-env": <Layers className="h-4 w-4" />,
  "data-processing": <BarChart3 className="h-4 w-4" />,
  "ml-lib": <Brain className="h-4 w-4" />,
  "dl-framework": <Sparkles className="h-4 w-4" />,
  "llm-ecosystem": <GraduationCap className="h-4 w-4" />,
  inference: <Zap className="h-4 w-4" />,
  "vector-db": <Database className="h-4 w-4" />,
  mlops: <Building2 className="h-4 w-4" />,
};

const DEFAULT_PROGRESS: NormalizedProgress = {
  stages: { basics: "pending", "core-algorithms": "pending", "deep-learning": "pending", projects: "pending", frontier: "pending" },
  notes: "",
  overall_percent: 0,
  completedItems: {},
  favoriteItems: {},
  completedChapters: {},
  favoriteChapters: {},
};

const AdminMLLearning: React.FC<AdminMLLearningProps> = ({ embedded = false }) => {
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const [activeTabKey, setActiveTabKey] = useState<TabKey>(normalizeTab(urlSearchParams.get("tab")));

  // 进度状态
  const [progress, setProgress] = useState<NormalizedProgress>(DEFAULT_PROGRESS);
  const [progressLoading, setProgressLoading] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [experimentKeyword, setExperimentKeyword] = useState("");
  const [experimentDifficulty, setExperimentDifficulty] = useState<"all" | Experiment["difficulty"]>("all");
  const [toolKeyword, setToolKeyword] = useState("");
  const [toolCategory, setToolCategory] = useState("all");
  const [resourceKeyword, setResourceKeyword] = useState("");
  const [resourceType, setResourceType] = useState<"all" | ResourceItem["type"]>("all");
  const [contentPayload, setContentPayload] = useState<MLLearningContentPayload | null>(null);
  const [activeBookSlug, setActiveBookSlug] = useState(ML_BOOK.chapters[0]?.slug ?? "overview");
  const [apiBook, setApiBook] = useState<LearningBook | null>(null);

  // 读取进度
  const loadProgress = useCallback(async () => {
    setProgressLoading(true);
    try {
      const res = await api.get("/learning/progress/ml");
      // 后端返回：{ id, user_id, module_key, data: {...}, ... }。
      // data 可能是已保存格式（含 stages）或旧 fallback 格式（含 current_stage）。
      const payload = res.data?.data;
      if (payload && typeof payload === "object") {
        if ("stages" in payload) {
          const p = payload as Record<string, unknown>;
          setProgress((prev) => ({
            stages: { ...prev.stages, ...((p.stages as Record<string, StageStatus>) ?? {}) },
            notes: (p.notes as string) || "",
            overall_percent: (p.overall_percent as number) ?? 0,
            completedItems: isBooleanRecord(p.completedItems) ? p.completedItems : {},
            favoriteItems: isBooleanRecord(p.favoriteItems) ? p.favoriteItems : {},
            completedChapters: isBooleanRecord(p.completedChapters) ? p.completedChapters : {},
            favoriteChapters: isBooleanRecord(p.favoriteChapters) ? p.favoriteChapters : {},
          }));
          setNotesText((p.notes as string) || "");
        } else {
          setProgress(DEFAULT_PROGRESS);
          setNotesText(((payload as Record<string, unknown>).notes as string) || "");
        }
      }
    } catch {
      // 首次访问无数据是正常情况
    } finally {
      setProgressLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    let mounted = true;
    void fetchLearningContentPayload<MLLearningContentPayload>("ml").then((payload) => {
      if (mounted && payload) setContentPayload(payload);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // 从新 API 读取书籍（转换 snake_case → camelCase）
  useEffect(() => {
    let mounted = true;
    mlBookPublicApi.getBook("ml").then((res) => {
      const raw = (res.data as unknown as Record<string, unknown>)?.book as Record<string, unknown> | null;
      if (!mounted || !raw || !Array.isArray(raw.chapters) || raw.chapters.length === 0) return;
      const book: LearningBook = {
        moduleKey: "ml",
        title: (raw.title as string) || "机器学习",
        subtitle: (raw.subtitle as string) || "",
        description: (raw.description as string) || "",
        audience: (raw.audience as string) || "",
        outcomes: Array.isArray(raw.outcomes) ? raw.outcomes as string[] : [],
        chapters: (raw.chapters as any[]).map((ch: any) => ({
          slug: ch.slug || "",
          title: ch.title || "",
          summary: ch.summary || "",
          estimatedMinutes: ch.estimated_minutes ?? ch.estimatedMinutes ?? 30,
          difficulty: ch.difficulty || "beginner",
          goals: Array.isArray(ch.goals) ? ch.goals : [],
          markdown: ch.markdown || "",
          checklist: Array.isArray(ch.checklist) ? ch.checklist : [],
          experiments: Array.isArray(ch.experiments) ? ch.experiments : [],
          glossary: Array.isArray(ch.glossary) ? ch.glossary : [],
          references: Array.isArray(ch.references) ? ch.references : [],
        })),
      };
      setApiBook(book);
      if (!book.chapters.find((ch) => ch.slug === activeBookSlug)) {
        setActiveBookSlug(book.chapters[0]?.slug ?? "overview");
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const roadmapStagesData = contentPayload?.roadmapStages ?? ROADMAP_STAGES;
  const knowledgeTreeData = contentPayload?.knowledgeTree ?? KNOWLEDGE_TREE;
  const experimentsData = contentPayload?.experiments ?? EXPERIMENTS;
  const toolsData = contentPayload?.tools ?? TOOLS_DATA;
  const resourcesData = contentPayload?.resources ?? RESOURCES_DATA;
  const bookData = apiBook ?? contentPayload?.book ?? ML_BOOK;

  // 保存进度
  const saveProgress = useCallback(async () => {
    try {
      const stages = progress.stages;
      const overall_percent = progress.overall_percent;

      await api.post("/learning/progress/ml", {
        stages,
        notes: notesText,
        overall_percent,
        completedItems: progress.completedItems,
        favoriteItems: progress.favoriteItems,
        completedChapters: progress.completedChapters,
        favoriteChapters: progress.favoriteChapters,
      });
      showMessage.success("进度已保存");
    } catch {
      showMessage.error("保存失败，请重试");
    }
  }, [progress.stages, progress.overall_percent, progress.completedItems, progress.favoriteItems, progress.completedChapters, progress.favoriteChapters, notesText]);

  // 标记阶段状态（同时更新总体进度百分比）
  const handleStageStatusChange = (stageId: string, status: StageStatus) => {
    setProgress((prev) => {
      const nextStages = { ...prev.stages, [stageId]: status };
      const completedCount = Object.values(nextStages).filter((s) => s === "completed").length;
      const totalCount = Object.keys(nextStages).length;
      const overall_percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      return { ...prev, stages: nextStages, overall_percent };
    });
  };

  const toggleCompletedItem = (itemKey: string) => {
    setProgress((prev) => ({
      ...prev,
      completedItems: { ...prev.completedItems, [itemKey]: !prev.completedItems[itemKey] },
    }));
  };

  const toggleFavoriteItem = (itemKey: string) => {
    setProgress((prev) => ({
      ...prev,
      favoriteItems: { ...prev.favoriteItems, [itemKey]: !prev.favoriteItems[itemKey] },
    }));
  };

  const toggleCompletedChapter = (slug: string) => {
    setProgress((prev) => ({
      ...prev,
      completedChapters: { ...prev.completedChapters, [slug]: !prev.completedChapters[slug] },
    }));
  };

  const toggleFavoriteChapter = (slug: string) => {
    setProgress((prev) => ({
      ...prev,
      favoriteChapters: { ...prev.favoriteChapters, [slug]: !prev.favoriteChapters[slug] },
    }));
  };

  // 自动保存进度（保存按钮手动触发，不自动）

  // Tab 切换
  const handleTabChange = (key: string) => {
    const next = normalizeTab(key);
    setActiveTabKey(next);
    const params = new URLSearchParams(urlSearchParams);
    params.set("tab", next);
    setUrlSearchParams(params, { replace: true });
  };

  // 跨 Tab 导航 + 关键词筛选 + 可选滚动
  const navigateToTabAndFilter = (tab: TabKey, keyword?: string, scrollToId?: string) => {
    setActiveTabKey(tab);
    const params = new URLSearchParams(urlSearchParams);
    params.set("tab", tab);
    setUrlSearchParams(params, { replace: true });
    if (keyword) {
      if (tab === "tools") setToolKeyword(keyword);
      else if (tab === "experiments") setExperimentKeyword(keyword);
      else if (tab === "resources") setResourceKeyword(keyword);
    }
    if (scrollToId) {
      setTimeout(() => {
        document.getElementById(scrollToId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  };

  // 阶段颜色映射
  const stageColorDot = (stageId: string): string => {
    const map: Record<string, string> = {
      basics: "var(--ws-color-primary)",
      "core-algorithms": "var(--ws-color-success)",
      "deep-learning": "var(--ws-color-info)",
      advanced: "var(--ws-color-warning)",
      production: "var(--ws-color-error)",
    };
    return map[stageId] ?? "var(--ws-color-primary)";
  };

  // 话题 → 导航目标
  const resolveTopicNav = (topic: string): { tab: TabKey; keyword: string } | null => {
    const t = topic.toLowerCase();
    if (t.includes("numpy") || t.includes("pandas")) return { tab: "tools", keyword: "NumPy" };
    if (t.includes("matplotlib") || t.includes("seaborn")) return { tab: "tools", keyword: "Matplotlib" };
    if (t.includes("scikit-learn")) return { tab: "tools", keyword: "scikit-learn" };
    if (t.includes("pytorch")) return { tab: "tools", keyword: "PyTorch" };
    if (t.includes("tensorflow")) return { tab: "tools", keyword: "TensorFlow" };
    if (t.includes("xgboost") || t.includes("lightgbm") || t.includes("catboost")) return { tab: "tools", keyword: "XGBoost" };
    if (t.includes("fastapi") || t.includes("docker")) return { tab: "tools", keyword: "Docker" };
    if (t.includes("huggingface") || t.includes("transformers")) return { tab: "tools", keyword: "Hugging Face" };
    if (t.includes("langchain")) return { tab: "tools", keyword: "LangChain" };
    if (t.includes("mlflow")) return { tab: "tools", keyword: "MLflow" };
    if (t.includes("cnn") || t.includes("resnet")) return { tab: "experiments", keyword: "CIFAR-10" };
    if (t.includes("bert") || t.includes("gpt")) return { tab: "experiments", keyword: "BERT" };
    if (t.includes("yolo") || t.includes("目标检测")) return { tab: "experiments", keyword: "YOLOv8" };
    if (t.includes("gan") || t.includes("生成对抗") || t.includes("dcgan")) return { tab: "experiments", keyword: "DCGAN" };
    if (t.includes("lstm") || t.includes("循环") || t.includes("rnn")) return { tab: "experiments", keyword: "IMDB" };
    if (t.includes("rag") || t.includes("知识库")) return { tab: "experiments", keyword: "RAG" };
    if (t.includes("推荐系统") || t.includes("协同过滤")) return { tab: "experiments", keyword: "推荐" };
    return null;
  };

  // 里程碑 → 导航目标
  const resolveMilestoneNav = (ms: string): { tab: TabKey; keyword: string } | null => {
    const m = ms.toLowerCase();
    if (m.includes("titanic")) return { tab: "experiments", keyword: "Titanic" };
    if (m.includes("cifar-10")) return { tab: "experiments", keyword: "CIFAR-10" };
    if (m.includes("mnist")) return { tab: "experiments", keyword: "MNIST" };
    if (m.includes("bert")) return { tab: "experiments", keyword: "BERT" };
    if (m.includes("yolo")) return { tab: "experiments", keyword: "YOLOv8" };
    if (m.includes("kaggle")) return { tab: "experiments", keyword: "Kaggle" };
    if (m.includes("fastapi") || m.includes("docker")) return { tab: "tools", keyword: "Docker" };
    if (m.includes("mlflow")) return { tab: "tools", keyword: "MLflow" };
    if (m.includes("pytorch") || m.includes("onnx")) return { tab: "tools", keyword: "PyTorch" };
    return null;
  };

  // 知识树节点 → 导航目标
  const knowledgeNavMap: Record<string, { tab: TabKey; keyword?: string; scrollToId?: string }> = {
    "linear-regression": { tab: "roadmap", scrollToId: "stage-core-algorithms" },
    "logistic-regression": { tab: "roadmap", scrollToId: "stage-core-algorithms" },
    "decision-tree": { tab: "roadmap", scrollToId: "stage-core-algorithms" },
    svm: { tab: "roadmap", scrollToId: "stage-core-algorithms" },
    knn: { tab: "roadmap", scrollToId: "stage-core-algorithms" },
    "naive-bayes": { tab: "roadmap", scrollToId: "stage-core-algorithms" },
    cnn: { tab: "experiments", keyword: "CIFAR-10" },
    mlp: { tab: "experiments", keyword: "MNIST" },
    lstm: { tab: "experiments", keyword: "IMDB" },
    bert: { tab: "experiments", keyword: "BERT" },
    gan: { tab: "experiments", keyword: "DCGAN" },
    xgboost: { tab: "experiments", keyword: "House Prices" },
    kmeans: { tab: "experiments", keyword: "KMeans" },
    resnet: { tab: "experiments", keyword: "CIFAR-10" },
  };

  // 计算进度百分比
  const completedStages = Object.values(progress.stages).filter((s) => s === "completed").length;
  const totalStages = Object.keys(progress.stages).length;
  const completedItemCount = Object.values(progress.completedItems).filter(Boolean).length;
  const favoriteItemCount = Object.values(progress.favoriteItems).filter(Boolean).length;
  const percent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  const experimentList = useMemo(() => Object.values(experimentsData).flat(), [experimentsData]);
  const toolExperimentMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const exp of Object.values(experimentsData).flat()) {
      for (const tool of exp.tools) {
        if (!map[tool]) map[tool] = [];
        if (!map[tool].includes(exp.name)) map[tool].push(exp.name);
      }
    }
    return map;
  }, [experimentsData]);
  const filteredExperiments = useMemo(() => {
    const byDifficulty = experimentDifficulty === "all" ? experimentList : experimentList.filter((item) => item.difficulty === experimentDifficulty);
    return filterByKeyword(byDifficulty.map((item) => ({ ...item, title: item.name, summary: item.data, tags: [...item.tools, ...item.skills] })), experimentKeyword);
  }, [experimentDifficulty, experimentKeyword, experimentList]);

  const filteredTools = useMemo(() => {
    const byCategory = toolCategory === "all" ? toolsData : toolsData.filter((tool) => tool.category === toolCategory);
    return filterByKeyword(byCategory.map((tool) => ({ ...tool, title: tool.name, summary: tool.description, tags: [CATEGORY_LABELS[tool.category] ?? tool.category] })), toolKeyword);
  }, [toolCategory, toolKeyword, toolsData]);

  const toolsByCategory = useMemo(() => filteredTools.reduce<Record<string, ToolItem[]>>((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {}), [filteredTools]);

  const filteredResources = useMemo(() => {
    const byType = resourceType === "all" ? resourcesData : resourcesData.filter((resource) => resource.type === resourceType);
    return filterByKeyword(byType.map((resource) => ({ ...resource, tags: [RESOURCE_TYPE_CONFIG[resource.type]?.label ?? resource.type] })), resourceKeyword);
  }, [resourceKeyword, resourceType, resourcesData]);

  const content = (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {/* 页面标题 */}
        <div className="flex flex-wrap items-center gap-3">
          <Brain className="h-6 w-6 text-[var(--ws-color-purple,var(--ws-color-primary))]" />
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-text-base sm:text-lg">机器学习学习中心</h1>
            <p className="text-xs text-text-tertiary">系统化学习路径 / 知识体系 / 实战项目</p>
          </div>
          {(activeTabKey === "book" || activeTabKey === "progress" || activeTabKey === "roadmap") && (
            <button
              type="button"
              onClick={saveProgress}
              disabled={progressLoading}
              className="ml-auto rounded-md bg-[var(--ws-color-primary)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {progressLoading ? "保存中..." : "保存进度"}
            </button>
          )}
        </div>

        {/* Tab 导航 */}
        <Tabs value={activeTabKey} onValueChange={handleTabChange} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="inline-flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 shrink-0">
            <TabsTrigger value="book" className="gap-1.5">
              <BookMarked className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">学习书</span>
            </TabsTrigger>
            <TabsTrigger value="roadmap" className="gap-1.5">
              <Route className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">学习路线</span>
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="gap-1.5">
              <Map className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">知识图谱</span>
            </TabsTrigger>
            <TabsTrigger value="experiments" className="gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">实验体系</span>
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">工具平台</span>
            </TabsTrigger>
            <TabsTrigger value="resources" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">学习资源</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">学习进度</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="book" className="flex-1 overflow-auto pt-3 outline-none">
            <BookReader
              book={bookData}
              activeSlug={activeBookSlug}
              completedChapters={progress.completedChapters}
              favoriteChapters={progress.favoriteChapters}
              onSelectChapter={setActiveBookSlug}
              onToggleComplete={toggleCompletedChapter}
              onToggleFavorite={toggleFavoriteChapter}
            />
          </TabsContent>

          {/* Tab 1: 学习路线图 */}
          <TabsContent value="roadmap" className="flex-1 overflow-auto pt-3 outline-none">
            <div className="space-y-4">
              {/* 总览进度条 */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-text-base">总学习进度</span>
                    <span className="text-text-secondary">{percent}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--ws-color-surface-2)]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percent}%`,
                        background: "linear-gradient(90deg, var(--ws-color-primary), var(--ws-color-purple, var(--ws-color-info)))",
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 时间线阶段列表 */}
              <div className="relative space-y-0">
                {/* 时间线竖线 */}
                <div className="absolute left-[17px] top-0 bottom-0 w-0.5 bg-[var(--ws-color-border-secondary)]" />

                {roadmapStagesData.map((stage, index) => {
                  const stageStatus = progress.stages[stage.id] || "pending";
                  return (
                    <div key={stage.id} id={`stage-${stage.id}`} className={cn("relative flex gap-4 pb-6 last:pb-0", stageStatus === "in-progress" && "rounded-lg border-2 border-[var(--ws-color-warning)] bg-[var(--ws-color-surface-2)] p-3")}>
                      {/* 时间线节点 */}
                      <button type="button" className="relative z-10 mt-1 flex shrink-0" onClick={() => {
                        const next: StageStatus = stageStatus === "pending" ? "in-progress" : stageStatus === "in-progress" ? "completed" : "pending";
                        handleStageStatusChange(stage.id, next);
                      }} title={`点击切换状态：当前为${stageStatus === "pending" ? "待开始" : stageStatus === "in-progress" ? "进行中" : "已完成"}`} aria-label={`切换 ${stage.name} 学习状态`}>
                        <StageIcon status={stageStatus} />
                      </button>

                      {/* 阶段内容 */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: stageColorDot(stage.id) }}>
                            {index + 1}
                          </span>
                          <h3 className="text-base font-semibold text-text-base">{stage.name}</h3>
                          <Badge variant="neutral" className="text-xs">
                            <Clock className="mr-1 h-3 w-3" />
                            {stageStatus === "in-progress" ? `还剩 ${stage.duration}` : stage.duration}
                          </Badge>
                          {stageStatus === "completed" && (
                            <Badge variant="success">已完成</Badge>
                          )}
                          {stageStatus === "in-progress" && (
                            <>
                              <Badge variant="warning">进行中</Badge>
                              <span className="text-xs font-medium text-[var(--ws-color-warning)]">← 当前进度</span>
                            </>
                          )}
                        </div>

                        {/* 里程碑 */}
                        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                          <div>
                            <p className="mb-1 text-xs font-medium text-text-secondary">核心主题</p>
                            <ul className="space-y-0.5">
                              {stage.topics.map((topic) => {
                                const nav = resolveTopicNav(topic);
                                return (
                                  <li
                                    key={topic}
                                    className={cn(
                                      "flex items-start gap-1.5 text-xs text-text-tertiary",
                                      nav && "cursor-pointer hover:text-[var(--ws-color-primary)]",
                                    )}
                                    onClick={nav ? () => navigateToTabAndFilter(nav.tab, nav.keyword) : undefined}
                                  >
                                    <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: stageColorDot(stage.id) }} />
                                    {topic}
                                    {nav && <ExternalLink className="ml-1 mt-0.5 h-3 w-3 shrink-0 opacity-40" />}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-medium text-text-secondary">
                              <Target className="mr-1 inline h-3 w-3" />
                              里程碑目标
                            </p>
                            <ul className="space-y-0.5">
                              {stage.milestones.map((ms) => {
                                const nav = resolveMilestoneNav(ms);
                                return (
                                  <li
                                    key={ms}
                                    className={cn(
                                      "flex items-start gap-1.5 text-xs text-text-tertiary",
                                      nav && "cursor-pointer hover:text-[var(--ws-color-primary)]",
                                    )}
                                    onClick={nav ? () => navigateToTabAndFilter(nav.tab, nav.keyword) : undefined}
                                  >
                                    <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--ws-color-success)]" />
                                    {ms}
                                    {nav && <ExternalLink className="ml-1 mt-0.5 h-3 w-3 shrink-0 opacity-40" />}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: 知识图谱 */}
          <TabsContent value="knowledge" className="flex-1 overflow-auto pt-3 outline-none">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardContent className="py-4">
                  <div className="rounded-lg border border-[var(--ws-color-border-secondary)] bg-[var(--ws-color-surface-2)] p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-base">
                      <Map className="h-4 w-4 text-[var(--ws-color-primary)]" />
                      机器学习知识体系
                    </h3>
                    {knowledgeTreeData.map((node) => (
                      <TreeNode key={node.id} node={node} onNavigate={(nodeId) => {
                        const target = knowledgeNavMap[nodeId];
                        if (target) navigateToTabAndFilter(target.tab, target.keyword, target.scrollToId);
                      }} />
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-[var(--ws-color-warning)]" />
                    学习建议
                  </CardTitle>
                  <CardDescription className="text-xs">
                    根据你的进度和兴趣，推荐以下学习路径
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-md border border-[var(--ws-color-border-secondary)] bg-[var(--ws-color-surface-2)] p-3 text-xs text-text-secondary">
                    <p className="mb-1 font-medium text-text-base">推荐路径：</p>
                    <ol className="ml-4 list-decimal space-y-1">
                      <li>从 <strong>数学基础</strong> 和 <strong>编程工具</strong> 开始打牢根基</li>
                      <li>学习 <strong>经典机器学习</strong> 算法，理解核心概念</li>
                      <li>进入 <strong>深度学习</strong> 领域，掌握 CNN / Transformer 等现代 AI 技术</li>
                      <li>进阶 <strong>大语言模型</strong> 方向，学习 RAG / 微调 / Agent 等核心技术</li>
                      <li>通过 <strong>工程部署</strong> 将模型落地到实际应用</li>
                      <li>关注 <strong>AI 前沿方向</strong> 与 <strong>多模态</strong> 保持技术前瞻性</li>
                    </ol>
                  </div>
                  <div className="rounded-md border border-[var(--ws-color-border-secondary)] bg-[var(--ws-color-surface-2)] p-3 text-xs text-text-secondary">
                    <p className="mb-1 font-medium text-text-base">技能树概览：</p>
                    <p>共 <strong>{knowledgeTreeData.length}</strong> 大领域，涵盖 <strong>40+</strong> 子方向。
                    点击节点展开查看详细描述。建议采用"广度优先 + 深度优先"结合的方式学习，
                    先了解全貌再深入特定方向。</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 3: 实验体系 */}
          <TabsContent value="experiments" className="flex-1 overflow-auto pt-3 outline-none">
            <div className="space-y-6">
              <div className="rounded-lg border border-[var(--ws-color-border-secondary)] bg-[var(--ws-color-surface-2)] p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                  <input
                    value={experimentKeyword}
                    onChange={(event) => setExperimentKeyword(event.target.value)}
                    placeholder="搜索实验、数据集、工具或技能"
                    className="h-9 rounded-md border border-[var(--ws-color-border)] bg-surface px-3 text-sm text-text-base placeholder:text-text-tertiary focus:border-[var(--ws-color-primary)] focus:outline-none"
                  />
                  <select
                    value={experimentDifficulty}
                    onChange={(event) => setExperimentDifficulty(event.target.value as typeof experimentDifficulty)}
                    className="h-9 rounded-md border border-[var(--ws-color-border)] bg-surface px-3 text-sm text-text-base focus:border-[var(--ws-color-primary)] focus:outline-none"
                  >
                    <option value="all">全部难度</option>
                    <option value="beginner">入门</option>
                    <option value="intermediate">中级</option>
                    <option value="advanced">高级</option>
                  </select>
                </div>
                <p className="mt-2 text-xs text-text-tertiary">匹配 {filteredExperiments.length} 个实验，可直接标记完成或收藏。</p>
              </div>

              {filteredExperiments.length === 0 && (
                <div className="rounded-md border border-dashed border-[var(--ws-color-border-secondary)] p-6 text-center text-sm text-text-tertiary">
                  未找到匹配的实验，请调整关键词或难度筛选。
                </div>
              )}

              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-base">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--ws-color-success)] text-xs text-white">1</span>
                  入门级实验
                  <Badge variant="success" className="text-xs">适合新手</Badge>
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredExperiments.filter((exp) => exp.difficulty === "beginner").map((exp) => (
                    <ExperimentCard
                      key={exp.name}
                      experiment={exp}
                      completed={Boolean(progress.completedItems[`experiment:${exp.name}`])}
                      favorite={Boolean(progress.favoriteItems[`experiment:${exp.name}`])}
                      onToggleCompleted={() => toggleCompletedItem(`experiment:${exp.name}`)}
                      onToggleFavorite={() => toggleFavoriteItem(`experiment:${exp.name}`)}
                    />
                  ))}
                </div>
              </div>

              {/* 中级 */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-base">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--ws-color-warning)] text-xs text-white">2</span>
                  中级实验
                  <Badge variant="warning" className="text-xs">需要基础</Badge>
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredExperiments.filter((exp) => exp.difficulty === "intermediate").map((exp) => (
                    <ExperimentCard
                      key={exp.name}
                      experiment={exp}
                      completed={Boolean(progress.completedItems[`experiment:${exp.name}`])}
                      favorite={Boolean(progress.favoriteItems[`experiment:${exp.name}`])}
                      onToggleCompleted={() => toggleCompletedItem(`experiment:${exp.name}`)}
                      onToggleFavorite={() => toggleFavoriteItem(`experiment:${exp.name}`)}
                    />
                  ))}
                </div>
              </div>

              {/* 高级 */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-base">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--ws-color-error)] text-xs text-white">3</span>
                  高级实验
                  <Badge variant="danger" className="text-xs">需深度学习基础</Badge>
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredExperiments.filter((exp) => exp.difficulty === "advanced").map((exp) => (
                    <ExperimentCard
                      key={exp.name}
                      experiment={exp}
                      completed={Boolean(progress.completedItems[`experiment:${exp.name}`])}
                      favorite={Boolean(progress.favoriteItems[`experiment:${exp.name}`])}
                      onToggleCompleted={() => toggleCompletedItem(`experiment:${exp.name}`)}
                      onToggleFavorite={() => toggleFavoriteItem(`experiment:${exp.name}`)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tab 4: 工具平台 */}
          <TabsContent value="tools" className="flex-1 overflow-auto pt-3 outline-none">
            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--ws-color-border-secondary)] bg-[var(--ws-color-surface-2)] p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                  <input
                    value={toolKeyword}
                    onChange={(event) => setToolKeyword(event.target.value)}
                    placeholder="搜索工具名称、用途或类别"
                    className="h-9 rounded-md border border-[var(--ws-color-border)] bg-surface px-3 text-sm text-text-base placeholder:text-text-tertiary focus:border-[var(--ws-color-primary)] focus:outline-none"
                  />
                  <select
                    value={toolCategory}
                    onChange={(event) => setToolCategory(event.target.value)}
                    className="h-9 rounded-md border border-[var(--ws-color-border)] bg-surface px-3 text-sm text-text-base focus:border-[var(--ws-color-primary)] focus:outline-none"
                  >
                    <option value="all">全部类别</option>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <p className="mt-2 text-xs text-text-tertiary">匹配 {filteredTools.length} 个工具，支持按工具链类别快速聚焦。</p>
              </div>

              {filteredTools.length === 0 && (
                <div className="rounded-md border border-dashed border-[var(--ws-color-border-secondary)] p-6 text-center text-sm text-text-tertiary">
                  未找到匹配的工具，请调整关键词或类别筛选。
                </div>
              )}

              {Object.entries(toolsByCategory).map(([category, tools]) => (
                <Card key={category}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      {CATEGORY_ICON_BY_KEY[category]}
                      {CATEGORY_LABELS[category] || category}
                      <span className="ml-1 text-xs font-normal text-text-tertiary">({tools.length} 个工具)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {tools.map((tool) => (
                        <div
                          key={tool.name}
                          className="rounded-md border border-[var(--ws-color-border-secondary)] bg-[var(--ws-color-surface-2)] p-3 transition-colors hover:border-[var(--ws-color-primary)]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-text-base">{tool.name}</span>
                            <div className="flex items-center gap-1">
                              {tool.difficulty && (
                                <span className="rounded px-1 py-0.5 text-[10px] bg-[var(--ws-color-surface)] text-text-tertiary">
                                  {DIFFICULTY_LABELS[tool.difficulty]?.label ?? tool.difficulty}
                                </span>
                              )}
                              {tool.url && (
                                <a href={tool.url} target="_blank" rel="noopener noreferrer"
                                  className="text-text-tertiary hover:text-[var(--ws-color-primary)]" onClick={(e) => e.stopPropagation()}>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-text-tertiary">{tool.description}</p>
                          {toolExperimentMap[tool.name] && toolExperimentMap[tool.name].length > 0 && (
                            <button
                              type="button"
                              className="mt-1 flex items-center gap-1 text-[10px] text-[var(--ws-color-primary)] hover:underline"
                              onClick={() => navigateToTabAndFilter("experiments", toolExperimentMap[tool.name]?.[0])}
                            >
                              <FlaskConical className="h-3 w-3" />
                              用于实验: {toolExperimentMap[tool.name].slice(0, 3).join(", ")}
                              {toolExperimentMap[tool.name].length > 3 && ` 等${toolExperimentMap[tool.name].length}个`}
                            </button>
                          )}
                          <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                            {tool.pricing && <span className="text-text-tertiary">{tool.pricing}</span>}
                            {tool.gettingStarted && (
                              <a href={tool.gettingStarted} target="_blank" rel="noopener noreferrer"
                                className="text-[var(--ws-color-primary)] hover:underline" onClick={(e) => e.stopPropagation()}>
                                入门指南 →
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tab 5: 学习资源 */}
          <TabsContent value="resources" className="flex-1 overflow-auto pt-3 outline-none">
            <div className="space-y-6">
              <div className="rounded-lg border border-[var(--ws-color-border-secondary)] bg-[var(--ws-color-surface-2)] p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                  <input
                    value={resourceKeyword}
                    onChange={(event) => setResourceKeyword(event.target.value)}
                    placeholder="搜索资源标题、描述或类型"
                    className="h-9 rounded-md border border-[var(--ws-color-border)] bg-surface px-3 text-sm text-text-base placeholder:text-text-tertiary focus:border-[var(--ws-color-primary)] focus:outline-none"
                  />
                  <select
                    value={resourceType}
                    onChange={(event) => setResourceType(event.target.value as typeof resourceType)}
                    className="h-9 rounded-md border border-[var(--ws-color-border)] bg-surface px-3 text-sm text-text-base focus:border-[var(--ws-color-primary)] focus:outline-none"
                  >
                    <option value="all">全部类型</option>
                    <option value="book">书籍</option>
                    <option value="course">课程</option>
                    <option value="github">GitHub</option>
                    <option value="video">视频</option>
                    <option value="paper">论文</option>
                    <option value="blog">博客</option>
                    <option value="competition">竞赛</option>
                  </select>
                </div>
                <p className="mt-2 text-xs text-text-tertiary">匹配 {filteredResources.length} 个资源，可收藏常用入口。</p>
              </div>

              {filteredResources.length === 0 && (
                <div className="rounded-md border border-dashed border-[var(--ws-color-border-secondary)] p-6 text-center text-sm text-text-tertiary">
                  未找到匹配的资源，请调整关键词或类型筛选。
                </div>
              )}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-base">
                  <BookMarked className="h-4 w-4 text-[var(--ws-color-primary)]" />
                  推荐书籍
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredResources.filter((r) => r.type === "book").map((item) => (
                    <ResourceCard
                      key={item.title}
                      item={item}
                      favorite={Boolean(progress.favoriteItems[`resource:${item.title}`])}
                      onToggleFavorite={() => toggleFavoriteItem(`resource:${item.title}`)}
                    />
                  ))}
                </div>
              </div>

              {/* 课程 */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-base">
                  <GraduationCap className="h-4 w-4 text-[var(--ws-color-success)]" />
                  推荐课程
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredResources.filter((r) => r.type === "course").map((item) => (
                    <ResourceCard
                      key={item.title}
                      item={item}
                      favorite={Boolean(progress.favoriteItems[`resource:${item.title}`])}
                      onToggleFavorite={() => toggleFavoriteItem(`resource:${item.title}`)}
                    />
                  ))}
                </div>
              </div>

              {/* GitHub 仓库 */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-base">
                  <ExternalLink className="h-4 w-4" />
                  GitHub 优秀仓库
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredResources.filter((r) => r.type === "github").map((item) => (
                    <ResourceCard
                      key={item.title}
                      item={item}
                      favorite={Boolean(progress.favoriteItems[`resource:${item.title}`])}
                      onToggleFavorite={() => toggleFavoriteItem(`resource:${item.title}`)}
                    />
                  ))}
                </div>
              </div>

              {/* 视频 */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-base">
                  <Sparkles className="h-4 w-4 text-[var(--ws-color-purple, #8B5CF6)]" />
                  精选视频
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredResources.filter((r) => r.type === "video").map((item) => (
                    <ResourceCard key={item.title} item={item} favorite={Boolean(progress.favoriteItems[`resource:${item.title}`])}
                      onToggleFavorite={() => toggleFavoriteItem(`resource:${item.title}`)} />
                  ))}
                </div>
              </div>

              {/* 论文 */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-base">
                  <FileText className="h-4 w-4 text-[var(--ws-color-info)]" />
                  必读论文
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredResources.filter((r) => r.type === "paper").map((item) => (
                    <ResourceCard key={item.title} item={item} favorite={Boolean(progress.favoriteItems[`resource:${item.title}`])}
                      onToggleFavorite={() => toggleFavoriteItem(`resource:${item.title}`)} />
                  ))}
                </div>
              </div>

              {/* 博客 */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-base">
                  <MessageSquare className="h-4 w-4 text-[var(--ws-color-success)]" />
                  优质博客
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredResources.filter((r) => r.type === "blog").map((item) => (
                    <ResourceCard key={item.title} item={item} favorite={Boolean(progress.favoriteItems[`resource:${item.title}`])}
                      onToggleFavorite={() => toggleFavoriteItem(`resource:${item.title}`)} />
                  ))}
                </div>
              </div>

              {/* 数据竞赛 */
}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-base">
                  <Trophy className="h-4 w-4 text-[var(--ws-color-warning)]" />
                  数据竞赛平台
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {filteredResources.filter((r) => r.type === "competition").map((item) => (
                    <ResourceCard
                      key={item.title}
                      item={item}
                      favorite={Boolean(progress.favoriteItems[`resource:${item.title}`])}
                      onToggleFavorite={() => toggleFavoriteItem(`resource:${item.title}`)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tab 6: 学习进度 */}
          <TabsContent value="progress" className="flex-1 overflow-auto pt-3 outline-none">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* 总体进度 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <BarChart3 className="h-4 w-4 text-[var(--ws-color-primary)]" />
                    总体进度
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-text-secondary">完成度</span>
                      <span className="font-semibold text-text-base">{percent}%</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--ws-color-surface-2)]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percent}%`,
                          background: "linear-gradient(90deg, var(--ws-color-primary), var(--ws-color-purple, var(--ws-color-info)))",
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-3 text-center">
                    <div className="rounded-md bg-[var(--ws-color-surface-2)] p-3">
                      <div className="text-2xl font-bold text-[var(--ws-color-primary)]">{totalStages}</div>
                      <div className="text-xs text-text-tertiary">总阶段</div>
                    </div>
                    <div className="rounded-md bg-[var(--ws-color-surface-2)] p-3">
                      <div className="text-2xl font-bold text-[var(--ws-color-success)]">{completedStages}</div>
                      <div className="text-xs text-text-tertiary">已完成</div>
                    </div>
                    <div className="rounded-md bg-[var(--ws-color-surface-2)] p-3">
                      <div className="text-2xl font-bold text-[var(--ws-color-warning)]">{totalStages - completedStages}</div>
                      <div className="text-xs text-text-tertiary">剩余</div>
                    </div>
                    <div className="rounded-md bg-[var(--ws-color-surface-2)] p-3">
                      <div className="text-2xl font-bold text-[var(--ws-color-info)]">{completedItemCount}</div>
                      <div className="text-xs text-text-tertiary">实验完成</div>
                    </div>
                    <div className="rounded-md bg-[var(--ws-color-surface-2)] p-3">
                      <div className="text-2xl font-bold text-[var(--ws-color-warning)]">{favoriteItemCount}</div>
                      <div className="text-xs text-text-tertiary">收藏资源</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 各阶段状态 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Layers className="h-4 w-4 text-[var(--ws-color-primary)]" />
                    阶段状态
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {roadmapStagesData.map((stage) => {
                    const status = progress.stages[stage.id] || "pending";
                    return (
                      <div key={stage.id} className="flex flex-col gap-2 rounded-md p-2 hover:bg-[var(--ws-color-surface-2)] sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <StageIcon status={status} />
                          <span className={cn("text-sm", status === "completed" ? "text-text-base" : "text-text-secondary")}>
                            {stage.name}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => handleStageStatusChange(stage.id, "pending")}
                            className={cn(
                              "rounded px-2 py-0.5 text-xs",
                              status === "pending"
                                ? "bg-[var(--ws-color-primary)] text-white"
                                : "bg-[var(--ws-color-surface-2)] text-text-tertiary hover:text-text-base",
                            )}
                          >
                            待开始
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStageStatusChange(stage.id, "in-progress")}
                            className={cn(
                              "rounded px-2 py-0.5 text-xs",
                              status === "in-progress"
                                ? "bg-[var(--ws-color-warning)] text-white"
                                : "bg-[var(--ws-color-surface-2)] text-text-tertiary hover:text-text-base",
                            )}
                          >
                            进行中
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStageStatusChange(stage.id, "completed")}
                            className={cn(
                              "rounded px-2 py-0.5 text-xs",
                              status === "completed"
                                ? "bg-[var(--ws-color-success)] text-white"
                                : "bg-[var(--ws-color-surface-2)] text-text-tertiary hover:text-text-base",
                            )}
                          >
                            已完成
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* 学习笔记 */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <BookMarked className="h-4 w-4 text-[var(--ws-color-primary)]" />
                    学习笔记
                  </CardTitle>
                  <CardDescription className="text-xs">记录你的学习心得、重要知识点和疑问</CardDescription>
                </CardHeader>
                <CardContent>
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="输入你的学习笔记..."
                    className="min-h-[200px] w-full resize-y rounded-md border border-[var(--ws-color-border)] bg-transparent p-3 text-sm text-text-base placeholder:text-text-tertiary focus:border-[var(--ws-color-primary)] focus:outline-none"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-text-tertiary">
                    <span>{notesText.length} 字</span>
                    <button
                      type="button"
                      onClick={saveProgress}
                      disabled={progressLoading}
                      className="rounded-md bg-[var(--ws-color-primary)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {progressLoading ? "保存中..." : "保存笔记"}
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
  );

  if (embedded) return content;

  return (
    <AdminPage padding="var(--ws-panel-padding)" scrollable={false}>
      {content}
    </AdminPage>
  );
};

// ────────────────────────────────────────
// 子卡片组件
// ────────────────────────────────────────

/** 实验卡片（可展开） */
const ExperimentCard: React.FC<{
  experiment: Experiment;
  completed: boolean;
  favorite: boolean;
  onToggleCompleted: () => void;
  onToggleFavorite: () => void;
}> = ({ experiment, completed, favorite, onToggleCompleted, onToggleFavorite }) => {
  const diff = DIFFICULTY_LABELS[experiment.difficulty];
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!(experiment.goal || experiment.steps?.length || experiment.code || experiment.expectedOutput);

  return (
    <div className={cn(
      "rounded-md border bg-[var(--ws-color-surface-2)] p-3 transition-colors",
      completed ? "border-[var(--ws-color-success)]" : "border-[var(--ws-color-border-secondary)]",
    )}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => hasDetail && setExpanded(!expanded)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-sm font-medium text-text-base hover:text-[var(--ws-color-primary)] transition-colors">{experiment.name}</span>
            {experiment.estimatedMinutes && (
              <Badge variant="neutral" className="text-[10px] gap-0.5 px-1 py-0">
                <Clock className="h-2.5 w-2.5" />{experiment.estimatedMinutes}m
              </Badge>
            )}
            {experiment.datasetUrl && (
              <a
                href={experiment.datasetUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-0.5 text-[10px] rounded bg-[var(--ws-color-primary-soft, rgba(99,102,241,0.1))] px-1.5 py-0 text-[var(--ws-color-primary)] hover:underline"
              >
                <Database className="h-2.5 w-2.5" />数据集
              </a>
            )}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onToggleFavorite} className={cn("rounded p-1", favorite ? "text-[var(--ws-color-warning)]" : "text-text-tertiary hover:text-[var(--ws-color-warning)]")}
            aria-label={favorite ? `取消收藏 ${experiment.name}` : `收藏 ${experiment.name}`}>
            <Star className={cn("h-3.5 w-3.5", favorite && "fill-[var(--ws-color-warning)]")} />
          </button>
          <Badge variant={diff.variant as any} className="text-xs">{diff.label}</Badge>
        </div>
      </div>
      <div className="mt-2 space-y-1.5 text-xs text-text-tertiary">
        <div className="flex items-start gap-1.5">
          <span className="shrink-0 font-medium text-text-secondary">数据：</span>
          <span>{experiment.data}</span>
        </div>
        <div className="flex items-start gap-1.5">
          <span className="shrink-0 font-medium text-text-secondary">工具：</span>
          <div className="flex flex-wrap gap-1">
            {experiment.tools.map((tool) => (
              <span key={tool} className="rounded bg-[var(--ws-color-surface)] px-1.5 py-0.5 text-xs">{tool}</span>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-1.5">
          <span className="shrink-0 font-medium text-text-secondary">技能：</span>
          <div className="flex flex-wrap gap-1">
            {experiment.skills.map((skill) => (
              <span key={skill} className="rounded bg-[var(--ws-color-primary-soft, rgba(99,102,241,0.1))] px-1.5 py-0.5 text-xs text-[var(--ws-color-primary)]">{skill}</span>
            ))}
          </div>
        </div>
      </div>
      {hasDetail && expanded && (
        <div className="mt-3 space-y-2 border-t border-[var(--ws-color-border-secondary)] pt-3">
          {experiment.goal && (
            <div className="rounded bg-[var(--ws-color-surface)] p-2">
              <span className="text-xs font-medium text-text-base flex items-center gap-1"><Target className="h-3 w-3 text-[var(--ws-color-success)]" />目标</span>
              <p className="mt-0.5 text-xs text-text-secondary">{experiment.goal}</p>
            </div>
          )}
          {experiment.steps && experiment.steps.length > 0 && (
            <div className="rounded bg-[var(--ws-color-surface)] p-2">
              <span className="text-xs font-medium text-text-base flex items-center gap-1"><ListChecks className="h-3 w-3 text-[var(--ws-color-primary)]" />步骤</span>
              <ol className="mt-1 ml-4 list-decimal space-y-0.5 text-xs text-text-secondary">
                {experiment.steps.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
            </div>
          )}
          {experiment.code && (
            <div className="rounded bg-slate-950 p-3">
              <span className="text-[10px] text-slate-400 flex items-center gap-1 mb-1"><Code2 className="h-3 w-3" />启动代码</span>
              <pre className="overflow-x-auto text-xs text-slate-100 leading-5">{experiment.code}</pre>
            </div>
          )}
          {experiment.expectedOutput && (
            <div className="rounded bg-[var(--ws-color-surface)] p-2">
              <span className="text-xs font-medium text-text-base">预期产出</span>
              <p className="mt-0.5 text-xs text-text-secondary">{experiment.expectedOutput}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {experiment.datasetUrl && (
              <a href={experiment.datasetUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded bg-[var(--ws-color-primary)] px-2 py-1 text-[10px] text-white hover:opacity-90">
                <ExternalLink className="h-3 w-3" />数据集
              </a>
            )}
            {experiment.notebookUrl && (
              <a href={experiment.notebookUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded bg-[var(--ws-color-surface)] px-2 py-1 text-[10px] text-text-secondary hover:text-text-base">
                <ExternalLink className="h-3 w-3" />Notebook
              </a>
            )}
          </div>
        </div>
      )}
      <button type="button" onClick={onToggleCompleted}
        className={cn("mt-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
          completed ? "bg-[var(--ws-color-success)] text-white" : "bg-[var(--ws-color-surface)] text-text-secondary hover:text-text-base")}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        {completed ? "已完成" : "标记完成"}
      </button>
      {hasDetail && (
        <button type="button" onClick={() => setExpanded(!expanded)}
          className="ml-2 mt-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-tertiary hover:text-text-base">
          {expanded ? "收起 ▲" : "展开详情 ▼"}
        </button>
      )}
    </div>
  );
};

/** 资源卡片 */
const ResourceCard: React.FC<{ item: ResourceItem; favorite: boolean; onToggleFavorite: () => void }> = ({ item, favorite, onToggleFavorite }) => {
  const config = RESOURCE_TYPE_CONFIG[item.type];

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-md border border-[var(--ws-color-border-secondary)] bg-[var(--ws-color-surface-2)] p-3 transition-colors hover:border-[var(--ws-color-primary)]"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-text-base">{item.title}</span>
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: config?.color || "var(--ws-color-primary)" }}
            >
              {config?.label || item.type}
            </span>
          </div>
          <p className="mt-1 text-xs text-text-tertiary">{item.description}</p>
          {item.author && <p className="mt-0.5 text-[11px] text-text-tertiary">作者: {item.author}{item.language ? ` · ${item.language === "zh" ? "中文" : "English"}` : ""}</p>}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            onToggleFavorite();
          }}
          className={cn("ml-2 rounded p-1", favorite ? "text-[var(--ws-color-warning)]" : "text-text-tertiary hover:text-[var(--ws-color-warning)]")}
          aria-label={favorite ? `取消收藏 ${item.title}` : `收藏 ${item.title}`}
        >
          <Star className={cn("h-3 w-3", favorite && "fill-[var(--ws-color-warning)]")} />
        </button>
        <ExternalLink className="ml-1 h-3 w-3 shrink-0 text-text-tertiary" />
      </div>
      {item.rating && (
        <div className="mt-1.5 flex items-center gap-0.5">
          {Array.from({ length: item.rating }).map((_, i) => (
            <Star key={i} className="h-3 w-3 fill-[var(--ws-color-warning)] text-[var(--ws-color-warning)]" />
          ))}
        </div>
      )}
    </a>
  );
};

const isBooleanRecord = (value: unknown): value is Record<string, boolean> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.values(item).every((entry) => typeof entry === "boolean");
};

export default AdminMLLearning;
