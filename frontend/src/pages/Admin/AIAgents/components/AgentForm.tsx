/**
 * AI智能体表单组件
 */
import { showMessage } from "@/lib/toast";
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bolt,
  CheckCircle2,
  CircleX,
  Cloud,
  Eye,
  Loader2,
  PlayCircle,
} from "lucide-react";

import { aiAgentsApi } from "@/services/znt/api";
import type {
  AgentFormValues,
  AIAgent,
  AIModelInfo,
  ModelDiscoveryResponse,
} from "@/services/znt/types";
import { logger } from "@services/logger";

const AgentTypeOptions = [
  { value: "general", label: "通用智能体", icon: <Bolt className="h-4 w-4" /> },
  { value: "dify", label: "Dify智能体", icon: <Cloud className="h-4 w-4" /> },
];

interface AgentFormProps {
  visible: boolean;
  editingAgent: AIAgent | null;
  onSubmit: (values: AgentFormValues) => void;
  onCancel: () => void;
}

const agentFormSchema = z.object({
  name: z.string().trim().min(1, "请输入名称"),
  agent_type: z.enum(["general", "dify"]),
  model_name: z.string(),
  description: z.string(),
  api_endpoint: z
    .string()
    .trim()
    .min(1, "请输入API地址")
    .url("请输入有效的URL"),
  api_key: z
    .string()
    .refine((value) => value.trim() === "" || value.trim().length >= 8, {
      message: "至少8位",
    }),
  is_active: z.boolean(),
  system_prompt: z.string().max(8000, "系统提示词不能超过8000字"),
});

type FormValues = z.infer<typeof agentFormSchema>;

type UITestResult = {
  success: boolean;
  message: string;
  timestamp: string;
  response_time?: number;
  provider?: string;
  model_count?: number;
};

const EMPTY_VALUES: FormValues = {
  name: "",
  agent_type: "general",
  model_name: "",
  description: "",
  api_endpoint: "",
  api_key: "",
  is_active: true,
  system_prompt: "",
};

const AgentForm: React.FC<AgentFormProps> = ({
  visible,
  editingAgent,
  onSubmit,
  onCancel,
}) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: EMPTY_VALUES,
    mode: "onChange",
  });

  const formValues = form.watch() as FormValues;
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<UITestResult | null>(null);
  const [availableModels, setAvailableModels] = useState<AIModelInfo[]>([]);
  const [discoveringModels, setDiscoveringModels] = useState(false);
  const [modelDiscoveryResult, setModelDiscoveryResult] =
    useState<ModelDiscoveryResponse | null>(null);
  const [revealVisible, setRevealVisible] = useState(false);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealedKeyVisible, setRevealedKeyVisible] = useState(false);
  const [revealedApiKey, setRevealedApiKey] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const watchedName = form.watch("name");
  const watchedApiEndpoint = form.watch("api_endpoint");
  const watchedApiKey = form.watch("api_key");
  const watchedSystemPrompt = form.watch("system_prompt");

  const canTest = useMemo(() => {
    const hasName = Boolean(watchedName?.trim());
    const hasUrl = Boolean(watchedApiEndpoint?.trim());
    const hasApiKey = Boolean(watchedApiKey?.trim());
    const hasStoredApiKey = Boolean(editingAgent?.id && editingAgent.has_api_key);
    return editingAgent?.id
      ? hasName && hasUrl && (hasStoredApiKey || hasApiKey)
      : hasName && hasUrl && hasApiKey;
  }, [
    editingAgent?.has_api_key,
    editingAgent?.id,
    watchedApiEndpoint,
    watchedApiKey,
    watchedName,
  ]);

  useEffect(() => {
    if (!visible) return;
    if (editingAgent) {
      form.reset({
        name: editingAgent.name || editingAgent.agent_name || "",
        agent_type: editingAgent.agent_type === "dify" ? "dify" : "general",
        model_name: editingAgent.model_name || "",
        description: editingAgent.description || "",
        api_endpoint: editingAgent.api_endpoint || "",
        api_key: "",
        is_active: editingAgent.is_active ?? true,
        system_prompt: editingAgent.system_prompt || "",
      });
    } else {
      form.reset(EMPTY_VALUES);
    }
    setTestResult(null);
    setAvailableModels([]);
    setModelDiscoveryResult(null);
    setAdminPassword("");
    setRevealedApiKey("");
    setRevealVisible(false);
    setRevealedKeyVisible(false);
  }, [editingAgent, form, visible]);

  const resetTestState = () => {
    if (testResult || availableModels.length > 0 || modelDiscoveryResult) {
      setTestResult(null);
      setAvailableModels([]);
      setModelDiscoveryResult(null);
    }
  };

  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    form.setValue(key as any, value as any, {
      shouldDirty: true,
      shouldValidate: true,
    });
    resetTestState();
  };

  const handleFormSubmit = async (values: FormValues) => {
    const cleaned: AgentFormValues = {
      name: values.name.trim(),
      agent_type: values.agent_type,
      model_name: values.model_name.trim() || undefined,
      description: values.description.trim() || undefined,
      api_endpoint: values.api_endpoint.trim() || undefined,
      api_key: values.api_key.trim() || undefined,
      is_active: values.is_active,
      system_prompt: values.system_prompt.trim() || undefined,
    };
    onSubmit(cleaned);
  };

  const handleRevealApiKey = async () => {
    if (!editingAgent?.id) return;
    if (!adminPassword.trim()) {
      showMessage.warning("请输入管理员密码");
      return;
    }
    try {
      setRevealLoading(true);
      const resp = await aiAgentsApi.revealApiKey(editingAgent.id, adminPassword);
      if (!resp.success || !resp.data) {
        showMessage.error(resp.message || "获取API密钥失败");
        return;
      }
      setField("api_key", resp.data);
      setRevealVisible(false);
      setAdminPassword("");
      setRevealedApiKey(resp.data);
      setRevealedKeyVisible(true);
      showMessage.success("API密钥获取成功");
    } catch (error: any) {
      showMessage.error(error?.message || "请求失败");
    } finally {
      setRevealLoading(false);
    }
  };

  const handleTest = async () => {
    if (!canTest) return;
    try {
      setTesting(true);
      setDiscoveringModels(true);
      setTestResult(null);
      setAvailableModels([]);
      setModelDiscoveryResult(null);

      const values = form.getValues();
      const apiEndpoint = values.api_endpoint.trim();
      const apiKey = values.api_key.trim();
      const hasStoredApiKey = Boolean(editingAgent?.id && editingAgent.has_api_key);
      if (!apiEndpoint) throw new Error("API端点不能为空");
      if (!apiKey && !hasStoredApiKey) throw new Error("请先填写API密钥");

      if (editingAgent?.id && apiKey?.trim()) {
        try {
          await aiAgentsApi.updateAgent(editingAgent.id, { api_key: apiKey.trim() });
        } catch (error) {
          logger.warn("自动保存API密钥失败:", error);
        }
      }

      let connectivityResult: UITestResult | null = null;
      if (editingAgent?.id) {
        try {
          const testResp = await aiAgentsApi.testAgent(editingAgent.id, "测试API连接");
          if (testResp.success) {
            const testData = (testResp.data || {}) as Record<string, unknown>;
            connectivityResult = {
              success: true,
              message: String(testData.message || testResp.message || "连接测试成功"),
              timestamp: new Date().toISOString(),
              response_time:
                typeof testData.response_time === "number"
                  ? testData.response_time
                  : undefined,
            };
          } else {
            connectivityResult = {
              success: false,
              message: testResp.message || "测试失败",
              timestamp: new Date().toISOString(),
            };
          }
        } catch (error) {
          logger.warn("智能体测试失败:", error);
          connectivityResult = {
            success: false,
            message: "测试失败",
            timestamp: new Date().toISOString(),
          };
        }
      }

      const useAgentId = editingAgent?.id && !apiKey && hasStoredApiKey;
      try {
        const discoveryResult = useAgentId
          ? await aiAgentsApi.discoverModelsByAgentId(editingAgent.id)
          : await aiAgentsApi.discoverModels({
              api_endpoint: apiEndpoint,
              api_key: apiKey,
            });
        setModelDiscoveryResult(discoveryResult);
        if (discoveryResult.success) {
          setAvailableModels(discoveryResult.models);
          if (discoveryResult.models.length === 1) {
            setField("model_name", discoveryResult.models[0].id);
          }
          setTestResult(
            connectivityResult?.success === false
              ? {
                  ...connectivityResult,
                  success: true,
                  message: `${connectivityResult.message}，并发现 ${discoveryResult.total_count} 个可用模型`,
                  provider: discoveryResult.provider,
                  model_count: discoveryResult.total_count,
                  response_time:
                    discoveryResult.response_time_ms ??
                    connectivityResult.response_time,
                }
              : {
                  success: true,
                  message:
                    connectivityResult?.message ||
                    `发现 ${discoveryResult.total_count} 个可用模型`,
                  timestamp: new Date().toISOString(),
                  response_time:
                    discoveryResult.response_time_ms ??
                    connectivityResult?.response_time,
                  provider: discoveryResult.provider,
                  model_count: discoveryResult.total_count,
                },
          );
        } else {
          setTestResult(
            connectivityResult?.success
              ? {
                  ...connectivityResult,
                  message: `连接成功，但模型发现失败: ${
                    discoveryResult.error_message || "未知错误"
                  }`,
                  provider: discoveryResult.provider,
                }
              : {
                  success: false,
                  message: `测试失败: ${
                    discoveryResult.error_message ||
                    connectivityResult?.message ||
                    "未知错误"
                  }`,
                  timestamp: new Date().toISOString(),
                  provider: discoveryResult.provider,
                },
          );
        }
      } catch (error) {
        logger.warn("模型发现失败:", error);
        setTestResult(
          connectivityResult?.success
            ? { ...connectivityResult, message: "连接成功，但无法获取模型列表" }
            : {
                success: false,
                message: "测试失败：无法获取模型列表",
                timestamp: new Date().toISOString(),
              },
        );
      }
    } catch (error) {
      logger.error("测试失败:", error);
      setTestResult({
        success: false,
        message: `测试异常: ${
          error instanceof Error ? error.message : "未知错误"
        }`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setTesting(false);
      setDiscoveringModels(false);
    }
  };

  return (
    <>
      <Dialog open={visible} onOpenChange={(next) => !next && onCancel()}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingAgent ? "编辑智能体" : "添加智能体"}</DialogTitle>
            <DialogDescription>
              配置智能体基础信息、API 参数和模型设置。
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(handleFormSubmit)}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto]">
                <FormField
                  control={form.control}
                  name="name"
                  render={() => (
                    <FormItem>
                      <FormLabel>名称</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="如：MiniMax"
                          value={formValues.name}
                          onChange={(e) => setField("name", e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="agent_type"
                  render={() => (
                    <FormItem>
                      <FormLabel>类型</FormLabel>
                      <Select
                        value={formValues.agent_type}
                        onValueChange={(v) =>
                          setField("agent_type", v as "general" | "dify")
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择类型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {AgentTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <span className="flex items-center gap-2">
                                {option.icon}
                                {option.label}
                              </span>
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
                  name="is_active"
                  render={() => (
                    <FormItem>
                      <FormLabel>状态</FormLabel>
                      <FormControl>
                        <div className="flex h-10 items-center gap-2 rounded-md border border-border px-3">
                          <Switch
                            checked={formValues.is_active}
                            onCheckedChange={(checked) =>
                              setField("is_active", checked)
                            }
                          />
                          <span className="text-sm text-text-secondary">
                            {formValues.is_active ? "启用" : "停用"}
                          </span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="api_endpoint"
                  render={() => (
                    <FormItem>
                      <FormLabel>API 地址</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://api.siliconflow.cn/v1"
                          value={formValues.api_endpoint}
                          onChange={(e) => setField("api_endpoint", e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="api_key"
                  render={() => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <FormLabel>API 密钥</FormLabel>
                        {editingAgent?.id && editingAgent.has_api_key ? (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => {
                              setAdminPassword("");
                              setRevealVisible(true);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            查看
                          </Button>
                        ) : null}
                      </div>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={
                            editingAgent?.has_api_key
                              ? `已保存（****${editingAgent.api_key_last4 || ""}）`
                              : "请输入API密钥"
                          }
                          value={formValues.api_key}
                          onChange={(e) => setField("api_key", e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="model_name"
                render={() => (
                  <FormItem>
                    <div className="flex items-center gap-2">
                      <FormLabel>模型</FormLabel>
                      {discoveringModels ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-text-tertiary" />
                      ) : null}
                      {!discoveringModels && modelDiscoveryResult?.success === false ? (
                        <CircleX className="h-3.5 w-3.5 text-destructive" />
                      ) : null}
                    </div>
                    <FormControl>
                      <Input
                        list="agent-model-options"
                        placeholder={
                          discoveringModels
                            ? "正在发现可用模型..."
                            : availableModels.length > 0
                              ? "请选择或输入模型名称"
                              : "测试连接后可快速选择"
                        }
                        value={formValues.model_name}
                        onChange={(e) => setField("model_name", e.target.value)}
                        disabled={discoveringModels}
                      />
                    </FormControl>
                    <datalist id="agent-model-options">
                      {availableModels.map((model) => (
                        <option key={model.id} value={model.id} />
                      ))}
                    </datalist>
                    <p className="text-xs text-text-tertiary">
                      {discoveringModels
                        ? "正在发现可用模型..."
                        : modelDiscoveryResult?.success
                          ? `发现 ${availableModels.length} 个模型`
                          : modelDiscoveryResult
                            ? `发现失败: ${
                                modelDiscoveryResult.error_message || "未知错误"
                              }`
                            : "点击「测试连接」获取可用模型"}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={() => (
                  <FormItem>
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="可选"
                        rows={2}
                        value={formValues.description}
                        onChange={(e) => setField("description", e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="system_prompt"
                render={() => (
                  <FormItem>
                    <FormLabel>系统提示词</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="设置智能体的角色和行为约束（可选）"
                        rows={3}
                        maxLength={8000}
                        value={formValues.system_prompt}
                        onChange={(e) => setField("system_prompt", e.target.value)}
                      />
                    </FormControl>
                    <p className="text-right text-xs text-text-tertiary">
                      {(watchedSystemPrompt?.length || 0)}/8000
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {testing ? (
                <div className="flex items-center justify-center rounded-lg border border-border py-6 text-sm text-text-secondary">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在测试连接...
                </div>
              ) : null}
              {testResult && !testing ? (
                <Alert variant={testResult.success ? "default" : "destructive"}>
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <CircleX className="h-4 w-4" />
                  )}
                  <AlertTitle>{testResult.message}</AlertTitle>
                  <AlertDescription>
                    <div className="mt-1 space-y-1 text-xs">
                      {testResult.response_time ? (
                        <div>响应时间: {testResult.response_time}ms</div>
                      ) : null}
                      {testResult.provider ? (
                        <div>服务商: {testResult.provider}</div>
                      ) : null}
                      {testResult.model_count != null ? (
                        <div>可用模型: {testResult.model_count} 个</div>
                      ) : null}
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={testing}
                >
                  取消
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleTest}
                          disabled={!canTest || testing}
                        >
                          {testing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <PlayCircle className="h-4 w-4" />
                          )}
                          测试连接
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {canTest
                        ? "测试连接并发现模型"
                        : "请先填写名称和API地址（新建还需API密钥）"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button type="submit" disabled={testing}>
                  {editingAgent ? "保存" : "添加"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revealVisible}
        onOpenChange={(next) => !next && setRevealVisible(false)}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>验证管理员密码</DialogTitle>
            <DialogDescription>
              请输入当前管理员密码以查看已保存的 API 密钥。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            <div className="ws-modal-label">管理员密码</div>
            <Input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="请输入管理员密码"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevealVisible(false)}
              disabled={revealLoading}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handleRevealApiKey}
              disabled={revealLoading}
            >
              {revealLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revealedKeyVisible}
        onOpenChange={(next) => !next && setRevealedKeyVisible(false)}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>API密钥</DialogTitle>
            <DialogDescription>
              请谨慎处理敏感信息，避免在公开环境泄露。
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-surface-2 p-3">
            <pre className="whitespace-pre-wrap break-all text-xs text-text-secondary">
              {revealedApiKey}
            </pre>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevealedKeyVisible(false)}
            >
              关闭
            </Button>
            <Button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(revealedApiKey);
                  showMessage.success("已复制到剪贴板");
                } catch {
                  showMessage.error("复制失败");
                }
              }}
            >
              复制
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AgentForm;
