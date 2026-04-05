import { showMessage } from "@/lib/toast";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type ColumnDef,
  type SortingState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import dayjs from "dayjs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { categoryApi } from "@services";
import type { CategoryWithUsage, CategoryFilterParams } from "@services";
import { logger } from "@services/logger";
import { AdminPage, AdminTablePanel } from "@components/Admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Ellipsis,
  Eye,
  FileText,
  Filter,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";

type CategoryEditFormProps = {
  category: CategoryWithUsage | null;
  isCreateMode: boolean;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "请输入分类名称")
    .max(50, "名称不能超过50个字符"),
  slug: z
    .string()
    .trim()
    .min(1, "请输入URL标识")
    .max(50, "URL标识不能超过50个字符")
    .regex(/^[a-z0-9-]+$/, "只能包含小写字母、数字和横线"),
  description: z.string().max(200, "描述不能超过200个字符"),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

const CategoryEditForm: React.FC<CategoryEditFormProps> = ({
  category,
  isCreateMode,
  open,
  onClose,
  onSaved,
}) => {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (category) {
      form.reset({
        name: category.name || "",
        slug: category.slug || "",
        description: category.description || "",
      });
    } else {
      form.reset({
        name: "",
        slug: "",
        description: "",
      });
    }
  }, [category, form, open]);

  const name = form.watch("name");
  const description = form.watch("description") || "";

  const generateSlug = () => {
    const generated = (name || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    form.setValue("slug", generated, { shouldDirty: true, shouldValidate: true });
  };

  const handleFormSubmit = async (values: CategoryFormValues) => {
    try {
      const payload = {
        name: values.name.trim(),
        slug:
          values.slug.trim() ||
          values.name.trim().toLowerCase().replace(/\s+/g, "-"),
        description: values.description?.trim()
          ? values.description.trim()
          : null,
      };
      if (isCreateMode) {
        await categoryApi.createCategory(payload);
        showMessage.success("分类创建成功");
      } else if (category) {
        await categoryApi.updateCategory(category.id, payload);
        showMessage.success("分类更新成功");
      }
      onSaved();
    } catch (error: any) {
      logger.error("保存分类失败:", error);
      showMessage.error(error?.response?.data?.detail || "保存分类失败，请检查表单数据");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{isCreateMode ? "添加新分类" : "编辑分类"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(handleFormSubmit)}>
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
                  <FormLabel>URL标识 (slug)</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Input placeholder="例如：algorithm-basics" {...field} />
                    </FormControl>
                    <Button type="button" variant="outline" onClick={generateSlug}>
                      从名称生成
                    </Button>
                  </div>
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
                      className="min-h-[96px]"
                      placeholder="请输入分类描述"
                      maxLength={200}
                      {...field}
                    />
                  </FormControl>
                  <div className="flex justify-between text-xs text-text-tertiary">
                    <FormMessage />
                    <span>{description.length}/200</span>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={form.formState.isSubmitting}>
                取消
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isCreateMode ? "创建分类" : "保存修改"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const SORT_NONE = "__none__";

const sortValueToState = (value: string): SortingState => {
  switch (value) {
    case "name_asc":
      return [{ id: "name", desc: false }];
    case "name_desc":
      return [{ id: "name", desc: true }];
    case "articles_asc":
      return [{ id: "articleCount", desc: false }];
    case "articles_desc":
      return [{ id: "articleCount", desc: true }];
    case "created_asc":
      return [{ id: "createdAt", desc: false }];
    case "created_desc":
      return [{ id: "createdAt", desc: true }];
    default:
      return [];
  }
};

const sortingStateToValue = (sorting: SortingState): string => {
  const [current] = sorting;
  if (!current) return SORT_NONE;

  if (current.id === "name") {
    return current.desc ? "name_desc" : "name_asc";
  }
  if (current.id === "articleCount") {
    return current.desc ? "articles_desc" : "articles_asc";
  }
  if (current.id === "createdAt") {
    return current.desc ? "created_desc" : "created_asc";
  }

  return SORT_NONE;
};

const AdminCategories: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryWithUsage[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<CategoryFilterParams>({
    page: 1,
    size: 20,
    include_usage_count: true,
  });
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [sorting, setSorting] = useState<SortingState>([]);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryWithUsage | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);

  const [filterVisible, setFilterVisible] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [minArticles, setMinArticles] = useState<string>("");

  const loadCategories = async (params: CategoryFilterParams = searchParams) => {
    try {
      setLoading(true);
      const response = await categoryApi.listCategories(params);
      const listData = response.data;
      const categoriesWithUsage = (listData?.categories || []).map((category) => {
        if ("article_count" in category) return category as CategoryWithUsage;
        return { ...category, article_count: 0 } as CategoryWithUsage;
      });
      setCategories(categoriesWithUsage);
      setTotal(listData?.total || 0);
      setRowSelection({});
    } catch (error) {
      logger.error("加载分类列表失败:", error);
      showMessage.error("加载分类列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const filteredCategories = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    let list = [...categories];
    if (kw) {
      list = list.filter((item) => {
        const target = `${item.name || ""} ${item.slug || ""} ${item.description || ""}`.toLowerCase();
        return target.includes(kw);
      });
    }
    const minValue = Number(minArticles);
    if (minArticles !== "" && Number.isFinite(minValue)) {
      list = list.filter((item) => (item.article_count || 0) >= minValue);
    }
    return list;
  }, [categories, minArticles, searchKeyword]);

  const handlePageChange = (page: number, size?: number) => {
    const newParams = {
      ...searchParams,
      page,
      size: size || pageSize,
    };
    setCurrentPage(page);
    if (size) setPageSize(size);
    setSearchParams(newParams);
    loadCategories(newParams);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("确定删除该分类吗？")) return;
    try {
      await categoryApi.deleteCategory(id);
      showMessage.success("分类删除成功");
      loadCategories();
    } catch (error: any) {
      logger.error("删除分类失败:", error);
      showMessage.error(error?.response?.data?.detail || "删除分类失败");
    }
  };

  const handleBatchDelete = async () => {
    const selectedIds = Object.keys(rowSelection)
      .filter((id) => rowSelection[id])
      .map((id) => Number(id));

    if (selectedIds.length === 0) {
      showMessage.warning("请选择要删除的分类");
      return;
    }
    if (!window.confirm(`确定删除选中的 ${selectedIds.length} 个分类吗？`)) return;
    try {
      setLoading(true);
      for (const id of selectedIds) {
        await categoryApi.deleteCategory(id);
      }
      showMessage.success(`成功删除 ${selectedIds.length} 个分类`);
      loadCategories();
    } catch (error) {
      logger.error("批量删除失败:", error);
      showMessage.error("批量删除失败");
    } finally {
      setLoading(false);
    }
  };

  const handleViewArticles = (id: number, name: string) => {
    navigate(`/admin/articles?category=${id}`);
    showMessage.info(`正在查看 "${name}" 分类的文章`);
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setIsCreateMode(true);
    setEditModalVisible(true);
  };

  const handleEdit = (record: CategoryWithUsage) => {
    setEditingCategory(record);
    setIsCreateMode(false);
    setEditModalVisible(true);
  };

  const selectedIds = useMemo(
    () =>
      Object.keys(rowSelection)
        .filter((id) => rowSelection[id])
        .map((id) => Number(id)),
    [rowSelection],
  );

  useEffect(() => {
    const allowedIds = new Set(filteredCategories.map((item) => String(item.id)));
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
  }, [filteredCategories]);

  const pageSizeOptions = [10, 20, 50, 100];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const sortBy = sortingStateToValue(sorting);

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
        size: 44,
        meta: { className: "w-[44px]" },
      },
      {
        accessorKey: "name",
        id: "name",
        header: "分类名称",
        cell: ({ row }) => (
          <div>
            <div className="font-semibold">{row.original.name}</div>
            <div className="text-xs text-text-secondary">{row.original.slug}</div>
          </div>
        ),
        size: 220,
        meta: { className: "w-[220px]" },
      },
      {
        accessorKey: "description",
        header: "描述",
        cell: ({ row }) => (
          <div className="text-text-secondary">{row.original.description || "暂无描述"}</div>
        ),
        enableSorting: false,
        size: 320,
        meta: { className: "w-[320px]" },
      },
      {
        accessorFn: (row) => row.article_count || 0,
        id: "articleCount",
        header: "文章数量",
        cell: ({ row }) => (
          <Badge
            variant={(row.original.article_count || 0) > 0 ? "info" : "outline"}
          >
            <FileText className="mr-1 h-3.5 w-3.5" />
            {row.original.article_count || 0} 篇
          </Badge>
        ),
        size: 130,
        meta: { className: "w-[130px]" },
      },
      {
        accessorFn: (row) => dayjs(row.created_at).valueOf(),
        id: "createdAt",
        header: "创建时间",
        cell: ({ row }) => (
          <div>
            <div className="text-xs">{dayjs(row.original.created_at).format("YYYY-MM-DD")}</div>
            <div className="text-xs text-text-secondary">
              {dayjs(row.original.created_at).format("HH:mm")}
            </div>
          </div>
        ),
        size: 150,
        meta: { className: "w-[150px]" },
      },
      {
        id: "actions",
        header: "操作",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => handleEdit(row.original)}>
              <Pencil className="h-4 w-4" />
              编辑
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewArticles(row.original.id, row.original.name)}
            >
              <FileText className="h-4 w-4" />
              文章
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Ellipsis className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleViewArticles(row.original.id, row.original.name)}>
                  <Eye className="mr-2 h-4 w-4" />
                  查看文章
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleEdit(row.original)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(row.original.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        enableSorting: false,
        size: 210,
        meta: { className: "w-[210px]" },
      },
    ],
    [handleDelete, handleEdit, navigate],
  );

  const table = useReactTable({
    data: filteredCategories,
    columns,
    state: {
      rowSelection,
      sorting,
    },
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <AdminPage scrollable={false}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            className="pl-9"
            placeholder="搜索分类名称或slug..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setCurrentPage(1);
                handlePageChange(1);
              }
            }}
          />
        </div>
        <Button variant="outline" onClick={() => { setCurrentPage(1); handlePageChange(1); }}>
          <Search className="h-4 w-4" />
          搜索
        </Button>
        <div className="flex-1" />
        {selectedIds.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Ellipsis className="h-4 w-4" />
                批量操作 ({selectedIds.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive" onClick={handleBatchDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                批量删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          variant={filterVisible ? "default" : "outline"}
          onClick={() => setFilterVisible((prev) => !prev)}
        >
          <Filter className="h-4 w-4" />
          筛选
        </Button>
        <Button variant="outline" onClick={() => loadCategories()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          刷新
        </Button>
        <Button onClick={handleAddCategory}>
          <Plus className="h-4 w-4" />
          新增分类
        </Button>
      </div>

      {filterVisible && (
        <div className="mb-4 rounded-xl bg-surface-2 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-[200px] space-y-1">
              <div className="text-xs text-text-secondary">排序方式</div>
              <Select value={sortBy} onValueChange={(value) => setSorting(sortValueToState(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SORT_NONE}>不排序</SelectItem>
                  <SelectItem value="name_asc">名称升序</SelectItem>
                  <SelectItem value="name_desc">名称降序</SelectItem>
                  <SelectItem value="articles_asc">文章数量升序</SelectItem>
                  <SelectItem value="articles_desc">文章数量降序</SelectItem>
                  <SelectItem value="created_desc">最新创建</SelectItem>
                  <SelectItem value="created_asc">最早创建</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[140px] space-y-1">
              <div className="text-xs text-text-secondary">最少文章数</div>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={minArticles}
                onChange={(e) => setMinArticles(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSorting([]);
                setMinArticles("");
                setFilterVisible(false);
              }}
            >
              重置
            </Button>
            <Button onClick={() => setFilterVisible(false)}>应用</Button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <AdminTablePanel
            title={
              <div className="flex items-center">
                <span>分类列表</span>
                {selectedIds.length > 0 && (
                  <Badge variant="info" className="ml-2">
                    已选择 {selectedIds.length} 项
                  </Badge>
                )}
              </div>
            }
            extra={<span className="text-sm text-text-secondary">共 {total} 个分类</span>}
            loading={loading}
            isEmpty={filteredCategories.length === 0}
            emptyDescription={categories.length === 0 ? "暂无分类数据" : "暂无符合条件的分类"}
            emptyAction={
              <Button onClick={handleAddCategory}>
                <Plus className="h-4 w-4" />
                添加第一个分类
              </Button>
            }
          >
            <DataTable table={table} className="h-full" tableClassName="min-w-[980px]" />
          </AdminTablePanel>
        </div>
        {filteredCategories.length > 0 ? (
          <div className="mt-2 flex justify-end border-t border-border-secondary pt-3">
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              pageSizeOptions={pageSizeOptions}
              onPageChange={handlePageChange}
            />
          </div>
        ) : null}
      </div>

      <CategoryEditForm
        category={editingCategory}
        isCreateMode={isCreateMode}
        open={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        onSaved={() => {
          setEditModalVisible(false);
          loadCategories();
        }}
      />
    </AdminPage>
  );
};

export default AdminCategories;
