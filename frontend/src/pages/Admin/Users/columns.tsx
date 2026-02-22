/**
 * 用户管理表格列配置
 */

import React from "react";
import { Space, Button, Tag, Tooltip, Popconfirm } from "antd";
import { EyeOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { User } from "./types";
import { ColumnConfigProps } from "./types";

/**
 * 用户表格列配置生成器
 * @param props 包含各种处理函数的配置对象
 * @returns 表格列配置数组
 */
export const getUserColumns = (props: ColumnConfigProps) => {
  const { handleEdit, handleDelete, handleView } = props;

  return [
    {
      title: "学号",
      dataIndex: "student_id",
      key: "student_id",
      width: 120,
      sorter: (a: User, b: User) => {
        const aVal = a.student_id || "";
        const bVal = b.student_id || "";
        return aVal.localeCompare(bVal);
      },
    },
    {
      title: "姓名",
      dataIndex: "full_name",
      key: "full_name",
      width: 100,
      sorter: (a: User, b: User) => a.full_name.localeCompare(b.full_name),
    },
    {
      title: "学年",
      dataIndex: "study_year",
      key: "study_year",
      width: 120,
      render: (study_year: string | null) =>
        study_year ? (
          <Tag color="blue" bordered={false} style={{ marginRight: 4, background: 'var(--ws-color-primary-soft)', color: 'var(--ws-color-primary)' }}>
            {study_year}
          </Tag>
        ) : null,
      sorter: (a: User, b: User) => {
        const aVal = a.study_year || "";
        const bVal = b.study_year || "";
        return aVal.localeCompare(bVal);
      },
    },
    {
      title: "班级",
      dataIndex: "class_name",
      key: "class_name",
      width: 120,
      render: (className: string | null) =>
        className ? (
          <Tag color="green" bordered={false} style={{ marginRight: 4, background: 'var(--ws-color-success-soft)', color: 'var(--ws-color-success)' }}>
            {className}
          </Tag>
        ) : null,
      sorter: (a: User, b: User) => {
        const aVal = a.class_name || "";
        const bVal = b.class_name || "";
        return aVal.localeCompare(bVal);
      },
    },
    {
      title: "状态",
      dataIndex: "is_active",
      key: "is_active",
      width: 80,
      render: (isActive: boolean) => (
        <Tag 
          color={isActive ? "success" : "error"} 
          bordered={false}
          style={{ 
            background: isActive ? 'var(--ws-color-success-soft)' : 'var(--ws-color-error-soft)',
            color: isActive ? 'var(--ws-color-success)' : 'var(--ws-color-error)'
          }}
        >
          {isActive ? "活跃" : "停用"}
        </Tag>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      key: "updated_at",
      width: 150,
      render: (date: string) => dayjs(date).format("YYYY-MM-DD HH:mm"),
      sorter: (a: User, b: User) =>
        dayjs(a.updated_at).unix() - dayjs(b.updated_at).unix(),
    },
    {
      title: "操作",
      key: "action",
      width: 150,
      fixed: "right" as const,
      render: (_: any, record: User) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确认删除"
              description={`确定要删除用户【${record.full_name}】吗？`}
              onConfirm={() => handleDelete(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="text" size="small" icon={<DeleteOutlined />} danger />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];
};
