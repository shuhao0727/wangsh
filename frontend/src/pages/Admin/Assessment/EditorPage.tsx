/**
 * 测评编辑页 - /admin/assessment/editor/new 或 /admin/assessment/editor/:id
 * 新建时：填写基本信息后创建，跳转到 QuestionsPage 管理题目
 * 编辑时：直接跳转到 QuestionsPage
 */
import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminPage } from "@components/Admin";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { assessmentConfigApi } from "@services/assessment";
import { aiAgentsApi } from "@services/agents";
import type { AIAgent } from "@services/znt/types";
import { logger } from "@services/logger";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { LoadingState } from "@/components/ui/loading-state";
import { Spinner } from "@/components/ui/spinner";
const GRADE_OPTIONS = [
  "高一", "高二", "高三",
  "初一", "初二", "初三",
  "七年级", "八年级", "九年级",
] as const;

const formSchema = z.object({
  title: z.string().trim().min(1, "请输入标题").max(200, "标题不能超过200个字符"),
  grade: z.string().optional(),
  agent_id: z.string().min(1, "请选择智能体"),
  knowledge_points: z.string().optional(),
  teaching_objectives: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const EditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = id === undefined || id === "new";
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<AIAgent[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      grade: "",
      agent_id: "",
      knowledge_points: "",
      teaching_objectives: "",
    },
  });

  useEffect(() => {
    if (!isNew && id) {
      void navigate(`/admin/assessment/${id}/questions`, { replace: true });
    }
  }, [id, isNew, navigate]);

  const loadAgents = useCallback(async () => {
    try {
      const resp = await aiAgentsApi.getAgents({ limit: 100 });
      if (resp.success) {
        setAgents(resp.data.items);
      }
    } catch (e) {
      logger.error("加载智能体失败:", e);
    }
  }, []);

  useEffect(() => {
    if (isNew) {
      void loadAgents();
    }
  }, [isNew, loadAgents]);

  const onSubmit = async (values: FormValues) => {
    const agentId = Number(values.agent_id);
    if (!Number.isFinite(agentId)) {
      showMessage.error("请选择智能体");
      return;
    }

    try {
      setSaving(true);
      const kpStr = (values.knowledge_points || "").trim();
      const kps = kpStr ? kpStr.split(/[,，、\s]+/).filter(Boolean) : [];

      const config = await assessmentConfigApi.create({
        title: values.title.trim(),
        grade: values.grade || undefined,
        agent_id: agentId,
        knowledge_points: JSON.stringify(kps),
        teaching_objectives: values.teaching_objectives?.trim() || undefined,
        question_config: JSON.stringify({}),
      });
      showMessage.success("创建成功");
      void navigate(`/admin/assessment/${config.id}/questions`, { replace: true });
    } catch (e: any) {
      showMessage.error(e?.message || "创建失败");
    } finally {
      setSaving(false);
    }
  };

  if (!isNew) {
    return (
      <AdminPage>
        {/* 整页加载态：原为裸 <Loader2>（无 aria）。尺寸 1.5x = h-7，与原一致。 */}
        <LoadingState label="正在加载测评编辑器…" size="1.5x" className="p-panel-padding-lg" />
      </AdminPage>
    );
  }

  return (
    <AdminPage scrollable>
      <div className="mx-auto max-w-[680px] py-5">
        <Breadcrumb
          items={[
            { label: "管理后台", href: "/admin" },
            { label: "自适应测评", href: "/admin/assessment" },
            { label: "新建测评" },
          ]}
        />

        <div className="rounded-md border border-border bg-surface px-5 py-5">
          <div className="mb-5 text-base font-semibold">新建测评</div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-form-field-gap">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>测评标题</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="如：Python循环结构课堂检测"
                        maxLength={200}
                        disabled={saving}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-item-gap md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="grade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>年级</FormLabel>
                      <Select
                        value={field.value || "__none__"}
                        onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                        disabled={saving}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择年级" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">不设置</SelectItem>
                          {GRADE_OPTIONS.map((g) => (
                            <SelectItem key={g} value={g}>
                              {g}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="agent_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>智能体</FormLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                        disabled={saving}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择智能体" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {agents.map((a) => (
                            <SelectItem key={a.id} value={String(a.id)}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      <p className="text-xs text-text-tertiary">用于 AI 出题和评分</p>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="knowledge_points"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>知识点</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="如：for循环、while循环、递归"
                        disabled={saving}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-text-tertiary">用逗号、顿号或空格分隔</p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="teaching_objectives"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>教学目标</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="可选，AI 出题时会参考"
                        disabled={saving}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-xs text-right">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/admin/assessment")}
                  className="mr-3"
                  disabled={saving}
                >
                  取消
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
                  创建测评
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </AdminPage>
  );
};

export default EditorPage;
