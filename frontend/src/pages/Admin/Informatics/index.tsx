import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { EditOutlined, PlusOutlined, ReloadOutlined, SyncOutlined } from "@ant-design/icons";
import { AdminCard, AdminPage } from "@components/Admin";
import { githubSyncApi, typstCategoriesApi, typstNotesApi } from "@services";
import type {
  GithubSyncRun,
  GithubSyncSettings,
  GithubSyncTaskStatus,
  TypstCategoryListItem,
  TypstNoteListItem,
} from "@services";

const { Text } = Typography;
const { Search } = Input;

const AdminInformatics: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  // 发布开关的行内loading集合
  const [publishingIds, setPublishingIds] = useState<Set<number>>(new Set());
  const [items, setItems] = useState<TypstNoteListItem[]>([]);
  const [categories, setCategories] = useState<TypstCategoryListItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [titleKeyword, setTitleKeyword] = useState<string>("");
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncSaving, setSyncSaving] = useState(false);
  const [syncTriggering, setSyncTriggering] = useState(false);
  const [syncRecompileTriggering, setSyncRecompileTriggering] = useState(false);
  const [syncSettings, setSyncSettings] = useState<GithubSyncSettings | null>(null);
  const [lastRun, setLastRun] = useState<GithubSyncRun | null>(null);
  const [syncTaskId, setSyncTaskId] = useState<string>("");
  const [syncTaskStatus, setSyncTaskStatus] = useState<GithubSyncTaskStatus | null>(null);
  const [syncResultShownTaskId, setSyncResultShownTaskId] = useState<string>("");

  const loadSync = useCallback(async (syncForm = true) => {
    setSyncLoading(true);
    try {
      const [settingsRes, runs] = await Promise.all([githubSyncApi.getSettings(), githubSyncApi.listRuns(1)]);
      setSyncSettings(settingsRes);
      setLastRun((runs || [])[0] || null);
      if (syncForm) {
        form.setFieldsValue({
          repo_url: settingsRes.repo_url,
          branch: settingsRes.branch,
          token: "",
          enabled: settingsRes.enabled,
          interval_hours: settingsRes.interval_hours,
          delete_mode: settingsRes.delete_mode,
        });
      }
    } catch (e: any) {
      message.error(e?.response?.data?.detail || e?.message || "加载 GitHub 同步配置失败");
    } finally {
      setSyncLoading(false);
    }
  }, [form]);

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

  useEffect(() => {
    if (syncModalOpen) {
      loadSync();
    }
  }, [syncModalOpen, loadSync]);

  useEffect(() => {
    if (!syncModalOpen || !syncTaskId) return;
    let stopped = false;
    const tick = async () => {
      try {
        const [taskStatus] = await Promise.all([githubSyncApi.getTaskStatus(syncTaskId), loadSync(false)]);
        if (stopped) return;
        setSyncTaskStatus(taskStatus);
        if (taskStatus.ready) {
          setSyncTaskId("");
          return;
        }
      } catch {
        return;
      }
    };
    tick();
    const timer = window.setInterval(tick, 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [syncModalOpen, syncTaskId, loadSync]);

  useEffect(() => {
    if (!syncTaskId || !syncTaskStatus?.ready || syncResultShownTaskId === syncTaskId) return;
    const created = syncTaskStatus.created_paths || [];
    const updated = syncTaskStatus.updated_paths || [];
    const deleted = syncTaskStatus.deleted_paths || [];
    const failed = syncTaskStatus.compile_failed || [];
    const compiledCount = (syncTaskStatus.compiled_note_ids || []).length;
    const pathPreview = (arr: string[]) => arr.slice(0, 8).join("\n");
    Modal.info({
      title: syncTaskStatus.successful ? "同步完成" : "同步结束（有失败）",
      width: 760,
      content: (
        <div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
          <div>新增：{created.length} 个</div>
          <div>更新：{updated.length} 个</div>
          <div>删除：{deleted.length} 个</div>
          <div>已编译：{compiledCount} 个</div>
          <div>编译失败：{failed.length} 个</div>
          {created.length > 0 ? <div style={{ marginTop: 8 }}>新增文件：{"\n"}{pathPreview(created)}</div> : null}
          {updated.length > 0 ? <div style={{ marginTop: 8 }}>更新文件：{"\n"}{pathPreview(updated)}</div> : null}
          {deleted.length > 0 ? <div style={{ marginTop: 8 }}>删除文件：{"\n"}{pathPreview(deleted)}</div> : null}
          {failed.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              编译失败：
              {"\n"}
              {failed
                .slice(0, 5)
                .map((x) => `${x.path || "-"}: ${x.error || "编译失败"}`)
                .join("\n")}
            </div>
          ) : null}
        </div>
      ),
    });
    setSyncResultShownTaskId(syncTaskId);
  }, [syncTaskId, syncTaskStatus, syncResultShownTaskId]);

  const openEditor = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const displayedItems = useMemo(() => {
    const kw = titleKeyword.trim().toLowerCase();
    const filtered = categoryFilter ? (items || []).filter((x) => (x.category_path || "") === categoryFilter) : items || [];
    const searched = kw ? filtered.filter((x) => String(x.title || "").toLowerCase().includes(kw)) : filtered;
    return [...searched].sort((a, b) => {
      const byTitle = String(a.title || "").localeCompare(String(b.title || ""), "en", {
        numeric: true,
        sensitivity: "base",
      });
      if (byTitle !== 0) return byTitle;
      return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
    });
  }, [items, categoryFilter, titleKeyword]);

  const columns: ColumnsType<TypstNoteListItem> = [
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      sorter: (a, b) =>
        String(a.title || "").localeCompare(String(b.title || ""), "en", {
          numeric: true,
          sensitivity: "base",
        }),
      sortDirections: ["ascend", "descend"],
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
      title: "发布",
      key: "published",
      width: 120,
      render: (_, r) => {
        const checked = !!r.published;
        const loading = publishingIds.has(r.id);
        return (
          <Switch
            checkedChildren="开"
            unCheckedChildren="关"
            checked={checked}
            loading={loading}
            disabled={loading}
            onChange={async (val) => {
              // 乐观更新
              const prev = !!r.published;
              setItems((list) => list.map((it) => (it.id === r.id ? { ...it, published: val } : it)));
              setPublishingIds((s) => new Set(s).add(r.id));
              try {
                const payload: Partial<{
                  title: string;
                  summary: string;
                  category_path: string;
                  published: boolean;
                }> = {
                  title: r.title,
                  // 仅当存在再传递，避免覆盖为undefined
                  ...(typeof r.summary !== "undefined" ? { summary: r.summary as any } : {}),
                  ...(typeof r.category_path !== "undefined" ? { category_path: r.category_path as any } : {}),
                  published: val,
                };
                const updated = await typstNotesApi.update(r.id, payload);
                // 成功后以返回为准刷新该行状态与更新时间
                setItems((list) =>
                  list.map((it) =>
                    it.id === r.id ? { ...it, published: !!updated.published, updated_at: updated.updated_at } : it,
                  ),
                );
                message.success(val ? "已发布" : "已停用");
              } catch (e: any) {
                // 回滚
                setItems((list) => list.map((it) => (it.id === r.id ? { ...it, published: prev } : it)));
                message.error(e?.response?.data?.detail || e?.message || "切换发布状态失败");
              } finally {
                setPublishingIds((s) => {
                  const next = new Set(s);
                  next.delete(r.id);
                  return next;
                });
              }
            }}
          />
        );
      },
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
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <Space>
          <Select
            value={categoryFilter || undefined}
            allowClear
            placeholder="按分类筛选"
            style={{ width: 280 }}
            options={categories.map((c) => ({ value: c.path, label: c.path }))}
            onChange={(v) => setCategoryFilter(v || "")}
          />
          <Search
            value={titleKeyword}
            allowClear
            placeholder="搜索标题..."
            style={{ width: 260 }}
            onChange={(e) => setTitleKeyword(e.target.value)}
          />
        </Space>
        <Space>
          <Button icon={<SyncOutlined />} onClick={() => setSyncModalOpen(true)}>
            GitHub同步
          </Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor("/admin/informatics/editor/new")}>
            新建笔记
          </Button>
        </Space>
      </div>

      <AdminCard styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={displayedItems}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
        />
      </AdminCard>

      <Modal
        title="GitHub 同步配置"
        open={syncModalOpen}
        width={760}
        onCancel={() => setSyncModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ enabled: false, interval_hours: 48, delete_mode: "unpublish" }}>
          <Form.Item name="repo_url" label="GitHub 仓库地址" rules={[{ required: true, message: "请输入仓库地址" }]}>
            <Input placeholder="https://github.com/shuhao0727/2-My-notes" />
          </Form.Item>
          <Space style={{ width: "100%", display: "flex", marginBottom: 8 }} align="start">
            <Form.Item style={{ flex: 1 }} name="branch" label="分支" rules={[{ required: true, message: "请输入分支" }]}>
              <Input placeholder="main" />
            </Form.Item>
            <Form.Item style={{ width: 180 }} name="interval_hours" label="同步周期(小时)" rules={[{ required: true, message: "请输入同步周期" }]}>
              <InputNumber min={1} max={24 * 30} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item style={{ width: 140 }} name="enabled" label="启用定时" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
          </Space>
          <Form.Item name="delete_mode" label="删除策略">
            <Select
              options={[
                { value: "unpublish", label: "仅下线（推荐）" },
                { value: "soft_delete", label: "软删除" },
              ]}
            />
          </Form.Item>
          <Form.Item name="token" label={`GitHub Token${syncSettings?.token_masked ? `（已保存：${syncSettings.token_masked}）` : ""}`}>
            <Input.Password placeholder="留空表示不修改已保存 Token" />
          </Form.Item>

          <Space style={{ marginBottom: 12 }}>
            <Button
              loading={syncLoading}
              onClick={async () => {
                await loadSync();
              }}
            >
              刷新状态
            </Button>
            <Button
              loading={syncSaving}
              type="primary"
              onClick={async () => {
                const v = await form.validateFields();
                setSyncSaving(true);
                try {
                  const saved = await githubSyncApi.saveSettings({
                    repo_url: v.repo_url,
                    branch: v.branch,
                    token: v.token || undefined,
                    enabled: !!v.enabled,
                    interval_hours: Number(v.interval_hours || 48),
                    delete_mode: v.delete_mode,
                  });
                  setSyncSettings(saved);
                  message.success("配置已保存");
                } catch (e: any) {
                  message.error(e?.response?.data?.detail || e?.message || "保存失败");
                } finally {
                  setSyncSaving(false);
                }
              }}
            >
              保存配置
            </Button>
            <Button
              onClick={async () => {
                const v = await form.validateFields(["repo_url", "branch", "token"]);
                const token = (v.token || "").trim();
                if (!token && !syncSettings?.token_configured) {
                  message.warning("请先输入 Token 或先保存过 Token");
                  return;
                }
                try {
                  await githubSyncApi.testConnection({
                    repo_url: v.repo_url,
                    branch: v.branch,
                    token: token || "__use_saved_token__",
                  });
                  message.success("连接成功");
                } catch (e: any) {
                  message.error(e?.response?.data?.detail || e?.message || "连接失败");
                }
              }}
            >
              测试连接
            </Button>
            <Button
              loading={syncTriggering}
              icon={<SyncOutlined />}
              onClick={async () => {
                setSyncTriggering(true);
                try {
                  const run = await githubSyncApi.trigger(false);
                  setLastRun(run);
                  const taskId = run.task_id || (run.status?.startsWith("queued:") ? run.status.split("queued:")[1] : "");
                  if (taskId) {
                    setSyncTaskId(taskId);
                    setSyncTaskStatus(null);
                  }
                  message.success("已触发同步");
                  await load();
                  await loadSync();
                } catch (e: any) {
                  message.error(e?.response?.data?.detail || e?.message || "触发同步失败");
                } finally {
                  setSyncTriggering(false);
                }
              }}
            >
              立即同步
            </Button>
            <Button
              loading={syncRecompileTriggering}
              icon={<ReloadOutlined />}
              onClick={async () => {
                setSyncRecompileTriggering(true);
                try {
                  const run = await githubSyncApi.trigger(false, true);
                  setLastRun(run);
                  const taskId = run.task_id || (run.status?.startsWith("queued:") ? run.status.split("queued:")[1] : "");
                  if (taskId) {
                    setSyncTaskId(taskId);
                    setSyncTaskStatus(null);
                  }
                  message.success("已触发全部重新编译");
                  await loadSync();
                } catch (e: any) {
                  message.error(e?.response?.data?.detail || e?.message || "触发全部重新编译失败");
                } finally {
                  setSyncRecompileTriggering(false);
                }
              }}
            >
              全部重新编译
            </Button>
          </Space>

          <div style={{ border: "1px solid #f0f0f0", borderRadius: 8, padding: 12 }}>
            <Text strong>最近同步状态</Text>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">运行状态：</Text>
              <Tag color={lastRun?.status?.includes("success") ? "green" : lastRun?.status?.includes("failed") ? "red" : "blue"}>
                {lastRun?.status || "暂无"}
              </Tag>
            </div>
            <div style={{ marginTop: 6 }}>
              <Text type="secondary">
                统计：新增 {lastRun?.created_count ?? 0}，更新 {lastRun?.updated_count ?? 0}，删除 {lastRun?.deleted_count ?? 0}，跳过 {lastRun?.skipped_count ?? 0}
              </Text>
            </div>
            {lastRun?.error_summary ? (
              <div style={{ marginTop: 6 }}>
                <Text type="danger">错误：{lastRun.error_summary}</Text>
              </div>
            ) : null}
            {lastRun?.finished_at ? (
              <div style={{ marginTop: 6 }}>
                <Text type="secondary">完成时间：{new Date(lastRun.finished_at).toLocaleString("zh-CN")}</Text>
              </div>
            ) : null}
            {syncTaskStatus ? (
              <div style={{ marginTop: 10 }}>
                <Progress
                  percent={syncTaskStatus.progress_percent}
                  status={syncTaskStatus.state === "FAILURE" ? "exception" : syncTaskStatus.ready ? "success" : "active"}
                />
                <div style={{ marginTop: 6 }}>
                  <Text type="secondary">
                    进度：{syncTaskStatus.progress_done}/{syncTaskStatus.progress_total || "?"}
                    {syncTaskStatus.progress_phase ? ` · 阶段 ${syncTaskStatus.progress_phase}` : ""}
                  </Text>
                </div>
                {syncTaskStatus.progress_current ? (
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary">当前文件：{syncTaskStatus.progress_current}</Text>
                  </div>
                ) : null}
                {syncTaskStatus.error ? (
                  <div style={{ marginTop: 4 }}>
                    <Text type="danger">任务错误：{syncTaskStatus.error}</Text>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Form>
      </Modal>
    </AdminPage>
  );
};

export default AdminInformatics;
