import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminFilterBar } from "@components/Admin";
import { ConfirmDialog } from "@components/Common/ConfirmDialog";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { FileText, Filter, FolderOpen, Pencil, Plus, RefreshCw, Search, Trash2,  } from "lucide-react";
import { categoryApi } from "@services";
import { logger } from "@services/logger";
import type { CategoryWithUsage, CategoryFilterParams } from "@services";
import { useBatchDeleteCategories } from "@hooks/queries/useCategoriesQuery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
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
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";
import { calculatePagination } from "@utils/pagination";

import { Spinner } from "@/components/ui/spinner";
type CategoryManageModalProps = {
  visible: boolean;
  onClose: () => void;
  onCategoryChange?: () => void;
};

const FILTER_ALL = "__all__";

const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "请输入分类名称")
    .max(50, "分类名称不能超过 50 个字符"),
  slug: z
    .string()
    .trim()
    .min(1, "请输入 URL 标识")
    .max(50, "URL 标识不能超过 50 个字符")
    .regex(/^[a-z0-9-]+$/, "URL 标识只能包含小写字母、数字和横线"),
  description: z.string().max(200, "描述不能超过 200 个字符"),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

const emptyFormValues: CategoryFormValues = {
  name: "",
  slug: "",
  description: "",
};

const CategoryEditDialog: React.FC<{
  open: boolean;
  category: CategoryWithUsage | null;
  isCreateMode: boolean;
  onSave: () => void;
  onCancel: () => void;
  onCloseAutoFocus: (event: Event) => void;
}> = ({ open, category, isCreateMode, onSave, onCancel, onCloseAutoFocus }) => {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: emptyFormValues,
  });

  useEffect(() => {
    if (!open) return;
    if (category) {
      form.reset({
        name: category.name || "",
        slug: category.slug || "",
        description: category.description || "",
      });
      return;
    }
    form.reset(emptyFormValues);
  }, [category, form, open]);

  const name = form.watch("name");
  const description = form.watch("description") || "";

  const generateSlug = () => {
    if (!name.trim()) return;
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    form.setValue("slug", slug, { shouldDirty: true, shouldValidate: true });
  };

  const handleSubmit = async (values: CategoryFormValues) => {
    try {
      const payload = {
        name: values.name.trim(),
        slug: values.slug.trim(),
        description: values.description.trim() || null,
      };
      if (isCreateMode) {
        await categoryApi.createCategory(payload);
        showMessage.success("分类创建成功");
      } else if (category) {
        await categoryApi.updateCategory(category.id, payload);
        showMessage.success("分类更新成功");
      }
      onSave();
    } catch (error: any) {
      logger.error("保存分类失败:", error);
      showMessage.error(error.response?.data?.detail || "保存分类失败，请检查表单数据");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-[640px]" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{isCreateMode ? "添加新分类" : "编辑分类"}</DialogTitle>
          <DialogDescription>
            分类会用于文章归档和筛选。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-form-field-gap" onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>分类名称</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入分类名称" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-wrap items-center justify-between gap-xs">
                    <FormLabel>URL 标识 (slug)</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-xs"
                      onClick={generateSlug}
                    >
                      从名称生成
                    </Button>
                  </div>
                  <FormControl>
                    <Input placeholder="例如：algorithm-basics" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>分类描述</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      maxLength={200}
                      placeholder="请输入分类描述"
                      {...field}
                    />
                  </FormControl>
                  <div className="mt-2xs flex items-center justify-between text-xs text-text-tertiary">
                    <FormMessage />
                    <span>{description.length}/200</span>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-button-gap">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={form.formState.isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Spinner size="sm" />
                ) : null}
                {isCreateMode ? "创建分类" : "保存修改"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const CategoryManageModal: React.FC<CategoryManageModalProps> = ({
  visible,
  onClose,
  onCategoryChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hasUnfilteredCategories, setHasUnfilteredCategories] = useState(false);
  const [categories, setCategories] = useState<CategoryWithUsage[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchParams, setSearchParams] = useState<CategoryFilterParams>({
    page: 1,
    size: DEFAULT_PAGE_SIZE,
    include_usage_count: true,
  });
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [searchText, setSearchText] = useState("");

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<CategoryWithUsage | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleEditCloseAutoFocus = useCallback((event: Event) => {
    const trigger = editTriggerRef.current?.isConnected ? editTriggerRef.current : addButtonRef.current;
    if (!trigger) return;
    event.preventDefault();
    trigger.focus();
  }, []);

  const [filterVisible, setFilterVisible] = useState(false);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [minArticles, setMinArticles] = useState<number | undefined>(undefined);

  const batchDeleteMutation = useBatchDeleteCategories();
  const requestSeqRef = useRef(0);

  const loadCategories = useCallback(
    async () => {
      const requestSeq = ++requestSeqRef.current;
      try {
        setLoading(true);
        const response = await categoryApi.listCategories(searchParams);
        if (requestSeq !== requestSeqRef.current) return;
        const listData = response.data;

        const normalized = (listData?.categories || []).map((category) => {
          if ("article_count" in category) return category as CategoryWithUsage;
          return { ...category, article_count: 0 } as CategoryWithUsage;
        });

        let next = normalized;
        if (searchText.trim()) {
          const keyword = searchText.trim().toLowerCase();
          next = next.filter(
            (item) =>
              String(item.name || "").toLowerCase().includes(keyword) ||
              String(item.slug || "").toLowerCase().includes(keyword),
          );
        }
        if (typeof minArticles === "number") {
          next = next.filter((item) => (item.article_count || 0) >= minArticles);
        }
        if (sortBy) {
          const byName = (a: CategoryWithUsage, b: CategoryWithUsage) =>
            String(a.name || "").localeCompare(String(b.name || ""));
          const byArticles = (a: CategoryWithUsage, b: CategoryWithUsage) =>
            (a.article_count || 0) - (b.article_count || 0);
          const byCreated = (a: CategoryWithUsage, b: CategoryWithUsage) =>
            dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf();
          next = [...next].sort((a, b) => {
            switch (sortBy) {
              case "name_asc":
                return byName(a, b);
              case "name_desc":
                return byName(b, a);
              case "articles_asc":
                return byArticles(a, b);
              case "articles_desc":
                return byArticles(b, a);
              case "created_asc":
                return byCreated(a, b);
              case "created_desc":
                return byCreated(b, a);
              default:
                return 0;
            }
          });
        }

        setCategories(next);
        setHasUnfilteredCategories(normalized.length > 0);
        setLoadFailed(false);
        setTotal(next.length);
        setRowSelection({});
      } catch (error) {
        if (requestSeq !== requestSeqRef.current) return;
        setLoadFailed(true);
        logger.error("加载分类列表失败:", error);
        showMessage.error("加载分类列表失败");
      } finally {
        if (requestSeq === requestSeqRef.current) setLoading(false);
      }
    },
    [minArticles, searchParams, searchText, sortBy],
  );

  useEffect(() => {
    if (!visible) return;
    void loadCategories();
    return () => {
      requestSeqRef.current += 1;
    };
  }, [loadCategories, visible]);

  const handleSearch = useCallback(() => {
    const nextParams = { ...searchParams, page: 1 };
    setCurrentPage(1);
    setSearchParams(nextParams);
  }, [searchParams]);

  const handleFilterApply = useCallback(() => {
    const nextParams = { ...searchParams, page: 1 };
    setCurrentPage(1);
    setSearchParams(nextParams);
    setFilterVisible(false);
  }, [searchParams]);

  const handleFilterReset = useCallback(() => {
    setSortBy(undefined);
    setMinArticles(undefined);
    const defaultParams: CategoryFilterParams = {
      page: 1,
      size: pageSize,
      include_usage_count: true,
    };
    setCurrentPage(1);
    setSearchParams(defaultParams);
    setFilterVisible(false);
  }, [pageSize]);

  const handlePageChange = useCallback((page: number, size?: number) => {
    const nextPage = Math.max(1, page);
    const nextSize = size || pageSize;
    const nextParams = {
      ...searchParams,
      page: nextPage,
      size: nextSize,
    };
    setCurrentPage(nextPage);
    if (size) setPageSize(size);
    setSearchParams(nextParams);
  }, [pageSize, searchParams]);

  const handleEdit = useCallback((record: CategoryWithUsage, trigger: HTMLButtonElement) => {
    editTriggerRef.current = trigger;
    setEditingCategory(record);
    setIsCreateMode(false);
    setEditModalVisible(true);
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await categoryApi.deleteCategory(id);
      showMessage.success("分类删除成功");
      await loadCategories();
      onCategoryChange?.();
    } catch (error: any) {
      logger.error("删除分类失败:", error);
      showMessage.error(error.response?.data?.detail || "删除分类失败");
    }
  }, [loadCategories, onCategoryChange]);

  const handleAddCategory = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    editTriggerRef.current = event.currentTarget;
    setEditingCategory(null);
    setIsCreateMode(true);
    setEditModalVisible(true);
  }, []);

  const handleEditFormSave = useCallback(async () => {
    setEditModalVisible(false);
    await loadCategories();
    onCategoryChange?.();
  }, [loadCategories, onCategoryChange]);

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      showMessage.warning("请选择要删除的分类");
      return;
    }
    setConfirmState({ message: `确定删除选中的 ${selectedRowKeys.length} 个分类吗？`, onOk: async () => {
      try {
        const result = await batchDeleteMutation.mutateAsync(selectedRowKeys);

        if (result.errorCount === 0) {
          showMessage.success(`成功删除 ${result.successCount} 个分类`);
        } else if (result.successCount > 0) {
          showMessage.warning(`部分删除成功：成功 ${result.successCount} 个，失败 ${result.errorCount} 个`);
        } else {
          showMessage.error("全部删除失败");
        }

        await loadCategories();
        onCategoryChange?.();
      } catch (error) {
        logger.error("批量删除失败:", error);
        showMessage.error("批量删除失败");
      }
    }});
  };

  const pagedCategories = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return categories.slice(start, start + pageSize);
  }, [categories, currentPage, pageSize]);

  useEffect(() => {
    const allowedIds = new Set(pagedCategories.map((item) => String(item.id)));
    setRowSelection((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([id, checked]) => checked && allowedIds.has(id)),
      );
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (
        prevKeys.length === nextKeys.length &&
        prevKeys.every((key) => prev[key] === next[key])
      ) {
        return prev;
      }
      return next;
    });
  }, [pagedCategories]);

  const [confirmState, setConfirmState] = useState<{ message: string; onOk: () => void } | null>(null);

  const selectedRowKeys = useMemo(
    () =>
      Object.keys(rowSelection)
        .filter((id) => rowSelection[id])
        .map((id) => Number(id)),
    [rowSelection],
  );

  const columns = useMemo<ColumnDef<CategoryWithUsage>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            aria-label="选择当前页全部分类"
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
            }
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`选择分类 ${row.original.name}`}
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked === true)}
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 42,
      },
      {
        id: "name",
        header: "分类名称",
        accessorKey: "name",
        size: 240,
        cell: ({ row }) => (
          <div className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">
            <div className="font-semibold" title={row.original.name}>{row.original.name}</div>
            <div className="text-xs text-text-secondary" title={row.original.slug}>{row.original.slug}</div>
          </div>
        ),
      },
      {
        id: "description",
        header: "描述",
        accessorKey: "description",
        size: 300,
        cell: ({ row }) => (
          <div className="whitespace-normal text-text-secondary [overflow-wrap:anywhere]">
            {row.original.description || (
              <span className="text-text-tertiary">暂无描述</span>
            )}
          </div>
        ),
      },
      {
        id: "article_count",
        header: "文章数量",
        accessorFn: (row) => row.article_count || 0,
        size: 140,
        cell: ({ row }) => (
          <Badge variant={(row.original.article_count || 0) > 0 ? "info" : "neutral"}>
            <FileText className="mr-2xs h-3 w-3" />
            {row.original.article_count || 0} 篇
          </Badge>
        ),
      },
      {
        id: "created_at",
        header: "创建时间",
        accessorKey: "created_at",
        size: 170,
        cell: ({ row }) => (
          <div>
            <div className="text-xs">
              {dayjs(row.original.created_at).format("YYYY-MM-DD")}
            </div>
            <div className="text-xs text-text-secondary">
              {dayjs(row.original.created_at).format("HH:mm")}
            </div>
          </div>
        ),
      },
      {
        id: "action",
        header: "操作",
        size: 160,
        meta: { className: "" },
        cell: ({ row }) => (
          <div className="flex items-center gap-2xs">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-xs"
              onClick={(event) => handleEdit(row.original, event.currentTarget)}
            >
              <Pencil className="h-3.5 w-3.5" />
              编辑
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-xs text-destructive hover:text-destructive"
              onClick={() => {
                setConfirmState({ message: "确定要删除这个分类吗？删除后不可恢复。", onOk: () => { void handleDelete(row.original.id); } });
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </Button>
          </div>
        ),
      },
    ],
    [handleDelete, handleEdit],
  );

  const table = useReactTable({
    data: pagedCategories,
    columns,
    state: { rowSelection },
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
  });

  const { totalPages } = calculatePagination({ page: currentPage, pageSize, total });

  return (
    <>
      <Dialog
        open={visible}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent className="w-[95vw] p-0 sm:max-w-[1100px]">
          <DialogHeader className="border-b border-border-subtle px-panel-padding py-panel-padding-sm">
            <DialogTitle className="flex items-center gap-xs">
              <FolderOpen className="h-4 w-4" />
              分类管理
            </DialogTitle>
            <DialogDescription>
              管理文章分类、排序和使用情况。
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(90vh-96px)] overflow-y-auto p-panel-padding">
            <AdminFilterBar className="p-panel-padding-sm">
              <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-button-gap">
                <div className="relative w-full min-w-0 md:w-auto md:flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                  <Input
                    value={searchText}
                    aria-label="搜索分类名称或 slug"
                    className="border-transparent bg-transparent pl-8 shadow-none hover:border-transparent hover:bg-interaction-hover focus-visible:border-transparent focus-visible:bg-surface focus-visible:ring-inset focus-visible:ring-offset-0"
                    placeholder="搜索分类名称或 slug..."
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearch();
                      }
                    }}
                  />
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-xs">
                  <Button
                    variant={filterVisible ? "default" : "outline"}
                    aria-label="筛选"
                    aria-expanded={filterVisible}
                    aria-controls="category-management-filters"
                    onClick={() => setFilterVisible((prev) => !prev)}
                  >
                    <Filter className="h-4 w-4" />
                    筛选
                  </Button>
                  <Button variant="outline" onClick={() => void loadCategories()} disabled={loading}>
                    {loading ? <Spinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
                    刷新
                  </Button>
                  <Button ref={addButtonRef} onClick={handleAddCategory}>
                    <Plus className="h-4 w-4" />
                    新增分类
                  </Button>
                </div>
              </div>
            </AdminFilterBar>

            {filterVisible ? (
              <section id="category-management-filters" aria-label="高级筛选" className="mb-item-gap rounded-lg bg-surface-2 p-panel-padding">
                <div className="mb-content-gap flex items-center justify-between gap-xs">
                  <h4 className="text-sm font-semibold">高级筛选</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-xs"
                    onClick={() => setFilterVisible(false)}
                  >
                    收起
                  </Button>
                </div>
                <div className="grid min-w-0 gap-form-field-gap md:grid-cols-3">
                  <div>
                    <label htmlFor="category-management-sort" className="mb-xs block text-sm font-medium">排序方式</label>
                    <Select
                      value={sortBy || FILTER_ALL}
                      onValueChange={(value) =>
                        setSortBy(value === FILTER_ALL ? undefined : value)
                      }
                    >
                      <SelectTrigger id="category-management-sort" className="border-transparent bg-transparent shadow-none hover:border-transparent hover:bg-interaction-hover focus-visible:bg-surface focus-visible:ring-inset focus-visible:ring-offset-0">
                        <SelectValue placeholder="选择排序方式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={FILTER_ALL}>默认</SelectItem>
                        <SelectItem value="name_asc">名称升序</SelectItem>
                        <SelectItem value="name_desc">名称降序</SelectItem>
                        <SelectItem value="articles_asc">文章数量升序</SelectItem>
                        <SelectItem value="articles_desc">文章数量降序</SelectItem>
                        <SelectItem value="created_desc">最新创建</SelectItem>
                        <SelectItem value="created_asc">最早创建</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="category-management-min-articles" className="mb-xs block text-sm font-medium">最少文章数</label>
                    <Input
                      id="category-management-min-articles"
                      className="border-transparent bg-transparent shadow-none hover:border-transparent hover:bg-interaction-hover focus-visible:border-transparent focus-visible:bg-surface focus-visible:ring-inset focus-visible:ring-offset-0"
                      type="number"
                      min={0}
                      value={minArticles ?? ""}
                      onChange={(e) =>
                        setMinArticles(
                          e.target.value === "" ? undefined : Number(e.target.value),
                        )
                      }
                    />
                  </div>
                  <div className="flex items-end gap-xs">
                    <Button variant="outline" onClick={handleFilterReset}>
                      重置
                    </Button>
                    <Button onClick={handleFilterApply}>筛选</Button>
                  </div>
                </div>
              </section>
            ) : null}

            {selectedRowKeys.length > 0 ? (
              <Card className="mb-item-gap border-0 bg-surface-2 p-panel-padding-sm shadow-none">
                <div className="flex flex-wrap items-center justify-between gap-xs">
                  <div className="text-sm">
                    已选择{" "}
                    <span className="font-semibold text-primary">
                      {selectedRowKeys.length}
                    </span>{" "}
                    个分类
                  </div>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void handleBatchDelete()}
                  >
                    <Trash2 className="h-4 w-4" />
                    批量删除
                  </Button>
                </div>
              </Card>
            ) : null}

            <Card className="border-0 bg-surface p-0 shadow-none">
              {loadFailed ? (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-xs rounded-lg bg-error-soft p-panel-padding-sm text-sm text-error-text">
                  <span>{categories.length > 0 ? "加载分类列表失败，当前显示上次加载的数据。" : "加载分类列表失败，请重试。"}</span>
                  <Button variant="outline" disabled={loading} onClick={() => void loadCategories()}>
                    重试
                  </Button>
                </div>
              ) : null}
              {loading ? (
                <div className="py-section-gap text-center text-sm text-text-tertiary">
                  <span className="inline-flex items-center gap-xs">
                    <Spinner size="sm" />
                    正在加载分类...
                  </span>
                </div>
              ) : categories.length === 0 ? (
                loadFailed ? null : (
                  <div role="status" className="py-section-gap text-center">
                    <p className="text-sm text-text-tertiary">{hasUnfilteredCategories ? "暂无符合条件的分类" : "暂无分类数据"}</p>
                    {hasUnfilteredCategories ? (
                      <p className="mt-xs text-sm text-text-secondary">请调整搜索关键词或筛选条件</p>
                    ) : (
                      <Button className="mt-button-gap" onClick={handleAddCategory}>
                        添加第一个分类
                      </Button>
                    )}
                  </div>
                )
              ) : (
                <>
                  <DataTable table={table} tableClassName="min-w-[980px] table-fixed" />
                  <div className="mt-xs flex justify-end border-t border-border-secondary pt-panel-padding-sm">
                    <DataTablePagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      total={total}
                      pageSize={pageSize}
                      pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
                      onPageChange={handlePageChange}
                    />
                  </div>
                </>
              )}
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <CategoryEditDialog
        open={editModalVisible}
        category={editingCategory}
        isCreateMode={isCreateMode}
        onSave={() => void handleEditFormSave()}
        onCancel={() => setEditModalVisible(false)}
        onCloseAutoFocus={handleEditCloseAutoFocus}
      />

      <ConfirmDialog
        open={confirmState !== null}
        onOpenChange={(open) => { if (!open) setConfirmState(null); }}
        title="确认操作"
        description={confirmState?.message ?? ""}
        confirmText="确认"
        variant="destructive"
        onConfirm={() => { confirmState?.onOk(); setConfirmState(null); }}
      />
    </>
  );
};

export default CategoryManageModal;
