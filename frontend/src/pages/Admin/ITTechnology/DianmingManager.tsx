import { showMessage } from '@/lib/toast';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { ConfirmDialog } from "@components/Common/ConfirmDialog";

import { AdminTablePanel } from '@/components/Admin';
import { Button } from '@/components/ui/button';
import { DataTablePagination } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/constants/tableDefaults';
import { dianmingApi, type DianmingClass } from '@/services/xxjs/dianming';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const formSchema = z.object({
  year: z.string().trim().min(1, '请输入年份，如 2024级'),
  class_name: z.string().trim().min(1, '请输入班级名称'),
  names_text: z.string().trim().min(1, '请输入学生名单'),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_FORM_VALUES: FormValues = {
  year: '',
  class_name: '',
  names_text: '',
};

const gridClass = 'grid grid-cols-[minmax(100px,120px)_minmax(140px,1fr)_minmax(80px,100px)_minmax(160px,220px)] gap-3';

const DianmingManager: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DianmingClass[]>([]);
  const [editingRecord, setEditingRecord] = useState<DianmingClass | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [editorVisible, setEditorVisible] = useState(false);
  const requestSeq = useRef(0);
  const [confirmState, setConfirmState] = useState<{ message: string; onOk: () => void } | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_FORM_VALUES,
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
    void fetchData();
  }, []);

  const displayedData = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return data;
    return data.filter((item) => {
      const year = String(item.year || '').toLowerCase();
      const className = String(item.class_name || '').toLowerCase();
      return year.includes(kw) || className.includes(kw);
    });
  }, [data, keyword]);

  const total = displayedData.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const start = (pageSafe - 1) * pageSize;
  const pageRows = displayedData.slice(start, start + pageSize);
  const editorTitle = editingRecord ? '编辑班级名单' : '新建/导入班级';
  const editorDescription = editingRecord ? '修改后会覆盖原有名单，一行一个姓名。' : '直接粘贴学生名单，一行一个姓名。';

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const closeEditor = () => {
    requestSeq.current += 1;
    setEditorVisible(false);
    setEditingRecord(null);
    setFormLoading(false);
    form.reset(EMPTY_FORM_VALUES);
  };

  const openCreateEditor = () => {
    requestSeq.current += 1;
    setEditingRecord(null);
    setFormLoading(false);
    form.reset(EMPTY_FORM_VALUES);
    setEditorVisible(true);
  };

  const openEditEditor = (record: DianmingClass) => {
    const currentRequest = requestSeq.current + 1;
    requestSeq.current = currentRequest;

    setEditingRecord(record);
    setFormLoading(true);
    form.reset({
      year: record.year,
      class_name: record.class_name,
      names_text: '',
    });
    setEditorVisible(true);

    void dianmingApi
      .listStudents(record.year, record.class_name)
      .then((students) => {
        if (requestSeq.current !== currentRequest) return;
        form.reset({
          year: record.year,
          class_name: record.class_name,
          names_text: students.map((student) => student.student_name).join('\n'),
        });
      })
      .catch(() => {
        if (requestSeq.current === currentRequest) {
          showMessage.error('获取学生名单失败');
        }
      })
      .finally(() => {
        if (requestSeq.current === currentRequest) {
          setFormLoading(false);
        }
      });
  };

  const handleImport = async (values: FormValues) => {
    try {
      if (editingRecord) {
        await dianmingApi.updateClassStudents({
          year: values.year,
          class_name: values.class_name,
          names_text: values.names_text,
        });
        showMessage.success('更新成功');
      } else {
        await dianmingApi.importStudents({
          year: values.year,
          class_name: values.class_name,
          names_text: values.names_text,
        });
        showMessage.success('导入成功');
      }

      closeEditor();
      await fetchData();
    } catch (_error) {
      showMessage.error(editingRecord ? '更新失败' : '导入失败');
    }
  };

  const handleDelete = (record: DianmingClass) => {
    setConfirmState({ message: '确定要删除该班级及其所有学生吗？', onOk: async () => {
      try {
        await dianmingApi.deleteClass(record.year, record.class_name);
        showMessage.success('删除成功');
        await fetchData();
      } catch (_error) {
        showMessage.error('删除失败');
      }
    }});
  };

  return (
    <>
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
          <Button type="button" onClick={openCreateEditor}>
            <Plus className="h-4 w-4" />
            新建/导入班级
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 flex flex-col">
          <AdminTablePanel
            loading={loading}
            isEmpty={displayedData.length === 0}
            emptyDescription="暂无班级数据"
            pagination={
              total > 0 ? (
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
              ) : undefined
            }
          >
            <div className="overflow-hidden rounded-md border border-border bg-background">
              <div className={`${gridClass} border-b border-border-secondary px-4 py-3 text-sm font-medium text-text-secondary`}>
                <div>年份/届别</div>
                <div>班级名称</div>
                <div>学生人数</div>
                <div>操作</div>
              </div>
              {pageRows.map((row) => (
                <div
                  key={`${row.year}-${row.class_name}`}
                  className={`${gridClass} items-center border-b border-border-secondary px-4 py-3 text-sm last:border-b-0`}
                >
                  <div className="truncate">{row.year}</div>
                  <div className="truncate">{row.class_name}</div>
                  <div>{row.count}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => openEditEditor(row)}>
                      <Pencil className="h-3.5 w-3.5" />
                      编辑
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void handleDelete(row)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </AdminTablePanel>
        </div>
      </div>

      <Dialog
        open={editorVisible}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeEditor();
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editorTitle}</DialogTitle>
            <DialogDescription>{editorDescription}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleImport)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>年份/届别</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：2024级" disabled={formLoading || form.formState.isSubmitting} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="class_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>班级名称</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：软件工程1班" disabled={formLoading || form.formState.isSubmitting} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="names_text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>学生名单</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={15}
                        placeholder={formLoading ? '正在加载学生名单...' : '张三\n李四\n王五'}
                        disabled={formLoading || form.formState.isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    {formLoading ? (
                      <div className="flex items-center gap-2 text-xs text-text-tertiary">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        正在加载班级名单...
                      </div>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={closeEditor}>
                  取消
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting || formLoading}>
                  {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>

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

export default DianmingManager;
