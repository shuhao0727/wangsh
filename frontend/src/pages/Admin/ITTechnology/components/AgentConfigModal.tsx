import { showMessage } from "@/lib/toast";
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { featureFlagsApi } from "@/services/system/featureFlags";
import { pythonlabFlowApi } from "../pythonLab/services/pythonlabDebugApi";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface AgentConfigModalProps {
  visible: boolean;
  onClose: () => void;
}

const formSchema = z.object({
  api_url: z.string().trim().min(1, "请输入 API URL"),
  api_key: z.string().trim().min(1, "请输入 API Key"),
  model: z.string().optional(),
  prompt_template: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const inferRecommendedModel = (apiUrl?: string): string | null => {
  const lower = String(apiUrl || "").toLowerCase();
  if (!lower) return null;
  if (lower.includes("deepseek")) return "deepseek-chat";
  if (lower.includes("api.openai.com")) return "gpt-4o-mini";
  return null;
};

const isDeepSeekGptMismatch = (apiUrl?: string, model?: string): boolean => {
  const lowerUrl = String(apiUrl || "").toLowerCase();
  const lowerModel = String(model || "").trim().toLowerCase();
  return lowerUrl.includes("deepseek") && lowerModel.startsWith("gpt-");
};

const AgentConfigModal: React.FC<AgentConfigModalProps> = ({ visible, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const {
    register,
    reset,
    trigger,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      api_url: "",
      api_key: "",
      model: "",
      prompt_template: "",
    },
  });

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await featureFlagsApi.list();
      const flag = res.find((f: any) => f.key === "python_lab_agent_config");
      const promptRes = await pythonlabFlowApi.getPromptTemplate();
      const flagValue = (flag?.value || {}) as Partial<FormValues>;
      reset({
        api_url: String(flagValue.api_url || ""),
        api_key: String(flagValue.api_key || ""),
        model: String(flagValue.model || ""),
        prompt_template: String(promptRes.content || flagValue.prompt_template || ""),
      });
    } catch (_error) {
      showMessage.error("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    if (visible) {
      loadConfig();
      setTestResult(null);
    }
  }, [visible, loadConfig]);

  const handleSave = async () => {
    const valid = await trigger();
    if (!valid) return;
    const values = getValues();
    const normalizedValues = { ...values };
    if (isDeepSeekGptMismatch(values.api_url, values.model)) {
      normalizedValues.model = "deepseek-chat";
      setValue("model", "deepseek-chat", { shouldDirty: true });
      showMessage.warning("检测到 DeepSeek 接口，模型已自动修正为 deepseek-chat");
    } else if (!String(values.model || "").trim()) {
      const recommended = inferRecommendedModel(values.api_url);
      if (recommended) {
        normalizedValues.model = recommended;
        setValue("model", recommended, { shouldDirty: true });
      }
    }
    try {
      setSaving(true);

      // Save URL/Key to DB
      await featureFlagsApi.save({
        key: "python_lab_agent_config",
        value: {
          api_url: normalizedValues.api_url,
          api_key: normalizedValues.api_key,
          model: normalizedValues.model,
        },
      });

      // Save Prompt to File
      await pythonlabFlowApi.savePromptTemplate(normalizedValues.prompt_template || "");

      showMessage.success("Configuration saved");
      onClose();
    } catch (_error) {
      showMessage.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const valid = await trigger();
    if (!valid) return;
    const values = getValues();
    const normalizedValues = { ...values };
    if (isDeepSeekGptMismatch(values.api_url, values.model)) {
      normalizedValues.model = "deepseek-chat";
      setValue("model", "deepseek-chat", { shouldDirty: true });
      showMessage.warning("检测到 DeepSeek 接口，模型已自动修正为 deepseek-chat");
    } else if (!String(values.model || "").trim()) {
      const recommended = inferRecommendedModel(values.api_url);
      if (recommended) {
        normalizedValues.model = recommended;
        setValue("model", recommended, { shouldDirty: true });
        showMessage.warning(`已自动填充推荐模型：${recommended}`);
      }
    }

    try {
      setTesting(true);
      setTestResult(null);
      const res = await pythonlabFlowApi.testAgent(normalizedValues, { timeoutMs: 60000, silent: true });
      if (res.success) {
        showMessage.success("Connection successful!");
        setTestResult({ success: true });
      } else {
        const rawError = String(res.error || "Unknown error");
        const hasModelNotExist = /model not exist|invalid_request_error/i.test(rawError);
        const hint =
          hasModelNotExist && String(normalizedValues.api_url || "").toLowerCase().includes("deepseek")
            ? "建议将模型改为 deepseek-chat 或 deepseek-reasoner。"
            : "";
        const finalError = hint ? `${rawError}\n\n${hint}` : rawError;
        showMessage.error("Connection failed");
        setTestResult({ success: false, error: finalError });
      }
    } catch (error: any) {
        const detail =
          error?.response?.data?.error ||
          error?.response?.data?.detail ||
          error?.message ||
          "Network error or invalid response";
        const rawError = String(detail);
        const hasModelNotExist = /model not exist|invalid_request_error/i.test(rawError);
        const hint =
          hasModelNotExist && String(normalizedValues.api_url || "").toLowerCase().includes("deepseek")
            ? "建议将模型改为 deepseek-chat 或 deepseek-reasoner。"
            : "";
        const finalError = hint ? `${rawError}\n\n${hint}` : rawError;
        showMessage.error("Test request failed");
        setTestResult({ success: false, error: finalError });
    } finally {
      setTesting(false);
    }
  };

  const apiUrlValue = watch("api_url");
  const modelValue = watch("model");
  const recommendedModel = inferRecommendedModel(apiUrlValue);
  const hasDeepSeekModelMismatch = isDeepSeekGptMismatch(apiUrlValue, modelValue);

  return (
    <Dialog open={visible} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>管理智能体配置</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-url">Agent API URL</Label>
              <Input
                id="api-url"
                placeholder="例如: https://api.example.com/v1/chat/completions"
                disabled={saving || testing}
                {...register("api_url")}
              />
              {errors.api_url?.message ? (
                <p className="text-xs text-destructive">{errors.api_url.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="sk-..."
                disabled={saving || testing}
                {...register("api_key")}
              />
              {errors.api_key?.message ? (
                <p className="text-xs text-destructive">{errors.api_key.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="model-name">模型名称 (Model)</Label>
              <Input
                id="model-name"
                placeholder="gpt-3.5-turbo"
                disabled={saving || testing}
                {...register("model")}
              />
              <p className="text-xs text-text-tertiary">
                如果是 OpenAI 兼容接口，请填写模型名称（例如: gpt-3.5-turbo, stepfun-ai/Step-3.5-Flash）
              </p>
              {recommendedModel ? (
                <p className="text-xs text-primary">
                  检测到当前接口，推荐模型：{recommendedModel}
                </p>
              ) : null}
              {hasDeepSeekModelMismatch ? (
                <p className="text-xs text-destructive">
                  当前 URL 是 DeepSeek，模型名称不能使用 gpt-*，请改为 deepseek-chat 或 deepseek-reasoner。
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt-template">提示词模板 (Prompt Template)</Label>
              <Textarea
                id="prompt-template"
                rows={8}
                placeholder="You are a Python expert..."
                disabled={saving || testing}
                {...register("prompt_template")}
              />
              <p className="text-xs text-text-tertiary">
                发送给智能体的系统提示词。后端会自动注入流程图 JSON 数据。
              </p>
            </div>

            {testResult ? (
              <Alert
                variant={testResult.success ? "default" : "destructive"}
                className={
                  testResult.success
                    ? "border border-[var(--ws-color-success)]/25 bg-[var(--ws-color-success-soft)]"
                    : undefined
                }
              >
                <AlertTitle>{testResult.success ? "测试通过" : "测试失败"}</AlertTitle>
                {testResult.error ? (
                  <AlertDescription>{testResult.error}</AlertDescription>
                ) : null}
              </Alert>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={handleTest} disabled={loading || saving || testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            测试连接
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving || testing}>
            取消
          </Button>
          <Button type="button" onClick={handleSave} disabled={loading || saving || testing}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AgentConfigModal;
