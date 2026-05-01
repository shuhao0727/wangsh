import { showMessage } from "@/lib/toast";
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { xbkDataApi } from "@services";
import type { XbkMeta } from "@services";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface XbkEditModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  kind: "students" | "courses" | "selections";
  mode: "create" | "edit";
  targetId: number | null;
  initialValues?: any;
  meta: XbkMeta;
  filters: {
    year?: number;
    term?: "上学期" | "下学期";
    grade?: "高一" | "高二";
  };
}

type FormValues = {
  year: number | "";
  term: string;
  grade: "高一" | "高二" | "";
  class_name: string;
  student_no: string;
  name: string;
  gender: "男" | "女" | "";
  course_code: string;
  course_name: string;
  teacher: string;
  quota: number | "";
  location: string;
};

const EMPTY_FORM: FormValues = {
  year: "",
  term: "",
  grade: "",
  class_name: "",
  student_no: "",
  name: "",
  gender: "",
  course_code: "",
  course_name: "",
  teacher: "",
  quota: "",
  location: "",
};

const baseFormSchema = z.object({
  year: z.union([z.number(), z.literal("")]),
  term: z.string(),
  grade: z.union([z.literal("高一"), z.literal("高二"), z.literal("")]),
  class_name: z.string(),
  student_no: z.string(),
  name: z.string(),
  gender: z.union([z.literal("男"), z.literal("女"), z.literal("")]),
  course_code: z.string(),
  course_name: z.string(),
  teacher: z.string(),
  quota: z.union([z.number(), z.literal("")]),
  location: z.string(),
});

export const XbkEditModal: React.FC<XbkEditModalProps> = ({
  open,
  onCancel,
  onSuccess,
  kind,
  mode,
  targetId,
  initialValues,
  meta,
  filters,
}) => {
  const [saving, setSaving] = useState(false);
  const formSchema = useMemo(
    () =>
      baseFormSchema.superRefine((values, ctx) => {
        if (!values.year) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["year"],
            message: "请输入年份",
          });
        }
        if (!values.term) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["term"],
            message: "请选择学期",
          });
        }

        if (kind === "students") {
          if (!values.class_name.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["class_name"],
              message: "请输入班级",
            });
          }
          if (!values.student_no.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["student_no"],
              message: "请输入学号",
            });
          }
          if (!values.name.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["name"],
              message: "请输入姓名",
            });
          }
        } else if (kind === "courses") {
          if (!values.course_code.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["course_code"],
              message: "请输入课程代码",
            });
          }
          if (!values.course_name.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["course_name"],
              message: "请输入课程名称",
            });
          }
          const quotaNum = Number(values.quota);
          if (values.quota === "" || Number.isNaN(quotaNum)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["quota"],
              message: "请输入限报人数",
            });
          } else if (quotaNum < 0 || quotaNum > 999) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["quota"],
              message: "限报人数范围 0-999",
            });
          }
        } else {
          if (!values.student_no.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["student_no"],
              message: "请输入学号",
            });
          }
          if (!values.course_code.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["course_code"],
              message: "请输入课程代码",
            });
          }
        }
      }),
    [kind],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_FORM,
    mode: "onChange",
  });
  const { reset } = form;
  useEffect(() => {
    if (!open) return;
    const base = initialValues || {};
    reset({
      ...EMPTY_FORM,
      year: typeof base.year === "number" ? base.year : filters.year || "",
      term: String(base.term || filters.term || ""),
      grade: (base.grade || filters.grade || "") as "高一" | "高二" | "",
      class_name: String(base.class_name || ""),
      student_no: String(base.student_no || ""),
      name: String(base.name || ""),
      gender: (base.gender || "") as "男" | "女" | "",
      course_code: String(base.course_code || ""),
      course_name: String(base.course_name || ""),
      teacher: String(base.teacher || ""),
      quota: typeof base.quota === "number" ? base.quota : base.quota ? Number(base.quota) : "",
      location: String(base.location || ""),
    });
  }, [open, initialValues, filters.grade, filters.term, filters.year, reset]);

  const getErrorMsg = (e: any, defaultMsg: string) => {
    const detail = e?.response?.data?.detail;
    if (Array.isArray(detail)) return detail.map((err: any) => err.msg).join("; ");
    if (typeof detail === "object") return JSON.stringify(detail);
    return detail || defaultMsg;
  };

  const handleSave = async (values: FormValues) => {
    const common = {
      year: Number(values.year),
      term: values.term,
      grade: values.grade || undefined,
    };

    setSaving(true);
    try {
      if (kind === "students") {
        const payload = {
          ...common,
          class_name: values.class_name.trim(),
          student_no: values.student_no.trim(),
          name: values.name.trim(),
          gender: values.gender || undefined,
        };
        if (mode === "create") {
          await xbkDataApi.createStudent(payload);
        } else if (targetId != null) {
          await xbkDataApi.updateStudent(targetId, payload);
        }
      } else if (kind === "courses") {
        const payload = {
          ...common,
          course_code: values.course_code.trim(),
          course_name: values.course_name.trim(),
          teacher: values.teacher.trim() || undefined,
          quota: Number(values.quota || 0),
          location: values.location.trim() || undefined,
        };
        if (mode === "create") {
          await xbkDataApi.createCourse(payload);
        } else if (targetId != null) {
          await xbkDataApi.updateCourse(targetId, payload);
        }
      } else {
        const payload = {
          ...common,
          student_no: values.student_no.trim(),
          name: values.name.trim() || undefined,
          course_code: values.course_code.trim(),
        };
        if (mode === "create") {
          await xbkDataApi.createSelection(payload);
        } else if (targetId != null) {
          await xbkDataApi.updateSelection(targetId, payload);
        }
      }
      showMessage.success("保存成功");
      onSuccess();
    } catch (e: any) {
      showMessage.error(getErrorMsg(e, "保存失败（需要管理员登录）"));
    } finally {
      setSaving(false);
    }
  };

  const getTitle = () => {
    if (kind === "students") return mode === "create" ? "新增学生" : "编辑学生";
    if (kind === "courses") return mode === "create" ? "新增课程" : "编辑课程";
    return mode === "create" ? "新增选课记录" : "编辑选课记录";
  };

  const termOptions = meta.terms?.length ? meta.terms : ["上学期", "下学期"];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-[780px]">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription className="sr-only">
            编辑或新增 XBK 学生、课程与选课记录，保存后将写入后端数据库。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>年份</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={2000}
                        max={2100}
                        value={field.value === "" ? "" : field.value}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v ? Number(v) : "");
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="term"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>学期</FormLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择学期" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {termOptions.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
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
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>年级</FormLabel>
                    <Select
                      value={field.value || "__none__"}
                      onValueChange={(v) => field.onChange(v === "__none__" ? "" : (v as "高一" | "高二"))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择年级" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">不设置</SelectItem>
                        <SelectItem value="高一">高一</SelectItem>
                        <SelectItem value="高二">高二</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {kind === "students" ? (
              <>
                <FormField
                  control={form.control}
                  name="class_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>班级</FormLabel>
                      <FormControl>
                        <Input placeholder="如：高二(1)班" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="student_no"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>学号</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>姓名</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>性别</FormLabel>
                      <Select
                        value={field.value || "__none__"}
                        onValueChange={(v) => field.onChange(v === "__none__" ? "" : (v as "男" | "女"))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择性别" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">不设置</SelectItem>
                          <SelectItem value="男">男</SelectItem>
                          <SelectItem value="女">女</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : kind === "courses" ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="course_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>课程代码</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quota"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>限报人数</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={999}
                            value={field.value === "" ? "" : field.value}
                            onChange={(e) => {
                              const v = e.target.value;
                              field.onChange(v ? Number(v) : "");
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="course_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>课程名称</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="teacher"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>课程负责人</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>上课地点</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="student_no"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>学号</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>姓名</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="course_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>课程代码</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
                取消
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                保存
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
