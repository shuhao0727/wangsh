import React, { useState, useEffect } from "react";
import {
  Typography,
  Space,
  Button,
  Table,
  Tag,
  Input,
  Form,
  Modal,
  message,
  Empty,
  Pagination,
  Dropdown,
  InputNumber,
  Select,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  EyeOutlined,
  MoreOutlined,
  ReloadOutlined,
  FilterOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { categoryApi } from "@services";
import type {
  CategoryWithUsage,
  CategoryFilterParams,
} from "@services";
import { logger } from "@services/logger";
import { AdminCard, AdminPage } from "@components/Admin";

const { Text } = Typography;
const { Search } = Input;
const { Option } = Select;

// 表格列配置
const getCategoryColumns = (
  handleEdit: (record: CategoryWithUsage) => void,
  handleDelete: (id: number) => void,
  handleViewArticles: (id: number, name: string) => void,
) => [
  {
    title: "分类名称",
    dataIndex: "name",
    key: "name",
    width: 200,
    render: (text: string, record: CategoryWithUsage) => (
      <div>
        <div className="font-bold">{text}</div>
          <div className="text-xs text-text-secondary">{record.slug}</div>
      </div>
    ),
  },
  {
    title: "描述",
    dataIndex: "description",
    key: "description",
    width: 250,
    render: (description: string) => (
      <div className="text-text-secondary">
        {description || <Text type="secondary">暂无描述</Text>}
      </div>
    ),
  },
  {
    title: "文章数量",
    dataIndex: "article_count",
    key: "article_count",
    width: 120,
    render: (count: number) => (
      <Tag color={count > 0 ? "blue" : "default"} className="text-sm">
        <FileTextOutlined /> {count} 篇
      </Tag>
    ),
  },
  {
    title: "创建时间",
    dataIndex: "created_at",
    key: "created_at",
    width: 150,
    render: (date: string) => (
      <div>
        <div className="text-xs">
          {dayjs(date).format("YYYY-MM-DD")}
        </div>
        <div className="text-xs text-text-secondary">
          {dayjs(date).format("HH:mm")}
        </div>
      </div>
    ),
  },
  {
    title: "操作",
    key: "action",
    width: 180,
    fixed: "right" as const,
    render: (_: any, record: CategoryWithUsage) => {
      const menu = {
        items: [
          {
            key: "view",
            label: "查看文章",
            icon: <EyeOutlined />,
            onClick: () => handleViewArticles(record.id, record.name),
          },
          {
            key: "edit",
            label: "编辑",
            icon: <EditOutlined />,
            onClick: () => handleEdit(record),
          },
          {
            type: "divider" as const,
          },
          {
            key: "delete",
            label: "删除",
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => handleDelete(record.id),
          },
        ],
      };

      return (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => handleViewArticles(record.id, record.name)}
          >
            文章
          </Button>
          <Dropdown menu={menu} trigger={["click"]}>
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      );
    },
  },
];

// 分类编辑表单组件
const CategoryEditForm: React.FC<{
  category: CategoryWithUsage | null;
  isCreateMode: boolean;
  onSave: () => void;
  onCancel: () => void;
}> = ({ category, isCreateMode, onSave, onCancel }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (category) {
      form.setFieldsValue({
        name: category.name,
        slug: category.slug,
        description: category.description || "",
      });
    } else {
      form.resetFields();
    }
  }, [category, form]);

  const handleSubmit = async (values: any) => {
    try {
      setSubmitting(true);

      const categoryData = {
        name: values.name,
        slug: values.slug || values.name.toLowerCase().replace(/\s+/g, "-"),
        description: values.description || null,
      };

      if (isCreateMode) {
        await categoryApi.createCategory(categoryData);
        message.success("分类创建成功");
      } else {
        await categoryApi.updateCategory(category!.id, categoryData);
        message.success("分类更新成功");
      }

      onSave();
    } catch (error: any) {
      logger.error("保存分类失败:", error);
      message.error(
        error.response?.data?.detail || "保存分类失败，请检查表单数据",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const generateSlug = () => {
    const name = form.getFieldValue("name");
    if (name) {
      const slug = name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      form.setFieldValue("slug", slug);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        description: "",
      }}
    >
      <Form.Item
        label="分类名称"
        name="name"
        rules={[
          { required: true, message: "请输入分类名称" },
          { max: 50, message: "名称不能超过50个字符" },
        ]}
      >
        <Input placeholder="请输入分类名称" size="large" allowClear />
      </Form.Item>

      <Form.Item
        label="URL标识 (slug)"
        name="slug"
        rules={[
          { required: true, message: "请输入URL标识" },
          {
            pattern: /^[a-z0-9-]+$/,
            message: "只能包含小写字母、数字和横线",
          },
          { max: 50, message: "URL标识不能超过50个字符" },
        ]}
      >
        <Input
          placeholder="例如：algorithm-basics"
          suffix={
            <Button type="link" size="small" onClick={generateSlug}>
              从名称生成
            </Button>
          }
        />
      </Form.Item>

      <Form.Item
        label="分类描述"
        name="description"
        rules={[{ max: 200, message: "描述不能超过200个字符" }]}
      >
        <Input.TextArea
          placeholder="请输入分类描述"
          rows={3}
          maxLength={200}
          showCount
        />
      </Form.Item>

      <div className="border-t border-black/5 mt-4 pt-4">
        <div className="text-right">
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {isCreateMode ? "创建分类" : "保存修改"}
            </Button>
          </Space>
        </div>
      </div>
    </Form>
  );
};

const AdminCategories: React.FC = () => {
  const navigate = useNavigate();

  // 状态管理
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 模态框状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<CategoryWithUsage | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);

  // 筛选表单
  const [filterForm] = Form.useForm();
  const [filterVisible, setFilterVisible] = useState(false);

  // 加载分类列表
  const loadCategories = async (
    params: CategoryFilterParams = searchParams,
  ) => {
    try {
      setLoading(true);
      const response = await categoryApi.listCategories(params);
      const listData = response.data;

      // 处理类型转换：确保包含 article_count 属性
      const categoriesWithUsage = (listData?.categories || []).map(
        (category) => {
          // 如果已经有 article_count 属性，直接使用
          if ("article_count" in category) {
            return category as CategoryWithUsage;
          }
          // 否则添加默认的 article_count
          return {
            ...category,
            article_count: 0,
          } as CategoryWithUsage;
        },
      );

      setCategories(categoriesWithUsage);
      setTotal(listData?.total || 0);
      setSelectedRowKeys([]);
    } catch (error) {
      logger.error("加载分类列表失败:", error);
      message.error("加载分类列表失败");
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadCategories();
  }, []);

  // 处理搜索
  const handleSearch = (value: string) => {
    const newParams = {
      ...searchParams,
      page: 1,
    };

    if (value.trim()) {
      // 这里可以调用搜索API
      newParams.page = 1;
    }

    setSearchParams(newParams);
    loadCategories(newParams);
  };

  // 处理筛选表单提交
  const handleFilterSubmit = (values: any) => {
    const { _sortBy, _minArticles } = values;
    const newParams: CategoryFilterParams = {
      ...searchParams,
      page: 1,
    };

    setSearchParams(newParams);
    setFilterVisible(false);
    loadCategories(newParams);
  };

  // 重置筛选
  const handleFilterReset = () => {
    filterForm.resetFields();
    const defaultParams: CategoryFilterParams = {
      page: 1,
      size: pageSize,
      include_usage_count: true,
    };
    setSearchParams(defaultParams);
    setFilterVisible(false);
    loadCategories(defaultParams);
  };

  // 处理分页变化
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

  // 处理编辑
  const handleEdit = (record: CategoryWithUsage) => {
    setEditingCategory(record);
    setIsCreateMode(false);
    setEditModalVisible(true);
  };

  // 处理删除
  const handleDelete = async (id: number) => {
    try {
      await categoryApi.deleteCategory(id);
      message.success("分类删除成功");
      loadCategories();
    } catch (error: any) {
      logger.error("删除分类失败:", error);
      const errorMsg = error.response?.data?.detail || "删除分类失败";
      message.error(errorMsg);
    }
  };

  // 处理查看分类文章
  const handleViewArticles = (id: number, name: string) => {
    navigate(`/admin/articles?category=${id}`);
    message.info(`正在查看 "${name}" 分类的文章`);
  };

  // 处理添加分类
  const handleAddCategory = () => {
    setEditingCategory(null);
    setIsCreateMode(true);
    setEditModalVisible(true);
  };

  // 处理编辑表单保存
  const handleEditFormSave = () => {
    setEditModalVisible(false);
    loadCategories();
  };

  // 处理编辑表单取消
  const handleEditFormCancel = () => {
    setEditModalVisible(false);
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("请选择要删除的分类");
      return;
    }

    try {
      setLoading(true);
      for (const id of selectedRowKeys) {
        await categoryApi.deleteCategory(id as number);
      }
      message.success(`成功删除 ${selectedRowKeys.length} 个分类`);
      loadCategories();
    } catch (error) {
      logger.error("批量删除失败:", error);
      message.error("批量删除失败");
    } finally {
      setLoading(false);
    }
  };

  // 表格行选择
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  // 筛选表单
  const renderFilterForm = () => (
    <Form form={filterForm} layout="inline" onFinish={handleFilterSubmit}>
      <Form.Item name="sortBy" label="排序方式">
        <Select placeholder="选择排序方式" allowClear style={{ width: 150 }}>
          <Option value="name_asc">名称升序</Option>
          <Option value="name_desc">名称降序</Option>
          <Option value="articles_asc">文章数量升序</Option>
          <Option value="articles_desc">文章数量降序</Option>
          <Option value="created_desc">最新创建</Option>
          <Option value="created_asc">最早创建</Option>
        </Select>
      </Form.Item>

      <Form.Item name="minArticles" label="最少文章数">
        <InputNumber min={0} placeholder="0" style={{ width: 100 }} />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button onClick={handleFilterReset}>重置</Button>
          <Button type="primary" htmlType="submit">
            筛选
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );

  // 批量操作菜单 - antd v6 使用 items 数组
  const batchMenu = {
    items: [
      {
        key: "delete",
        label: "批量删除",
        danger: true,
        onClick: handleBatchDelete,
      },
    ],
  };

  return (
    <AdminPage>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Search
          placeholder="搜索分类名称或slug..."
          allowClear
          enterButton={<SearchOutlined />}
          size="middle"
          onSearch={handleSearch}
          style={{ width: 280 }}
        />
        <div className="flex-1" />
        {selectedRowKeys.length > 0 && (
          <Dropdown menu={batchMenu}>
            <Button icon={<MoreOutlined />}>批量操作 ({selectedRowKeys.length})</Button>
          </Dropdown>
        )}
        <Button
          icon={<FilterOutlined />}
          onClick={() => setFilterVisible(!filterVisible)}
          type={filterVisible ? "primary" : "default"}
        >筛选</Button>
        <Button icon={<ReloadOutlined />} onClick={() => loadCategories()} loading={loading}>刷新</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCategory}>新增分类</Button>
      </div>

      {/* 筛选表单 */}
      {filterVisible && (
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          {renderFilterForm()}
        </div>
      )}

      {/* 分类表格 */}
      <AdminCard
        title={
          <div className="flex items-center">
            <span>分类列表</span>
            {selectedRowKeys.length > 0 && (
              <Tag color="blue" className="ml-2">
                已选择 {selectedRowKeys.length} 项
              </Tag>
            )}
          </div>
        }
        extra={
          <Text type="secondary">
            共 {total} 个分类
          </Text>
        }
        styles={{ body: { padding: 0 } }}
      >
        {loading ? (
          <div className="text-center py-10">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="加载中..." />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-10">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无分类数据"
            >
              <Button type="primary" onClick={handleAddCategory}>
                添加第一个分类
              </Button>
            </Empty>
          </div>
        ) : (
          <>
            <Table
              rowKey="id"
              columns={getCategoryColumns(
                handleEdit,
                handleDelete,
                handleViewArticles,
              )}
              dataSource={categories}
              rowSelection={rowSelection}
              pagination={false}
              scroll={{ x: 1000 }}
              size="middle"
            />
            <div className="px-6 py-3">
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={total}
                onChange={handlePageChange}
                showSizeChanger
                showTotal={(total: number) => `共 ${total} 条`}
              />
            </div>
          </>
        )}
      </AdminCard>

      {/* 编辑模态框 */}
      <Modal
        title={isCreateMode ? "添加新分类" : "编辑分类"}
        open={editModalVisible}
        width={600}
        footer={null}
        onCancel={handleEditFormCancel}
        destroyOnHidden
      >
        <CategoryEditForm
          category={editingCategory}
          isCreateMode={isCreateMode}
          onSave={handleEditFormSave}
          onCancel={handleEditFormCancel}
        />
      </Modal>
    </AdminPage>
  );
};

export default AdminCategories;
