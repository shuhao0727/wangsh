/**
 * AI智能体管理页面 - 真实数据版
 * 连接后端数据库，支持完整的CRUD操作和测试功能
 */
import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  type RowSelectionState,
  type Updater,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useAdminSSE } from "@hooks/useAdminSSE";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTablePagination } from "@/components/ui/data-table";

// 导入组件
import { getAgentColumns } from "./components/columns";
import AgentForm from "./components/AgentForm";
import AgentDetail from "./components/AgentDetail";
import StatisticsCards from "./components/StatisticsCards";
import SearchBar from "./components/SearchBar";

// 导入类型和API
import type { AIAgent, AgentStatisticsData } from "@services/znt/types";
import { aiAgentsApi } from "@services/agents";
import { logger } from "@services/logger";
import { AdminPage, AdminTablePanel } from "@components/Admin";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/constants/tableDefaults";

const AdminAIAgents: React.FC = () => {
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [statisticsData, setStatisticsData] = useState<AgentStatisticsData | null>(null);

  // 弹窗状态
  const [formVisible, setFormVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<AIAgent | null>(null);

  // 加载智能体列表 - 使用真实API数据
  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);

      // 调用真实API
      const response = await aiAgentsApi.getAgents({
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
        search: searchKeyword.trim() || undefined,
        agent_type: selectedType !== "all" ? selectedType : undefined,
      });

      if (response.success) {
        setAgents(response.data.items);
        setTotal(response.data.total);
        setSelectedRowKeys([]);
      } else {
        showMessage.error(response.message || "加载智能体列表失败");
        setAgents([]);
        setTotal(0);
      }
    } catch (error) {
      logger.error("加载智能体列表失败:", error);
      showMessage.error("加载智能体列表失败");
      setAgents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchKeyword, selectedType]);

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setCurrentPage(1);
  };

  // 处理重置
  const handleReset = () => {
    setSearchKeyword("");
    setSelectedType("all");
    setCurrentPage(1);
  };

  // 处理分页变化
  const handlePageChange = (page: number, size?: number) => {
    setCurrentPage(Math.max(1, page));
    if (size) setPageSize(size);
  };

  // 处理添加智能体
  const handleAddAgent = () => {
    setEditingAgent(null);
    setFormVisible(true);
  };

  // 处理编辑智能体
  const handleEdit = (record: AIAgent) => {
    setEditingAgent(record);
    setFormVisible(true);
  };

  // 处理删除智能体
  const handleDelete = async (id: number) => {
    try {
      setLoading(true);
      
      // 调用真实API删除
      const response = await aiAgentsApi.deleteAgent(id);
      
      if (response.success) {
        // 重新加载列表
        await loadAgents();
        showMessage.success("智能体删除成功");
      } else {
        showMessage.error(response.message || "删除智能体失败");
      }
    } catch (error) {
      logger.error("删除智能体失败:", error);
      showMessage.error("删除智能体失败");
    } finally {
      setLoading(false);
    }
  };

  // 处理切换激活状态
  const handleToggleActive = async (id: number, isActive: boolean) => {
    try {
      setLoading(true);

      // 调用真实API更新状态
      const response = await aiAgentsApi.updateAgent(id, { is_active: isActive });
      
      if (response.success) {
        // 重新加载列表
        await loadAgents();
        showMessage.success(`智能体已${isActive ? "启用" : "停用"}`);
      } else {
        showMessage.error(response.message || "更新智能体状态失败");
      }
    } catch (error) {
      logger.error("更新智能体状态失败:", error);
      showMessage.error("更新智能体状态失败");
    } finally {
      setLoading(false);
    }
  };

  // 处理表单提交
  const handleFormSubmit = async (values: any) => {
    try {
      setLoading(true);

      if (editingAgent) {
        // 更新现有智能体
        // model_name 可能是数组（tags模式），需要取第一个值
        const modelName = Array.isArray(values.model_name)
          ? (values.model_name[0] ?? "")
          : (values.model_name || "");
        const response = await aiAgentsApi.updateAgent(editingAgent.id, {
          name: values.name,
          agent_type: values.agent_type,
          description: values.description || undefined,
          model_name: modelName || undefined,
          system_prompt: values.system_prompt || undefined,
          api_endpoint: values.api_endpoint,
          api_key: values.api_key || undefined,
          is_active: values.is_active,
        });
        
        if (response.success) {
          // 重新加载列表
          await loadAgents();
          showMessage.success("智能体信息更新成功");
        } else {
          showMessage.error(response.message || "更新智能体信息失败");
          return;
        }
      } else {
        // 创建新智能体
        const createModelName = Array.isArray(values.model_name)
          ? (values.model_name[0] ?? "")
          : (values.model_name || "");
        const response = await aiAgentsApi.createAgent({
          name: values.name,
          agent_type: values.agent_type || "general",
          description: values.description || undefined,
          model_name: createModelName || undefined,
          system_prompt: values.system_prompt || undefined,
          api_endpoint: values.api_endpoint || undefined,
          api_key: values.api_key || undefined,
          is_active: values.is_active !== undefined ? values.is_active : true,
        });
        
        if (response.success) {
          // 重新加载列表
          await loadAgents();
          showMessage.success("智能体添加成功");
        } else {
          showMessage.error(response.message || "创建智能体失败");
          return;
        }
      }

      setFormVisible(false);
    } catch (error) {
      logger.error("保存智能体信息失败:", error);
      showMessage.error("保存智能体信息失败");
    } finally {
      setLoading(false);
    }
  };

  // 处理查看详情
  const handleViewDetails = (record: AIAgent) => {
    setCurrentAgent(record);
    setDetailVisible(true);
  };

  // 处理测试智能体
  const handleTestAgent = async (id: number, name: string) => {
    try {
      const input = window.prompt(
        `测试智能体: ${name}\n请输入测试消息`,
        "你好，请介绍一下你自己",
      );
      if (input == null) return;

      const testMessage = input.trim();
      if (!testMessage) {
        showMessage.warning("请输入测试消息");
        return;
      }

      const response = await aiAgentsApi.testAgent(id, testMessage);
      if (!response.success) {
        showMessage.error(response.message || "测试失败");
        return;
      }
      const testData = response.data as { message?: string; response_time?: number };
      showMessage.success(`测试成功${testData.response_time ? `（${testData.response_time.toFixed(2)}ms）` : ""}`);
      if (testData.message) {
        showMessage.info(testData.message);
      }
    } catch (error) {
      logger.error("测试智能体失败:", error);
      showMessage.error("测试智能体失败");
    }
  };

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      showMessage.warning("请选择要删除的智能体");
      return;
    }
    if (!window.confirm(`确定要删除选中的 ${selectedRowKeys.length} 个智能体吗？此操作不可恢复。`)) {
      return;
    }

    const run = async () => {
      try {
        setLoading(true);

        let successCount = 0;
        let errorCount = 0;

        for (const id of selectedRowKeys) {
          try {
            const response = await aiAgentsApi.deleteAgent(id);
            if (response.success) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch {
            errorCount++;
          }
        }

        await loadAgents();
        setSelectedRowKeys([]);

        if (errorCount === 0) {
          showMessage.success(`成功删除 ${successCount} 个智能体`);
        } else if (successCount > 0) {
          showMessage.warning(`成功删除 ${successCount} 个智能体，${errorCount} 个删除失败`);
        } else {
          showMessage.error(`批量删除失败，所有 ${errorCount} 个智能体删除失败`);
        }
      } catch (error) {
        logger.error("批量删除失败:", error);
        showMessage.error("批量删除失败");
      } finally {
        setLoading(false);
      }
    };

    void run();
  };

  // 加载统计数据
  const loadStatistics = useCallback(async () => {
    try {
      const response = await aiAgentsApi.getAgentStatistics();
      if (response.success) {
        setStatisticsData(response.data);
      }
    } catch (error) {
      logger.error("加载统计数据失败:", error);
    }
  }, []);

  // 页面加载时获取数据
  useEffect(() => {
    loadAgents();
    loadStatistics();
  }, [loadAgents, loadStatistics]);

  // SSE 实时更新
  useAdminSSE('agent_changed', loadAgents);

  const baseColumns = useMemo(
    () =>
      getAgentColumns(
        handleEdit,
        handleDelete,
        handleToggleActive,
        handleViewDetails,
        handleTestAgent,
      ),
    [handleDelete, handleEdit, handleTestAgent, handleToggleActive],
  );

  const rowSelection = useMemo<RowSelectionState>(() => {
    const selectedIds = new Set(selectedRowKeys.map((id) => String(id)));
    return agents.reduce<RowSelectionState>((acc, agent) => {
      const id = String(agent.id);
      if (selectedIds.has(id)) {
        acc[id] = true;
      }
      return acc;
    }, {});
  }, [agents, selectedRowKeys]);

  const handleRowSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      const nextSelection =
        typeof updater === "function" ? updater(rowSelection) : updater;
      const nextKeys = Object.keys(nextSelection)
        .filter((key) => nextSelection[key])
        .map((key) => Number(key));
      setSelectedRowKeys(nextKeys);
    },
    [rowSelection],
  );

  const columns = useMemo<ColumnDef<AIAgent>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              aria-label="选择当前页全部智能体"
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
              }
              onCheckedChange={(checked) =>
                table.toggleAllPageRowsSelected(checked === true)
              }
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              aria-label={`选择智能体 ${row.original.name}`}
              checked={row.getIsSelected()}
              onCheckedChange={(checked) => row.toggleSelected(checked === true)}
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
        size: 44,
        meta: { className: "w-11 align-middle" },
      },
      ...baseColumns,
    ],
    [baseColumns],
  );

  const table = useReactTable({
    data: agents,
    columns,
    state: { rowSelection },
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    onRowSelectionChange: handleRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminPage scrollable={false}>
      {/* 统计卡片 */}
      <StatisticsCards 
        data={statisticsData || {
          total: 0,
          generalCount: 0,
          difyCount: 0,
          activeCount: 0,
          total_agents: 0,
          active_agents: 0,
          deleted_agents: 0,
          api_errors: 0,
        }} 
      />

      {/* 搜索和操作栏 */}
      <SearchBar
        searchKeyword={searchKeyword}
        selectedType={selectedType}
        selectedRowKeys={selectedRowKeys}
        onSearchChange={setSearchKeyword}
        onSearch={handleSearch}
        onTypeChange={setSelectedType}
        onReset={handleReset}
        onBatchDelete={handleBatchDelete}
        onAddAgent={handleAddAgent}
      />

      {/* 智能体表格 */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <AdminTablePanel
            loading={loading}
            isEmpty={agents.length === 0}
            emptyDescription={searchKeyword ? "未找到匹配的智能体" : "暂无智能体数据"}
            emptyAction={
              <Button onClick={handleAddAgent}>
                添加第一个智能体
              </Button>
            }
          >
            <DataTable table={table} className="h-full" tableClassName="min-w-[1400px]" />
          </AdminTablePanel>
        </div>
        {agents.length > 0 ? (
          <div className="mt-2 flex justify-end border-t border-border-secondary pt-3">
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
              onPageChange={handlePageChange}
            />
          </div>
        ) : null}
      </div>

      {/* 智能体表单弹窗 */}
      <AgentForm
        visible={formVisible}
        editingAgent={editingAgent}
        onSubmit={handleFormSubmit}
        onCancel={() => setFormVisible(false)}
      />

      {/* 智能体详情弹窗 */}
      <AgentDetail
        visible={detailVisible}
        agent={currentAgent}
        onClose={() => setDetailVisible(false)}
      />
    </AdminPage>
  );
};

export default AdminAIAgents;
