import { showMessage } from "@/lib/toast";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Code, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  Activity,
  ActivityCreateRequest,
  OptionItem,
  ActiveAgentOption} from "@services/classroom";
import {
  classroomApi
} from "@services/classroom";
import {
  toFillBlankPayload,
  countBlanksInCode,
  extractCodeTemplate,
  packCodeTemplate,
  parseErrorMessage,
} from "../utils";

const FILTER_ALL = "__all__";
const STEP_TITLES = ["基本信息", "题目内容", "活动设置", "AI分析"];

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
    blank_answers: type === "fill_blank"
      ? (() => {
          const parsed = parseBlankAnswers(record.correct_answer);
          return parsed.length > 0 ? parsed : [""];
        })()
      : [""],
    correct_answer: type === "vote" ? String(record.correct_answer || "") : "",
    allow_multiple: Boolean(record.allow_multiple),
    time_limit: Number(record.time_limit || 60),
    analysis_agent_id: record.analysis_agent_id ? String(record.analysis_agent_id) : "",
    analysis_prompt: record.analysis_prompt || "",
  };
};

function parseBlankAnswers(raw?: string | null): string[] {
  const text = String(raw || "").trim();
  if (!text) return [];
  if (!text.startsWith("[") && !text.startsWith("{")) return [text];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((v: any) => String(v ?? "").trim());
    if (parsed && typeof parsed === "object") {
      return Object.keys(parsed)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => String((parsed as any)[k] ?? "").trim());
    }
  } catch {}
  return [text];
}

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
  const form = useForm<FormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: defaultFormValues(),
    mode: "onChange",
  });
  const {
    reset,
    setValue,
    getValues,
    watch,
    handleSubmit: submitForm,
  } = form;
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

        <Form {...form}>
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
              <FormField
                control={form.control}
                name="activity_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>活动类型</FormLabel>
                    <FormControl>
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
                              field.value === item.value
                                ? "bg-surface text-text shadow-sm"
                                : "text-text-tertiary hover:text-text",
                            )}
                            onClick={() => {
                              field.onChange(item.value);
                              if (item.value === "fill_blank" && formValues.blank_answers.length === 0) {
                                setValue("blank_answers", [""], { shouldDirty: true, shouldValidate: true });
                              }
                            }}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>活动标题</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        maxLength={200}
                        placeholder="活动标题，填空题中可用（1）（2）标记空位"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                      <FormField
                        control={form.control}
                        name={`options.${idx}.text`}
                        render={({ field }) => (
                          <FormItem className="flex-1 space-y-0">
                            <FormControl>
                              <Input
                                {...field}
                                placeholder={`选项 ${option.key}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
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
                  <FormField
                    control={form.control}
                    name="correct_answer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>正确答案（可选）</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="如 A 或 A,B（留空表示无标准答案）"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                      <Badge variant="purple" className="shrink-0 whitespace-nowrap">
                        空位 {idx + 1}
                      </Badge>
                      <FormField
                        control={form.control}
                        name={`blank_answers.${idx}`}
                        render={({ field }) => (
                          <FormItem className="min-w-0 flex-1 space-y-0">
                            <FormControl>
                              <Input
                                {...field}
                                placeholder={`空位 ${idx + 1} 标准答案`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
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
              <FormField
                control={form.control}
                name="time_limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>时间限制（秒）</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={3600}
                        value={String(field.value)}
                        onChange={(e) =>
                          field.onChange(Number(e.target.value || 0))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <div className="mb-1.5 text-xs text-text-tertiary">快速设置</div>
                <div className="flex flex-wrap gap-2">
                  {[30, 60, 120, 300, 0].map((v) => (
                    <Button
                      key={v}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => form.setValue("time_limit", v, { shouldDirty: true, shouldValidate: true })}
                    >
                      {v === 0 ? "无限" : `${v}s`}
                    </Button>
                  ))}
                </div>
              </div>
              {formValues.activity_type === "vote" ? (
                <FormField
                  control={form.control}
                  name="allow_multiple"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-md border border-border px-3 py-2 space-y-0">
                      <FormLabel className="text-sm">允许多选</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <div className="text-xs text-text-tertiary">
                活动结束后自动触发 AI 分析（可选，跳过则不分析）
              </div>
              <FormField
                control={form.control}
                name="analysis_agent_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分析智能体</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value || FILTER_ALL}
                        disabled={loadingAgents || activeAgents.length === 0}
                        onValueChange={(v) =>
                          field.onChange(v === FILTER_ALL ? "" : v)
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
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="analysis_prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI 分析提示词</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={4}
                        maxLength={1000}
                        disabled={activeAgents.length === 0}
                        placeholder="留空使用默认提示词；填写后将完全自定义分析要求"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ActivityFormDialog;
