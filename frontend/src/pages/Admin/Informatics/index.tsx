import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { AdminCard, AdminPage } from "@components/Admin";
import { typstCategoriesApi, typstNotesApi } from "@services";
import type { TypstCategoryListItem, TypstNoteListItem } from "@services";

const { Text } = Typography;

const AdminInformatics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<TypstNoteListItem[]>([]);
  const [categories, setCategories] = useState<TypstCategoryListItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await typstNotesApi.list({ limit: 200 });
      setItems(res || []);
      try {
        const cats = await typstCategoriesApi.list();
        setCategories(cats || []);
      } catch {
        setCategories([]);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.detail || e?.message || "加载 Typst 笔记失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEditor = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const categorySortMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of categories || []) m.set(c.path, c.sort_order ?? 0);
    return m;
  }, [categories]);

  const displayedItems = useMemo(() => {
    const filtered = categoryFilter ? (items || []).filter((x) => (x.category_path || "") === categoryFilter) : items || [];
    return [...filtered].sort((a, b) => {
      const ao = categorySortMap.get((a.category_path || "").trim()) ?? 999999;
      const bo = categorySortMap.get((b.category_path || "").trim()) ?? 999999;
      if (ao !== bo) return ao - bo;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [items, categoryFilter, categorySortMap]);

  const columns: ColumnsType<TypstNoteListItem> = [
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: "分类",
      dataIndex: "category_path",
      key: "category_path",
      width: 220,
      render: (v: any) => (v ? <Tag>{String(v)}</Tag> : <Tag color="default">未分类</Tag>),
    },
    {
      title: "状态",
      key: "status",
      width: 180,
      render: (_, r) => (
        <Space size={8}>
          {r.published ? <Tag color="green">已发布</Tag> : <Tag>未发布</Tag>}
          {r.compiled_at ? <Tag color="blue">已编译</Tag> : <Tag>未编译</Tag>}
        </Space>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      key: "updated_at",
      width: 220,
      render: (v: string) => <Text type="secondary">{new Date(v).toLocaleString("zh-CN")}</Text>,
    },
    {
      title: "操作",
      key: "actions",
      width: 240,
      render: (_, r) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEditor(`/admin/informatics/editor/${r.id}`)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除？"
            description={`将删除「${r.title}」`}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try {
                await typstNotesApi.remove(r.id);
                message.success("已删除");
                await load();
              } catch (e: any) {
                message.error(e?.response?.data?.detail || e?.message || "删除失败");
              }
            }}
          >
            <Button danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AdminPage>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <Space>
          <Select
            value={categoryFilter || undefined}
            allowClear
            placeholder="按分类筛选"
            style={{ width: 280 }}
            options={categories.map((c) => ({ value: c.path, label: c.path }))}
            onChange={(v) => setCategoryFilter(v || "")}
          />
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor("/admin/informatics/editor/new")}>
            新建笔记
          </Button>
        </Space>
      </div>

      <AdminCard
        title="Typst 笔记"
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={displayedItems}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
        />
      </AdminCard>
    </AdminPage>
  );
};

export default AdminInformatics;
