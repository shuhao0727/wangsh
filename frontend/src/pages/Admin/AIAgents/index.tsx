/**
 * AI智能体管理页面 - 真实数据版
 * 连接后端数据库，支持完整的CRUD操作和测试功能
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  Table,
  Modal,
  Popconfirm,
  message,
  Pagination,
  Input,
} from "antd";
import { DeleteOutlined, ThunderboltOutlined } from "@ant-design/icons";

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

const AdminAIAgents: React.FC = () => {
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
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
        message.error(response.message || "加载智能体列表失败");
        setAgents([]);
        setTotal(0);
      }
    } catch (error) {
      logger.error("加载智能体列表失败:", error);
      message.error("加载智能体列表失败");
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
    setCurrentPage(page);
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
        message.success("智能体删除成功");
      } else {
        message.error(response.message || "删除智能体失败");
      }
    } catch (error) {
      logger.error("删除智能体失败:", error);
      message.error("删除智能体失败");
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
        message.success(`智能体已${isActive ? "启用" : "停用"}`);
      } else {
        message.error(response.message || "更新智能体状态失败");
      }
    } catch (error) {
      logger.error("更新智能体状态失败:", error);
      message.error("更新智能体状态失败");
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
        const response = await aiAgentsApi.updateAgent(editingAgent.id, {
          name: values.name,
          agent_type: values.agent_type,
          model_name: values.model_name,
          api_endpoint: values.api_endpoint,
          api_key: values.api_key,
          is_active: values.is_active,
        });
        
        if (response.success) {
          // 重新加载列表
          await loadAgents();
          message.success("智能体信息更新成功");
        } else {
          message.error(response.message || "更新智能体信息失败");
          return;
        }
      } else {
        // 创建新智能体
        const response = await aiAgentsApi.createAgent({
          name: values.name,
          agent_type: values.agent_type || "general",
          model_name: values.model_name,
          api_endpoint: values.api_endpoint,
          api_key: values.api_key,
          is_active: values.is_active !== undefined ? values.is_active : true,
        });
        
        if (response.success) {
          // 重新加载列表
          await loadAgents();
          message.success("智能体添加成功");
        } else {
          message.error(response.message || "创建智能体失败");
          return;
        }
      }

      setFormVisible(false);
    } catch (error) {
      logger.error("保存智能体信息失败:", error);
      message.error("保存智能体信息失败");
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
      // 弹出测试对话框
      Modal.confirm({
        title: `测试智能体: ${name}`,
        content: (
          <div>
            <p>请输入测试消息:</p>
            <Input.TextArea
              placeholder="例如: 你好，请介绍一下你自己"
              rows={4}
              id="test-message-input"
            />
          </div>
        ),
        icon: <ThunderboltOutlined />,
        okText: "发送测试",
        cancelText: "取消",
        async onOk() {
          const testMessageInput = document.getElementById("test-message-input") as HTMLTextAreaElement;
          const testMessage = testMessageInput?.value?.trim();
          
          if (!testMessage) {
            message.warning("请输入测试消息");
            return Promise.reject();
          }

          try {
            const response = await aiAgentsApi.testAgent(id, testMessage);
            if (response.success) {
              Modal.success({
                title: "测试成功",
                content: (
                  <div>
                    <p>{response.data.message}</p>
                    {response.data.response_time && (
                      <p>响应时间: {response.data.response_time.toFixed(2)}ms</p>
                    )}
                  </div>
                ),
              });
            } else {
              Modal.error({
                title: "测试失败",
                content: response.message,
              });
            }
          } catch (error: any) {
            Modal.error({
              title: "测试失败",
              content: error.message || "智能体测试失败",
            });
          }
        },
      });
    } catch (error) {
      console.error("测试智能体失败:", error);
      message.error("测试智能体失败");
    }
  };

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning("请选择要删除的智能体");
      return;
    }

    Modal.confirm({
      title: "确认批量删除",
      content: `确定要删除选中的 ${selectedRowKeys.length} 个智能体吗？此操作不可恢复。`,
      okText: "确认删除",
      okType: "danger",
      cancelText: "取消",
      async onOk() {
        try {
          setLoading(true);
          
          // 循环删除每个选中的智能体
          let successCount = 0;
          let errorCount = 0;
          
          for (const id of selectedRowKeys) {
            const response = await aiAgentsApi.deleteAgent(id as number);
            if (response.success) {
              successCount++;
            } else {
              errorCount++;
            }
          }
          
          // 重新加载列表
          await loadAgents();
          setSelectedRowKeys([]);
          
          if (errorCount === 0) {
            message.success(`成功删除 ${successCount} 个智能体`);
          } else if (successCount > 0) {
            message.warning(`成功删除 ${successCount} 个智能体，${errorCount} 个删除失败`);
          } else {
            message.error(`批量删除失败，所有 ${errorCount} 个智能体删除失败`);
          }
        } catch (error) {
          logger.error("批量删除失败:", error);
          message.error("批量删除失败");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 表格行选择
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
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

  return (
    <AdminPage>
      {/* 标题和操作栏 */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        {selectedRowKeys.length > 0 && (
          <Popconfirm
            title="确认批量删除"
            description={`确定要删除选中的 ${selectedRowKeys.length} 个智能体吗？`}
            onConfirm={handleBatchDelete}
            okText="确认"
            cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />}>
              批量删除 ({selectedRowKeys.length})
            </Button>
          </Popconfirm>
        )}
      </div>

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
      <AdminTablePanel
        loading={loading}
        isEmpty={agents.length === 0}
        emptyDescription={searchKeyword ? "未找到匹配的智能体" : "暂无智能体数据"}
        emptyAction={
          <Button type="primary" onClick={handleAddAgent}>
            添加第一个智能体
          </Button>
        }
        pagination={
          agents.length > 0 ? (
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={total}
              onChange={handlePageChange}
              showSizeChanger
              showQuickJumper
              showTotal={(total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`}
            />
          ) : null
        }
      >
        <Table
          rowKey="id"
          columns={getAgentColumns(
            handleEdit,
            handleDelete,
            handleToggleActive,
            handleViewDetails,
            handleTestAgent,
          )}
          dataSource={agents}
          rowSelection={rowSelection}
          pagination={false}
          scroll={{ x: 1200 }}
          size="middle"
        />
      </AdminTablePanel>

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
