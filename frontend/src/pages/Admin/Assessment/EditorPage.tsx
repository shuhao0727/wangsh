/**
 * 测评编辑页 - /admin/assessment/editor/new 或 /admin/assessment/editor/:id
 * 新建时：填写基本信息后创建，跳转到 QuestionsPage 管理题目
 * 编辑时：直接跳转到 QuestionsPage
 */
import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminPage } from "@components/Admin";
import { assessmentConfigApi } from "@services/assessment";
import { aiAgentsApi } from "@services/agents";
import type { AIAgent } from "@services/znt/types";
import { logger } from "@services/logger";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

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
  const isNew = id === "new";
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<AIAgent[]>([]);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
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
      navigate(`/admin/assessment/${id}/questions`, { replace: true });
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
      loadAgents();
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
      navigate(`/admin/assessment/${config.id}/questions`, { replace: true });
    } catch (e: any) {
      showMessage.error(e?.message || "创建失败");
    } finally {
      setSaving(false);
    }
  };

  if (!isNew) {
    return (
      <AdminPage>
        <div className="flex justify-center p-24">
          <Loader2 className="h-7 w-7 animate-spin text-text-tertiary" />
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage scrollable>
      <div className="mx-auto max-w-[680px] py-5">
        <div className="mb-6 flex items-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/admin/assessment")}
            className="text-text-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Button>
        </div>

        <div className="rounded-md border border-border bg-surface px-5 py-5">
          <div className="mb-5 text-base font-semibold">新建测评</div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assessment-title">测评标题</Label>
              <Input
                id="assessment-title"
                placeholder="如：Python循环结构课堂检测"
                maxLength={200}
                disabled={saving}
                {...register("title")}
              />
              {errors.title?.message ? (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>年级</Label>
                <Controller
                  control={control}
                  name="grade"
                  render={({ field }) => (
                    <Select
                      value={field.value || "__none__"}
                      onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择年级" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">不设置</SelectItem>
                        {GRADE_OPTIONS.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>智能体</Label>
                <Controller
                  control={control}
                  name="agent_id"
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择智能体" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.agent_id?.message ? (
                  <p className="text-xs text-destructive">{errors.agent_id.message}</p>
                ) : (
                  <p className="text-xs text-text-tertiary">用于 AI 出题和评分</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assessment-kp">知识点</Label>
              <Input
                id="assessment-kp"
                placeholder="如：for循环、while循环、递归"
                disabled={saving}
                {...register("knowledge_points")}
              />
              <p className="text-xs text-text-tertiary">用逗号、顿号或空格分隔</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assessment-objective">教学目标</Label>
              <Textarea
                id="assessment-objective"
                rows={3}
                placeholder="可选，AI 出题时会参考"
                disabled={saving}
                {...register("teaching_objectives")}
              />
            </div>

            <div className="pt-2 text-right">
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
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                创建测评
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AdminPage>
  );
};

export default EditorPage;
