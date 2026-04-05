import { showMessage } from "@/lib/toast";
import React, { useState, useEffect, useMemo } from 'react';
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, RefreshCw, Loader2 } from 'lucide-react';
import { AdminTablePanel } from '@/components/Admin';
import { dianmingApi, DianmingClass } from '@/services/xxjs/dianming';
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";

const formSchema = z.object({
  year: z.string().trim().min(1, "请输入年份，如 2024级"),
  class_name: z.string().trim().min(1, "请输入班级名称"),
  names_text: z.string().trim().min(1, "请输入学生名单"),
});

type FormValues = z.infer<typeof formSchema>;

const DianmingManager: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DianmingClass[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DianmingClass | null>(null);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      year: "",
      class_name: "",
      names_text: "",
    },
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await dianmingApi.listClasses();
      setData(res);
    } catch (_error) {
      showMessage.error('获取班级列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const displayedData = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return data;
    return data.filter((item) => {
      const year = String(item.year || "").toLowerCase();
      const className = String(item.class_name || "").toLowerCase();
      return year.includes(kw) || className.includes(kw);
    });
  }, [data, keyword]);

  const handleImport = async (values: FormValues) => {
    try {
      if (editingRecord) {
        // 编辑模式：调用更新接口（覆盖名单）
        await dianmingApi.updateClassStudents({
          year: values.year,
          class_name: values.class_name,
          names_text: values.names_text,
        });
        showMessage.success('更新成功');
      } else {
        // 新建模式：调用导入接口（追加名单）
        await dianmingApi.importStudents({
          year: values.year,
          class_name: values.class_name,
          names_text: values.names_text,
        });
        showMessage.success('导入成功');
      }
      
      setIsModalVisible(false);
      setEditingRecord(null);
      reset();
      fetchData();
    } catch (_error) {
      showMessage.error(editingRecord ? '更新失败' : '导入失败');
    }
  };

  const handleDelete = async (record: DianmingClass) => {
    if (!window.confirm("确定要删除该班级及其所有学生吗？")) return;
    try {
      await dianmingApi.deleteClass(record.year, record.class_name);
      showMessage.success('删除成功');
      fetchData();
    } catch (_error) {
      showMessage.error('删除失败');
    }
  };

  const handleEdit = async (record: DianmingClass) => {
    setEditingRecord(record);
    try {
      const students = await dianmingApi.listStudents(record.year, record.class_name);
      const namesText = students.map(s => s.student_name).join('\n');
      
      reset({
        year: record.year,
        class_name: record.class_name,
        names_text: namesText,
      });
      setIsModalVisible(true);
    } catch (_error) {
      showMessage.error('获取学生名单失败');
    }
  };

  const total = displayedData.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const start = (pageSafe - 1) * pageSize;
  const pageRows = displayedData.slice(start, start + pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const columns: ColumnDef<DianmingClass>[] = [
    {
      id: "year",
      header: "年份/届别",
      accessorKey: "year",
      size: 120,
      meta: { className: "w-[120px]" },
      cell: ({ row }) => <span className="truncate">{row.original.year}</span>,
    },
    {
      id: "class_name",
      header: "班级名称",
      accessorKey: "class_name",
      size: 180,
      meta: { className: "w-[180px]" },
      cell: ({ row }) => <span className="truncate">{row.original.class_name}</span>,
    },
    {
      id: "count",
      header: "学生人数",
      accessorKey: "count",
      size: 120,
      meta: { className: "w-[120px] text-text-tertiary" },
      cell: ({ row }) => <span>{row.original.count}</span>,
    },
    {
      id: "actions",
      header: "操作",
      size: 240,
      meta: { className: "w-[240px]" },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => handleEdit(row.original)}>
            <Pencil className="h-3.5 w-3.5" />
            编辑
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => handleDelete(row.original)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: pageRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex flex-wrap justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyword}
            placeholder="搜索年份或班级名称..."
            className="w-64"
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void fetchData()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            刷新
          </Button>
          <Button
            onClick={() => {
              setEditingRecord(null);
              reset();
              setIsModalVisible(true);
            }}
          >
            <Plus className="h-4 w-4" /> 新建/导入班级
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <AdminTablePanel
            loading={loading}
            isEmpty={displayedData.length === 0}
            emptyDescription="暂无班级数据"
          >
            <DataTable table={table} className="h-full" tableClassName="min-w-full" />
          </AdminTablePanel>
        </div>
        {total > 0 ? (
          <div className="mt-2 flex justify-end border-t border-border-secondary pt-3">
            <DataTablePagination
              currentPage={pageSafe}
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

      <Dialog
        open={isModalVisible}
        onOpenChange={(next) => {
          setIsModalVisible(next);
          if (!next) {
            setEditingRecord(null);
            reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingRecord ? "编辑班级名单" : "新建/导入班级"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleImport)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dm-admin-year">年份/届别</Label>
              <Input id="dm-admin-year" placeholder="例如：2024级" {...register("year")} />
              {errors.year?.message ? <p className="text-xs text-destructive">{errors.year.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dm-admin-class">班级名称</Label>
              <Input id="dm-admin-class" placeholder="例如：软件工程1班" {...register("class_name")} />
              {errors.class_name?.message ? <p className="text-xs text-destructive">{errors.class_name.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dm-admin-names">{editingRecord ? "学生名单 (修改后将覆盖原名单，一行一个姓名)" : "学生名单 (直接粘贴，一行一个姓名)"}</Label>
              <Textarea id="dm-admin-names" rows={15} placeholder={"张三\n李四\n王五"} {...register("names_text")} />
              {errors.names_text?.message ? <p className="text-xs text-destructive">{errors.names_text.message}</p> : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsModalVisible(false);
                  setEditingRecord(null);
                  reset();
                }}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DianmingManager;
