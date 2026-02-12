/**
 * 用户表单组件
 */

import React, { useEffect } from "react";
import { Form, Input, Select, Row, Col, Modal } from "antd";
import { UserFormProps } from "../types";
import {
  formRules,
  roleOptions,
  statusOptions,
  studyYearOptions,
} from "../data";

const { Option } = Select;

const UserForm: React.FC<UserFormProps> = ({
  visible,
  editingUser,
  onSubmit,
  onCancel,
}) => {
  const [form] = Form.useForm();

  // 初始化表单值
  useEffect(() => {
    if (editingUser) {
      form.setFieldsValue(editingUser);
    } else {
      form.resetFields();
      // 设置默认值
      form.setFieldsValue({
        is_active: true,
        role_code: "student",
      });
    }
  }, [editingUser, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      onSubmit(values);
    } catch (error) {
      console.error("表单验证失败:", error);
    }
  };

  return (
    <Modal
      title={editingUser ? "编辑用户" : "添加用户"}
      open={visible}
      onOk={handleSubmit}
      onCancel={onCancel}
      okText={editingUser ? "保存" : "添加"}
      cancelText="取消"
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          is_active: true,
          role_code: "student",
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="学号"
              name="student_id"
              rules={formRules.student_id}
            >
              <Input placeholder="请输入学号" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ pattern: /^\S+$/, message: "用户名不能包含空格" }]}
            >
              <Input placeholder="请输入用户名（可选）" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="姓名"
              name="full_name"
              rules={formRules.full_name}
            >
              <Input placeholder="请输入姓名" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="角色"
              name="role_code"
              rules={[{ required: true, message: "请选择角色" }]}
            >
              <Select placeholder="请选择角色">
                {roleOptions.map((role) => (
                  <Option key={role.value} value={role.value}>
                    {role.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="学年"
              name="study_year"
              rules={formRules.study_year}
            >
              <Select placeholder="请选择学年">
                {studyYearOptions.map((year) => (
                  <Option key={year.value} value={year.value}>
                    {year.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="班级"
              name="class_name"
              rules={formRules.class_name}
            >
              <Input placeholder="如：高一(1)班、高二(3)班" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="状态" name="is_active">
          <Select placeholder="请选择状态">
            {statusOptions.map((status) => (
              <Option key={String(status.value)} value={status.value}>
                {status.label}
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default UserForm;
