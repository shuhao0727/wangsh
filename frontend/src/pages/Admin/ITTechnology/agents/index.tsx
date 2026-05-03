/**
 * 智能体探索学习板块
 * 6 Tab 页面：学习路线图、Agent 知识体系、核心技术分析、框架对比、动手实验、学习进度
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AdminPage } from "@/components/Admin";
import { api } from "@/services/api";
import { logger } from "@/services/logger";
import { showMessage } from "@/lib/toast";

import {
  ArrowUpFromLine,
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  Circle,
  Cpu,
  Database,
  FileCode,
  FlaskConical,
  FlaskRound,
  GitCompare,
  Layers,
  Map,
  NotebookPen,
  Puzzle,
  Rocket,
  ScrollText,
  Trophy,
  Users,
  Waypoints,
} from "lucide-react";
import {
  type AgentLearningProgress,
  agentCoreArchitecture,
  agentTypeComparison,
  coreTechs,
  defaultProgress,
  experimentLevels,
  frameworkData,
  roadmapStages,
} from "./data";
import { fetchLearningContentPayload, filterByKeyword } from "../learning/helpers";
import { BookReader } from "../learning/BookReader";
import { AGENTS_BOOK } from "./book";

// ─── Types ───────────────────────────────────────────────────────────────────

type TabKey = "book" | "roadmap" | "knowledge" | "core-tech" | "frameworks" | "experiments" | "progress";

type LearningProgress = AgentLearningProgress & {
  completedChapters?: Record<string, boolean>;
  favoriteChapters?: Record<string, boolean>;
};

type AgentCoreTech = (typeof coreTechs)[number];

interface AgentExplorationContentPayload {
  roadmapStages?: typeof roadmapStages;
  architecture?: typeof agentCoreArchitecture;
  agentTypes?: typeof agentTypeComparison;
  coreTechs?: AgentCoreTech[];
  frameworks?: typeof frameworkData;
  experiments?: typeof experimentLevels;
  book?: typeof AGENTS_BOOK;
}

interface LearningProgressResponse {
  data?: LearningProgress;
}

interface ProgressTabProps {
  bookProgress?: Pick<LearningProgress, "completedChapters" | "favoriteChapters">;
}

interface AgentExplorationProps {
  embedded?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const normalizeTab = (tab: string | null): TabKey => {
  const valid: TabKey[] = ["book", "roadmap", "knowledge", "core-tech", "frameworks", "experiments", "progress"];
  if (tab && valid.includes(tab as TabKey)) return tab as TabKey;
  return "book";
};

const tabConfigs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "book",       label: "学习书", icon: <BookOpen className="h-3.5 w-3.5" /> },
  { key: "roadmap",    label: "学习路线图", icon: <Map className="h-3.5 w-3.5" /> },
  { key: "knowledge",  label: "Agent 知识体系", icon: <BookOpen className="h-3.5 w-3.5" /> },
  { key: "core-tech",  label: "核心技术分析", icon: <Cpu className="h-3.5 w-3.5" /> },
  { key: "frameworks", label: "框架对比", icon: <GitCompare className="h-3.5 w-3.5" /> },
  { key: "experiments",label: "动手实验", icon: <FlaskConical className="h-3.5 w-3.5" /> },
  { key: "progress",   label: "学习进度",  icon: <BarChart3 className="h-3.5 w-3.5" /> },
];

const CORE_TECH_ICON_BY_KEY: Record<string, React.ReactNode> = {
  "scroll-text": <ScrollText className="h-4 w-4" />,
  database: <Database className="h-4 w-4" />,
  brain: <Brain className="h-4 w-4" />,
  layers: <Layers className="h-4 w-4" />,
  puzzle: <Puzzle className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
};

const EXPERIMENT_ICON_BY_KEY: Record<string, React.ReactNode> = {
  rocket: <Rocket className="h-4 w-4" />,
  "bar-chart": <BarChart3 className="h-4 w-4" />,
  cpu: <Cpu className="h-4 w-4" />,
  trophy: <Trophy className="h-4 w-4" />,
};

const normalizeProgress = (value: unknown): LearningProgress | null => {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<LearningProgress>;
  if (!Array.isArray(data.stages)) return null;
  const stages = defaultProgress.stages.map((stage) => {
    const saved = data.stages?.find((item) => item?.stage === stage.stage);
    return {
      ...stage,
      ...saved,
      completed: typeof saved?.completed === "number" ? saved.completed : stage.completed,
      total: typeof saved?.total === "number" ? saved.total : stage.total,
      status: saved?.status ?? stage.status,
    };
  });
  const totalCompleted = stages.reduce((sum, stage) => sum + stage.completed, 0);
  const totalItems = stages.reduce((sum, stage) => sum + stage.total, 0);
  return {
      stages,
      overall_progress: totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0,
      total_completed: totalCompleted,
      total_items: totalItems,
      notes: typeof data.notes === "string" ? data.notes : undefined,
      completedChapters: isBooleanRecord(data.completedChapters) ? data.completedChapters : {},
      favoriteChapters: isBooleanRecord(data.favoriteChapters) ? data.favoriteChapters : {},
  };
};

const isBooleanRecord = (value: unknown): value is Record<string, boolean> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((item) => typeof item === "boolean");
};

// ─── Sub-components ──────────────────────────────────────────────────────────

/** 进度环 */
const ProgressRing: React.FC<{ value: number; size?: number; strokeWidth?: number; color?: string }> = ({
  value,
  size = 80,
  strokeWidth = 6,
  color = "var(--ws-color-primary)",
}) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} className="shrink-0" style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ws-color-border)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.22}
        fontWeight={600}
        fill="currentColor"
        style={{ transform: "rotate(90deg)", transformOrigin: "center" }}
      >
        {Math.round(value)}%
      </text>
    </svg>
  );
};

/** Mermaid 架构图容器 */
const MermaidDiagram: React.FC<{ chart: string; active?: boolean }> = ({ chart, active = true }) => {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!active) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    setLoaded(false);
    if (iframe.contentDocument) {
      renderMermaid(iframe.contentDocument);
      setLoaded(true);
      return;
    }
    iframe.onload = () => {
      if (iframe.contentDocument) {
        renderMermaid(iframe.contentDocument);
        setLoaded(true);
      }
    };
  }, [active, chart]);

  const renderMermaid = (doc: Document) => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"><\/script>
  <style>
    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: transparent; }
    #mermaid { max-width: 100%; }
  </style>
</head>
<body>
  <div class="mermaid" id="mermaid">${chart}</div>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'base', themeVariables: { primaryColor: 'var(--ws-color-primary)', primaryBorderColor: 'var(--ws-color-primary)', primaryTextColor: 'var(--ws-color-text)', lineColor: 'var(--ws-color-border)', secondaryColor: 'var(--ws-color-surface-2)', tertiaryColor: 'var(--ws-color-surface)' } });<\/script>
</body>
</html>`;
    doc.open();
    doc.write(html);
    doc.close();
  };

  if (!active) {
    return (
      <div className="rounded-lg border bg-card/50 p-6 text-center text-sm text-muted-foreground">
        切换到知识体系页后加载架构图
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border bg-card/50 p-4">
      <iframe
        ref={iframeRef}
        title="Mermaid Diagram"
        className="w-full"
        style={{ minHeight: 320, border: "none" }}
        sandbox="allow-scripts allow-same-origin"
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/70 text-sm text-muted-foreground">
          加载架构图中...
        </div>
      )}
    </div>
  );
};

// ─── Tab Content Components ───────────────────────────────────────────────────

/** Tab 1: 学习路线图 */
const RoadmapTab: React.FC<{ stages?: typeof roadmapStages }> = ({ stages = roadmapStages }) => (
  <div className="flex flex-col gap-6">
    <div className="mb-2">
      <h3 className="text-lg font-semibold">智能体学习路径</h3>
      <p className="text-sm text-muted-foreground">
        从零基础到前沿探索的系统化学习路线，建议按阶段循序渐进
      </p>
    </div>

    {/* 时间线式路线图 */}
    <div className="relative">
      {/* 中间竖线 */}
      <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-border hidden md:block" />

      <div className="flex flex-col gap-6">
        {stages.map((stage, idx) => (
          <div key={stage.stage} className="relative flex flex-col md:flex-row gap-4 md:gap-6">
            {/* 阶段编号 + 竖线节点 */}
            <div className="flex md:flex-col items-center gap-3 md:w-24 shrink-0">
              <div
                className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shrink-0"
                style={{ backgroundColor: stage.color }}
              >
                {stage.stage}
              </div>
              <div className="hidden md:block text-center">
                <Badge variant={stage.badgeVariant} className="text-[10px] px-1.5">
                  {stage.badge}
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">{stage.period}</div>
              </div>
            </div>

            {/* 内容卡片 */}
            <div className="flex-1 min-w-0">
              <Card className="border-l-4" style={{ borderLeftColor: stage.color }}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{stage.title}</CardTitle>
                      <Badge variant={stage.badgeVariant} className="md:hidden text-[10px] px-1.5">
                        {stage.badge}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground hidden sm:inline">{stage.period}</span>
                  </div>
                  <CardDescription>学习内容与核心技能</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-1.5">
                    {stage.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Circle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">推荐项目：</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {stage.projects.map((proj, i) => (
                        <Badge key={i} variant="secondary" className="text-[11px]">
                          {proj}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/** Tab 2: Agent 知识体系 */
const KnowledgeTab: React.FC<{
  active?: boolean;
  architecture?: typeof agentCoreArchitecture;
  agentTypes?: typeof agentTypeComparison;
}> = ({ active = true, architecture = agentCoreArchitecture, agentTypes = agentTypeComparison }) => {
  const architectureChart = `graph LR
    subgraph Perception["感知层 (Perception)"]
        A1["文本"] --> A2["语音"] --> A3["图像"] --> A4["结构化数据"]
    end
    subgraph Planning["规划层 (Planning)"]
        B1["任务分解"] --> B2["路径规划"] --> B3["资源分配"]
    end
    subgraph Memory["记忆层 (Memory)"]
        C1["工作记忆"] --> C2["情景记忆"] --> C3["语义记忆"] --> C4["程序记忆"]
    end
    subgraph Execution["执行层 (Execution)"]
        D1["工具调用"] --> D2["代码执行"] --> D3["API 调用"] --> D4["外部交互"]
    end
    subgraph Tools["工具层 (Tools)"]
        E1["Function\nCalling"] --> E2["MCP 协议"] --> E3["Web 搜索"] --> E4["自定义工具"]
    end

    Perception -->|"输入"| Planning
    Planning -->|"决策"| Memory
    Memory -->|"上下文"| Execution
    Execution -->|"调用"| Tools
    Tools -.->|"反馈循环"| Perception`;

  const evolutionChart = `timeline
    title Agent 架构演进
    1950s-1980s : 符号主义 AI：物理符号系统
               : 专家系统：规则推理
    1990s-2000s : 反应式 Agent：Brooks 行为主义
               : BDI Agent：信念-愿望-意图
    2010s : 深度强化学习 Agent
          : 多 Agent 强化学习
    2020-2022 : 预训练语言模型
              : Prompt-based Agent：ChatGPT
    2023 : LLM-based Agent 爆发
         : AutoGPT, BabyAGI
         : ReAct, Tool Use
    2024 : 多 Agent 框架：CrewAI, AutoGen
         : MCP 协议 (Model Context Protocol)
    2025+ : A2A 标准 (Agent-to-Agent)
           : 自治 Agent 社会
           : 具身 Agent + AGI 探索`;

  return (
    <div className="flex flex-col gap-8 pb-4">
      {/* 核心组件架构 */}
      <section>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Layers className="h-4 w-4" style={{ color: "var(--ws-color-primary)" }} />
          Agent 核心组件架构
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {architecture.map((item) => (
            <Card key={item.step} className="text-center">
              <CardContent className="p-4">
                <div className="text-2xl mb-2">{item.icon}</div>
                <div className="text-sm font-semibold">{item.step}</div>
                <div className="text-xs text-muted-foreground mt-1">{item.desc}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        <MermaidDiagram chart={architectureChart} active={active} />
      </section>

      {/* Agent 类型对比 */}
      <section>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <GitCompare className="h-4 w-4" style={{ color: "var(--ws-color-warning)" }} />
          五种 Agent 类型对比
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {agentTypes.map((item) => (
            <Card key={item.type} className="border-t-4" style={{ borderTopColor: item.color }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{item.type}</CardTitle>
                <CardDescription>{item.desc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-success">优势：</span>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {item.pros.map((p, i) => (<li key={i}>{p}</li>))}
                  </ul>
                </div>
                <div>
                  <span className="font-semibold text-error">局限：</span>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {item.cons.map((c, i) => (<li key={i}>{c}</li>))}
                  </ul>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">代表：</span>
                  <span className="text-muted-foreground">{item.example}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 架构演进 */}
      <section>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <ArrowUpFromLine className="h-4 w-4" style={{ color: "var(--ws-color-accent)" }} />
          架构演进时间线
        </h3>
        <MermaidDiagram chart={evolutionChart} active={active} />
      </section>
    </div>
  );
};

/** Tab 3: 核心技术分析 */
const CoreTechTab: React.FC<{ items?: AgentCoreTech[] }> = ({ items = coreTechs }) => (
  <div className="flex flex-col gap-4 pb-4">
    <div className="mb-1">
      <h3 className="text-lg font-semibold">六大核心技术</h3>
      <p className="text-sm text-muted-foreground">
        深度解析构建 Agent 所需的核心技术能力
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((tech) => (
        <Card key={tech.title} className="overflow-hidden">
          <CardHeader className="pb-3" style={{ borderBottom: "1px solid var(--ws-color-border)" }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: "color-mix(in srgb, " + tech.color + " 12%, transparent)", color: tech.color }}
              >
                {CORE_TECH_ICON_BY_KEY[tech.icon] ?? <Cpu className="h-4 w-4" />}
              </div>
              <div>
                <CardTitle className="text-sm">{tech.title}</CardTitle>
                <CardDescription className="text-xs">{tech.desc}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-3 space-y-3">
            {/* Prompt Engineering 四层结构 */}
            {tech.levels && (
              <div className="space-y-1.5">
                {tech.levels.map((level, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: tech.color }}
                    >
                      {i + 1}
                    </div>
                    <span className="font-medium shrink-0">{level.name}：</span>
                    <span className="text-muted-foreground">{level.desc}</span>
                  </div>
                ))}
              </div>
            )}

            {/* RAG 步骤 */}
            {tech.steps && (
              <div className="flex flex-wrap gap-1.5">
                {tech.steps.map((step, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">
                    {i + 1}. {step}
                  </Badge>
                ))}
              </div>
            )}

            {/* 推理模式 */}
            {tech.modes && (
              <div className="space-y-1.5">
                {tech.modes.map((mode, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs border-b border-border/50 pb-1.5 last:border-0">
                    <span className="font-medium w-20 shrink-0" style={{ color: tech.color }}>{mode.name}</span>
                    <span className="text-muted-foreground flex-1">{mode.desc}</span>
                    <span className="text-muted-foreground/60">{mode.use}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 记忆系统 */}
            {tech.memories && (
              <div className="space-y-1.5">
                {tech.memories.map((mem, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-medium w-20 shrink-0" style={{ color: tech.color }}>{mem.name}</span>
                    <span className="text-muted-foreground flex-1">{mem.desc}</span>
                    <Badge variant="outline" className="text-[10px]">{mem.duration}</Badge>
                  </div>
                ))}
              </div>
            )}

            {/* 工具调用协议 */}
            {tech.protocols && (
              <div className="space-y-1.5">
                {tech.protocols.map((proto, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-medium w-28 shrink-0" style={{ color: tech.color }}>{proto.name}</span>
                    <span className="text-muted-foreground flex-1">{proto.desc}</span>
                    <Badge variant="outline" className="text-[10px]">{proto.style}</Badge>
                  </div>
                ))}
              </div>
            )}

            {/* 多 Agent 协作模式 */}
            {tech.patterns && (
              <div className="space-y-1.5">
                {tech.patterns.map((pat, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs border-b border-border/50 pb-1.5 last:border-0">
                    <span className="font-medium w-24 shrink-0" style={{ color: tech.color }}>{pat.name}</span>
                    <span className="text-muted-foreground flex-1">{pat.desc}</span>
                    <span className="text-muted-foreground/60">{pat.use}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs text-muted-foreground italic pt-1 border-t border-border/50">
              适用场景：{tech.bestFor}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

/** Tab 4: 框架对比 */
const FrameworksTab: React.FC<{ items?: typeof frameworkData }> = ({ items = frameworkData }) => {
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [scenario, setScenario] = useState("all");

  const scenarioOptions = useMemo(() => Array.from(new Set(items.map((fw) => fw.scenario))), [items]);
  const filteredFrameworks = useMemo(() => {
    const byScenario = scenario === "all" ? items : items.filter((fw) => fw.scenario === scenario);
    return filterByKeyword(
      byScenario.map((fw) => ({ ...fw, title: fw.name, summary: fw.desc, description: fw.scenario, tags: [fw.ease, fw.curve, fw.completeness, fw.githubStars] })),
      keyword,
    );
  }, [items, keyword, scenario]);

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <h3 className="text-lg font-semibold">主流 Agent 框架对比</h3>
        <p className="text-sm text-muted-foreground">
          横向对比 13 个主流框架，帮助选择最适合你项目的方案
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-lg border bg-card/50 p-3 sm:grid-cols-[1fr_220px]">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索框架、场景、难度或 Stars"
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <select
          value={scenario}
          onChange={(event) => setScenario(event.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
        >
          <option value="all">全部场景</option>
          {scenarioOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      {/* 对比表格 */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left p-3 font-semibold">框架</th>
              <th className="text-left p-3 font-semibold">易用性</th>
              <th className="text-left p-3 font-semibold">功能完整度</th>
              <th className="text-left p-3 font-semibold">学习曲线</th>
              <th className="text-left p-3 font-semibold hidden md:table-cell">适合场景</th>
              <th className="text-left p-3 font-semibold hidden lg:table-cell">GitHub Stars</th>
            </tr>
          </thead>
          <tbody>
            {filteredFrameworks.map((fw) => (
              <tr
                key={fw.name}
                className={`border-b border-border/40 cursor-pointer transition-colors hover:bg-muted/30 ${
                  selectedFramework === fw.name ? "bg-muted/40" : ""
                }`}
                onClick={() => setSelectedFramework(selectedFramework === fw.name ? null : fw.name)}
              >
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: fw.color }}
                    />
                    <span className="font-medium">{fw.name}</span>
                  </div>
                </td>
                <td className="p-3">{fw.ease}</td>
                <td className="p-3">{fw.completeness}</td>
                <td className="p-3">{fw.curve}</td>
                <td className="p-3 text-muted-foreground hidden md:table-cell">{fw.scenario}</td>
                <td className="p-3 text-muted-foreground hidden lg:table-cell">{fw.githubStars}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 选中框架详情 */}
      {selectedFramework && (
        <Card>
          <CardContent className="p-4">
            {(() => {
              const fw = items.find((f) => f.name === selectedFramework);
              if (!fw) return null;
              return (
                <div className="flex items-start gap-3 text-sm">
                  <div
                    className="h-3 w-3 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: fw.color }}
                  />
                  <div>
                    <div className="font-semibold">{fw.name}</div>
                    <div className="text-muted-foreground mt-0.5">{fw.desc}</div>
                    <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                      <span>易用性：{fw.ease}</span>
                      <span>功能：{fw.completeness}</span>
                      <span>学习曲线：{fw.curve}</span>
                      <span>Stars：{fw.githubStars}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* 框架选择决策树 */}
      <Card className="border-t-4" style={{ borderTopColor: "var(--ws-color-primary)" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Waypoints className="h-4 w-4" />
            框架选择决策树
          </CardTitle>
          <CardDescription>根据你的需求选择最合适的框架</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <DecisionItem
              question="你是初学者，想快速上手？"
              answer={<span>→ 选 <strong>CrewAI</strong>（最简单）或 <strong>OpenAI Agents SDK</strong>（开箱即用）</span>}
            />
            <DecisionItem
              question="你需要最丰富的工具生态？"
              answer={<span>→ 选 <strong>LangChain</strong>（生态最广，社区最大）</span>}
            />
            <DecisionItem
              question="你需要构建多 Agent 协作系统？"
              answer={<span>→ 选 <strong>AutoGen</strong>（对话驱动）或 <strong>CrewAI</strong>（角色驱动）</span>}
            />
            <DecisionItem
              question="你是全栈/非开发者，需要可视化搭建？"
              answer={<span>→ 选 <strong>Dify</strong>（拖拽式工作流，无需编码）</span>}
            />
            <DecisionItem
              question="你在 .NET / Azure 生态？"
              answer={<span>→ 选 <strong>Semantic Kernel</strong>（微软原生集成）</span>}
            />
            <DecisionItem
              question="你需要自治/全自动 Agent？"
              answer={<span>→ 选 <strong>AutoGPT</strong>（自治先驱）或 <strong>BabyAGI</strong>（轻量学习）</span>}
            />
            <DecisionItem
              question="你在做软件工程自动化？"
              answer={<span>→ 选 <strong>MetaGPT</strong>（模拟软件公司流程）</span>}
            />
            <DecisionItem
              question="你在做 Agent 研究/学术探索？"
              answer={<span>→ 选 <strong>Camel</strong>（研究型框架）</span>}
            />
            <DecisionItem
              question="你需要轻量级、现代感框架？"
              answer={<span>→ 选 <strong>Agno</strong>（新一代轻量级框架）</span>}
            />
            <DecisionItem
              question="你使用 Hugging Face 模型生态？"
              answer={<span>→ 选 <strong>Smolagents</strong>（HF 官方轻量 Agent 框架）</span>}
            />
            <DecisionItem
              question="你需要类型安全的 Python Agent？"
              answer={<span>→ 选 <strong>Pydantic AI</strong>（类型安全，企业级友好）</span>}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const DecisionItem: React.FC<{ question: string; answer: React.ReactNode }> = ({ question, answer }) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 border-b border-border/30 pb-2 last:border-0">
    <span className="font-medium shrink-0">{question}</span>
    <span className="text-muted-foreground">{answer}</span>
  </div>
);

/** Tab 5: 动手实验 */
const ExperimentsTab: React.FC<{ levels?: typeof experimentLevels }> = ({ levels = experimentLevels }) => {
  const [keyword, setKeyword] = useState("");
  const [difficulty, setDifficulty] = useState("all");

  const filteredLevels = useMemo(() => levels.map((level) => {
    const items = filterByKeyword(
      level.items.map((item) => ({ ...item, title: item.name, summary: item.desc, tags: [item.tech, level.level] })),
      keyword,
    );
    return { ...level, items };
  }).filter((level) => (difficulty === "all" || level.badge === difficulty) && level.items.length > 0), [difficulty, keyword, levels]);

  return (
  <div className="flex flex-col gap-6 pb-4">
    <div>
      <h3 className="text-lg font-semibold">动手实验项目</h3>
      <p className="text-sm text-muted-foreground">
        4 个难度层级、16 个实战项目，从入门到前沿
      </p>
    </div>

    <div className="grid grid-cols-1 gap-2 rounded-lg border bg-card/50 p-3 sm:grid-cols-[1fr_180px]">
      <input
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder="搜索实验、技术栈或目标能力"
        className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
      <select
        value={difficulty}
        onChange={(event) => setDifficulty(event.target.value)}
        className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
      >
        <option value="all">全部难度</option>
        {levels.map((level) => (
          <option key={level.badge} value={level.badge}>{level.level}</option>
        ))}
      </select>
    </div>

    {filteredLevels.map((level) => (
      <section key={level.level}>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: level.color }}>
            {EXPERIMENT_ICON_BY_KEY[level.icon] ?? <FlaskRound className="h-4 w-4" />}
            <span>{level.level}</span>
          </div>
          <Badge variant={level.badgeVariant} className="text-[10px]">{level.items.length} 个项目</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {level.items.map((item) => (
            <Card key={item.name} className="group cursor-default transition-shadow hover:shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold flex items-center gap-1.5">
                      <FlaskRound className="h-3.5 w-3.5 shrink-0" style={{ color: level.color }} />
                      {item.name}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <FileCode className="h-3 w-3 text-muted-foreground/60" />
                  <span className="text-[10px] text-muted-foreground/70">{item.tech}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    ))}
  </div>
  );
};

/** Tab 6: 学习进度 */
const ProgressTab: React.FC<ProgressTabProps> = ({ bookProgress }) => {
  const [progress, setProgress] = useState<LearningProgress>(defaultProgress);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProgress = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<LearningProgressResponse>("/learning/progress/agents");
      const normalized = normalizeProgress(response.data?.data);
      if (normalized) {
        setProgress(normalized);
      }
    } catch (err) {
      logger.error("Failed to load learning progress", err);
      setError("加载学习进度失败，显示默认数据");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStageStatus = useCallback((stageNo: number, status: LearningProgress["stages"][number]["status"]) => {
    setProgress((prev) => {
      const stages = prev.stages.map((stage) => {
        if (stage.stage !== stageNo) return stage;
        const completed = status === "completed" ? stage.total : status === "in_progress" ? Math.max(stage.completed, Math.ceil(stage.total / 2)) : 0;
        return { ...stage, status, completed };
      });
      const totalCompleted = stages.reduce((sum, stage) => sum + stage.completed, 0);
      const totalItems = stages.reduce((sum, stage) => sum + stage.total, 0);
      return {
        ...prev,
        stages,
        total_completed: totalCompleted,
        total_items: totalItems,
        overall_progress: totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0,
      };
    });
  }, []);

  const saveProgress = useCallback(async () => {
    setSaving(true);
    try {
      await api.post("/learning/progress/agents", { ...progress, ...bookProgress });
      showMessage.success("进度已保存");
    } catch (err) {
      logger.error("Failed to save learning progress", err);
      showMessage.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }, [bookProgress, progress]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  const stageColors = [
    "var(--ws-color-primary)",
    "var(--ws-color-info)",
    "var(--ws-color-warning)",
    "var(--ws-color-error)",
    "var(--ws-color-accent)",
  ];

  const statusBadge = (status: LearningProgress["stages"][0]["status"]) => {
    switch (status) {
      case "completed":
        return <Badge variant="success" className="text-[10px]">已完成</Badge>;
      case "in_progress":
        return <Badge variant="warning" className="text-[10px]">进行中</Badge>;
      default:
        return <Badge variant="neutral" className="text-[10px]">未开始</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">加载学习进度...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <h3 className="text-lg font-semibold">学习进度追踪</h3>
        <p className="text-sm text-muted-foreground">
          追踪你的 Agent 学习之旅，记录每个阶段的完成情况
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-warning-soft border border-warning/30 px-3 py-2 text-xs text-warning">
          {error}
        </div>
      )}

      {/* 总体进度 */}
      <Card>
        <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">
          <ProgressRing value={progress.overall_progress} size={100} strokeWidth={8} />
          <div className="text-center sm:text-left">
            <div className="text-lg font-bold">{Math.round(progress.overall_progress)}%</div>
            <div className="text-sm text-muted-foreground">总体进度</div>
            <div className="text-xs text-muted-foreground mt-1">
              已完成 {progress.total_completed} / {progress.total_items} 项
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 各阶段进度 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {progress.stages.map((stage, idx) => {
          const stagePct = stage.total > 0 ? (stage.completed / stage.total) * 100 : 0;
          const stageColor = stageColors[idx % stageColors.length];
          return (
            <Card key={stage.stage}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: stageColor }}
                    >
                      {stage.stage}
                    </div>
                    <span className="text-sm font-semibold">{stage.name}</span>
                  </div>
                  {statusBadge(stage.status)}
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>进度</span>
                    <span>{stage.completed}/{stage.total}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${stagePct}%`,
                        backgroundColor: stageColor,
                      }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button size="sm" variant={stage.status === "not_started" ? "secondary" : "ghost"} onClick={() => updateStageStatus(stage.stage, "not_started")}>未开始</Button>
                    <Button size="sm" variant={stage.status === "in_progress" ? "secondary" : "ghost"} onClick={() => updateStageStatus(stage.stage, "in_progress")}>进行中</Button>
                    <Button size="sm" variant={stage.status === "completed" ? "secondary" : "ghost"} onClick={() => updateStageStatus(stage.stage, "completed")}>完成</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {progress.notes && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            <NotebookPen className="h-4 w-4 inline mr-1.5" />
            {progress.notes}
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-0 flex justify-end border-t border-border bg-surface/95 pt-3 backdrop-blur">
        <Button onClick={saveProgress} disabled={saving}>{saving ? "保存中..." : "保存进度"}</Button>
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

const AgentExploration: React.FC<AgentExplorationProps> = ({ embedded = false }) => {
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const [activeTabKey, setActiveTabKey] = useState<TabKey>(normalizeTab(urlSearchParams.get("tab")));
  const [contentPayload, setContentPayload] = useState<AgentExplorationContentPayload | null>(null);
  const [bookProgress, setBookProgress] = useState<Pick<LearningProgress, "completedChapters" | "favoriteChapters">>({
    completedChapters: {},
    favoriteChapters: {},
  });
  const [activeBookSlug, setActiveBookSlug] = useState(AGENTS_BOOK.chapters[0]?.slug ?? "agent-concept");
  const [savingBookProgress, setSavingBookProgress] = useState(false);

  useEffect(() => {
    let mounted = true;
    void fetchLearningContentPayload<AgentExplorationContentPayload>("agents").then((payload) => {
      if (mounted && payload) setContentPayload(payload);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const roadmapStagesData = contentPayload?.roadmapStages ?? roadmapStages;
  const architectureData = contentPayload?.architecture ?? agentCoreArchitecture;
  const agentTypesData = contentPayload?.agentTypes ?? agentTypeComparison;
  const coreTechsData = contentPayload?.coreTechs ?? coreTechs;
  const frameworksData = contentPayload?.frameworks ?? frameworkData;
  const experimentsData = contentPayload?.experiments ?? experimentLevels;
  const bookData = contentPayload?.book ?? AGENTS_BOOK;

  useEffect(() => {
    let mounted = true;
    void api.get<LearningProgressResponse>("/learning/progress/agents").then((response) => {
      if (!mounted) return;
      const normalized = normalizeProgress(response.data?.data);
      if (normalized) {
        setBookProgress({
          completedChapters: normalized.completedChapters ?? {},
          favoriteChapters: normalized.favoriteChapters ?? {},
        });
      }
    }).catch(() => {
      // 首次访问无数据时使用空状态。
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const next = normalizeTab(urlSearchParams.get("tab"));
    if (next !== activeTabKey) setActiveTabKey(next);
  }, [urlSearchParams, activeTabKey]);

  const handleTabChange = (key: string) => {
    const next = normalizeTab(key);
    setActiveTabKey(next);
    const nextParams = new URLSearchParams(urlSearchParams);
    nextParams.set("tab", next);
    setUrlSearchParams(nextParams, { replace: true });
  };

  const toggleCompletedChapter = useCallback((slug: string) => {
    setBookProgress((prev) => ({
      ...prev,
      completedChapters: { ...(prev.completedChapters ?? {}), [slug]: !prev.completedChapters?.[slug] },
    }));
  }, []);

  const toggleFavoriteChapter = useCallback((slug: string) => {
    setBookProgress((prev) => ({
      ...prev,
      favoriteChapters: { ...(prev.favoriteChapters ?? {}), [slug]: !prev.favoriteChapters?.[slug] },
    }));
  }, []);

  const saveBookProgress = useCallback(async () => {
    setSavingBookProgress(true);
    try {
      const response = await api.get<LearningProgressResponse>("/learning/progress/agents");
      const normalized = normalizeProgress(response.data?.data) ?? defaultProgress;
      await api.post("/learning/progress/agents", { ...normalized, ...bookProgress });
      showMessage.success("学习书进度已保存");
    } catch (err) {
      logger.error("Failed to save book progress", err);
      showMessage.error("保存失败，请重试");
    } finally {
      setSavingBookProgress(false);
    }
  }, [bookProgress]);

  const content = (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* 页面标题 */}
        <div className="shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                智能体探索
              </h2>
              <p className="text-sm text-text-secondary mt-0.5">
                系统化学习 AI Agent 的概念、架构、技术与实践
              </p>
            </div>
            {activeTabKey === "book" && (
              <Button size="sm" onClick={saveBookProgress} disabled={savingBookProgress}>
                {savingBookProgress ? "保存中..." : "保存学习书进度"}
              </Button>
            )}
          </div>
        </div>

        {/* Tab 导航 */}
        <Tabs
          value={activeTabKey}
          onValueChange={handleTabChange}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="inline-flex h-auto min-h-10 w-full justify-start gap-1 shrink-0 flex-wrap">
            {tabConfigs.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5">
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 内容面板 */}
          <div className="flex-1 min-h-0 pt-3">
            <ScrollArea className="h-full">
              <div className="pr-3">
                <TabsContent value="roadmap" className="mt-0">
                  <RoadmapTab stages={roadmapStagesData} />
                </TabsContent>
                <TabsContent value="book" className="mt-0">
                  <BookReader
                    book={bookData}
                    activeSlug={activeBookSlug}
                    completedChapters={bookProgress.completedChapters ?? {}}
                    favoriteChapters={bookProgress.favoriteChapters ?? {}}
                    onSelectChapter={setActiveBookSlug}
                    onToggleComplete={toggleCompletedChapter}
                    onToggleFavorite={toggleFavoriteChapter}
                  />
                </TabsContent>
                <TabsContent value="knowledge" className="mt-0">
                  <KnowledgeTab active={activeTabKey === "knowledge"} architecture={architectureData} agentTypes={agentTypesData} />
                </TabsContent>
                <TabsContent value="core-tech" className="mt-0">
                  <CoreTechTab items={coreTechsData} />
                </TabsContent>
                <TabsContent value="frameworks" className="mt-0">
                  <FrameworksTab items={frameworksData} />
                </TabsContent>
                <TabsContent value="experiments" className="mt-0">
                  <ExperimentsTab levels={experimentsData} />
                </TabsContent>
                <TabsContent value="progress" className="mt-0">
                  <ProgressTab bookProgress={bookProgress} />
                </TabsContent>
              </div>
            </ScrollArea>
          </div>
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

export default AgentExploration;
