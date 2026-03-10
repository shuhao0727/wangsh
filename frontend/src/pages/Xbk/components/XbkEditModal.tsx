import React, { useState, useEffect } from "react";
import { Modal, Form, Row, Col, Input, InputNumber, Select, message } from "antd";
import { xbkDataApi } from "@services";
import type { XbkMeta } from "@services";

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
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (initialValues) {
        form.setFieldsValue(initialValues);
      } else {
        form.setFieldsValue({
          year: filters.year,
          term: filters.term,
          grade: filters.grade,
        });
      }
    }
  }, [open, initialValues, form, filters]);

  const getErrorMsg = (e: any, defaultMsg: string) => {
    const detail = e?.response?.data?.detail;
    if (Array.isArray(detail)) return detail.map((err: any) => err.msg).join("; ");
    if (typeof detail === "object") return JSON.stringify(detail);
    return detail || defaultMsg;
  };

  const handleOk = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      if (kind === "students") {
        if (mode === "create") {
          await xbkDataApi.createStudent(values);
        } else if (targetId != null) {
          await xbkDataApi.updateStudent(targetId, values);
        }
      } else if (kind === "courses") {
        const payload = { ...values, quota: Number(values.quota || 0) };
        if (mode === "create") {
          await xbkDataApi.createCourse(payload);
        } else if (targetId != null) {
          await xbkDataApi.updateCourse(targetId, payload);
        }
      } else {
        if (mode === "create") {
          await xbkDataApi.createSelection(values);
        } else if (targetId != null) {
          await xbkDataApi.updateSelection(targetId, values);
        }
      }
      message.success("保存成功");
      onSuccess();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(getErrorMsg(e, "保存失败（需要管理员登录）"));
    } finally {
      setSaving(false);
    }
  };

  const getTitle = () => {
    if (kind === "students") return mode === "create" ? "新增学生" : "编辑学生";
    if (kind === "courses") return mode === "create" ? "新增课程" : "编辑课程";
    return mode === "create" ? "新增选课记录" : "编辑选课记录";
  };

  return (
    <Modal
      title={getTitle()}
      open={open}
      forceRender
      confirmLoading={saving}
      onCancel={onCancel}
      onOk={handleOk}
      okText="保存"
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="year" label="年份" rules={[{ required: true, message: "请输入年份" }]}>
              <InputNumber style={{ width: "100%" }} min={2000} max={2100} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="term" label="学期" rules={[{ required: true, message: "请选择学期" }]}>
              <Select
                options={(meta.terms?.length ? meta.terms : ["上学期", "下学期"]).map((t) => ({
                  value: t,
                  label: t,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="grade" label="年级">
              <Select
                allowClear
                options={[
                  { value: "高一", label: "高一" },
                  { value: "高二", label: "高二" },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        {kind === "students" ? (
          <>
            <Form.Item name="class_name" label="班级" rules={[{ required: true, message: "请输入班级" }]}>
              <Input placeholder="如：高二(1)班" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="student_no" label="学号" rules={[{ required: true, message: "请输入学号" }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="gender" label="性别">
              <Select
                allowClear
                options={[
                  { value: "男", label: "男" },
                  { value: "女", label: "女" },
                ]}
              />
            </Form.Item>
          </>
        ) : kind === "courses" ? (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="course_code" label="课程代码" rules={[{ required: true, message: "请输入课程代码" }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="quota" label="限报人数" rules={[{ required: true, message: "请输入限报人数" }]}>
                  <InputNumber style={{ width: "100%" }} min={0} max={999} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="course_name" label="课程名称" rules={[{ required: true, message: "请输入课程名称" }]}>
              <Input />
            </Form.Item>
            <Form.Item name="teacher" label="课程负责人">
              <Input />
            </Form.Item>
            <Form.Item name="location" label="上课地点">
              <Input />
            </Form.Item>
          </>
        ) : (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="student_no" label="学号" rules={[{ required: true, message: "请输入学号" }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="name" label="姓名">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="course_code" label="课程代码" rules={[{ required: true, message: "请输入课程代码" }]}>
              <Input />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
};
