/**
 * 人工智能探索 —— AI 知识探索平台
 *
 * Tab 1: 学习路线图 (Roadmap)
 * Tab 2: AI 知识全景 (Knowledge Map)
 * Tab 3: Prompt 工程 (Prompt Engineering)
 * Tab 4: 生成式 AI 工具 (GenAI Tools)
 * Tab 5: AI 安全与伦理 (Safety & Ethics)
 * Tab 6: 学习进度 (Progress)
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "@services";
import { showMessage } from "@/lib/toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminPage } from "@components/Admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  Lightbulb,
  Map,
  MessageSquare,
  Route,
  Shield,
  Sparkles,
  Star,
  Target,
  Wrench,
} from "lucide-react";
import {
  AI_DOMAINS,
  ETHICS_CASES,
  ETHICS_TOPICS,
  GENAI_TOOL_CATEGORIES,
  MILESTONES,
  PROMPT_CHECKLIST,
  PROMPT_LEVELS,
  PROMPT_TEMPLATES,
  RESPONSIBLE_AI_PRINCIPLES,
  ROADMAP_STAGES,
} from "./data";
import { fetchLearningContentPayload, filterByKeyword } from "../learning/helpers";
import { BookReader } from "../learning/BookReader";
import { AI_BOOK } from "./book";

/* ───────────── 工具函数 ───────────── */

type TabKey = "book" | "roadmap" | "knowledge" | "prompt" | "tools" | "ethics" | "progress";

const ALL_TABS: TabKey[] = ["book", "roadmap", "knowledge", "prompt", "tools", "ethics", "progress"];

const TAB_LABELS: Record<TabKey, string> = {
  book: "学习书",
  roadmap: "学习路线图",
  knowledge: "AI 知识全景",
  prompt: "Prompt 工程",
  tools: "生成式 AI 工具",
  ethics: "安全与伦理",
  progress: "学习进度",
};

const TAB_ICONS: Record<TabKey, React.ReactNode> = {
  book: <BookOpen className="h-3.5 w-3.5" />,
  roadmap: <Route className="h-3.5 w-3.5" />,
  knowledge: <Map className="h-3.5 w-3.5" />,
  prompt: <MessageSquare className="h-3.5 w-3.5" />,
  tools: <Wrench className="h-3.5 w-3.5" />,
  ethics: <Shield className="h-3.5 w-3.5" />,
  progress: <BarChart3 className="h-3.5 w-3.5" />,
};

const normalizeTab = (tab: string | null): TabKey => {
  if (ALL_TABS.includes(tab as TabKey)) return tab as TabKey;
  return "book";
};

const LEVEL_ICON_BY_KEY: Record<string, React.ReactNode> = {
  star: <Star className="h-4 w-4" />,
  target: <Target className="h-4 w-4" />,
  lightbulb: <Lightbulb className="h-4 w-4" />,
};

const ETHICS_ICON_BY_KEY: Record<string, React.ReactNode> = {
  target: <Target className="h-5 w-5" />,
  check: <CheckCircle2 className="h-5 w-5" />,
  lightbulb: <Lightbulb className="h-5 w-5" />,
  shield: <Shield className="h-5 w-5" />,
  alert: <AlertTriangle className="h-5 w-5" />,
};

/** 学习进度相关类型 */
interface LearningProgress {
  stages: {
    id: string;
    name: string;
    progress: number;
    status: "not_started" | "in_progress" | "completed";
    notes?: string;
  }[];
  overall: number;
  completedChapters?: Record<string, boolean>;
  favoriteChapters?: Record<string, boolean>;
}

interface LearningProgressResponse {
  data?: LearningProgress;
}

interface AdminAIExplorationProps {
  embedded?: boolean;
}

interface AIExplorationContentPayload {
  roadmapStages?: typeof ROADMAP_STAGES;
  milestones?: typeof MILESTONES;
  domains?: typeof AI_DOMAINS;
  promptLevels?: typeof PROMPT_LEVELS;
  promptTemplates?: typeof PROMPT_TEMPLATES;
  promptChecklist?: typeof PROMPT_CHECKLIST;
  toolCategories?: typeof GENAI_TOOL_CATEGORIES;
  ethicsTopics?: typeof ETHICS_TOPICS;
  ethicsCases?: typeof ETHICS_CASES;
  responsiblePrinciples?: typeof RESPONSIBLE_AI_PRINCIPLES;
  book?: typeof AI_BOOK;
}


const DEFAULT_PROGRESS: LearningProgress = {
  stages: [
    { id: "stage-1", name: "AI 概览与数学基础", progress: 0, status: "not_started" },
    { id: "stage-2", name: "机器学习核心", progress: 0, status: "not_started" },
    { id: "stage-3", name: "深度学习与神经网络", progress: 0, status: "not_started" },
    { id: "stage-4", name: "NLP 与计算机视觉", progress: 0, status: "not_started" },
    { id: "stage-5", name: "生成式 AI 与大模型", progress: 0, status: "not_started" },
    { id: "stage-6", name: "AI 应用与前沿", progress: 0, status: "not_started" },
  ],
  overall: 0,
  completedChapters: {},
  favoriteChapters: {},
};

const normalizeProgress = (value: unknown): LearningProgress | null => {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<LearningProgress>;
  if (!Array.isArray(data.stages)) return null;
  return {
    stages: DEFAULT_PROGRESS.stages.map((stage) => {
      const saved = data.stages?.find((item) => item?.id === stage.id);
      return {
        ...stage,
        ...saved,
        progress: typeof saved?.progress === "number" ? saved.progress : stage.progress,
        status: saved?.status ?? stage.status,
      };
    }),
    overall: typeof data.overall === "number" ? data.overall : DEFAULT_PROGRESS.overall,
    completedChapters: isBooleanRecord(data.completedChapters) ? data.completedChapters : {},
    favoriteChapters: isBooleanRecord(data.favoriteChapters) ? data.favoriteChapters : {},
  };
};

const isBooleanRecord = (value: unknown): value is Record<string, boolean> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((item) => typeof item === "boolean");
};

/* ───────────── 子组件 ───────────── */

/** 学习路线图卡片 */
const StageCard: React.FC<{
  stage: (typeof ROADMAP_STAGES)[number];
  index: number;
}> = ({ stage, index }) => (
  <div
    className="group relative rounded-lg border p-4 transition-shadow hover:shadow-md"
    style={{ borderLeftColor: stage.color, borderLeftWidth: 3 }}
  >
    {/* 阶段序号 */}
    <div
      className="absolute -left-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: stage.color }}
    >
      {index + 1}
    </div>

    <div className="ml-1">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-sm font-semibold">{stage.title}</h3>
        <Badge variant="outline" className="text-[11px]">
          {stage.duration}
        </Badge>
      </div>

      <div className="mb-2 mt-2 space-y-0.5">
        {stage.topics.map((topic) => (
          <div key={topic} className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ChevronRight className="mt-0.5 h-3 w-3 shrink-0" style={{ color: stage.color }} />
            <span>{topic}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {stage.resources.map((r) => (
          <Badge key={r.name} variant="secondary" className="text-[10px] font-normal">
            {r.name}
            <span className="ml-1 text-[9px] text-muted-foreground">({r.type})</span>
          </Badge>
        ))}
      </div>
    </div>
  </div>
);

/** 简化的 Mermaid 时间线渲染 */
const TimelineView: React.FC<{ milestones?: typeof MILESTONES }> = ({ milestones = MILESTONES }) => (
  <div className="relative mx-auto max-w-3xl">
    {/* 中央时间轴线 */}
    <div className="absolute left-[19px] top-0 h-full w-0.5 bg-border md:left-1/2 md:-translate-x-px" />

    {milestones.map((m, i) => {
      const isLeft = i % 2 === 0;
      return (
        <div
          key={m.year}
          className={`relative mb-6 flex flex-col md:flex-row ${isLeft ? "md:flex-row" : "md:flex-row-reverse"}`}
        >
          {/* 时间标记 */}
          <div className="absolute left-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background text-[10px] font-bold md:left-1/2 md:-translate-x-1/2">
            {m.year}
          </div>

          {/* 内容卡片 */}
          <div
            className={`ml-12 rounded-lg border bg-card p-3 md:ml-0 md:w-[calc(50%-2rem)] ${
              isLeft ? "md:mr-auto md:pr-6" : "md:ml-auto md:pl-6"
            }`}
          >
            <h4 className="text-sm font-semibold">{m.event}</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">{m.desc}</p>
          </div>
        </div>
      );
    })}
  </div>
);

/** 领域树节点 */
const DomainCard: React.FC<{
  domain: (typeof AI_DOMAINS)[number];
}> = ({ domain }) => (
  <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
    <div className="mb-2 flex items-center gap-2">
      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: domain.color }} />
      <h4 className="text-sm font-semibold">{domain.name}</h4>
    </div>
    <p className="mb-2 text-[11px] text-muted-foreground">{domain.desc}</p>
    <div className="flex flex-wrap gap-1">
      {domain.sub.map((s) => (
        <Badge key={s} variant="outline" className="text-[10px] font-normal">
          {s}
        </Badge>
      ))}
    </div>
  </div>
);

/** Prompt 级别卡片 */
const PromptLevelCard: React.FC<{
  level: (typeof PROMPT_LEVELS)[number];
}> = ({ level }) => (
  <div className="rounded-lg border bg-card p-4">
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ backgroundColor: level.color }}>
        {LEVEL_ICON_BY_KEY[level.icon] ?? <Star className="h-4 w-4" />}
      </div>
      <h4 className="text-sm font-semibold">{level.level}</h4>
    </div>
    <div className="space-y-2.5">
      {level.items.map((item) => (
        <div key={item.title}>
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <CheckCircle2 className="h-3 w-3" style={{ color: level.color }} />
            {item.title}
          </div>
          <p className="ml-5 text-[11px] text-muted-foreground">{item.desc}</p>
        </div>
      ))}
    </div>
  </div>
);

/** 工具对比表行 */
const ToolRow: React.FC<{
  tool: (typeof GENAI_TOOL_CATEGORIES)[number]["tools"][number];
}> = ({ tool }) => (
  <tr className="border-b last:border-b-0 hover:bg-muted/30">
    <td className="py-2.5 pr-3">
      <div className="text-sm font-medium">{tool.name}</div>
    </td>
    <td className="py-2.5 pr-3">
      <p className="text-[11px] text-muted-foreground leading-relaxed">{tool.desc}</p>
    </td>
    <td className="py-2.5 pr-3">
      <Badge variant="outline" className="text-[10px] whitespace-nowrap">
        {tool.pricing}
      </Badge>
    </td>
    <td className="py-2.5">
      <span className="text-[11px] text-muted-foreground">{tool.use}</span>
    </td>
  </tr>
);

/** 伦理主题卡片 */
const EthicsCard: React.FC<{
  topic: (typeof ETHICS_TOPICS)[number];
}> = ({ topic }) => (
  <div className="rounded-lg border bg-card p-4">
    <div className="mb-2 flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
        {ETHICS_ICON_BY_KEY[topic.icon] ?? <Shield className="h-5 w-5" />}
      </div>
      <h4 className="text-sm font-semibold">{topic.title}</h4>
    </div>
    <p className="mb-2 text-[11px] text-muted-foreground">{topic.desc}</p>
    <ul className="space-y-1">
      {topic.details.map((d) => (
        <li key={d} className="flex items-start gap-1.5 text-[11px] text-foreground/80">
          <Circle className="mt-0.5 h-1.5 w-1.5 shrink-0 fill-primary/40 text-primary/40" />
          {d}
        </li>
      ))}
    </ul>
  </div>
);

/* ───────────── 主页面 ───────────── */

const AdminAIExploration: React.FC<AdminAIExplorationProps> = ({ embedded = false }) => {
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const activeTabKey = normalizeTab(urlSearchParams.get("tab"));
  const [progress, setProgress] = useState<LearningProgress>(DEFAULT_PROGRESS);
  const [savingProgress, setSavingProgress] = useState(false);
  const [toolKeyword, setToolKeyword] = useState("");
  const [toolCategory, setToolCategory] = useState("all");
  const [contentPayload, setContentPayload] = useState<AIExplorationContentPayload | null>(null);
  const [activeBookSlug, setActiveBookSlug] = useState(AI_BOOK.chapters[0]?.slug ?? "history");

  const roadmapStagesData = contentPayload?.roadmapStages ?? ROADMAP_STAGES;
  const milestonesData = contentPayload?.milestones ?? MILESTONES;
  const domainsData = contentPayload?.domains ?? AI_DOMAINS;
  const promptLevelsData = contentPayload?.promptLevels ?? PROMPT_LEVELS;
  const promptTemplatesData = contentPayload?.promptTemplates ?? PROMPT_TEMPLATES;
  const promptChecklistData = contentPayload?.promptChecklist ?? PROMPT_CHECKLIST;
  const toolCategoriesData = contentPayload?.toolCategories ?? GENAI_TOOL_CATEGORIES;
  const ethicsTopicsData = contentPayload?.ethicsTopics ?? ETHICS_TOPICS;
  const ethicsCasesData = contentPayload?.ethicsCases ?? ETHICS_CASES;
  const responsiblePrinciplesData = contentPayload?.responsiblePrinciples ?? RESPONSIBLE_AI_PRINCIPLES;
  const bookData = contentPayload?.book ?? AI_BOOK;

  /* 同步 URL */
  useEffect(() => {
    const raw = urlSearchParams.get("tab");
    const next = normalizeTab(raw);
    if (raw !== next) setUrlSearchParams({ tab: next }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = useCallback(
    (key: string) => {
      const next = normalizeTab(key);
      const nextParams = new URLSearchParams(urlSearchParams);
      nextParams.set("tab", next);
      setUrlSearchParams(nextParams, { replace: true });
    },
    [urlSearchParams, setUrlSearchParams]
  );

  /* 加载学习进度 */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<LearningProgressResponse>(
          "/learning/progress/ai"
        );
        const normalized = normalizeProgress(res.data?.data);
        if (normalized) setProgress(normalized);
      } catch {
        // 使用默认占位数据
      }
    })();
  }, []);

  useEffect(() => {
    let mounted = true;
    void fetchLearningContentPayload<AIExplorationContentPayload>("ai").then((payload) => {
      if (mounted && payload) setContentPayload(payload);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const updateStageStatus = useCallback((stageId: string, status: LearningProgress["stages"][number]["status"]) => {
    setProgress((prev) => {
      const stages = prev.stages.map((stage) => {
        if (stage.id !== stageId) return stage;
        const nextProgress = status === "completed" ? 100 : status === "in_progress" ? Math.max(stage.progress, 50) : 0;
        return { ...stage, status, progress: nextProgress };
      });
      const overall = Math.round(stages.reduce((sum, stage) => sum + stage.progress, 0) / stages.length);
      return { stages, overall };
    });
  }, []);

  const toggleCompletedChapter = useCallback((slug: string) => {
    setProgress((prev) => ({
      ...prev,
      completedChapters: { ...(prev.completedChapters ?? {}), [slug]: !prev.completedChapters?.[slug] },
    }));
  }, []);

  const toggleFavoriteChapter = useCallback((slug: string) => {
    setProgress((prev) => ({
      ...prev,
      favoriteChapters: { ...(prev.favoriteChapters ?? {}), [slug]: !prev.favoriteChapters?.[slug] },
    }));
  }, []);

  const saveProgress = useCallback(async () => {
    setSavingProgress(true);
    try {
      await api.post("/learning/progress/ai", progress);
      showMessage.success("进度已保存");
    } catch {
      showMessage.error("保存失败，请重试");
    } finally {
      setSavingProgress(false);
    }
  }, [progress]);

  const filteredToolCategories = useMemo(() => toolCategoriesData.map((category) => {
    const tools = filterByKeyword(
      category.tools.map((tool) => ({ ...tool, title: tool.name, summary: tool.desc, description: tool.use, tags: [category.name, tool.pricing] })),
      toolKeyword,
    );
    return { ...category, tools };
  }).filter((category) => (toolCategory === "all" || category.name === toolCategory) && category.tools.length > 0), [toolCategory, toolKeyword]);

  const copyPromptTemplate = useCallback(async (template: string) => {
    try {
      await navigator.clipboard.writeText(template);
      showMessage.success("Prompt 模板已复制");
    } catch {
      showMessage.error("复制失败，请手动选择模板文本");
    }
  }, []);

  /* ───────────── 渲染 ───────────── */

  const content = (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {/* 标题区 */}
        <div className="shrink-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5" style={{ color: "var(--ws-color-info)" }} />
            人工智能探索
          </h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            系统性学习 AI 知识体系，从基础到前沿，兼顾理论与实战
          </p>
        </div>

        {/* Tab 导航 */}
        <Tabs
          value={activeTabKey}
          onValueChange={handleTabChange}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="inline-flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 shrink-0">
            {ALL_TABS.map((key) => (
              <TabsTrigger key={key} value={key} className="gap-1.5 text-xs sm:text-sm">
                {TAB_ICONS[key]}
                <span className="hidden sm:inline">{TAB_LABELS[key]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="book" className="flex-1 overflow-y-auto pt-3">
            <BookReader
              book={bookData}
              activeSlug={activeBookSlug}
              completedChapters={progress.completedChapters ?? {}}
              favoriteChapters={progress.favoriteChapters ?? {}}
              onSelectChapter={setActiveBookSlug}
              onToggleComplete={toggleCompletedChapter}
              onToggleFavorite={toggleFavoriteChapter}
            />
          </TabsContent>

          {/* ===== Tab 1: 学习路线图 ===== */}
          <TabsContent value="roadmap" className="flex-1 overflow-y-auto pt-3">
              <div className="mb-4">
                <p className="text-xs text-muted-foreground">
                  从零基础到前沿，以下是推荐的 AI 学习路线。每个阶段包含核心学习主题与推荐资源。
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {roadmapStagesData.map((stage, i) => (
                  <React.Fragment key={stage.id}>
                    {i > 0 && (
                      <div className="flex justify-center">
                        <ChevronRight className="h-5 w-5 rotate-90 text-muted-foreground/40" />
                      </div>
                    )}
                    <StageCard stage={stage} index={i} />
                  </React.Fragment>
                ))}
              </div>
          </TabsContent>

          {/* ===== Tab 2: AI 知识全景 ===== */}
          <TabsContent value="knowledge" className="flex-1 overflow-y-auto pt-3">
              {/* 发展历程 */}
              <section className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <BookOpen className="h-4 w-4 text-primary" />
                  AI 发展历程
                </h3>
                <TimelineView milestones={milestonesData} />
              </section>

              {/* 分支领域 */}
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Map className="h-4 w-4 text-primary" />
                  AI 分支领域全景
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {domainsData.map((domain) => (
                    <DomainCard key={domain.name} domain={domain} />
                  ))}
                </div>
              </section>
          </TabsContent>

          {/* ===== Tab 3: Prompt 工程 ===== */}
          <TabsContent value="prompt" className="flex-1 overflow-y-auto pt-3">
              {/* 学习体系 */}
              <section className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Prompt 工程学习体系
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {promptLevelsData.map((level) => (
                    <PromptLevelCard key={level.level} level={level} />
                  ))}
                </div>
              </section>

              {/* 模板示例库 */}
              <section className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Wrench className="h-4 w-4 text-primary" />
                  Prompt 模板示例库
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {promptTemplatesData.map((t) => (
                    <div key={t.title} className="rounded-lg border bg-card p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold">{t.title}</h4>
                        <Button size="sm" variant="outline" onClick={() => copyPromptTemplate(t.template)}>
                          复制
                        </Button>
                      </div>
                    <pre className="whitespace-pre-wrap break-words rounded bg-surface-2 p-2 text-xs leading-relaxed text-text-secondary">
                        {t.template}
                      </pre>
                    </div>
                  ))}
                </div>
              </section>

              {/* Checklist */}
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  最佳实践 Checklist
                </h3>
                <div className="rounded-lg border bg-card p-4">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {promptChecklistData.map((item) => (
                      <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ws-color-success)" }} />
                        {item.replace("✓ ", "")}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
          </TabsContent>

          {/* ===== Tab 4: 生成式 AI 工具 ===== */}
          <TabsContent value="tools" className="flex-1 overflow-y-auto pt-3">
              <div className="rounded-lg border bg-card p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                  <input
                    value={toolKeyword}
                    onChange={(event) => setToolKeyword(event.target.value)}
                    placeholder="搜索工具、用途、定价或场景"
                    className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  <select
                    value={toolCategory}
                    onChange={(event) => setToolCategory(event.target.value)}
                    className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="all">全部类别</option>
                    {toolCategoriesData.map((category) => (
                      <option key={category.name} value={category.name}>{category.name}</option>
                    ))}
                  </select>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">匹配 {filteredToolCategories.reduce((sum, category) => sum + category.tools.length, 0)} 个工具。</p>
              </div>

              {filteredToolCategories.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  未找到匹配的 AI 工具，请调整关键词或分类。
                </div>
              )}

              {filteredToolCategories.map((cat) => (
                <section key={cat.name} className="mb-6">
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <span>{cat.icon}</span>
                    {cat.name}
                  </h3>

                  {cat.tools.length <= 3 ? (
                    /* 工具少于等于 3 个用卡片布局 */
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {cat.tools.map((tool) => (
                        <div key={tool.name} className="rounded-lg border bg-card p-3">
                          <div className="mb-1 text-sm font-medium">{tool.name}</div>
                          <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">{tool.desc}</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="secondary" className="text-[10px]">
                              {tool.pricing}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {tool.use}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* 工具多时用表格 */
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="min-w-[720px] w-full text-left text-xs">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="py-2 pr-3 pl-3 font-medium">工具</th>
                            <th className="py-2 pr-3 font-medium">简介</th>
                            <th className="py-2 pr-3 font-medium">定价</th>
                            <th className="py-2 pr-3 font-medium">适用场景</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {cat.tools.map((tool) => (
                            <ToolRow key={tool.name} tool={tool} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
          </TabsContent>

          {/* ===== Tab 5: AI 安全与伦理 ===== */}
          <TabsContent value="ethics" className="flex-1 overflow-y-auto pt-3">
              {/* 核心概念 */}
              <section className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Shield className="h-4 w-4 text-primary" />
                  核心概念
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {ethicsTopicsData.map((topic) => (
                    <EthicsCard key={topic.title} topic={topic} />
                  ))}
                </div>
              </section>

              {/* 典型案例 */}
              <section className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  典型案例讨论
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {ethicsCasesData.map((c) => (
                    <div key={c.title} className="rounded-lg border bg-card p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <h4 className="text-sm font-medium">{c.title}</h4>
                        <Badge variant="outline" className="text-[10px]">
                          {c.source}
                        </Badge>
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">{c.lesson}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* 负责任 AI 原则 */}
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  负责任 AI 开发原则
                </h3>
                <div className="rounded-lg border bg-card p-4">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {responsiblePrinciplesData.map((p) => (
                      <div key={p} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
          </TabsContent>

          {/* ===== Tab 6: 学习进度 ===== */}
          <TabsContent value="progress" className="flex-1 overflow-y-auto pt-3">
              {/* 总体进度 */}
              <div className="mb-6 rounded-lg border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    总体学习进度
                  </h3>
                  <span className="text-lg font-bold tabular-nums" style={{ color: "var(--ws-color-primary)" }}>
                    {progress.overall}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--ws-color-surface-2)]">
                  <div className="h-2 rounded-full bg-[var(--ws-color-primary)] transition-all" style={{ width: `${Math.min(100, progress.overall)}%` }} />
                </div>
              </div>

              {/* 分阶段进度 */}
              <div className="space-y-3">
                {roadmapStagesData.map((stage) => {
                  const sp = progress.stages.find((s) => s.id === stage.id);
                  const pct = sp?.progress ?? 0;
                  const status = sp?.status ?? "not_started";

                  const statusLabel =
                    status === "completed" ? "已完成" : status === "in_progress" ? "进行中" : "未开始";
                  const statusColor =
                    status === "completed"
                      ? "text-[var(--ws-color-success)]"
                      : status === "in_progress"
                        ? "text-[var(--ws-color-warning)]"
                        : "text-muted-foreground";

                  return (
                    <div key={stage.id} className="rounded-lg border bg-card p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium">{stage.title}</h4>
                          <Badge variant="outline" className={`text-[10px] ${statusColor}`}>
                            {statusLabel}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <span className="text-xs font-medium tabular-nums">{pct}%</span>
                          <Button size="sm" variant={status === "not_started" ? "secondary" : "ghost"} onClick={() => updateStageStatus(stage.id, "not_started")}>未开始</Button>
                          <Button size="sm" variant={status === "in_progress" ? "secondary" : "ghost"} onClick={() => updateStageStatus(stage.id, "in_progress")}>进行中</Button>
                          <Button size="sm" variant={status === "completed" ? "secondary" : "ghost"} onClick={() => updateStageStatus(stage.id, "completed")}>完成</Button>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[var(--ws-color-surface-2)]">
                        <div className="h-1.5 rounded-full bg-[var(--ws-color-primary)] transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      {sp?.notes && (
                        <p className="mt-2 text-[11px] italic text-muted-foreground">{sp.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="sticky bottom-0 mt-4 flex justify-end border-t border-border bg-[var(--ws-color-surface)]/95 pt-3 backdrop-blur">
                <Button onClick={saveProgress} disabled={savingProgress}>{savingProgress ? "保存中..." : "保存进度"}</Button>
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

export default AdminAIExploration;
