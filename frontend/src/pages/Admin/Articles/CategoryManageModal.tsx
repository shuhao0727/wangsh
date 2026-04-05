import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import {
  FileText,
  Filter,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { categoryApi } from "@services";
import { logger } from "@services/logger";
import type { CategoryWithUsage, CategoryFilterParams } from "@services";
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
}> = ({ open, category, isCreateMode, onSave, onCancel }) => {
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
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{isCreateMode ? "添加新分类" : "编辑分类"}</DialogTitle>
          <DialogDescription>
            分类会用于文章归档和筛选。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-3" onSubmit={form.handleSubmit(handleSubmit)}>
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
                  <div className="flex items-center justify-between gap-2">
                    <FormLabel>URL 标识 (slug)</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
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
                  <div className="mt-1 flex items-center justify-between text-xs text-text-tertiary">
                    <FormMessage />
                    <span>{description.length}/200</span>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
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
                  <Loader2 className="h-4 w-4 animate-spin" />
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

  const [filterVisible, setFilterVisible] = useState(false);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [minArticles, setMinArticles] = useState<number | undefined>(undefined);

  const loadCategories = useCallback(
    async (params: CategoryFilterParams = searchParams) => {
      try {
        setLoading(true);
        const response = await categoryApi.listCategories(params);
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
        setTotal(next.length);
        setRowSelection({});
      } catch (error) {
        logger.error("加载分类列表失败:", error);
        showMessage.error("加载分类列表失败");
      } finally {
        setLoading(false);
      }
    },
    [minArticles, searchParams, searchText, sortBy],
  );

  useEffect(() => {
    if (!visible) return;
    void loadCategories();
  }, [loadCategories, visible]);

  const handleSearch = () => {
    const nextParams = { ...searchParams, page: 1 };
    setCurrentPage(1);
    setSearchParams(nextParams);
    void loadCategories(nextParams);
  };

  const handleFilterApply = () => {
    const nextParams = { ...searchParams, page: 1 };
    setCurrentPage(1);
    setSearchParams(nextParams);
    setFilterVisible(false);
    void loadCategories(nextParams);
  };

  const handleFilterReset = () => {
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
    void loadCategories(defaultParams);
  };

  const handlePageChange = (page: number, size?: number) => {
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
    void loadCategories(nextParams);
  };

  const handleEdit = (record: CategoryWithUsage) => {
    setEditingCategory(record);
    setIsCreateMode(false);
    setEditModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await categoryApi.deleteCategory(id);
      showMessage.success("分类删除成功");
      await loadCategories();
      onCategoryChange?.();
    } catch (error: any) {
      logger.error("删除分类失败:", error);
      showMessage.error(error.response?.data?.detail || "删除分类失败");
    }
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setIsCreateMode(true);
    setEditModalVisible(true);
  };

  const handleEditFormSave = async () => {
    setEditModalVisible(false);
    await loadCategories();
    onCategoryChange?.();
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      showMessage.warning("请选择要删除的分类");
      return;
    }
    if (!window.confirm(`确定删除选中的 ${selectedRowKeys.length} 个分类吗？`)) return;

    try {
      setLoading(true);
      for (const id of selectedRowKeys) {
        await categoryApi.deleteCategory(id);
      }
      showMessage.success(`成功删除 ${selectedRowKeys.length} 个分类`);
      await loadCategories();
      onCategoryChange?.();
    } catch (error) {
      logger.error("批量删除失败:", error);
      showMessage.error("批量删除失败");
    } finally {
      setLoading(false);
    }
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
        meta: { className: "w-[42px]" },
      },
      {
        id: "name",
        header: "分类名称",
        accessorKey: "name",
        size: 240,
        meta: { className: "w-[240px]" },
        cell: ({ row }) => (
          <div>
            <div className="font-semibold">{row.original.name}</div>
            <div className="text-xs text-text-secondary">{row.original.slug}</div>
          </div>
        ),
      },
      {
        id: "description",
        header: "描述",
        accessorKey: "description",
        size: 300,
        meta: { className: "w-[300px]" },
        cell: ({ row }) => (
          <div className="text-text-secondary">
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
        meta: { className: "w-[140px]" },
        cell: ({ row }) => (
          <Badge variant={(row.original.article_count || 0) > 0 ? "info" : "neutral"}>
            <FileText className="mr-1 h-3 w-3" />
            {row.original.article_count || 0} 篇
          </Badge>
        ),
      },
      {
        id: "created_at",
        header: "创建时间",
        accessorKey: "created_at",
        size: 170,
        meta: { className: "w-[170px]" },
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
        size: 170,
        meta: { className: "w-[170px]" },
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => handleEdit(row.original)}
            >
              <Pencil className="h-3.5 w-3.5" />
              编辑
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={() => {
                if (!window.confirm("确定要删除这个分类吗？删除后不可恢复。")) {
                  return;
                }
                void handleDelete(row.original.id);
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <Dialog
        open={visible}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent className="w-[95vw] p-0 sm:max-w-[1100px]">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              分类管理
            </DialogTitle>
            <DialogDescription>
              管理文章分类、排序和使用情况。
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(90vh-96px)] space-y-4 overflow-y-auto px-6 py-5">
            <Card className="border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full max-w-[320px]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                  <Input
                    value={searchText}
                    className="pl-8"
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

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={filterVisible ? "default" : "outline"}
                    aria-label="筛选"
                    onClick={() => setFilterVisible((prev) => !prev)}
                  >
                    <Filter className="h-4 w-4" />
                    筛选
                  </Button>
                  <Button variant="outline" onClick={() => void loadCategories()} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    刷新
                  </Button>
                  <Button onClick={handleAddCategory}>
                    <Plus className="h-4 w-4" />
                    新增分类
                  </Button>
                </div>
              </div>
            </Card>

            {filterVisible ? (
              <Card className="border border-border bg-surface p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold">高级筛选</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setFilterVisible(false)}
                  >
                    收起
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-[180px_140px_auto]">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">排序方式</label>
                    <Select
                      value={sortBy || FILTER_ALL}
                      onValueChange={(value) =>
                        setSortBy(value === FILTER_ALL ? undefined : value)
                      }
                    >
                      <SelectTrigger>
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
                    <label className="mb-1.5 block text-sm font-medium">最少文章数</label>
                    <Input
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
                  <div className="flex items-end gap-2">
                    <Button variant="outline" onClick={handleFilterReset}>
                      重置
                    </Button>
                    <Button onClick={handleFilterApply}>筛选</Button>
                  </div>
                </div>
              </Card>
            ) : null}

            {selectedRowKeys.length > 0 ? (
              <Card className="border border-primary/20 bg-primary-soft p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
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

            <Card className="border border-border bg-surface p-0">
              {loading ? (
                <div className="py-14 text-center text-sm text-text-tertiary">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在加载分类...
                  </span>
                </div>
              ) : categories.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="text-sm text-text-tertiary">暂无分类数据</p>
                  <Button className="mt-3" onClick={handleAddCategory}>
                    添加第一个分类
                  </Button>
                </div>
              ) : (
                <>
                  <DataTable table={table} tableClassName="min-w-[980px]" />
                  <div className="mt-2 flex justify-end border-t border-border-secondary pt-3">
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
      />
    </>
  );
};

export default CategoryManageModal;
