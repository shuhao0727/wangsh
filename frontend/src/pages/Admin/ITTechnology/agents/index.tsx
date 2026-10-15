/**
 * 智能体学习板块
 *
 * 完整的学习知识体系展示平台，包含：
 * - 学习书 (Book)
 * - 学习地图 (Knowledge Map)
 * - 动手实验 (Experiments)
 * - 工具箱 (Tools)
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPage } from "@/components/Admin";
import { api } from "@/services/api";
import {
  isLearningProgressVersionConflict,
  readLearningProgressEnvelope,
  withLearningProgressVersion,
} from "@/services/learningProgress";
import { showMessage } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  DIFFICULTY_LABELS,
  RESOURCE_TYPE_CONFIG,
  experimentLevels,
  TOOLS_DATA,
  RESOURCES_DATA,
  AGENT_TOOL_CATEGORY_LABELS,
  type Experiment,
  type ResourceItem,
  type ToolItem,
} from "./data";
import {
  fetchLearningContentPayload,
  filterByKeyword,
} from "../learning/helpers";
import { BookReader } from "../learning/BookReader";
import MindMapViewer from "../learning/MindMapViewer";
import { AGENTS_BOOK } from "./book";
import mindmapMd from "./chapters/mindmap.md?raw";

import {
  Map,
  FlaskConical,
  Wrench,
  BookOpen,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Star,
  Bot,
  Cpu,
  Layers,
  Puzzle,
  Copy,
  Download,
  BookMarked,
  ClipboardList,
  Monitor,
  Lightbulb,
} from "lucide-react";

// ────────────────────────────────────────
// 类型定义
// ────────────────────────────────────────

type TabKey = "book" | "knowledge" | "experiments" | "tools";

interface NormalizedProgress {
  overall_percent: number;
  notes: string;
  completedItems: Record<string, boolean>;
  favoriteItems: Record<string, boolean>;
  completedChapters: Record<string, boolean>;
  favoriteChapters: Record<string, boolean>;
}

interface AgentsLearningContentPayload {
  experiments?: Record<string, Experiment[]>;
  tools?: ToolItem[];
  resources?: ResourceItem[];
  book?: typeof AGENTS_BOOK;
}

// ────────────────────────────────────────
// 难度映射
// ────────────────────────────────────────

const CN_DIFFICULTY_TO_KEY: Record<string, Experiment["difficulty"]> = {
  初级: "beginner",
  中级: "intermediate",
  高级: "advanced",
  专家: "expert",
};

/** 将 experimentLevels 中的 agent 实验条目映射为标准 Experiment */
function agentItemToExperiment(item: Record<string, unknown>): Experiment {
  const rawDiff = (item.difficulty as string) || "初级";
  return {
    name: (item.name as string) || "",
    difficulty: CN_DIFFICULTY_TO_KEY[rawDiff] || "beginner",
    data: (item.desc as string) || "",
    tools: Array.isArray(item.tools) ? item.tools : [],
    skills: [],
    goal: (item.goal as string) || "",
    estimated_time: (item.estimated_time as string) || "",
    deliverables: (item.desc as string) || "",
    steps: Array.isArray(item.steps) ? item.steps : undefined,
    code: (item.code as string) || undefined,
    expected_output: (item.expected_output as string) || undefined,
    reflection: Array.isArray(item.reflection) ? item.reflection : undefined,
    download_url: undefined,
    data_source: (item.data_source as string) || undefined,
  };
}

/** 从本地 experimentLevels 构建分组实验 */
function buildFallbackExperiments(): Record<string, Experiment[]> {
  const grouped: Record<string, Experiment[]> = {};
  for (const level of experimentLevels) {
    const key = level.badge as string;
    grouped[key] = (level.items || []).map((item: Record<string, unknown>) =>
      agentItemToExperiment(item),
    );
  }
  return grouped;
}

const FALLBACK_EXPERIMENTS = buildFallbackExperiments();

/** 工具类别图标 */
const CATEGORY_ICON_BY_KEY: Record<string, React.ReactNode> = {
  核心框架: <Layers className="h-4 w-4" />,
  开发工具: <Wrench className="h-4 w-4" />,
  MCP生态: <Puzzle className="h-4 w-4" />,
  向量数据库: <Cpu className="h-4 w-4" />,
  可观测性: <BarChart3 className="h-4 w-4" />,
};
const MINDMAP_MARKDOWN = mindmapMd;

const DEFAULT_PROGRESS: NormalizedProgress = {
  overall_percent: 0,
  notes: "",
  completedItems: {},
  favoriteItems: {},
  completedChapters: {},
  favoriteChapters: {},
};

// ────────────────────────────────────────
// 工具函数
// ────────────────────────────────────────

/** 标准化实验数据 */
function normalizeExperiments(raw: unknown): Record<string, Experiment[]> {
  if (!raw || typeof raw !== "object") return FALLBACK_EXPERIMENTS;
  // experimentLevels 数组格式 [{level, badge, items: [...]}]
  if (Array.isArray(raw))
    return buildFallbackExperimentsFromArray(raw as Record<string, unknown>[]);
  const vals = Object.values(raw);
  if (vals.length === 0) return FALLBACK_EXPERIMENTS;
  // 已是分组格式 {difficulty: Experiment[]}
  if (Array.isArray(vals[0])) return raw as Record<string, Experiment[]>;
  // DB 扁平格式 {name: Experiment} -> 按 difficulty 重新分组
  const grouped: Record<string, Experiment[]> = {};
  for (const exp of vals as Experiment[]) {
    const d = exp.difficulty || "beginner";
    (grouped[d] ??= []).push(exp);
  }
  return grouped;
}

function buildFallbackExperimentsFromArray(
  arr: Record<string, unknown>[],
): Record<string, Experiment[]> {
  const grouped: Record<string, Experiment[]> = {};
  for (const level of arr) {
    const badge = (level.badge as string) || "beginner";
    const items = Array.isArray(level.items) ? level.items : [];
    grouped[badge] = items.map((item: Record<string, unknown>) =>
      agentItemToExperiment(item),
    );
  }
  return grouped;
}

/** 标准化数组数据 */
function normalizeArray<T>(raw: unknown, fallback: T[]): T[] {
  if (!raw || typeof raw !== "object") return fallback;
  const vals = Object.values(raw);
  if (vals.length === 0) return fallback;
  if (Array.isArray(vals[0])) return vals.flat() as T[];
  return vals as T[];
}

const isBooleanRecord = (value: unknown): value is Record<string, boolean> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.values(item).every((entry) => typeof entry === "boolean");
};

// ────────────────────────────────────────
// 主组件
// ────────────────────────────────────────

const normalizeTab = (tab: string | null): TabKey => {
  if (
    tab === "book" ||
    tab === "knowledge" ||
    tab === "experiments" ||
    tab === "tools"
  )
    return tab;
  return "book";
};

const AgentExploration: React.FC<{ embedded?: boolean }> = ({
  embedded = false,
}) => {
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const [activeTabKey, setActiveTabKey] = useState<TabKey>(
    normalizeTab(urlSearchParams.get("tab")),
  );

  // 进度状态
  const [progress, setProgress] =
    useState<NormalizedProgress>(DEFAULT_PROGRESS);
  const [progressLoadState, setProgressLoadState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [progressSaving, setProgressSaving] = useState(false);
  const progressRequestRef = useRef(0);
  const progressSaveRequestRef = useRef(0);
  const progressVersionRef = useRef<string | null>(null);
  const [notesText, setNotesText] = useState("");
  const [experimentKeyword, setExperimentKeyword] = useState("");
  const [experimentDifficulty, setExperimentDifficulty] = useState<
    "all" | Experiment["difficulty"]
  >("all");
  const [toolKeyword, setToolKeyword] = useState("");
  const [toolCategory, setToolCategory] = useState("all");
  const [resourceKeyword, setResourceKeyword] = useState("");
  const [resourceType, setResourceType] = useState<
    "all" | ResourceItem["type"]
  >("all");
  const [mindmapMarkdown, setMindmapMarkdown] = useState(MINDMAP_MARKDOWN);
  const [contentPayload, setContentPayload] =
    useState<AgentsLearningContentPayload | null>(null);
  const [activeBookSlug, setActiveBookSlug] = useState(
    AGENTS_BOOK.chapters[0]?.slug ?? "agent-concept",
  );

  // 读取进度
  const loadProgress = useCallback(async () => {
    const requestId = ++progressRequestRef.current;
    setProgressLoadState("loading");
    try {
      const res = await api.get("/learning/progress/agents");
      if (requestId !== progressRequestRef.current) return;
      const envelope = readLearningProgressEnvelope(res.data);
      const payload = envelope.data;
      progressVersionRef.current = envelope.version;
      setProgress(() => ({
        ...DEFAULT_PROGRESS,
        overall_percent:
          typeof payload.overall_percent === "number"
            ? payload.overall_percent
            : typeof payload.overall_progress === "number"
              ? payload.overall_progress
              : DEFAULT_PROGRESS.overall_percent,
        notes:
          typeof payload.notes === "string"
            ? payload.notes
            : payload.notes === null
              ? ""
              : DEFAULT_PROGRESS.notes,
        completedItems: isBooleanRecord(payload.completedItems)
          ? payload.completedItems
          : DEFAULT_PROGRESS.completedItems,
        favoriteItems: isBooleanRecord(payload.favoriteItems)
          ? payload.favoriteItems
          : DEFAULT_PROGRESS.favoriteItems,
        completedChapters: isBooleanRecord(payload.completedChapters)
          ? payload.completedChapters
          : DEFAULT_PROGRESS.completedChapters,
        favoriteChapters: isBooleanRecord(payload.favoriteChapters)
          ? payload.favoriteChapters
          : DEFAULT_PROGRESS.favoriteChapters,
      }));
      setNotesText(() =>
        typeof payload.notes === "string"
          ? payload.notes
          : payload.notes === null
            ? ""
            : DEFAULT_PROGRESS.notes,
      );
      setProgressLoadState("ready");
    } catch {
      if (requestId !== progressRequestRef.current) return;
      progressVersionRef.current = null;
      setProgressLoadState("error");
      showMessage.error("学习进度读取失败，请重试；当前内容不会覆盖已有进度");
    } finally {
      // requestId 变化时，新的请求拥有自己的状态。
    }
  }, []);

  useEffect(() => {
    void loadProgress();
    return () => {
      progressRequestRef.current += 1;
      progressSaveRequestRef.current += 1;
    };
  }, [loadProgress]);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    void fetchLearningContentPayload<AgentsLearningContentPayload>("agents", controller.signal).then((payload) => {
      if (mounted && payload) setContentPayload(payload);
    });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const experimentsData = normalizeExperiments(contentPayload?.experiments);
  const toolsData = normalizeArray(contentPayload?.tools, TOOLS_DATA);
  const resourcesData = normalizeArray(
    contentPayload?.resources,
    RESOURCES_DATA,
  );
  const bookData = contentPayload?.book ?? AGENTS_BOOK;

  // 从数据库加载思维导图
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await api.get("/learning/content/agents", { signal: controller.signal });
        if (controller.signal.aborted) return;
        const items = Array.isArray(res.data) ? res.data : [];
        const mindmapItem = (items || []).find(
          (d: any) => d.section_key === "mindmap" && d.item_key === "overview",
        );
        if (mindmapItem?.content?.markdown) {
          setMindmapMarkdown(mindmapItem.content.markdown);
        }
      } catch {
        if (!controller.signal.aborted) showMessage.error("加载失败");
      }
    })();
    return () => controller.abort();
  }, []);

  // 保存进度
  const saveProgress = useCallback(async () => {
    if (progressLoadState !== "ready") {
      showMessage.error("学习进度尚未成功读取，暂不能保存");
      return;
    }
    const saveRequestId = ++progressSaveRequestRef.current;
    setProgressSaving(true);
    try {
      const res = await api.patch(
        "/learning/progress/agents",
        withLearningProgressVersion(
          {
            notes: notesText,
            overall_percent: progress.overall_percent,
            completedItems: progress.completedItems,
            favoriteItems: progress.favoriteItems,
            completedChapters: progress.completedChapters,
            favoriteChapters: progress.favoriteChapters,
          },
          progressVersionRef.current,
        ),
      );
      if (saveRequestId !== progressSaveRequestRef.current) return;
      progressVersionRef.current = readLearningProgressEnvelope(
        res.data,
      ).version;
      showMessage.success("进度已保存");
    } catch (error: any) {
      if (saveRequestId !== progressSaveRequestRef.current) return;
      if (isLearningProgressVersionConflict(error)) {
        showMessage.error("进度已在其他标签页更新，正在重新读取最新内容");
        void loadProgress();
      } else {
        showMessage.error("保存失败，请重试");
      }
    } finally {
      if (saveRequestId === progressSaveRequestRef.current)
        setProgressSaving(false);
    }
  }, [loadProgress, progress, notesText, progressLoadState]);

  const toggleCompletedItem = (itemKey: string) => {
    if (progressLoadState !== "ready") return;
    setProgress((prev) => ({
      ...prev,
      completedItems: {
        ...prev.completedItems,
        [itemKey]: !prev.completedItems[itemKey],
      },
    }));
  };

  const toggleFavoriteItem = (itemKey: string) => {
    if (progressLoadState !== "ready") return;
    setProgress((prev) => ({
      ...prev,
      favoriteItems: {
        ...prev.favoriteItems,
        [itemKey]: !prev.favoriteItems[itemKey],
      },
    }));
  };

  const toggleCompletedChapter = (slug: string) => {
    if (progressLoadState !== "ready") return;
    setProgress((prev) => ({
      ...prev,
      completedChapters: {
        ...prev.completedChapters,
        [slug]: !prev.completedChapters[slug],
      },
    }));
  };

  const toggleFavoriteChapter = (slug: string) => {
    if (progressLoadState !== "ready") return;
    setProgress((prev) => ({
      ...prev,
      favoriteChapters: {
        ...prev.favoriteChapters,
        [slug]: !prev.favoriteChapters[slug],
      },
    }));
  };

  // Tab 切换
  const handleTabChange = (key: string) => {
    const next = normalizeTab(key);
    setActiveTabKey(next);
    const params = new URLSearchParams(urlSearchParams);
    params.set("tab", next);
    setUrlSearchParams(params, { replace: true });
  };

  const completedItemCount = Object.values(progress.completedItems).filter(
    Boolean,
  ).length;
  const favoriteItemCount = Object.values(progress.favoriteItems).filter(
    Boolean,
  ).length;

  const experimentList = useMemo(
    () => Object.values(experimentsData).flat(),
    [experimentsData],
  );
  const filteredExperiments = useMemo(() => {
    const byDifficulty =
      experimentDifficulty === "all"
        ? experimentList
        : experimentList.filter(
            (item) => item.difficulty === experimentDifficulty,
          );
    return filterByKeyword(
      byDifficulty.map((item) => ({
        ...item,
        title: item.name,
        summary: item.data,
        tags: [...(item.tools || []), ...(item.skills || [])],
      })),
      experimentKeyword,
    );
  }, [experimentDifficulty, experimentKeyword, experimentList]);

  const filteredTools = useMemo(() => {
    const byCategory =
      toolCategory === "all"
        ? toolsData
        : toolsData.filter((tool) => tool.category === toolCategory);
    return filterByKeyword(
      byCategory.map((tool) => ({
        ...tool,
        title: tool.name,
        summary: tool.description,
        tags: [AGENT_TOOL_CATEGORY_LABELS[tool.category] ?? tool.category],
      })),
      toolKeyword,
    );
  }, [toolCategory, toolKeyword, toolsData]);

  const toolsByCategory = useMemo(
    () =>
      filteredTools.reduce<Record<string, ToolItem[]>>((acc, tool) => {
        if (!acc[tool.category]) acc[tool.category] = [];
        acc[tool.category].push(tool);
        return acc;
      }, {}),
    [filteredTools],
  );

  const filteredResources = useMemo(() => {
    const byType =
      resourceType === "all"
        ? resourcesData
        : resourcesData.filter((resource) => resource.type === resourceType);
    return filterByKeyword(
      byType.map((resource) => ({
        ...resource,
        tags: [RESOURCE_TYPE_CONFIG[resource.type]?.label ?? resource.type],
      })),
      resourceKeyword,
    );
  }, [resourceKeyword, resourceType, resourcesData]);

  const content = (
    <div className="flex min-h-0 flex-1 flex-col gap-item-gap">
      {/* 页面标题 */}
      <div className="flex flex-wrap items-center gap-3">
        <Bot className="h-6 w-6 text-[var(--ws-color-primary)]" />
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-text-base sm:text-lg">
            智能体学习中心
          </h1>
          <p className="text-xs text-text-tertiary">
            系统化学习路径 / 知识体系 / 实战项目
          </p>
        </div>
        {activeTabKey === "book" && (
          <button
            type="button"
            onClick={
              progressLoadState === "error"
                ? () => void loadProgress()
                : saveProgress
            }
            disabled={progressSaving || progressLoadState === "loading"}
            className="ml-auto rounded-md bg-[var(--ws-color-primary)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {progressSaving
              ? "保存中..."
              : progressLoadState === "error"
                ? "重新读取"
                : "保存进度"}
          </button>
        )}
      </div>

      {progressLoadState !== "ready" && (
        <div
          role={progressLoadState === "error" ? "alert" : "status"}
          className="flex items-center gap-3 text-xs text-text-secondary"
        >
          <span>
            {progressLoadState === "loading"
              ? "正在读取学习进度，暂不能标记或收藏。"
              : "学习进度读取失败，暂不能标记或收藏。"}
          </span>
          {progressLoadState === "error" && (
            <Button variant="outline" size="sm" onClick={() => void loadProgress()}>
              重试读取
            </Button>
          )}
        </div>
      )}

      {/* Tab 导航 */}
      <Tabs
        value={activeTabKey}
        onValueChange={handleTabChange}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="inline-flex h-auto min-h-10 w-full flex-wrap justify-start gap-2xs shrink-0">
          <TabsTrigger value="book" className="gap-1.5">
            <BookMarked className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">学习书</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-1.5">
            <Map className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">学习地图</span>
          </TabsTrigger>
          <TabsTrigger value="experiments" className="gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">动手实验</span>
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">工具箱</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: 学习书 */}
        <TabsContent
          value="book"
          className="flex-1 overflow-auto pt-3 outline-none"
        >
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

        {/* Tab: 学习地图 */}
        <TabsContent
          value="knowledge"
          className="flex-1 overflow-hidden pt-3 outline-none"
        >
          <MindMapViewer
            markdown={mindmapMarkdown}
            onNodeClick={(text: string) => {
              const mapping: Record<string, string> = {
                "Agent 定义": "agent-concept",
                "ReAct 推理-行动模式": "react-pattern",
                "Prompt 工程": "prompt-engineering",
                "Function Calling": "function-calling",
                "RAG 检索增强生成": "rag",
                "Supervisor-Worker 模式": "multi-agent-arch",
              };
              const slug = mapping[text];
              if (slug) {
                setActiveBookSlug(slug);
                handleTabChange("book");
              }
            }}
          />
        </TabsContent>

        {/* Tab: 动手实验 */}
        <TabsContent
          value="experiments"
          className="flex-1 overflow-auto pt-3 outline-none"
        >
          <div className="space-y-form-field-gap">
            <div className="rounded-lg border border-[var(--ws-color-border-secondary)] bg-[var(--ws-color-surface-2)] p-3">
              <div className="grid gap-xs sm:grid-cols-[1fr_160px]">
                <Input
                  value={experimentKeyword}
                  onChange={(event) => setExperimentKeyword(event.target.value)}
                  placeholder="搜索实验、工具或技能"
                  className="h-9 rounded-md border border-[var(--ws-color-border)] bg-surface px-3 text-sm text-text-base placeholder:text-text-tertiary focus:border-[var(--ws-color-primary)] focus:outline-none"
                  clearable
                  onClear={() => setExperimentKeyword("")}
                />
                <Select
                  value={experimentDifficulty}
                  onValueChange={(value) =>
                    setExperimentDifficulty(
                      value as typeof experimentDifficulty,
                    )
                  }
                >
                  <SelectTrigger className="h-9 rounded-md border border-[var(--ws-color-border)] bg-surface px-3 text-sm text-text-base focus:border-[var(--ws-color-primary)] focus:outline-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部难度</SelectItem>
                    <SelectItem value="beginner">入门</SelectItem>
                    <SelectItem value="intermediate">中级</SelectItem>
                    <SelectItem value="advanced">高级</SelectItem>
                    <SelectItem value="expert">专家</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="mt-xs text-xs text-text-tertiary">
                匹配 {filteredExperiments.length} 个实验，可直接标记完成或收藏。
              </p>
            </div>

            {filteredExperiments.length === 0 && (
              <div className="rounded-md border border-dashed border-[var(--ws-color-border-secondary)] p-panel-padding text-center text-sm text-text-tertiary">
                未找到匹配的实验，请调整关键词或难度筛选。
              </div>
            )}

            {/* 入门 */}
            <div>
              <h3 className="mb-3 flex items-center gap-xs text-sm font-semibold text-text-base">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--ws-color-success)] text-xs text-white">
                  1
                </span>
                入门级实验
                <Badge variant="success" className="text-xs">
                  适合新手
                </Badge>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredExperiments
                  .filter((exp) => exp.difficulty === "beginner")
                  .map((exp) => (
                    <ExperimentCard
                      progressDisabled={progressLoadState !== "ready"}
                      key={exp.name}
                      experiment={exp}
                      completed={Boolean(
                        progress.completedItems[`experiment:${exp.name}`],
                      )}
                      favorite={Boolean(
                        progress.favoriteItems[`experiment:${exp.name}`],
                      )}
                      onToggleCompleted={() =>
                        toggleCompletedItem(`experiment:${exp.name}`)
                      }
                      onToggleFavorite={() =>
                        toggleFavoriteItem(`experiment:${exp.name}`)
                      }
                    />
                  ))}
              </div>
            </div>

            {/* 中级 */}
            <div>
              <h3 className="mb-3 flex items-center gap-xs text-sm font-semibold text-text-base">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--ws-color-warning)] text-xs text-white">
                  2
                </span>
                中级实验
                <Badge variant="warning" className="text-xs">
                  需要基础
                </Badge>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredExperiments
                  .filter((exp) => exp.difficulty === "intermediate")
                  .map((exp) => (
                    <ExperimentCard
                      progressDisabled={progressLoadState !== "ready"}
                      key={exp.name}
                      experiment={exp}
                      completed={Boolean(
                        progress.completedItems[`experiment:${exp.name}`],
                      )}
                      favorite={Boolean(
                        progress.favoriteItems[`experiment:${exp.name}`],
                      )}
                      onToggleCompleted={() =>
                        toggleCompletedItem(`experiment:${exp.name}`)
                      }
                      onToggleFavorite={() =>
                        toggleFavoriteItem(`experiment:${exp.name}`)
                      }
                    />
                  ))}
              </div>
            </div>

            {/* 高级 */}
            <div>
              <h3 className="mb-3 flex items-center gap-xs text-sm font-semibold text-text-base">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--ws-color-error)] text-xs text-white">
                  3
                </span>
                高级实验
                <Badge variant="danger" className="text-xs">
                  需深度学习基础
                </Badge>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredExperiments
                  .filter((exp) => exp.difficulty === "advanced")
                  .map((exp) => (
                    <ExperimentCard
                      progressDisabled={progressLoadState !== "ready"}
                      key={exp.name}
                      experiment={exp}
                      completed={Boolean(
                        progress.completedItems[`experiment:${exp.name}`],
                      )}
                      favorite={Boolean(
                        progress.favoriteItems[`experiment:${exp.name}`],
                      )}
                      onToggleCompleted={() =>
                        toggleCompletedItem(`experiment:${exp.name}`)
                      }
                      onToggleFavorite={() =>
                        toggleFavoriteItem(`experiment:${exp.name}`)
                      }
                    />
                  ))}
              </div>
            </div>

            {/* 专家 */}
            {filteredExperiments.some((exp) => exp.difficulty === "expert") && (
              <div>
                <h3 className="mb-3 flex items-center gap-xs text-sm font-semibold text-text-base">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-purple text-xs text-white">
                    4
                  </span>
                  专家实验
                  <Badge variant="info" className="text-xs">
                    需工程实践基础
                  </Badge>
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredExperiments
                    .filter((exp) => exp.difficulty === "expert")
                    .map((exp) => (
                      <ExperimentCard
                        progressDisabled={progressLoadState !== "ready"}
                        key={exp.name}
                        experiment={exp}
                        completed={Boolean(
                          progress.completedItems[`experiment:${exp.name}`],
                        )}
                        favorite={Boolean(
                          progress.favoriteItems[`experiment:${exp.name}`],
                        )}
                        onToggleCompleted={() =>
                          toggleCompletedItem(`experiment:${exp.name}`)
                        }
                        onToggleFavorite={() =>
                          toggleFavoriteItem(`experiment:${exp.name}`)
                        }
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: 工具箱 */}
        <TabsContent
          value="tools"
          className="flex-1 overflow-auto pt-3 outline-none"
        >
          <div className="space-y-item-gap">
            <div className="rounded-lg border border-[var(--ws-color-border-secondary)] bg-[var(--ws-color-surface-2)] p-3">
              <div className="grid gap-xs sm:grid-cols-[1fr_180px]">
                <Input
                  value={toolKeyword}
                  onChange={(event) => setToolKeyword(event.target.value)}
                  placeholder="搜索工具名称、用途或类别"
                  className="h-9 rounded-md border border-[var(--ws-color-border)] bg-surface px-3 text-sm text-text-base placeholder:text-text-tertiary focus:border-[var(--ws-color-primary)] focus:outline-none"
                  clearable
                  onClear={() => setToolKeyword("")}
                />
                <Select
                  value={toolCategory}
                  onValueChange={(value) => setToolCategory(value)}
                >
                  <SelectTrigger className="h-9 rounded-md border border-[var(--ws-color-border)] bg-surface px-3 text-sm text-text-base focus:border-[var(--ws-color-primary)] focus:outline-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类别</SelectItem>
                    {Object.entries(AGENT_TOOL_CATEGORY_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <p className="mt-xs text-xs text-text-tertiary">
                匹配 {filteredTools.length} 个工具，支持按类别快速聚焦。
              </p>
            </div>

            {filteredTools.length === 0 && (
              <div className="rounded-md border border-dashed border-[var(--ws-color-border-secondary)] p-panel-padding text-center text-sm text-text-tertiary">
                未找到匹配的工具，请调整关键词或类别筛选。
              </div>
            )}

            {Object.entries(toolsByCategory).map(([category, tools]) => (
              <Card key={category}>
                <CardHeader className="pb-xs">
                  <CardTitle className="flex items-center gap-xs text-sm font-semibold">
                    {CATEGORY_ICON_BY_KEY[category] ?? (
                      <Wrench className="h-4 w-4" />
                    )}
                    {AGENT_TOOL_CATEGORY_LABELS[category] || category}
                    <span className="ml-2xs text-xs font-normal text-text-tertiary">
                      ({tools.length} 个工具)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {tools.map((tool) => (
                      <div
                        key={tool.name}
                        className="rounded-md border border-[var(--ws-color-border-secondary)] bg-[var(--ws-color-surface-2)] p-3 transition-colors hover:border-[var(--ws-color-primary)] hover:bg-[var(--ws-color-primary-soft)]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-text-base">
                            {tool.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {tool.difficulty && (
                              <Badge
                                variant={
                                  DIFFICULTY_LABELS[tool.difficulty]
                                    ?.variant as any
                                }
                                className="text-3xs px-1.5 py-0"
                              >
                                {DIFFICULTY_LABELS[tool.difficulty]?.label}
                              </Badge>
                            )}
                            {tool.url && (
                              <a
                                href={tool.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-text-tertiary hover:text-[var(--ws-color-primary)] rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                        <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">
                          {tool.description}
                        </p>
                        {tool.pip_install && (
                          <p className="mt-xs font-mono text-3xs text-text-tertiary bg-[var(--ws-color-surface)] rounded px-1.5 py-0.5 select-all">
                            {tool.pip_install}
                          </p>
                        )}
                        {tool.related_experiments &&
                          tool.related_experiments.length > 0 && (
                            <div className="mt-xs flex flex-wrap gap-2xs">
                              {tool.related_experiments
                                .slice(0, 3)
                                .map((exp) => (
                                  <span
                                    key={exp}
                                    className="text-3xs text-[var(--ws-color-primary)] bg-[var(--ws-color-primary-soft)] rounded px-1.5 py-0.5"
                                  >
                                    {exp}
                                  </span>
                                ))}
                              {tool.related_experiments.length > 3 && (
                                <span className="text-3xs text-text-tertiary">
                                  +{tool.related_experiments.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* ── 学习资源 ── */}
            <div className="mt-6 border-t border-[var(--ws-color-border-secondary)] pt-6">
              <h3 className="mb-3 flex items-center gap-xs text-sm font-semibold text-text-base">
                <BookOpen className="h-4 w-4 text-[var(--ws-color-primary)]" />
                学习资源
                <span className="text-xs font-normal text-text-tertiary">
                  ({filteredResources.length} 个资源)
                </span>
              </h3>

              <div className="mb-4 rounded-lg border border-[var(--ws-color-border-secondary)] bg-[var(--ws-color-surface-2)] p-3">
                <div className="grid gap-xs sm:grid-cols-[1fr_160px]">
                  <Input
                    value={resourceKeyword}
                    onChange={(event) => setResourceKeyword(event.target.value)}
                    placeholder="搜索资源名称、描述或类型"
                    className="h-9 rounded-md border border-[var(--ws-color-border)] bg-surface px-3 text-sm text-text-base placeholder:text-text-tertiary focus:border-[var(--ws-color-primary)] focus:outline-none"
                    clearable
                    onClear={() => setResourceKeyword("")}
                  />
                  <Select
                    value={resourceType}
                    onValueChange={(value) =>
                      setResourceType(value as typeof resourceType)
                    }
                  >
                    <SelectTrigger className="h-9 rounded-md border border-[var(--ws-color-border)] bg-surface px-3 text-sm text-text-base focus:border-[var(--ws-color-primary)] focus:outline-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部类型</SelectItem>
                      {Object.entries(RESOURCE_TYPE_CONFIG).map(
                        ([value, config]) => (
                          <SelectItem key={value} value={value}>
                            {config.label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredResources.length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--ws-color-border-secondary)] p-panel-padding text-center text-sm text-text-tertiary">
                  未找到匹配的资源，请调整关键词或类型筛选。
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredResources.map((resource) => (
                    <ResourceCard
                      progressDisabled={progressLoadState !== "ready"}
                      key={resource.title}
                      item={resource}
                      favorite={Boolean(
                        progress.favoriteItems[`resource:${resource.title}`],
                      )}
                      onToggleFavorite={() =>
                        toggleFavoriteItem(`resource:${resource.title}`)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  if (embedded) return content;

  return <AdminPage scrollable={false}>{content}</AdminPage>;
};

// ────────────────────────────────────────
// 子卡片组件
// ────────────────────────────────────────

type SectionKey = "steps" | "code" | "data" | "reflection";

const TAB_CONFIG: { key: SectionKey; label: string; icon: React.ReactNode }[] =
  [
    {
      key: "steps",
      label: "实验步骤",
      icon: <ClipboardList className="h-4 w-4" />,
    },
    { key: "code", label: "实验代码", icon: <Monitor className="h-4 w-4" /> },
    { key: "data", label: "实验数据", icon: <BarChart3 className="h-4 w-4" /> },
    {
      key: "reflection",
      label: "思考题",
      icon: <Lightbulb className="h-4 w-4" />,
    },
  ];

/** 实验卡片 */
const ExperimentCard: React.FC<{
  experiment: Experiment;
  completed: boolean;
  favorite: boolean;
  progressDisabled: boolean;
  onToggleCompleted: () => void;
  onToggleFavorite: () => void;
}> = ({
  experiment,
  completed,
  favorite,
  progressDisabled,
  onToggleCompleted,
  onToggleFavorite,
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SectionKey>("steps");
  const diff = DIFFICULTY_LABELS[experiment.difficulty];

  return (
    <>
      {/* Compact list card */}
      <div
        className={cn(
          "rounded-md border bg-[var(--ws-color-surface-2)] p-3 transition-colors hover:border-[var(--ws-color-primary)] hover:bg-[var(--ws-color-primary-soft)] cursor-pointer",
          completed
            ? "border-[var(--ws-color-success)]"
            : "border-[var(--ws-color-border-secondary)]",
        )}
        onClick={() => {
          setOpen(true);
          setTab("steps");
        }}
      >
        <div className="flex items-start justify-between gap-xs">
          <h3 className="text-sm font-medium text-text-base">
            {experiment.name}
          </h3>
          <div className="flex shrink-0 items-center gap-2xs">
            <button
              type="button"
              disabled={progressDisabled}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={cn(
                "rounded p-2xs transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                favorite
                  ? "text-[var(--ws-color-warning)]"
                  : "text-text-tertiary hover:text-[var(--ws-color-warning)]",
              )}
            >
              <Star
                className={cn(
                  "h-3.5 w-3.5",
                  favorite && "fill-[var(--ws-color-warning)]",
                )}
              />
            </button>
            <Badge variant={diff.variant as any} className="text-xs">
              {diff.label}
            </Badge>
          </div>
        </div>
        <div className="mt-xs space-y-2xs text-xs text-text-tertiary">
          <p>{experiment.data}</p>
          <p>
            ⏱ {experiment.estimated_time} · 🎯 {experiment.goal}
          </p>
          <div className="flex flex-wrap gap-2xs">
            {experiment.tools.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded bg-[var(--ws-color-surface)] px-1.5 py-0.5"
              >
                {t}
              </span>
            ))}
            {experiment.tools.length > 4 && (
              <span className="text-text-tertiary">
                +{experiment.tools.length - 4}
              </span>
            )}
          </div>
        </div>
        <div className="mt-xs flex items-center gap-xs">
          <button
            type="button"
            disabled={progressDisabled}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCompleted();
            }}
            className={cn(
              "inline-flex items-center gap-2xs rounded-md px-xs py-2xs text-xs font-medium",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              completed
                ? "bg-[var(--ws-color-success)] text-white"
                : "bg-[var(--ws-color-surface)] text-text-secondary",
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {completed ? "已完成" : "标记"}
          </button>
          <span className="text-xs text-[var(--ws-color-primary)]">
            点击查看详情 →
          </span>
        </div>
      </div>

      {/* ── Single Modal with Tabs ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ws-color-overlay)] p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${experiment.name} - 实验详情`}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-surface shadow-2xl"
            ref={(el) => {
              if (el) {
                const first =
                  el.querySelector<HTMLElement>("button, [tabindex]");
                first?.focus();
              }
            }}
          >
            {/* Header */}
            <div className="shrink-0 border-b border-border px-6 pt-5 pb-3">
              <div className="flex items-center justify-between mb-xs">
                <h2 className="text-lg font-bold">{experiment.name}</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded p-2xs hover:bg-accent text-lg leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="关闭"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-xs text-xs text-text-tertiary">
                <Badge variant={diff.variant as any} className="text-3xs">
                  {diff.label}
                </Badge>
                <span>⏱ {experiment.estimated_time}</span>
                <span>{experiment.data}</span>
              </div>
              <p className="mt-xs text-xs text-text-secondary">
                🎯 {experiment.goal}
              </p>
            </div>

            {/* Tab bar */}
            <div className="shrink-0 flex border-b border-border bg-[var(--ws-color-surface-2)] px-3">
              {TAB_CONFIG.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-[1px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    tab === t.key
                      ? "border-[var(--ws-color-primary)] text-[var(--ws-color-primary)]"
                      : "border-transparent text-text-tertiary hover:text-text-secondary",
                  )}
                >
                  <span className="text-base">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-auto p-panel-padding animate-ws-fade-in-up">
              {/* Steps */}
              {tab === "steps" && experiment.steps && (
                <div className="space-y-3">
                  <ol className="space-y-3 ml-5 list-decimal text-sm text-text-secondary leading-relaxed">
                    {experiment.steps.map((s, i) => (
                      <li key={i} className="pl-2xs">
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Code */}
              {tab === "code" && experiment.code && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-text-tertiary">
                      可复制到 Jupyter Notebook / Google Colab 运行
                    </p>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2xs rounded-md px-2.5 py-2xs text-xs text-text-secondary hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            experiment.code || "",
                          );
                          showMessage.success("代码已复制到剪贴板");
                        } catch {
                          showMessage.error("复制失败");
                        }
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      复制代码
                    </button>
                  </div>
                  <pre className="overflow-auto rounded-lg bg-[var(--ws-color-code-bg)] p-5 text-xs leading-relaxed text-[var(--ws-color-code-text)]">
                    {experiment.code}
                  </pre>
                </div>
              )}

              {/* Data */}
              {tab === "data" && (
                <div>
                  <div className="rounded-lg border border-border bg-[var(--ws-color-surface-2)] p-5 mb-4">
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {experiment.data_source || experiment.data}
                    </p>
                  </div>
                  {experiment.download_url ? (
                    <a
                      href={experiment.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-xs rounded-md bg-[var(--ws-color-primary)] px-4 py-xs text-sm font-medium text-white hover:opacity-90 transition-opacity no-underline mb-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Download className="h-4 w-4" />
                      下载数据文件
                    </a>
                  ) : (
                    <div className="mb-5 rounded-md bg-[var(--ws-color-surface-2)] px-4 py-2.5 text-sm text-text-secondary">
                      此实验的数据通过代码中的 API
                      调用或内置数据集加载，无需手动下载。
                    </div>
                  )}
                  {experiment.expected_output && (
                    <>
                      <h3 className="text-sm font-semibold mb-2.5">预期输出</h3>
                      <div className="rounded-lg border border-border bg-[var(--ws-color-surface-2)] p-4">
                        <p className="text-sm text-text-secondary leading-relaxed">
                          {experiment.expected_output}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Reflection */}
              {tab === "reflection" && experiment.reflection && (
                <div>
                  <p className="text-xs text-text-tertiary mb-4">
                    动手完成后思考以下问题，加深理解
                  </p>
                  <ul className="space-y-item-gap">
                    {experiment.reflection.map((r, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ws-color-surface-2)] text-xs font-bold text-text-tertiary">
                          {i + 1}
                        </span>
                        <span className="text-sm text-text-secondary leading-relaxed pt-0.5">
                          {r}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 flex items-center justify-between border-t border-border px-6 py-3 bg-[var(--ws-color-surface-2)]">
              <Button
                size="sm"
                variant={completed ? "secondary" : "outline"}
                disabled={progressDisabled}
                onClick={onToggleCompleted}
              >
                <CheckCircle2 className="h-4 w-4 mr-2xs" />
                {completed ? "已完成" : "标记完成"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/** 资源卡片 */
const ResourceCard: React.FC<{
  item: ResourceItem;
  favorite: boolean;
  progressDisabled: boolean;
  onToggleFavorite: () => void;
}> = ({ item, favorite, progressDisabled, onToggleFavorite }) => {
  const config = RESOURCE_TYPE_CONFIG[item.type];

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-md border border-[var(--ws-color-border-secondary)] bg-[var(--ws-color-surface-2)] p-3 transition-colors hover:border-[var(--ws-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-xs">
            <span className="truncate text-sm font-medium text-text-base">
              {item.title}
            </span>
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-3xs font-medium text-white"
              style={{
                backgroundColor: config?.color || "var(--ws-color-primary)",
              }}
            >
              {config?.label || item.type}
            </span>
          </div>
          <p className="mt-2xs text-xs text-text-tertiary">
            {item.description}
          </p>
        </div>
        <button
          type="button"
          disabled={progressDisabled}
          onClick={(event) => {
            event.preventDefault();
            onToggleFavorite();
          }}
          className={cn(
            "ml-xs rounded p-2xs",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            favorite
              ? "text-[var(--ws-color-warning)]"
              : "text-text-tertiary hover:text-[var(--ws-color-warning)]",
          )}
          aria-label={
            favorite ? `取消收藏 ${item.title}` : `收藏 ${item.title}`
          }
        >
          <Star
            className={cn(
              "h-3 w-3",
              favorite && "fill-[var(--ws-color-warning)]",
            )}
          />
        </button>
        <ExternalLink className="ml-2xs h-3 w-3 shrink-0 text-text-tertiary" />
      </div>
      {item.rating && (
        <div className="mt-1.5 flex items-center gap-0.5">
          {Array.from({ length: item.rating }).map((_, i) => (
            <Star
              key={i}
              className="h-3 w-3 fill-[var(--ws-color-warning)] text-[var(--ws-color-warning)]"
            />
          ))}
        </div>
      )}
    </a>
  );
};

export default AgentExploration;
