/**
 * 测评管理页 - /admin/assessment/:id/questions
 * 三个板块：基本设置 → 固定题 → 自适应知识点题
 */
import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useState } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import {
  ArrowLeft,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AdminPage } from "@components/Admin";
import {
  assessmentQuestionApi,
  assessmentConfigApi,
  type AssessmentQuestion,
} from "@services/assessment";
import { aiAgentsApi } from "@services/agents";
import type { AIAgent } from "@services/znt/types";
import { logger } from "@services/logger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";

const FILTER_ALL = "__all__";

const TYPE_MAP: Record<
  string,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  choice: { label: "选择题", variant: "sky" },
  fill: { label: "填空题", variant: "success" },
  short_answer: { label: "简答题", variant: "warning" },
};

const DIFF_MAP: Record<
  string,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  easy: { label: "简单", variant: "success" },
  medium: { label: "中等", variant: "warning" },
  hard: { label: "困难", variant: "danger" },
};

const GRADE_OPTIONS = [
  "高一",
  "高二",
  "高三",
  "初一",
  "初二",
  "初三",
  "七年级",
  "八年级",
  "九年级",
];

type QuestionType = "choice" | "fill" | "short_answer";
type Difficulty = "easy" | "medium" | "hard";

type AdaptiveKP = {
  key: string;
  knowledge_point: string;
  question_type: "choice" | "fill";
  score: number;
  prompt_hint: string;
  mastery_streak: number;
  max_attempts: number;
};

type ConfigDraft = {
  title: string;
  grade: string;
  total_score: number;
  available_start: string;
  available_end: string;
  agent_id: string;
  knowledge_points: string;
  teaching_objectives: string;
  ai_prompt: string;
};

type QuestionDraft = {
  question_type: QuestionType;
  content: string;
  options_A: string;
  options_B: string;
  options_C: string;
  options_D: string;
  correct_answer: string;
  score: number;
  difficulty: Difficulty;
  knowledge_point: string;
  explanation: string;
};

type GenerateDraft = {
  count: number;
  question_type: "" | QuestionType;
  difficulty: "" | Difficulty;
  knowledge_points_text: string;
};

const initialConfigDraft: ConfigDraft = {
  title: "",
  grade: "",
  total_score: 100,
  available_start: "",
  available_end: "",
  agent_id: "",
  knowledge_points: "",
  teaching_objectives: "",
  ai_prompt: "",
};

const initialQuestionDraft: QuestionDraft = {
  question_type: "choice",
  content: "",
  options_A: "",
  options_B: "",
  options_C: "",
  options_D: "",
  correct_answer: "",
  score: 10,
  difficulty: "medium",
  knowledge_point: "",
  explanation: "",
};

const initialGenerateDraft: GenerateDraft = {
  count: 5,
  question_type: "",
  difficulty: "",
  knowledge_points_text: "",
};

const toDateTimeLocal = (value: string | null | undefined) => {
  if (!value) return "";
  const d = dayjs(value);
  if (!d.isValid()) return "";
  return d.format("YYYY-MM-DDTHH:mm");
};

const parseKnowledgePoints = (value: string | null | undefined) => {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === "string").join("、");
    }
  } catch {}
  return "";
};

const parseOptionsRecord = (value: string | null) => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const parseOptionsList = (value: string | null) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as string[];
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {}
  return null;
};

const asPositiveNumber = (value: string, fallback: number) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return next;
};

const QuestionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const configId = Number(id);

  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configDraft, setConfigDraft] = useState<ConfigDraft>(initialConfigDraft);
  const [agents, setAgents] = useState<AIAgent[]>([]);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AssessmentQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterDiff, setFilterDiff] = useState<string | undefined>();

  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQ, setEditingQ] = useState<AssessmentQuestion | null>(null);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(initialQuestionDraft);
  const [qSaving, setQSaving] = useState(false);
  const [previewQ, setPreviewQ] = useState<AssessmentQuestion | null>(null);

  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [genDraft, setGenDraft] = useState<GenerateDraft>(initialGenerateDraft);

  const [adaptiveKPs, setAdaptiveKPs] = useState<AdaptiveKP[]>([]);
  const [adaptiveLoading, setAdaptiveLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await assessmentQuestionApi.list(configId, {
        skip: (page - 1) * pageSize,
        limit: pageSize,
        question_type: filterType,
        difficulty: filterDiff,
      });
      const fixed: AssessmentQuestion[] = [];
      const adaptive: AdaptiveKP[] = [];
      for (const q of resp.items) {
        if (q.mode === "adaptive") {
          let adaptiveConfig = {
            mastery_streak: 2,
            max_attempts: 5,
            prompt_hint: "",
          };
          if (q.adaptive_config) {
            try {
              adaptiveConfig = { ...adaptiveConfig, ...JSON.parse(q.adaptive_config) };
            } catch {}
          }
          adaptive.push({
            key: String(q.id),
            knowledge_point: q.knowledge_point || "",
            question_type: q.question_type as "choice" | "fill",
            score: q.score,
            prompt_hint: adaptiveConfig.prompt_hint,
            mastery_streak: adaptiveConfig.mastery_streak,
            max_attempts: adaptiveConfig.max_attempts,
          });
        } else {
          fixed.push(q);
        }
      }
      setItems(fixed);
      setAdaptiveKPs(adaptive);
      setTotal(resp.total);
    } catch (e: any) {
      showMessage.error(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [configId, page, pageSize, filterType, filterDiff]);

  const loadConfig = useCallback(async () => {
    try {
      setConfigLoading(true);
      const config = await assessmentConfigApi.get(configId);
      setConfigDraft({
        title: config.title || "",
        grade: config.grade || "",
        total_score: config.total_score || 100,
        available_start: toDateTimeLocal(config.available_start),
        available_end: toDateTimeLocal(config.available_end),
        agent_id: config.agent_id ? String(config.agent_id) : "",
        knowledge_points: parseKnowledgePoints(config.knowledge_points),
        teaching_objectives: config.teaching_objectives || "",
        ai_prompt: config.ai_prompt || "",
      });
    } catch (e: any) {
      showMessage.error(e.message || "加载配置失败");
    } finally {
      setConfigLoading(false);
    }
  }, [configId]);

  const loadAgents = useCallback(async () => {
    try {
      const response = await aiAgentsApi.getAgents({ limit: 100 });
      if (response.success) setAgents(response.data.items || []);
    } catch (e) {
      logger.error("加载智能体失败:", e);
    }
  }, []);

  useEffect(() => {
    void loadQuestions();
    void loadConfig();
    void loadAgents();
  }, [loadQuestions, loadConfig, loadAgents]);

  const handleSaveConfig = async () => {
    if (!configDraft.title.trim()) {
      showMessage.warning("请输入标题");
      return;
    }
    if (!configDraft.agent_id) {
      showMessage.warning("请选择智能体");
      return;
    }
    try {
      setConfigSaving(true);
      const kpStr = configDraft.knowledge_points.trim();
      const kps = kpStr ? kpStr.split(/[,，、\s]+/).filter(Boolean) : [];
      await assessmentConfigApi.update(configId, {
        title: configDraft.title.trim(),
        grade: configDraft.grade || undefined,
        total_score: configDraft.total_score,
        available_start: configDraft.available_start
          ? dayjs(configDraft.available_start).toISOString()
          : undefined,
        available_end: configDraft.available_end
          ? dayjs(configDraft.available_end).toISOString()
          : undefined,
        agent_id: Number(configDraft.agent_id),
        agent_ids: [Number(configDraft.agent_id)],
        teaching_objectives: configDraft.teaching_objectives || undefined,
        ai_prompt: configDraft.ai_prompt || undefined,
        knowledge_points: JSON.stringify(kps),
        question_config: JSON.stringify({}),
      });
      showMessage.success("已保存");
    } catch (e: any) {
      showMessage.error(e.message || "保存失败");
    } finally {
      setConfigSaving(false);
    }
  };

  const openAddQ = () => {
    setEditingQ(null);
    setQuestionDraft(initialQuestionDraft);
    setQuestionDialogOpen(true);
  };

  const openEditQ = (question: AssessmentQuestion) => {
    const options = parseOptionsRecord(question.options);
    setEditingQ(question);
    setQuestionDraft({
      question_type: question.question_type,
      content: question.content,
      options_A: options.A || "",
      options_B: options.B || "",
      options_C: options.C || "",
      options_D: options.D || "",
      correct_answer: question.correct_answer,
      score: question.score,
      difficulty: question.difficulty,
      knowledge_point: question.knowledge_point || "",
      explanation: question.explanation || "",
    });
    setQuestionDialogOpen(true);
  };

  const validateQuestionDraft = () => {
    if (!questionDraft.content.trim()) {
      showMessage.warning("请输入题目内容");
      return false;
    }
    if (!questionDraft.correct_answer.trim()) {
      showMessage.warning("请输入正确答案");
      return false;
    }
    if (questionDraft.question_type === "choice") {
      const requiredOptions = [
        questionDraft.options_A,
        questionDraft.options_B,
        questionDraft.options_C,
        questionDraft.options_D,
      ];
      if (requiredOptions.some((item) => !item.trim())) {
        showMessage.warning("选择题必须填写 A/B/C/D 四个选项");
        return false;
      }
    }
    if (!Number.isFinite(questionDraft.score) || questionDraft.score < 1) {
      showMessage.warning("分值必须大于 0");
      return false;
    }
    return true;
  };

  const handleSaveQuestion = async () => {
    if (!validateQuestionDraft()) return;
    try {
      setQSaving(true);
      const options =
        questionDraft.question_type === "choice"
          ? JSON.stringify({
              A: questionDraft.options_A,
              B: questionDraft.options_B,
              C: questionDraft.options_C,
              D: questionDraft.options_D,
            })
          : undefined;
      if (editingQ) {
        await assessmentQuestionApi.update(editingQ.id, {
          question_type: questionDraft.question_type,
          content: questionDraft.content.trim(),
          options,
          correct_answer: questionDraft.correct_answer.trim(),
          score: questionDraft.score,
          difficulty: questionDraft.difficulty,
          knowledge_point: questionDraft.knowledge_point.trim() || undefined,
          explanation: questionDraft.explanation.trim() || undefined,
          mode: "fixed",
        });
        showMessage.success("已更新");
      } else {
        await assessmentQuestionApi.create({
          config_id: configId,
          question_type: questionDraft.question_type,
          content: questionDraft.content.trim(),
          options,
          correct_answer: questionDraft.correct_answer.trim(),
          score: questionDraft.score,
          difficulty: questionDraft.difficulty,
          knowledge_point: questionDraft.knowledge_point.trim() || undefined,
          explanation: questionDraft.explanation.trim() || undefined,
          source: "manual",
          mode: "fixed",
        });
        showMessage.success("已添加");
      }
      setQuestionDialogOpen(false);
      await loadQuestions();
    } catch (e: any) {
      showMessage.error(e.message || "保存失败");
    } finally {
      setQSaving(false);
    }
  };

  const handleDeleteQ = async (questionId: number) => {
    if (!window.confirm("确认删除该题目？")) return;
    try {
      await assessmentQuestionApi.delete(questionId);
      showMessage.success("已删除");
      await loadQuestions();
    } catch (e: any) {
      showMessage.error(e.message || "删除失败");
    }
  };

  const handleGenerate = async () => {
    if (!Number.isFinite(genDraft.count) || genDraft.count < 1 || genDraft.count > 50) {
      showMessage.warning("生成数量需在 1 - 50 之间");
      return;
    }
    try {
      setGenerating(true);
      setGenDialogOpen(false);
      setGenProgress(0);
      const timer = window.setInterval(() => {
        setGenProgress((prev) => (prev >= 90 ? 90 : prev + Math.random() * 15));
      }, 800);
      const knowledgePoints = genDraft.knowledge_points_text
        .split(/[,，、\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);
      const result = await assessmentQuestionApi.generate(configId, {
        count: genDraft.count,
        question_type: genDraft.question_type || undefined,
        difficulty: genDraft.difficulty || undefined,
        knowledge_points: knowledgePoints.length > 0 ? knowledgePoints : undefined,
      });
      window.clearInterval(timer);
      setGenProgress(100);
      showMessage.success(result.message || `生成了 ${result.count} 道题`);
      window.setTimeout(() => {
        setGenerating(false);
        setGenProgress(0);
      }, 600);
      await loadQuestions();
    } catch (e: any) {
      setGenerating(false);
      setGenProgress(0);
      showMessage.error(e.message || "AI 生成失败");
    }
  };

  const handleAddAdaptive = () => {
    setAdaptiveKPs((prev) => [
      ...prev,
      {
        key: `new_${Date.now()}`,
        knowledge_point: "",
        question_type: "choice",
        score: 10,
        prompt_hint: "",
        mastery_streak: 2,
        max_attempts: 5,
      },
    ]);
  };

  const updateAdaptive = (key: string, field: keyof AdaptiveKP, value: string | number) => {
    setAdaptiveKPs((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    );
  };

  const removeAdaptive = async (kp: AdaptiveKP) => {
    if (!window.confirm("确认删除该知识点？")) return;
    if (!kp.key.startsWith("new_")) {
      try {
        await assessmentQuestionApi.delete(Number(kp.key));
      } catch {}
    }
    setAdaptiveKPs((prev) => prev.filter((item) => item.key !== kp.key));
  };

  const saveAllAdaptive = async () => {
    try {
      setAdaptiveLoading(true);
      for (const kp of adaptiveKPs) {
        if (!kp.knowledge_point.trim()) {
          showMessage.warning("知识点名称不能为空");
          return;
        }
        const adaptiveConfig = JSON.stringify({
          mastery_streak: kp.mastery_streak,
          max_attempts: kp.max_attempts,
          prompt_hint: kp.prompt_hint,
        });
        if (kp.key.startsWith("new_")) {
          await assessmentQuestionApi.create({
            config_id: configId,
            question_type: kp.question_type,
            content: `[自适应] ${kp.knowledge_point}`,
            correct_answer: "AI_GENERATED",
            score: kp.score,
            knowledge_point: kp.knowledge_point,
            source: "manual",
            mode: "adaptive",
            adaptive_config: adaptiveConfig,
          });
        } else {
          await assessmentQuestionApi.update(Number(kp.key), {
            question_type: kp.question_type,
            score: kp.score,
            knowledge_point: kp.knowledge_point,
            mode: "adaptive",
            adaptive_config: adaptiveConfig,
          });
        }
      }
      showMessage.success("已保存");
      await loadQuestions();
    } catch (e: any) {
      showMessage.error(e.message || "保存失败");
    } finally {
      setAdaptiveLoading(false);
    }
  };

  const fixedQuestionColumns: ColumnDef<AssessmentQuestion>[] = [
      {
        id: "index",
        header: "#",
        size: 56,
        meta: { className: "w-[56px]" },
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        id: "question_type",
        header: "题型",
        accessorKey: "question_type",
        size: 100,
        meta: { className: "w-[100px]" },
        cell: ({ row }) => (
          <Badge variant={TYPE_MAP[row.original.question_type]?.variant || "neutral"}>
            {TYPE_MAP[row.original.question_type]?.label || row.original.question_type}
          </Badge>
        ),
      },
      {
        id: "content",
        header: "内容",
        accessorKey: "content",
        cell: ({ row }) => <div className="max-w-[420px] truncate">{row.original.content}</div>,
      },
      {
        id: "score",
        header: "分值",
        accessorKey: "score",
        size: 80,
        meta: { className: "w-[80px]" },
      },
      {
        id: "difficulty",
        header: "难度",
        accessorKey: "difficulty",
        size: 100,
        meta: { className: "w-[100px]" },
        cell: ({ row }) => (
          <Badge variant={DIFF_MAP[row.original.difficulty]?.variant || "neutral"}>
            {DIFF_MAP[row.original.difficulty]?.label || row.original.difficulty}
          </Badge>
        ),
      },
      {
        id: "knowledge_point",
        header: "知识点",
        accessorKey: "knowledge_point",
        size: 130,
        meta: { className: "w-[130px]" },
        cell: ({ row }) => row.original.knowledge_point || "-",
      },
      {
        id: "actions",
        header: "操作",
        size: 160,
        meta: { className: "w-[160px]" },
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5"
              onClick={() => setPreviewQ(row.original)}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5"
              onClick={() => openEditQ(row.original)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 text-destructive hover:text-destructive"
              onClick={() => void handleDeleteQ(row.original.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
  ];

  const fixedQuestionTable = useReactTable({
    data: loading ? [] : items,
    columns: fixedQuestionColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (configLoading) {
    return (
      <AdminPage>
        <div className="flex justify-center p-24">
          <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage scrollable>
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/assessment")}>
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Button>
      </div>

      <Card className="mb-5 border border-border bg-surface p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-text-base">基本设置</h3>
          <Button size="sm" disabled={configSaving} onClick={() => void handleSaveConfig()}>
            {configSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存设置
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">测评标题</label>
            <Input
              maxLength={200}
              placeholder="如：Python循环结构课堂检测"
              value={configDraft.title}
              onChange={(e) => setConfigDraft((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">年级</label>
            <Select
              value={configDraft.grade || FILTER_ALL}
              onValueChange={(value) =>
                setConfigDraft((prev) => ({ ...prev, grade: value === FILTER_ALL ? "" : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择年级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>未设置</SelectItem>
                {GRADE_OPTIONS.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">智能体</label>
            <Select
              value={configDraft.agent_id || FILTER_ALL}
              onValueChange={(value) =>
                setConfigDraft((prev) => ({ ...prev, agent_id: value === FILTER_ALL ? "" : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择智能体" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>请选择</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={String(agent.id)}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">开放开始时间</label>
            <Input
              type="datetime-local"
              value={configDraft.available_start}
              onChange={(e) =>
                setConfigDraft((prev) => ({ ...prev, available_start: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">开放结束时间</label>
            <Input
              type="datetime-local"
              value={configDraft.available_end}
              onChange={(e) =>
                setConfigDraft((prev) => ({ ...prev, available_end: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">知识点</label>
            <Input
              placeholder="如：for循环、while循环、递归"
              value={configDraft.knowledge_points}
              onChange={(e) =>
                setConfigDraft((prev) => ({ ...prev, knowledge_points: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">总分</label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={configDraft.total_score}
              onChange={(e) =>
                setConfigDraft((prev) => ({
                  ...prev,
                  total_score: asPositiveNumber(e.target.value, prev.total_score),
                }))
              }
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">教学目标</label>
            <Textarea
              rows={3}
              placeholder="可选，AI 出题时会参考"
              value={configDraft.teaching_objectives}
              onChange={(e) =>
                setConfigDraft((prev) => ({ ...prev, teaching_objectives: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">出题提示</label>
            <Textarea
              rows={3}
              placeholder="可选，如：侧重实际应用场景"
              value={configDraft.ai_prompt}
              onChange={(e) => setConfigDraft((prev) => ({ ...prev, ai_prompt: e.target.value }))}
            />
          </div>
        </div>
      </Card>

      <Card className="mb-5 border border-border bg-surface p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-text-base">固定题</h3>
            <Badge variant="sky">{items.length}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={filterType || FILTER_ALL}
              onValueChange={(value) => {
                setFilterType(value === FILTER_ALL ? undefined : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[110px]">
                <SelectValue placeholder="题型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>全部题型</SelectItem>
                {Object.entries(TYPE_MAP).map(([value, item]) => (
                  <SelectItem key={value} value={value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterDiff || FILTER_ALL}
              onValueChange={(value) => {
                setFilterDiff(value === FILTER_ALL ? undefined : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[110px]">
                <SelectValue placeholder="难度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>全部难度</SelectItem>
                {Object.entries(DIFF_MAP).map(([value, item]) => (
                  <SelectItem key={value} value={value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button size="sm" variant="outline" onClick={openAddQ}>
              <Plus className="h-4 w-4" />
              添加
            </Button>
            <Button
              size="sm"
              disabled={generating}
              onClick={() => {
                setGenDraft(initialGenerateDraft);
                setGenDialogOpen(true);
              }}
            >
              <Sparkles className="h-4 w-4" />
              AI 生成
            </Button>
          </div>
        </div>

        {generating ? (
          <div className="mb-3 rounded-md bg-surface-2 px-3 py-2.5">
            <div className="mb-1 flex items-center justify-between text-sm text-text-secondary">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                AI 正在生成题目...
              </span>
              <span>{Math.round(genProgress)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--ws-color-border-secondary)]">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, Math.max(0, genProgress))}%` }}
              />
            </div>
          </div>
        ) : null}

        <DataTable
          table={fixedQuestionTable}
          className="border-0"
          tableClassName="min-w-[840px]"
          emptyState={
            loading ? (
              <div className="py-10 text-center text-sm text-text-tertiary">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在加载...
                </span>
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-text-tertiary">
                暂无固定题，可手动添加或 AI 生成
              </div>
            )
          }
        />

        {total > pageSize ? (
          <div className="mt-2 flex justify-end border-t border-border-secondary pt-3">
            <DataTablePagination
              currentPage={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
              onPageChange={(nextPage, nextPageSize) => {
                if (nextPageSize && nextPageSize !== pageSize) {
                  setPageSize(nextPageSize);
                }
                setPage(nextPage);
              }}
            />
          </div>
        ) : null}
      </Card>

      <Card className="mb-5 border border-border bg-surface p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-text-base">自适应知识点题</h3>
              <Badge variant="success">{adaptiveKPs.length}</Badge>
            </div>
            <div className="mt-0.5 text-xs text-text-tertiary">
              答题时 AI 实时出题，答错追加，连续答对即掌握
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleAddAdaptive}>
              <Plus className="h-4 w-4" />
              添加
            </Button>
            <Button size="sm" disabled={adaptiveLoading} onClick={() => void saveAllAdaptive()}>
              {adaptiveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              保存
            </Button>
          </div>
        </div>

        {adaptiveKPs.length === 0 ? (
          <div className="py-10 text-center">
            <Button size="sm" variant="outline" onClick={handleAddAdaptive}>
              <Plus className="h-4 w-4" />
              添加知识点
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div
              className="grid gap-2 px-2 text-xs font-medium text-text-tertiary"
              style={{ gridTemplateColumns: "32px 1fr 2fr 110px 90px 90px 90px 40px" }}
            >
              <span>#</span>
              <span>知识点</span>
              <span>考察内容</span>
              <span>题型</span>
              <span>分值</span>
              <span title="连续答对几题判定掌握">掌握</span>
              <span title="最多尝试几次">上限</span>
              <span />
            </div>
            {adaptiveKPs.map((kp, index) => (
              <div
                key={kp.key}
                className="grid items-center gap-2 rounded-md bg-surface-2 px-2 py-2"
                style={{ gridTemplateColumns: "32px 1fr 2fr 110px 90px 90px 90px 40px" }}
              >
                <span className="text-sm font-medium text-text-secondary">{index + 1}</span>
                <Input
                  value={kp.knowledge_point}
                  placeholder="如：for循环"
                  onChange={(e) => updateAdaptive(kp.key, "knowledge_point", e.target.value)}
                />
                <Input
                  value={kp.prompt_hint}
                  placeholder="给 AI 的出题提示"
                  onChange={(e) => updateAdaptive(kp.key, "prompt_hint", e.target.value)}
                />
                <Select
                  value={kp.question_type}
                  onValueChange={(value) =>
                    updateAdaptive(kp.key, "question_type", value as "choice" | "fill")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="choice">选择题</SelectItem>
                    <SelectItem value="fill">填空题</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={kp.score}
                  onChange={(e) =>
                    updateAdaptive(kp.key, "score", asPositiveNumber(e.target.value, kp.score))
                  }
                />
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={kp.mastery_streak}
                  onChange={(e) =>
                    updateAdaptive(
                      kp.key,
                      "mastery_streak",
                      asPositiveNumber(e.target.value, kp.mastery_streak),
                    )
                  }
                />
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={kp.max_attempts}
                  onChange={(e) =>
                    updateAdaptive(
                      kp.key,
                      "max_attempts",
                      asPositiveNumber(e.target.value, kp.max_attempts),
                    )
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={() => void removeAdaptive(kp)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog
        open={questionDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setQuestionDialogOpen(false);
            setEditingQ(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[780px]">
          <DialogHeader>
            <DialogTitle>{editingQ ? "编辑题目" : "添加题目"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">题型</label>
              <div className="flex flex-wrap gap-2">
                {(["choice", "fill", "short_answer"] as QuestionType[]).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={questionDraft.question_type === value ? "default" : "outline"}
                    onClick={() =>
                      setQuestionDraft((prev) => ({ ...prev, question_type: value }))
                    }
                  >
                    {TYPE_MAP[value].label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">题目内容</label>
              <Textarea
                rows={3}
                value={questionDraft.content}
                onChange={(e) =>
                  setQuestionDraft((prev) => ({ ...prev, content: e.target.value }))
                }
              />
            </div>

            {questionDraft.question_type === "choice" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">选项 A</label>
                  <Input
                    value={questionDraft.options_A}
                    onChange={(e) =>
                      setQuestionDraft((prev) => ({ ...prev, options_A: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">选项 B</label>
                  <Input
                    value={questionDraft.options_B}
                    onChange={(e) =>
                      setQuestionDraft((prev) => ({ ...prev, options_B: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">选项 C</label>
                  <Input
                    value={questionDraft.options_C}
                    onChange={(e) =>
                      setQuestionDraft((prev) => ({ ...prev, options_C: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">选项 D</label>
                  <Input
                    value={questionDraft.options_D}
                    onChange={(e) =>
                      setQuestionDraft((prev) => ({ ...prev, options_D: e.target.value }))
                    }
                  />
                </div>
              </div>
            ) : null}

            <div>
              <label className="mb-1.5 block text-sm font-medium">正确答案</label>
              <Input
                placeholder={questionDraft.question_type === "choice" ? "如：A" : "输入正确答案"}
                value={questionDraft.correct_answer}
                onChange={(e) =>
                  setQuestionDraft((prev) => ({ ...prev, correct_answer: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">分值</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={questionDraft.score}
                  onChange={(e) =>
                    setQuestionDraft((prev) => ({
                      ...prev,
                      score: asPositiveNumber(e.target.value, prev.score),
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">难度</label>
                <Select
                  value={questionDraft.difficulty}
                  onValueChange={(value) =>
                    setQuestionDraft((prev) => ({
                      ...prev,
                      difficulty: value as Difficulty,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">简单</SelectItem>
                    <SelectItem value="medium">中等</SelectItem>
                    <SelectItem value="hard">困难</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">知识点</label>
                <Input
                  placeholder="可选"
                  value={questionDraft.knowledge_point}
                  onChange={(e) =>
                    setQuestionDraft((prev) => ({ ...prev, knowledge_point: e.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">解析</label>
              <Textarea
                rows={2}
                placeholder="可选"
                value={questionDraft.explanation}
                onChange={(e) =>
                  setQuestionDraft((prev) => ({ ...prev, explanation: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>
              取消
            </Button>
            <Button disabled={qSaving} onClick={() => void handleSaveQuestion()}>
              {qSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingQ ? "保存修改" : "添加题目"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(previewQ)}
        onOpenChange={(open) => {
          if (!open) setPreviewQ(null);
        }}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>题目预览</DialogTitle>
          </DialogHeader>

          {previewQ ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={TYPE_MAP[previewQ.question_type]?.variant || "neutral"}>
                  {TYPE_MAP[previewQ.question_type]?.label || previewQ.question_type}
                </Badge>
                <Badge variant={DIFF_MAP[previewQ.difficulty]?.variant || "neutral"}>
                  {DIFF_MAP[previewQ.difficulty]?.label || previewQ.difficulty}
                </Badge>
                <Badge variant="secondary">{previewQ.score} 分</Badge>
                {previewQ.knowledge_point ? (
                  <Badge variant="secondary">{previewQ.knowledge_point}</Badge>
                ) : null}
              </div>

              <div className="whitespace-pre-wrap text-base leading-loose">{previewQ.content}</div>

              {(() => {
                const options = parseOptionsList(previewQ.options);
                if (!options) return null;
                if (Array.isArray(options)) {
                  return (
                    <div className="space-y-1 text-sm">
                      {options.map((item, index) => (
                        <div key={index}>{item}</div>
                      ))}
                    </div>
                  );
                }
                return (
                  <div className="space-y-1 text-sm">
                    {Object.entries(options).map(([key, value]) => (
                      <div key={key}>
                        {key}. {String(value)}
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div className="border-t border-border pt-3">
                <div className="text-sm font-medium text-[var(--ws-color-success)]">
                  正确答案：{previewQ.correct_answer}
                </div>
                {previewQ.explanation ? (
                  <div className="mt-2 text-sm leading-relaxed text-text-secondary">
                    解析：{previewQ.explanation}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={genDialogOpen}
        onOpenChange={(open) => {
          if (!open) setGenDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>AI 生成题目</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">生成数量</label>
              <Input
                type="number"
                min={1}
                max={50}
                value={genDraft.count}
                onChange={(e) =>
                  setGenDraft((prev) => ({
                    ...prev,
                    count: asPositiveNumber(e.target.value, prev.count),
                  }))
                }
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">题型</label>
              <Select
                value={genDraft.question_type || FILTER_ALL}
                onValueChange={(value) =>
                  setGenDraft((prev) => ({
                    ...prev,
                    question_type: value === FILTER_ALL ? "" : (value as QuestionType),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="不限（混合出题）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>不限</SelectItem>
                  <SelectItem value="choice">选择题</SelectItem>
                  <SelectItem value="fill">填空题</SelectItem>
                  <SelectItem value="short_answer">简答题</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">难度</label>
              <Select
                value={genDraft.difficulty || FILTER_ALL}
                onValueChange={(value) =>
                  setGenDraft((prev) => ({
                    ...prev,
                    difficulty: value === FILTER_ALL ? "" : (value as Difficulty),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="不限（自动分布）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>不限</SelectItem>
                  <SelectItem value="easy">简单</SelectItem>
                  <SelectItem value="medium">中等</SelectItem>
                  <SelectItem value="hard">困难</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">知识点范围</label>
              <Textarea
                rows={3}
                placeholder="可填多个，用逗号/顿号/空格分隔，留空表示不限制"
                value={genDraft.knowledge_points_text}
                onChange={(e) =>
                  setGenDraft((prev) => ({
                    ...prev,
                    knowledge_points_text: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setGenDialogOpen(false)}>
              取消
            </Button>
            <Button disabled={generating} onClick={() => void handleGenerate()}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              开始生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
};

export default QuestionsPage;
