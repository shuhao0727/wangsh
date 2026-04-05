/**
 * 测评配置列表页 - /admin/assessment
 */
import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useAdminSSE } from "@hooks/useAdminSSE";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
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
import {
  BarChart3,
  Database,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AdminPage, AdminTablePanel } from "@components/Admin";
import {
  assessmentConfigApi,
  type AssessmentConfig,
} from "@services/assessment";
import { aiAgentsApi } from "@services/agents";
import type { AIAgent } from "@services/znt/types";
import { logger } from "@services/logger";
import { PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";

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

const createAssessmentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "请输入标题")
    .max(200, "标题不能超过 200 个字符"),
  grade: z
    .string()
    .trim()
    .refine((value) => !value || GRADE_OPTIONS.includes(value), "请选择有效年级"),
  agent_id: z
    .string()
    .trim()
    .min(1, "请选择智能体")
    .regex(/^\d+$/, "请选择智能体"),
  knowledge_points: z.string(),
});

type CreateFormValues = z.infer<typeof createAssessmentSchema>;

const DEFAULT_CREATE_VALUES: CreateFormValues = {
  title: "",
  grade: "",
  agent_id: "",
  knowledge_points: "",
};

const MOCK_ASSESSMENTS: AssessmentConfig[] = Array.from({ length: 36 }, (_, index) => {
  const i = index + 1;
  const grade = GRADE_OPTIONS[index % GRADE_OPTIONS.length] ?? null;
  const created = new Date(Date.now() - index * 3600_000 * 12).toISOString();
  const agentId = 100 + (index % 4);
  const agentName = ["教学助手A", "教学助手B", "学习诊断助手", "知识点讲解助手"][index % 4];
  const qCount = 8 + (index % 6) * 2;
  const sCount = (index * 3) % 31;
  return {
    id: -i,
    title: `模拟测评 #${String(i).padStart(2, "0")} - Python 基础与算法`,
    grade,
    teaching_objectives: "巩固基础语法与算法思维",
    knowledge_points: JSON.stringify(["循环结构", "条件判断", "函数参数", "列表与字典"].slice(0, 2 + (index % 3))),
    total_score: 100,
    question_config: JSON.stringify({ mode: "adaptive" }),
    ai_prompt: null,
    agent_id: agentId,
    agent_name: agentName,
    time_limit_minutes: 30,
    available_start: null,
    available_end: null,
    enabled: index % 5 !== 0,
    created_by_user_id: 1,
    creator_name: "系统管理员",
    question_count: qCount,
    session_count: sCount,
    config_agents: [{ id: agentId, name: agentName, agent_type: "teaching" }],
    created_at: created,
    updated_at: created,
  };
});

const AdminAssessment: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AssessmentConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [agents, setAgents] = useState<AIAgent[]>([]);

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createAssessmentSchema),
    defaultValues: DEFAULT_CREATE_VALUES,
  });

  const applyMockData = useCallback(() => {
    const keyword = search.trim().toLowerCase();
    const filtered = MOCK_ASSESSMENTS.filter((item) => {
      if (!keyword) return true;
      return (
        item.title.toLowerCase().includes(keyword) ||
        String(item.grade || "").toLowerCase().includes(keyword) ||
        String(item.agent_name || "").toLowerCase().includes(keyword)
      );
    });
    const start = (currentPage - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);
    setItems(pageItems);
    setTotal(filtered.length);
  }, [currentPage, pageSize, search]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await assessmentConfigApi.list({
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
        search: search.trim() || undefined,
      });
      if (resp.total === 0) {
        applyMockData();
        return;
      }
      setItems(resp.items || []);
      setTotal(resp.total || 0);
    } catch (error: any) {
      logger.error("加载测评配置失败，切换到模拟数据:", error);
      applyMockData();
    } finally {
      setLoading(false);
    }
  }, [applyMockData, currentPage, pageSize, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useAdminSSE("assessment_changed", loadData);

  const loadAgents = useCallback(async () => {
    try {
      const resp = await aiAgentsApi.getAgents({ limit: 100 });
      if (resp.success) {
        setAgents(resp.data.items);
      }
    } catch (error) {
      logger.error("加载智能体失败:", error);
    }
  }, []);

  const openCreateModal = () => {
    createForm.reset(DEFAULT_CREATE_VALUES);
    void loadAgents();
    setCreateOpen(true);
  };

  const handleCreate = async (values: CreateFormValues) => {
    try {
      const title = values.title.trim();
      const agentId = values.agent_id.trim();
      const kpStr = values.knowledge_points.trim();
      const kps = kpStr ? kpStr.split(/[,，、\s]+/).filter(Boolean) : [];

      const config = await assessmentConfigApi.create({
        title,
        grade: values.grade || undefined,
        agent_id: Number(agentId),
        knowledge_points: JSON.stringify(kps),
        question_config: JSON.stringify({}),
      });
      showMessage.success("创建成功");
      setCreateOpen(false);
      createForm.reset(DEFAULT_CREATE_VALUES);
      navigate(`/admin/assessment/${config.id}/questions`);
    } catch (error: any) {
      showMessage.error(error.message || "创建失败");
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await assessmentConfigApi.toggle(id);
      await loadData();
    } catch (error: any) {
      showMessage.error(error.message || "切换状态失败");
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !window.confirm("确定删除此测评配置？将同时删除关联的题目、答题记录和画像。")
    ) {
      return;
    }
    try {
      await assessmentConfigApi.delete(id);
      showMessage.success("删除成功");
      await loadData();
    } catch (error: any) {
      showMessage.error(error.message || "删除失败");
    }
  };

  const handleSearchSubmit = () => {
    const next = searchInput.trim();
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
    if (search !== next) {
      setSearch(next);
      return;
    }
    void loadData();
  };

  const handleClearSearch = () => {
    setSearchInput("");
    if (search !== "") {
      setSearch("");
    }
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  };

  const columns = useMemo<ColumnDef<AssessmentConfig>[]>(
    () => [
      {
        id: "title",
        header: "标题",
        accessorKey: "title",
        size: 260,
        meta: { className: "w-[260px] align-top" },
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <div className="max-w-[220px] truncate font-medium">{row.original.title}</div>
            {row.original.id < 0 ? (
              <Badge variant="outline" className="border-border bg-transparent text-[11px] text-text-tertiary">
                模拟
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: "grade",
        header: "年级",
        accessorKey: "grade",
        size: 90,
        meta: { className: "w-[90px] align-top" },
        cell: ({ row }) => row.original.grade || "-",
      },
      {
        id: "question_count",
        header: "题目数",
        accessorKey: "question_count",
        size: 90,
        meta: { className: "w-[90px] align-top" },
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className="border-border bg-transparent text-text-secondary"
          >
            {row.original.question_count}
          </Badge>
        ),
      },
      {
        id: "session_count",
        header: "答题人数",
        accessorKey: "session_count",
        size: 100,
        meta: { className: "w-[100px] align-top" },
        cell: ({ row }) => (
          <Badge
            variant={row.original.session_count > 0 ? "info" : "outline"}
            className={row.original.session_count > 0 ? undefined : "border-border bg-transparent text-text-secondary"}
          >
            {row.original.session_count}
          </Badge>
        ),
      },
      {
        id: "enabled",
        header: "状态",
        accessorKey: "enabled",
        size: 90,
        meta: { className: "w-[90px] align-top" },
        cell: ({ row }) => (
          <Switch
            checked={row.original.enabled}
            disabled={row.original.id < 0}
            onCheckedChange={() => {
              if (row.original.id < 0) return;
              void handleToggle(row.original.id);
            }}
          />
        ),
      },
      {
        id: "created_at",
        header: "创建时间",
        accessorKey: "created_at",
        size: 170,
        meta: { className: "w-[170px] align-top" },
        cell: ({ row }) => new Date(row.original.created_at).toLocaleString("zh-CN"),
      },
      {
        id: "action",
        header: "操作",
        size: 240,
        meta: { className: "w-[240px] align-top" },
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={row.original.id < 0}
              onClick={() => navigate(`/admin/assessment/${row.original.id}/questions`)}
            >
              <Database className="h-4 w-4" />
              管理
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={row.original.id < 0}
              onClick={() => navigate(`/admin/assessment/${row.original.id}/statistics`)}
            >
              <BarChart3 className="h-4 w-4" />
              统计
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={row.original.id < 0}
              className="text-destructive hover:text-destructive"
              onClick={() => void handleDelete(row.original.id)}
            >
              <Trash2 className="h-4 w-4" />
              删除
            </Button>
          </div>
        ),
      },
    ],
    [handleToggle, navigate],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminPage scrollable={false}>
      <div className="mb-4 flex items-center gap-2">
        <Input
          placeholder="搜索测评标题"
          className="w-[220px]"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearchSubmit();
            }
          }}
        />
        <Button variant="outline" onClick={handleSearchSubmit}>
          <Search className="h-4 w-4" />
          搜索
        </Button>
        {search || searchInput ? (
          <Button variant="ghost" onClick={handleClearSearch}>
            清空
          </Button>
        ) : null}
        <div className="flex-1" />
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          新建测评
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <AdminTablePanel
            loading={loading}
            isEmpty={items.length === 0}
            emptyDescription={search ? "未找到匹配的测评" : "暂无测评配置"}
            emptyAction={<Button onClick={openCreateModal}>创建第一个测评</Button>}
          >
            <DataTable table={table} className="h-full" tableClassName="min-w-[980px]" />
          </AdminTablePanel>
        </div>
        {items.length > 0 ? (
          <div className="mt-2 flex justify-end border-t border-border-secondary pt-3">
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
              onPageChange={(page, size) => {
                if (size && size !== pageSize) {
                  setPageSize(size);
                  setCurrentPage(1);
                  return;
                }
                setCurrentPage(Math.max(1, Math.min(totalPages, page)));
              }}
            />
          </div>
        ) : null}
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(next) => {
          if (!next) {
            setCreateOpen(false);
            createForm.reset(DEFAULT_CREATE_VALUES);
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>新建测评</DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <form
              className="space-y-4"
              onSubmit={createForm.handleSubmit(handleCreate)}
            >
              <FormField
                control={createForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>测评标题</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="如：Python循环结构课堂检测"
                        maxLength={200}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FormField
                  control={createForm.control}
                  name="grade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>年级</FormLabel>
                      <Select
                        value={field.value || "__none__"}
                        onValueChange={(value) =>
                          field.onChange(value === "__none__" ? "" : value)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择年级" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">不设置</SelectItem>
                          {GRADE_OPTIONS.map((grade) => (
                            <SelectItem key={grade} value={grade}>
                              {grade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="agent_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>智能体</FormLabel>
                      <Select
                        value={field.value || "__none__"}
                        onValueChange={(value) =>
                          field.onChange(value === "__none__" ? "" : value)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择智能体" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">请选择</SelectItem>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={String(agent.id)}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="knowledge_points"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>知识点</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="如：for循环、while循环、递归"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-text-tertiary">
                      用逗号、顿号或空格分隔
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCreateOpen(false);
                    createForm.reset(DEFAULT_CREATE_VALUES);
                  }}
                  disabled={createForm.formState.isSubmitting}
                >
                  取消
                </Button>
                <Button type="submit" disabled={createForm.formState.isSubmitting}>
                  {createForm.formState.isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  创建
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
};

export default AdminAssessment;
