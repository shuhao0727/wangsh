import React, { useCallback, useEffect, useState } from "react";
import {
  Typography,
  Card,
  Space,
  Button,
  Row,
  Col,
  Divider,
  Table,
  Tag,
  Input,
  Form,
  Modal,
  Popconfirm,
  message,
  Spin,
  Empty,
  Pagination,
  Dropdown,
  InputNumber,
  Select,
  ModalProps,
} from "antd";
import {
  FolderOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  MoreOutlined,
  ReloadOutlined,
  FilterOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { categoryApi } from "@services";
import { logger } from "@services/logger";
import type { CategoryWithUsage, CategoryFilterParams } from "@services";

const { Text } = Typography;
const { Search } = Input;
const { Option } = Select;

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

      <Divider />
      <div style={{ textAlign: "right" }}>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {isCreateMode ? "创建分类" : "保存修改"}
          </Button>
        </Space>
      </div>
    </Form>
  );
};

// 表格列配置
const getCategoryColumns = (
  handleEdit: (record: CategoryWithUsage) => void,
  handleDelete: (id: number) => void,
) => [
  {
    title: "分类名称",
    dataIndex: "name",
    key: "name",
    width: 200,
    render: (text: string, record: CategoryWithUsage) => (
      <div>
        <div style={{ fontWeight: "bold" }}>{text}</div>
        <div style={{ fontSize: "12px", color: "var(--ws-color-text-secondary)" }}>{record.slug}</div>
      </div>
    ),
  },
  {
    title: "描述",
    dataIndex: "description",
    key: "description",
    width: 250,
    render: (description: string) => (
      <div style={{ color: "var(--ws-color-text-secondary)" }}>
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
      <Tag color={count > 0 ? "blue" : "default"} style={{ fontSize: "14px" }}>
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
        <div style={{ fontSize: "12px" }}>
          {dayjs(date).format("YYYY-MM-DD")}
        </div>
        <div style={{ fontSize: "10px", color: "var(--ws-color-text-secondary)" }}>
          {dayjs(date).format("HH:mm")}
        </div>
      </div>
    ),
  },
  {
    title: "操作",
    key: "action",
    width: 120,
    fixed: "right" as const,
    render: (_: any, record: CategoryWithUsage) => {
      return (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title={
              <div>
                <div>确定要删除这个分类吗？</div>
                <div
                  style={{ fontSize: "12px", color: "var(--ws-color-text-secondary)", marginTop: "4px" }}
                >
                  删除后不可恢复
                </div>
              </div>
            }
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" icon={<DeleteOutlined />} danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      );
    },
  },
];

interface CategoryManageModalProps extends Omit<
  ModalProps,
  "onOk" | "onCancel"
> {
  visible: boolean;
  onClose: () => void;
  onCategoryChange?: () => void; // 当分类发生变化时触发
}

const CategoryManageModal: React.FC<CategoryManageModalProps> = ({
  visible,
  onClose,
  onCategoryChange,
  ...modalProps
}) => {
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryWithUsage[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchParams, setSearchParams] = useState<CategoryFilterParams>({
    page: 1,
    size: 10,
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
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [minArticles, setMinArticles] = useState<number | undefined>(undefined);

  // 加载分类列表
  const loadCategories = useCallback(async (
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

      let next = categoriesWithUsage;
      if (typeof minArticles === "number") {
        next = next.filter((c) => (c.article_count || 0) >= minArticles);
      }
      if (sortBy) {
        const byName = (a: CategoryWithUsage, b: CategoryWithUsage) => String(a.name || "").localeCompare(String(b.name || ""));
        const byArticles = (a: CategoryWithUsage, b: CategoryWithUsage) => (a.article_count || 0) - (b.article_count || 0);
        const byCreated = (a: CategoryWithUsage, b: CategoryWithUsage) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf();
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
      setTotal(listData?.total || 0);
      setSelectedRowKeys([]);
    } catch (error) {
      logger.error("加载分类列表失败:", error);
      message.error("加载分类列表失败");
    } finally {
      setLoading(false);
    }
  }, [minArticles, searchParams, sortBy]);

  // 初始加载
  useEffect(() => {
    if (visible) {
      loadCategories();
    }
  }, [loadCategories, visible]);

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
    setSortBy(values.sortBy || undefined);
    setMinArticles(typeof values.minArticles === "number" ? values.minArticles : undefined);
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
      // 触发分类变化回调
      if (onCategoryChange) {
        onCategoryChange();
      }
    } catch (error: any) {
      logger.error("删除分类失败:", error);
      const errorMsg = error.response?.data?.detail || "删除分类失败";
      message.error(errorMsg);
    }
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
    // 触发分类变化回调
    if (onCategoryChange) {
      onCategoryChange();
    }
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
      // 触发分类变化回调
      if (onCategoryChange) {
        onCategoryChange();
      }
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
    <>
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center" }}>
            <FolderOutlined style={{ marginRight: "8px" }} />
            <span>分类管理</span>
          </div>
        }
        open={visible}
        onCancel={onClose}
        width="80%"
        style={{ top: 20 }}
        footer={null}
        destroyOnHidden
        {...modalProps}
      >
        <div className="category-manage-modal">
          {/* 搜索和操作栏 */}
          <Card
            size="small"
            style={{ marginBottom: "16px" }}
            styles={{ body: { padding: "16px" } }}
          >
            <Row gutter={16} align="middle">
              <Col flex="1">
                <Search
                  placeholder="搜索分类名称或slug..."
                  allowClear
                  enterButton={<SearchOutlined />}
                  size="middle"
                  onSearch={handleSearch}
                  style={{ maxWidth: "300px" }}
                />
              </Col>
              <Col>
                <Space>
                  <Button
                    icon={<FilterOutlined />}
                    onClick={() => setFilterVisible(!filterVisible)}
                    type={filterVisible ? "primary" : "default"}
                  >
                    筛选
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => loadCategories()}
                  >
                    刷新
                  </Button>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAddCategory}
                  >
                    新增分类
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* 筛选表单 */}
          {filterVisible && (
            <Card
              title="高级筛选"
              size="small"
              style={{ marginBottom: "16px" }}
              extra={
                <Button
                  type="link"
                  size="small"
                  onClick={() => setFilterVisible(false)}
                >
                  收起
                </Button>
              }
            >
              {renderFilterForm()}
            </Card>
          )}

          {/* 批量操作 */}
          {selectedRowKeys.length > 0 && (
            <Card
              size="small"
              style={{ marginBottom: "16px", background: "#e6f7ff" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <Text>
                    已选择 <Tag color="blue">{selectedRowKeys.length}</Tag>{" "}
                    个分类
                  </Text>
                </div>
                <Dropdown menu={batchMenu}>
                  <Button icon={<MoreOutlined />}>批量操作</Button>
                </Dropdown>
              </div>
            </Card>
          )}

          {/* 分类表格 */}
          <Card>
            {loading ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <Spin size="large" />
              </div>
            ) : categories.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无分类数据"
              >
                <Button type="primary" onClick={handleAddCategory}>
                  添加第一个分类
                </Button>
              </Empty>
            ) : (
              <>
                <Table
                  rowKey="id"
                  columns={getCategoryColumns(handleEdit, handleDelete)}
                  dataSource={categories}
                  rowSelection={rowSelection}
                  pagination={false}
                  scroll={{ x: 1000 }}
                  size="middle"
                />
                <div style={{ marginTop: "24px", textAlign: "center" }}>
                  <Pagination
                    current={currentPage}
                    pageSize={pageSize}
                    total={total}
                    onChange={handlePageChange}
                    showSizeChanger
                    showQuickJumper
                    showTotal={(total, range) =>
                      `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`
                    }
                  />
                </div>
              </>
            )}
          </Card>
        </div>
      </Modal>

      {/* 分类编辑模态框 */}
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
    </>
  );
};

export default CategoryManageModal;
