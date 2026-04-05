// 课堂互动 - 管理端

import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ColumnDef,
  type RowSelectionState,
  type Updater,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BarChart3,
  Check,
  Code,
  Copy,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react";
import { AdminPage, AdminTablePanel } from "@components/Admin";
import { ActivityDetailDrawer } from "@components/ActivityDetailDrawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
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
import { Switch } from "@/components/ui/switch";
import {
  Textarea,
} from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  classroomApi,
  Activity,
  ActivityCreateRequest,
  ActivityStats,
  OptionItem,
  ActiveAgentOption,
} from "@services/classroom";
import { cn } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";

const FILTER_ALL = "__all__";
const STEP_TITLES = ["基本信息", "题目内容", "活动设置", "AI分析"];

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

const parseBlankAnswers = (raw?: string | null): string[] => {
  const text = String(raw || "").trim();
  if (!text) return [];
  if (!text.startsWith("[") && !text.startsWith("{")) return [text];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v ?? "").trim());
    if (parsed && typeof parsed === "object") {
      return Object.keys(parsed)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => String((parsed as any)[k] ?? "").trim());
    }
  } catch {}
  return [text];
};

const toFillBlankPayload = (values: FormValues): string | undefined => {
  const blanks = (values.blank_answers || [])
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  if (blanks.length === 0) return undefined;
  if (blanks.length === 1) return blanks[0];
  return JSON.stringify(blanks);
};

const countBlanksInCode = (code: string): number => (code.match(/___/g) || []).length;

const extractCodeTemplate = (options: OptionItem[] | null): string => {
  if (!Array.isArray(options)) return "";
  const codeOpt = options.find((o) => o.key === "__code__");
  return codeOpt?.text || "";
};

const packCodeTemplate = (code: string): OptionItem[] => [{ key: "__code__", text: code }];

const parseErrorMessage = (error: any): string =>
  String(error?.response?.data?.detail || error?.message || "操作失败");

const ANALYSIS_STATUS_MAP: Record<string, { variant: React.ComponentProps<typeof Badge>["variant"]; text: string }> = {
  pending: { variant: "neutral", text: "待分析" },
  running: { variant: "info", text: "分析中" },
  success: { variant: "success", text: "分析完成" },
  failed: { variant: "danger", text: "分析失败" },
  skipped: { variant: "warning", text: "已跳过" },
  not_applicable: { variant: "neutral", text: "不适用" },
};

const STATUS_MAP: Record<Activity["status"], { label: string; dotClass: string }> = {
  draft: { label: "草稿", dotClass: "bg-text-tertiary" },
  active: { label: "进行中", dotClass: "bg-[var(--ws-color-info)]" },
  ended: { label: "已结束", dotClass: "bg-[var(--ws-color-success)]" },
};

type FormValues = {
  activity_type: "vote" | "fill_blank";
  title: string;
  options: OptionItem[];
  blank_answers: string[];
  correct_answer: string;
  allow_multiple: boolean;
  time_limit: number;
  analysis_agent_id: string;
  analysis_prompt: string;
};

const activityFormSchema = z.object({
  activity_type: z.enum(["vote", "fill_blank"]),
  title: z.string().max(200, "活动标题不能超过 200 个字符"),
  options: z.array(
    z.object({
      key: z.string(),
      text: z.string(),
    }),
  ),
  blank_answers: z.array(z.string()),
  correct_answer: z.string(),
  allow_multiple: z.boolean(),
  time_limit: z.number().min(0, "时间限制不能小于 0").max(3600, "时间限制不能超过 3600"),
  analysis_agent_id: z.string(),
  analysis_prompt: z.string().max(1000, "AI 分析提示词不能超过 1000 个字符"),
});

const defaultFormValues = (): FormValues => ({
  activity_type: "vote",
  title: "",
  options: [
    { key: "A", text: "" },
    { key: "B", text: "" },
  ],
  blank_answers: [""],
  correct_answer: "",
  allow_multiple: false,
  time_limit: 60,
  analysis_agent_id: "",
  analysis_prompt: "",
});

const toEditFormValues = (record: Activity): FormValues => {
  const type = record.activity_type;
  return {
    activity_type: type,
    title: record.title || "",
    options:
      type === "vote" && Array.isArray(record.options) && record.options.length > 0
        ? record.options
        : [
            { key: "A", text: "" },
            { key: "B", text: "" },
          ],
    blank_answers: type === "fill_blank" ? parseBlankAnswers(record.correct_answer) : [""],
    correct_answer: type === "vote" ? String(record.correct_answer || "") : "",
    allow_multiple: Boolean(record.allow_multiple),
    time_limit: Number(record.time_limit || 60),
    analysis_agent_id: record.analysis_agent_id ? String(record.analysis_agent_id) : "",
    analysis_prompt: record.analysis_prompt || "",
  };
};

// ─── 分步创建/编辑 Dialog ─────────────────────────────────────────────────────

interface ActivityFormDialogProps {
  open: boolean;
  editingId: number | null;
  editingRecord: Activity | null;
  activeAgents: ActiveAgentOption[];
  loadingAgents: boolean;
  onRefreshAgents: () => void;
  onClose: () => void;
  onSuccess: () => void | Promise<unknown>;
}

const ActivityFormDialog: React.FC<ActivityFormDialogProps> = ({
  open,
  editingId,
  editingRecord,
  activeAgents,
  loadingAgents,
  onRefreshAgents,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState(0);
  const {
    reset,
    setValue,
    getValues,
    watch,
    handleSubmit: submitForm,
  } = useForm<FormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: defaultFormValues(),
    mode: "onChange",
  });
  const formValues = watch() as FormValues;
  const [codeTemplate, setCodeTemplate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    if (editingRecord) {
      reset(toEditFormValues(editingRecord));
      if (editingRecord.activity_type === "fill_blank") {
        setCodeTemplate(extractCodeTemplate(editingRecord.options as OptionItem[] | null));
      } else {
        setCodeTemplate("");
      }
      return;
    }
    reset(defaultFormValues());
    setCodeTemplate("");
  }, [open, editingRecord, reset]);

  const updateField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValue(key as any, value as any, { shouldDirty: true, shouldValidate: true });
  };

  const updateOption = (index: number, text: string) => {
    const options = getValues("options") || [];
    const next = [...options];
    next[index] = { ...next[index], text };
    setValue("options", next, { shouldDirty: true, shouldValidate: true });
  };

  const addOption = () => {
    const options = getValues("options") || [];
    if (options.length >= 6) return;
    const next = [
      ...options,
      { key: String.fromCharCode(65 + options.length), text: "" },
    ];
    setValue("options", next, { shouldDirty: true, shouldValidate: true });
  };

  const removeOption = (index: number) => {
    const options = getValues("options") || [];
    const next = options
      .filter((_, idx) => idx !== index)
      .map((item, idx) => ({ ...item, key: String.fromCharCode(65 + idx) }));
    setValue("options", next, { shouldDirty: true, shouldValidate: true });
  };

  const syncBlankAnswers = (code: string) => {
    const count = Math.max(countBlanksInCode(code), 1);
    const cur = getValues("blank_answers") || [];
    if (cur.length === count) return;
    const next = Array.from({ length: count }, (_, i) => cur[i] ?? "");
    setValue("blank_answers", next, { shouldDirty: true, shouldValidate: true });
  };

  const updateBlankAnswer = (index: number, value: string) => {
    const answers = getValues("blank_answers") || [];
    const next = [...answers];
    next[index] = value;
    setValue("blank_answers", next, { shouldDirty: true, shouldValidate: true });
  };

  const addBlankAnswer = () => {
    const answers = getValues("blank_answers") || [];
    if (answers.length >= 10) return;
    setValue("blank_answers", [...answers, ""], { shouldDirty: true, shouldValidate: true });
  };

  const removeBlankAnswer = (index: number) => {
    const answers = getValues("blank_answers") || [];
    if (answers.length <= 1) return;
    setValue(
      "blank_answers",
      answers.filter((_, idx) => idx !== index),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const nextStep = () => {
    if (step === 0) {
      if (!formValues.title.trim()) {
        showMessage.warning("请输入活动标题");
        return;
      }
      if (formValues.title.trim().length > 200) {
        showMessage.warning("活动标题不能超过 200 个字符");
        return;
      }
    }
    if (step === 1) {
      if (formValues.activity_type === "vote") {
        const options = formValues.options || [];
        if (options.length < 2) {
          showMessage.warning("至少需要 2 个选项");
          return;
        }
        const hasEmpty = options.some((o) => !String(o.text || "").trim());
        if (hasEmpty) {
          showMessage.warning("请填写所有选项内容");
          return;
        }
      } else {
        const answers = formValues.blank_answers || [];
        if (answers.length === 0) {
          showMessage.warning("至少需要 1 个空位答案");
          return;
        }
        const hasEmpty = answers.some((v) => !String(v || "").trim());
        if (hasEmpty) {
          showMessage.warning("请填写所有空位答案");
          return;
        }
      }
    }
    if (step === 2) {
      const timeLimit = Number(formValues.time_limit);
      if (!Number.isFinite(timeLimit) || timeLimit < 0 || timeLimit > 3600) {
        showMessage.warning("时间限制需在 0-3600 秒之间");
        return;
      }
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const handleFinalSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const payload: ActivityCreateRequest = {
        activity_type: values.activity_type,
        title: values.title.trim(),
        time_limit: Number(values.time_limit || 60),
        correct_answer:
          values.activity_type === "fill_blank"
            ? toFillBlankPayload(values)
            : (values.correct_answer || "").trim() || undefined,
        allow_multiple: values.allow_multiple,
        analysis_agent_id: values.analysis_agent_id
          ? Number(values.analysis_agent_id)
          : undefined,
        analysis_prompt: values.analysis_prompt.trim() || undefined,
      };

      if (values.activity_type === "vote") {
        payload.options = (values.options || [])
          .map((o) => ({ ...o, text: String(o.text || "").trim() }))
          .filter((o) => o.text);
      } else if (codeTemplate.trim()) {
        payload.options = packCodeTemplate(codeTemplate.trim());
      }

      if (editingId) {
        await classroomApi.update(editingId, payload);
        showMessage.success("已更新");
      } else {
        await classroomApi.create(payload);
        showMessage.success("创建成功");
      }

      onClose();
      await onSuccess();
    } catch (e: any) {
      showMessage.error(parseErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{editingId ? "编辑活动" : "创建活动"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {STEP_TITLES.map((title, index) => (
              <div
                key={title}
                className={cn(
                  "rounded-md border px-2 py-1 text-center text-xs",
                  index < step
                    ? "border-[color:var(--ws-color-success)] bg-[var(--ws-color-success-soft)] text-[var(--ws-color-success)]"
                    : index === step
                      ? "border-[color:var(--ws-color-info)] bg-[var(--ws-color-info-soft)] text-[var(--ws-color-info)]"
                      : "border-border bg-surface text-text-tertiary",
                )}
              >
                {title}
              </div>
            ))}
          </div>

          {step === 0 ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">活动类型</label>
                <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
                  {[
                    { value: "vote", label: "投票 / 选择" },
                    { value: "fill_blank", label: "填空" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={cn(
                        "rounded px-3 py-1.5 text-xs transition-colors",
                        formValues.activity_type === item.value
                          ? "bg-surface text-text shadow-sm"
                          : "text-text-tertiary hover:text-text",
                      )}
                      onClick={() => {
                        const next = item.value as "vote" | "fill_blank";
                        updateField("activity_type", next);
                        if (next === "fill_blank" && formValues.blank_answers.length === 0) {
                          updateField("blank_answers", [""]);
                        }
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">活动标题</label>
                <Input
                  value={formValues.title}
                  maxLength={200}
                  placeholder="活动标题，填空题中可用（1）（2）标记空位"
                  onChange={(e) => updateField("title", e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-3">
              {formValues.activity_type === "vote" ? (
                <>
                  <div className="text-xs text-text-tertiary">至少 2 个选项，最多 6 个</div>
                  {(formValues.options || []).map((option, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input value={option.key} disabled className="w-[48px]" />
                      <Input
                        value={option.text}
                        placeholder={`选项 ${option.key}`}
                        onChange={(e) => updateOption(idx, e.target.value)}
                      />
                      {formValues.options.length > 2 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeOption(idx)}
                        >
                          删除
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {formValues.options.length < 6 ? (
                    <Button type="button" variant="outline" className="w-full" onClick={addOption}>
                      <Plus className="h-4 w-4" /> 添加选项
                    </Button>
                  ) : null}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">正确答案（可选）</label>
                    <Input
                      value={formValues.correct_answer}
                      placeholder="如 A 或 A,B（留空表示无标准答案）"
                      onChange={(e) => updateField("correct_answer", e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                      <Code className="h-3.5 w-3.5" />
                      代码片段模板（可选）— 用 <code className="rounded bg-violet-100 px-1 py-0.5 text-violet-700">___</code> 标记空位
                    </div>
                    <Textarea
                      value={codeTemplate}
                      rows={8}
                      spellCheck={false}
                      className="font-mono"
                      placeholder={`// 示例：\ndef add(a, b):\n    return ___ + ___`}
                      onChange={(e) => {
                        const next = e.target.value;
                        setCodeTemplate(next);
                        syncBlankAnswers(next);
                      }}
                    />
                    {codeTemplate ? (
                      <div className="text-xs text-text-tertiary">
                        检测到{" "}
                        <strong className="text-violet-600">{countBlanksInCode(codeTemplate)}</strong>{" "}
                        个空位
                      </div>
                    ) : null}
                  </div>

                  <div className="text-xs text-text-tertiary">
                    {codeTemplate
                      ? "每个 ___ 对应一个标准答案"
                      : "在标题中使用（1）（2）... 标记空位位置，这里填写每个空位的标准答案"}
                  </div>
                  {(formValues.blank_answers || []).map((answer, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Badge variant="violet" className="shrink-0 whitespace-nowrap">
                        空位 {idx + 1}
                      </Badge>
                      <Input
                        className="min-w-0 flex-1"
                        value={answer}
                        placeholder={`空位 ${idx + 1} 标准答案`}
                        onChange={(e) => updateBlankAnswer(idx, e.target.value)}
                      />
                      {formValues.blank_answers.length > 1 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeBlankAnswer(idx)}
                        >
                          删除
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {formValues.blank_answers.length < 10 ? (
                    <Button type="button" variant="outline" className="w-full" onClick={addBlankAnswer}>
                      <Plus className="h-4 w-4" /> 添加空位
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">时间限制（秒）</label>
                <Input
                  type="number"
                  min={0}
                  max={3600}
                  value={String(formValues.time_limit)}
                  onChange={(e) =>
                    updateField("time_limit", Number(e.target.value || 0))
                  }
                />
              </div>
              <div>
                <div className="mb-1.5 text-xs text-text-tertiary">快速设置</div>
                <div className="flex flex-wrap gap-2">
                  {[30, 60, 120, 300, 0].map((v) => (
                    <Button
                      key={v}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => updateField("time_limit", v)}
                    >
                      {v === 0 ? "无限" : `${v}s`}
                    </Button>
                  ))}
                </div>
              </div>
              {formValues.activity_type === "vote" ? (
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span className="text-sm">允许多选</span>
                  <Switch
                    checked={formValues.allow_multiple}
                    onCheckedChange={(checked) => updateField("allow_multiple", checked)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <div className="text-xs text-text-tertiary">
                活动结束后自动触发 AI 分析（可选，跳过则不分析）
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">分析智能体</label>
                <Select
                  value={formValues.analysis_agent_id || FILTER_ALL}
                  disabled={loadingAgents || activeAgents.length === 0}
                  onValueChange={(v) =>
                    updateField("analysis_agent_id", v === FILTER_ALL ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        activeAgents.length > 0 ? "选择智能体" : "暂无可用智能体"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>不设置</SelectItem>
                    {activeAgents.map((agent) => (
                      <SelectItem key={agent.id} value={String(agent.id)}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">AI 分析提示词</label>
                <Textarea
                  rows={4}
                  maxLength={1000}
                  value={formValues.analysis_prompt}
                  disabled={activeAgents.length === 0}
                  placeholder="留空使用默认提示词；填写后将完全自定义分析要求"
                  onChange={(e) => updateField("analysis_prompt", e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRefreshAgents}
                disabled={loadingAgents}
              >
                {loadingAgents ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                刷新智能体列表
              </Button>
            </div>
          ) : null}

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={step === 0 ? onClose : () => setStep((s) => Math.max(0, s - 1))}
            >
              {step === 0 ? "取消" : "上一步"}
            </Button>
            {step < 3 ? (
              <Button type="button" onClick={nextStep}>
                下一步
              </Button>
            ) : (
              <Button type="button" disabled={submitting} onClick={() => void submitForm(handleFinalSubmit)()}>
                {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editingId ? "保存" : "创建"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── 主组件 ────────────────────────────────────────────────────────────────────

const AdminClassroomInteractionPage: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<Activity | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailActivity, setDetailActivity] = useState<Activity | null>(null);
  const [detailStats, setDetailStats] = useState<ActivityStats | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const [activeAgents, setActiveAgents] = useState<ActiveAgentOption[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await classroomApi.list({
        skip: (page - 1) * pageSize,
        limit: pageSize,
        status: statusFilter || undefined,
      });
      let items = resp.items || [];
      if (search.trim()) {
        const q = search.toLowerCase();
        items = items.filter((a) => a.title.toLowerCase().includes(q));
      }
      if (typeFilter) {
        items = items.filter((a) => a.activity_type === typeFilter);
      }
      setActivities(items);
      setTotal(resp.total);
      return true;
    } catch (e: any) {
      showMessage.error(parseErrorMessage(e));
      return false;
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, typeFilter, search]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const fetchActiveAgents = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? true;
    setLoadingAgents(true);
    try {
      setActiveAgents(await classroomApi.getActiveAgents());
    } catch (e: any) {
      if (!silent) showMessage.error(parseErrorMessage(e));
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  useEffect(() => {
    void fetchActiveAgents({ silent: true });
  }, [fetchActiveAgents]);

  useEffect(() => {
    return () => {
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    };
  }, []);

  const clearStatsTimer = () => {
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = undefined;
    }
  };

  const handleRefreshList = useCallback(async () => {
    const ok = await fetchList();
    if (ok) showMessage.success("已刷新");
  }, [fetchList]);

  const openCreate = () => {
    setEditingId(null);
    setEditingRecord(null);
    setModalOpen(true);
  };

  const openEdit = (record: Activity) => {
    setEditingId(record.id);
    setEditingRecord(record);
    setModalOpen(true);
  };

  const handleStart = async (id: number) => {
    try {
      await classroomApi.start(id);
      showMessage.success("活动已开始");
      void fetchList();
    } catch (e: any) {
      showMessage.error(parseErrorMessage(e));
    }
  };

  const handleEnd = async (id: number) => {
    const act = activities.find((a) => a.id === id) || detailActivity;
    try {
      await classroomApi.end(id, {
        analysis_agent_id: act?.analysis_agent_id ?? undefined,
        analysis_prompt: act?.analysis_prompt ?? undefined,
      });
      showMessage.success("活动已结束");
      void fetchList();
      if (detailActivity?.id === id) {
        void refreshDetail(id);
      }
    } catch (e: any) {
      showMessage.error(parseErrorMessage(e));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await classroomApi.remove(id);
      showMessage.success("已删除");
      void fetchList();
    } catch (e: any) {
      showMessage.error(parseErrorMessage(e));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    if (!window.confirm(`确认删除选中的 ${selectedRowKeys.length} 条活动？（只有草稿状态可被删除）`)) return;
    try {
      const result = await classroomApi.bulkRemove(selectedRowKeys);
      const skippedCount = result.skipped.length;
      if (skippedCount > 0) {
        showMessage.warning(`已删除 ${result.deleted.length} 条，${skippedCount} 条进行中无法删除`);
      } else {
        showMessage.success(`已删除 ${result.deleted.length} 条`);
      }
      setSelectedRowKeys([]);
      void fetchList();
    } catch (e: any) {
      showMessage.error(parseErrorMessage(e));
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await classroomApi.duplicate(id);
      showMessage.success("已复制为新草稿");
      void fetchList();
    } catch (e: any) {
      showMessage.error(parseErrorMessage(e));
    }
  };

  const handleRestart = async (id: number) => {
    try {
      await classroomApi.restart(id);
      showMessage.success("已重新开始");
      void fetchList();
    } catch (e: any) {
      showMessage.error(parseErrorMessage(e));
    }
  };

  const refreshDetail = async (id: number) => {
    try {
      const detail = await classroomApi.getDetail(id);
      setDetailActivity(detail);
      setDetailStats(detail.stats || null);
    } catch (e: any) {
      showMessage.error(parseErrorMessage(e));
    }
  };

  const openDetail = (record: Activity) => {
    clearStatsTimer();
    setDetailOpen(true);
    void refreshDetail(record.id);
    if (record.status === "active") {
      statsTimerRef.current = setInterval(() => {
        void refreshDetail(record.id);
      }, 3000);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailActivity(null);
    setDetailStats(null);
    clearStatsTimer();
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rowSelection = useMemo<RowSelectionState>(() => {
    const selected = new Set(selectedRowKeys.map((id) => String(id)));
    return activities.reduce<RowSelectionState>((acc, activity) => {
      const key = String(activity.id);
      if (selected.has(key)) {
        acc[key] = true;
      }
      return acc;
    }, {});
  }, [activities, selectedRowKeys]);

  const handleRowSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      const nextSelection =
        typeof updater === "function" ? updater(rowSelection) : updater;
      const pageIds = new Set(activities.map((activity) => activity.id));
      const nextPageSelected = Object.keys(nextSelection)
        .filter((key) => nextSelection[key])
        .map((key) => Number(key));
      setSelectedRowKeys((prev) => [
        ...prev.filter((id) => !pageIds.has(id)),
        ...nextPageSelected,
      ]);
    },
    [activities, rowSelection],
  );

  const rowActionButton = (
    title: string,
    icon: React.ReactNode,
    onClick: () => void,
    options?: { danger?: boolean; disabled?: boolean },
  ) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(options?.danger ? "text-destructive hover:text-destructive" : "")}
          disabled={options?.disabled}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );

  const statusBadge = (status: Activity["status"]) => {
    const item = STATUS_MAP[status];
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 text-xs text-text-secondary">
        <span className={cn("inline-block h-2 w-2 rounded-full", item.dotClass)} />
        {item.label}
      </span>
    );
  };

  const analysisBadge = (analysisStatus?: string | null) => {
    if (!analysisStatus) return <span className="text-xs text-text-tertiary">—</span>;
    const info = ANALYSIS_STATUS_MAP[analysisStatus] || {
      variant: "neutral" as const,
      text: analysisStatus,
    };
    return <Badge variant={info.variant} className="text-xs">{info.text}</Badge>;
  };

  const columns: ColumnDef<Activity>[] = [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
            }
            onCheckedChange={(checked) =>
              table.toggleAllPageRowsSelected(checked === true)
            }
            aria-label="全选当前页活动"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked === true)}
            aria-label={`选择活动 ${row.original.title}`}
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 42,
        meta: { className: "w-[42px]" },
      },
      {
        id: "id",
        header: "ID",
        accessorKey: "id",
        size: 64,
        meta: { className: "w-[64px]" },
      },
      {
        id: "title",
        header: "标题",
        accessorKey: "title",
        meta: { className: "min-w-[180px]" },
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        id: "type",
        header: "类型",
        size: 100,
        meta: { className: "w-[100px]" },
        cell: ({ row }) => (
          <Badge
            variant={row.original.activity_type === "vote" ? "info" : "success"}
          >
            {row.original.activity_type === "vote" ? "投票" : "填空"}
          </Badge>
        ),
      },
      {
        id: "status",
        header: "状态",
        size: 110,
        meta: { className: "w-[110px]" },
        cell: ({ row }) => statusBadge(row.original.status),
      },
      {
        id: "analysis",
        header: "分析",
        size: 110,
        meta: { className: "w-[110px]" },
        cell: ({ row }) => analysisBadge(row.original.analysis_status),
      },
      {
        id: "time_limit",
        header: "时限",
        size: 90,
        meta: { className: "w-[90px]" },
        cell: ({ row }) =>
          row.original.time_limit > 0 ? `${row.original.time_limit}s` : "无限",
      },
      {
        id: "response_count",
        header: "参与",
        size: 80,
        meta: { className: "w-[80px]" },
        cell: ({ row }) => (
          <span
            className={
              row.original.response_count
                ? "font-semibold text-primary"
                : "text-text-tertiary"
            }
          >
            {row.original.response_count ?? 0}
          </span>
        ),
      },
      {
        id: "actions",
        header: "操作",
        size: 260,
        meta: { className: "w-[260px]" },
        cell: ({ row }) => {
          const record = row.original;
          const isDraft = record.status === "draft";
          const isActive = record.status === "active";
          const isEnded = record.status === "ended";
          return (
            <div className="flex items-center gap-1">
              {!isActive
                ? rowActionButton("编辑", <Pencil className="h-4 w-4" />, () => openEdit(record))
                : null}
              {isDraft
                ? rowActionButton("开始", <Play className="h-4 w-4" />, () => {
                    if (!window.confirm("确认开始活动？")) return;
                    void handleStart(record.id);
                  })
                : null}
              {isActive
                ? rowActionButton(
                    "结束",
                    <Square className="h-4 w-4" />,
                    () => {
                      if (!window.confirm("确认结束活动？")) return;
                      void handleEnd(record.id);
                    },
                    { danger: true },
                  )
                : null}
              {isEnded
                ? rowActionButton("重新开始", <RotateCcw className="h-4 w-4" />, () => {
                    if (!window.confirm("重新开始将清除所有答题记录，确认？")) return;
                    void handleRestart(record.id);
                  })
                : null}
              {isEnded
                ? rowActionButton("复制为新草稿", <Copy className="h-4 w-4" />, () => {
                    void handleDuplicate(record.id);
                  })
                : null}
              {!isActive
                ? rowActionButton(
                    "删除",
                    <Trash2 className="h-4 w-4" />,
                    () => {
                      if (!window.confirm("确认删除？")) return;
                      void handleDelete(record.id);
                    },
                    { danger: true },
                  )
                : null}
              {rowActionButton("详情", <BarChart3 className="h-4 w-4" />, () => openDetail(record))}
            </div>
          );
        },
      },
  ];

  const table = useReactTable({
    data: activities,
    columns,
    state: { rowSelection },
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    onRowSelectionChange: handleRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
  });

  const detailExtra =
    detailActivity?.status === "active" ? (
      <div className="mt-5">
        <Button
          type="button"
          variant="destructive"
          className="w-full"
          onClick={() => {
            if (!detailActivity) return;
            if (!window.confirm("确认结束活动？")) return;
            void handleEnd(detailActivity.id);
          }}
        >
          <Square className="h-4 w-4" />
          结束活动
        </Button>
      </div>
    ) : null;

  return (
    <AdminPage scrollable={false}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="搜索标题"
            className="w-[220px]"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <Select
            value={statusFilter || FILTER_ALL}
            onValueChange={(v) => {
              setStatusFilter(v === FILTER_ALL ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>全部状态</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="active">进行中</SelectItem>
              <SelectItem value="ended">已结束</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={typeFilter || FILTER_ALL}
            onValueChange={(v) => {
              setTypeFilter(v === FILTER_ALL ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>全部类型</SelectItem>
              <SelectItem value="vote">投票</SelectItem>
              <SelectItem value="fill_blank">填空</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            onClick={() => void handleRefreshList()}
            disabled={loading}
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            刷新
          </Button>

          {selectedRowKeys.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => void handleBulkDelete()}
            >
              <Trash2 className="h-4 w-4" />
              批量删除 ({selectedRowKeys.length})
            </Button>
          ) : null}
        </div>

        <Button type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          创建活动
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <AdminTablePanel
            loading={loading}
            isEmpty={!loading && activities.length === 0}
            emptyDescription="暂无课堂互动活动"
          >
            <DataTable table={table} className="h-full" tableClassName="min-w-[980px]" />
          </AdminTablePanel>
        </div>
        {total > 0 ? (
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
      </div>

      <ActivityFormDialog
        open={modalOpen}
        editingId={editingId}
        editingRecord={editingRecord}
        activeAgents={activeAgents}
        loadingAgents={loadingAgents}
        onRefreshAgents={() => {
          void fetchActiveAgents({ silent: false });
        }}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchList}
      />

      <ActivityDetailDrawer
        open={detailOpen}
        activity={detailActivity}
        stats={detailStats}
        onClose={closeDetail}
        extra={detailExtra}
      />
    </AdminPage>
  );
};

export default AdminClassroomInteractionPage;
