import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Typography,
  Space,
  Button,
  Table,
  Tag,
  Input,
  Select,
  Modal,
  message,
  Switch,
  Dropdown,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MoreOutlined,
  FolderOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { articleApi, categoryApi } from "@services";
import { logger } from "@services/logger";
import type {
  ArticleWithRelations,
  ArticleFilterParams,
} from "@services";
import { AdminCard, AdminPage } from "@components/Admin";
import { subscribeArticleUpdated } from "@utils/articleUpdatedEvent";
import CategoryManageModal from "./CategoryManageModal";
import "./AdminArticles.css";

const { Text } = Typography;
const { Search } = Input;

// 表格列配置
const getArticleColumns = (
  handleEdit: (record: ArticleWithRelations) => void,
  handleDelete: (id: number) => void,
  handleTogglePublish: (id: number, published: boolean) => void,
  handleView: (slug: string) => void,
) => [
  {
    title: "标题",
    dataIndex: "title",
    key: "title",
    width: 300,
    ellipsis: true,
    render: (text: string, record: ArticleWithRelations) => (
      <div>
        <div style={{ fontWeight: "bold" }}>
          {text}
          {record.published ? (
            <Tag color="green" style={{ marginLeft: 8, fontSize: "10px" }}>
              已发布
            </Tag>
          ) : (
            <Tag color="orange" style={{ marginLeft: 8, fontSize: "10px" }}>
              草稿
            </Tag>
          )}
        </div>
        <div style={{ fontSize: "12px", color: "var(--ws-color-text-secondary)" }}>{record.slug}</div>
      </div>
    ),
  },
  {
    title: "分类",
    dataIndex: "category",
    key: "category",
    width: 150,
    render: (category: any) =>
      category ? (
        <Tag color="orange" style={{ cursor: "pointer" }}>
          {category.name}
        </Tag>
      ) : (
        <Text type="secondary">未分类</Text>
      ),
  },
  {
    title: "发布时间",
    dataIndex: "published",
    key: "published_time",
    width: 150,
    render: (published: boolean, record: ArticleWithRelations) => (
      <div>
        <div style={{ fontSize: "12px" }}>
          {published ? "已发布" : "未发布"}
        </div>
        <div style={{ fontSize: "10px", color: "var(--ws-color-text-secondary)" }}>
          更新: {dayjs(record.updated_at).format("MM-DD HH:mm")}
        </div>
      </div>
    ),
  },
  {
    title: "发布状态",
    dataIndex: "published",
    key: "published",
    width: 100,
    render: (published: boolean, record: ArticleWithRelations) => (
      <Switch
        checked={published}
        checkedChildren={<CheckCircleOutlined />}
        unCheckedChildren={<CloseCircleOutlined />}
        onChange={(checked) => handleTogglePublish(record.id, checked)}
      />
    ),
  },
  {
    title: "操作",
    key: "action",
    width: 120,
    fixed: "right" as const,
    render: (_: any, record: ArticleWithRelations) => {
      const menu = {
        items: [
          {
            key: "view",
            label: "预览文章",
            icon: <EyeOutlined />,
            onClick: () => handleView(record.slug),
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
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Dropdown menu={menu} trigger={["click"]}>
            <Button icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      );
    },
  },
];

const AdminArticles: React.FC = () => {
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState<ArticleWithRelations[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<ArticleFilterParams>({
    page: 1,
    size: 20,
    published_only: false, // 管理员可以看到所有文章
    include_relations: true,
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>(undefined);
  const [titleKeyword, setTitleKeyword] = useState<string>("");

  // 分类管理弹窗状态
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  // 加载文章列表
  const loadArticles = useCallback(async (params: ArticleFilterParams = searchParams) => {
    try {
      setLoading(true);
      const response = await articleApi.listArticles(params);
      // 注意：后端直接返回数据，没有ApiResponse包装，所以是response.data而不是response.data.data
      const listData = response.data;

      setArticles(listData?.articles || []);
      setTotal(listData?.total || 0);
      setSelectedRowKeys([]);
    } catch (error) {
      logger.error("加载文章列表失败:", error);
      message.error("加载文章列表失败");
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  const refreshTimerRef = useRef<number | null>(null);
  const lastRefreshAtRef = useRef(0);
  const seenSignalIdsRef = useRef<Map<string, number>>(new Map());

  const requestRefreshFromSignal = useCallback((signalId?: string) => {
    const now = Date.now();
    if (signalId) {
      const seen = seenSignalIdsRef.current;
      const prev = seen.get(signalId);
      if (prev && now - prev < 60_000) return;
      seen.set(signalId, now);
      const toDelete: string[] = [];
      seen.forEach((ts, id) => {
        if (now - ts > 60_000) toDelete.push(id);
      });
      for (let i = 0; i < toDelete.length; i++) seen.delete(toDelete[i]);
    }

    const minInterval = 500;
    const since = now - lastRefreshAtRef.current;
    if (since >= minInterval) {
      lastRefreshAtRef.current = now;
      loadArticles();
      return;
    }
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      lastRefreshAtRef.current = Date.now();
      loadArticles();
    }, minInterval - since);
  }, [loadArticles]);

  // 加载分类列表
  const loadCategories = useCallback(async () => {
    try {
      const response = await categoryApi.listCategories({
        page: 1,
        size: 100,
      });
      // 注意：后端直接返回数据，没有ApiResponse包装，所以是response.data.categories而不是response.data.data.categories
      const categoriesData = response.data?.categories || [];
      setCategories(categoriesData);
    } catch (error) {
      logger.error("加载分类列表失败:", error);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadArticles();
    loadCategories();
  }, [loadArticles, loadCategories]);

  useEffect(() => {
    const unsub = subscribeArticleUpdated((_payload, meta) => {
      requestRefreshFromSignal(meta?.id);
    });

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data: any = e.data;
      if (!data || data.type !== "article_updated") return;
      requestRefreshFromSignal(typeof data.id === "string" ? data.id : undefined);
    };

    window.addEventListener("message", onMessage);
    return () => {
      unsub();
      window.removeEventListener("message", onMessage);
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    };
  }, [requestRefreshFromSignal]);

  useEffect(() => {
    const onFocus = () => requestRefreshFromSignal();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") requestRefreshFromSignal();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [requestRefreshFromSignal]);

  const displayedArticles = React.useMemo(() => {
    const kw = titleKeyword.trim().toLowerCase();
    if (!kw) return articles;
    return (articles || []).filter((a) => {
      const t = String(a.title || "").toLowerCase();
      const s = String(a.slug || "").toLowerCase();
      return t.includes(kw) || s.includes(kw);
    });
  }, [articles, titleKeyword]);

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
    loadArticles(newParams);
  };

  // 处理编辑
  const handleEdit = (record: ArticleWithRelations) => {
    window.open(`/admin/articles/editor/${record.id}`, "_blank", "noopener,noreferrer");
  };

  // 处理删除
  const handleDelete = async (id: number) => {
    try {
      await articleApi.deleteArticle(id);
      message.success("文章删除成功");
      loadArticles();
    } catch (error) {
      logger.error("删除文章失败:", error);
      message.error("删除文章失败");
    }
  };

  // 处理发布状态切换
  const handleTogglePublish = async (id: number, published: boolean) => {
    try {
      await articleApi.togglePublishStatus(id, published);
      message.success(`文章已${published ? "发布" : "转为草稿"}`);

      // 重新加载文章列表，确保数据同步
      loadArticles();
    } catch (error) {
      logger.error("切换发布状态失败:", error);
      message.error("操作失败");
    }
  };

  // 处理查看文章
  const handleView = (slug: string) => {
    window.open(`/articles/${slug}`, "_blank");
  };

  // 处理添加文章
  const handleAddArticle = () => {
    window.open("/admin/articles/editor/new", "_blank", "noopener,noreferrer");
  };

  // 批量操作
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("请选择要删除的文章");
      return;
    }

    // 验证选中的文章ID是否存在于当前文章中
    const invalidIds = selectedRowKeys.filter(
      (id) => !articles.some((article) => article.id === id),
    );

    if (invalidIds.length > 0) {
      logger.warn("检测到无效的文章ID:", invalidIds);
      message.error(`选中的文章中包含无效ID，请刷新页面后重试`);
      return;
    }

    Modal.confirm({
      title: "确认批量删除",
      content: `确定要删除选中的 ${selectedRowKeys.length} 篇文章吗？此操作不可恢复。`,
      okText: "确认删除",
      okType: "danger",
      cancelText: "取消",
      async onOk() {
        try {
          setLoading(true);
          const successIds = [];
          const failedIds = [];

          // 批量删除逻辑 - 添加错误处理
          for (const id of selectedRowKeys) {
            try {
              await articleApi.deleteArticle(id as number);
              successIds.push(id);
            } catch (error: any) {
              logger.error(`删除文章 ${id} 失败:`, error);
              failedIds.push({
                id,
                error: error?.message || error?.toString() || "未知错误",
              });
            }
          }

          if (failedIds.length === 0) {
            message.success(`成功删除 ${successIds.length} 篇文章`);
          } else if (successIds.length > 0) {
            message.warning(
              `部分删除成功：成功删除 ${successIds.length} 篇，失败 ${failedIds.length} 篇`,
            );
          } else {
            message.error(`全部删除失败，请检查文章ID是否正确`);
          }

          // 重新加载文章列表
          loadArticles();
        } catch (error) {
          logger.error("批量删除失败:", error);
          message.error("批量删除操作失败");
        } finally {
          setLoading(false);
        }
      },
      onCancel() {
        logger.debug("用户取消批量删除");
      },
    });
  };

  const handleBatchPublish = async (published: boolean) => {
    if (selectedRowKeys.length === 0) {
      message.warning("请选择要操作的文章");
      return;
    }

    try {
      setLoading(true);
      for (const id of selectedRowKeys) {
        await articleApi.togglePublishStatus(id as number, published);
      }
      message.success(
        `成功${published ? "发布" : "转为草稿"} ${
          selectedRowKeys.length
        } 篇文章`,
      );
      loadArticles();
    } catch (error) {
      logger.error("批量操作失败:", error);
      message.error("批量操作失败");
    } finally {
      setLoading(false);
    }
  };

  // 表格行选择
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  // 批量操作菜单 - antd v6 使用 items 数组
  const batchMenu = {
    items: [
      {
        key: "publish",
        label: "批量发布",
        onClick: () => handleBatchPublish(true),
      },
      {
        key: "draft",
        label: "批量转为草稿",
        onClick: () => handleBatchPublish(false),
      },
      {
        type: "divider" as const,
      },
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
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <Space>
          <Select
            value={categoryFilter}
            allowClear
            placeholder="按分类筛选"
            style={{ width: 280 }}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(v) => {
              const next = typeof v === "number" ? v : undefined;
              setCategoryFilter(next);
              const newParams: ArticleFilterParams = {
                ...searchParams,
                page: 1,
                category_id: next,
              };
              setCurrentPage(1);
              setSearchParams(newParams);
              loadArticles(newParams);
            }}
          />
          <Search
            value={titleKeyword}
            allowClear
            placeholder="搜索标题..."
            style={{ width: 260 }}
            onChange={(e) => setTitleKeyword(e.target.value)}
            onSearch={(v) => setTitleKeyword(v)}
          />
        </Space>
        <Space>
          {selectedRowKeys.length > 0 && (
            <Dropdown menu={batchMenu}>
              <Button icon={<MoreOutlined />}>批量操作 ({selectedRowKeys.length})</Button>
            </Dropdown>
          )}
          <Button icon={<ReloadOutlined />} onClick={() => loadArticles()} loading={loading}>
            刷新
          </Button>
          <Button icon={<FolderOutlined />} onClick={() => setCategoryModalVisible(true)}>
            分类管理
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddArticle}>
            新建文章
          </Button>
        </Space>
      </div>

      <AdminCard styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          loading={loading}
          columns={getArticleColumns(handleEdit, handleDelete, handleTogglePublish, handleView)}
          dataSource={displayedArticles}
          rowSelection={rowSelection}
          scroll={{ x: 1300 }}
          size="middle"
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            onChange: handlePageChange,
          }}
        />
      </AdminCard>

      {/* 分类管理弹窗 */}
      <CategoryManageModal
        visible={categoryModalVisible}
        onClose={() => setCategoryModalVisible(false)}
        onCategoryChange={loadCategories}
      />
    </AdminPage>
  );
};

export default AdminArticles;
