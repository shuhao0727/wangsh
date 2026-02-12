/**
 * 用户管理主页面
 * 使用自定义Hook和组件架构
 */

import React from "react";
import {
  Button,
  Input,
  Space,
  Row,
  Col,
  Table,
  Pagination,
  Select,
  Upload,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";

// 导入自定义Hook和组件
import { useUsers } from "./hooks/useUsers";
import { getUserColumns } from "./columns";
import UserForm from "./components/UserForm";
import UserDetailModal from "./components/UserDetailModal";
import { roleOptions, statusOptions } from "./data";
import { AdminCard, AdminPage, AdminTablePanel } from "@components/Admin";

const { Search } = Input;
const { Option } = Select;

const AdminUsers: React.FC = () => {
  // 使用自定义Hook管理状态和逻辑
  const { state, actions, closeForm, closeDetail } = useUsers();

  // 表格配置
  const columns = getUserColumns({
    handleEdit: actions.handleEdit,
    handleDelete: actions.handleDelete,
    handleView: actions.handleView,
  });

  // 表格行选择配置
  const rowSelection = {
    selectedRowKeys: state.selectedRowKeys,
    onChange: actions.setSelectedRowKeys,
  };

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
        {state.selectedRowKeys.length > 0 && (
          <Button
            danger
            icon={<DownloadOutlined />}
            onClick={actions.handleBatchDelete}
          >
            批量删除 ({state.selectedRowKeys.length})
          </Button>
        )}
      </div>

      {/* 搜索和操作栏 */}
      <AdminCard
        size="small"
        style={{ marginBottom: "16px" }}
        styles={{ body: { padding: "16px" } }}
        accentColor="var(--ws-color-primary)"
        gradient="var(--ws-color-surface)"
      >
        <Row gutter={16} align="middle">
          <Col flex="1">
            <Search
              placeholder="搜索学号、姓名、班级或学年..."
              allowClear
              enterButton={<SearchOutlined />}
              size="middle"
              value={state.searchKeyword}
              onChange={(e) => actions.handleSearch(e.target.value)}
              onSearch={actions.handleSearch}
              style={{ maxWidth: "400px" }}
            />
          </Col>
          <Col>
            <Space>
              {/* 筛选条件 */}
              <Select
                placeholder="角色筛选"
                style={{ width: 120 }}
                allowClear
                onChange={(value) => actions.handleRoleFilter(value as string)}
              >
                {roleOptions.map((role) => (
                  <Option key={role.value} value={role.value}>
                    {role.label}
                  </Option>
                ))}
              </Select>

              <Select
                placeholder="状态筛选"
                style={{ width: 120 }}
                allowClear
                onChange={(value) =>
                  actions.handleStatusFilter(value as boolean)
                }
              >
                {statusOptions.map((status) => (
                  <Option key={String(status.value)} value={status.value}>
                    {status.label}
                  </Option>
                ))}
              </Select>

              <Button icon={<ReloadOutlined />} onClick={actions.handleReset}>
                重置
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={actions.handleDownloadTemplate}
              >
                下载模板
              </Button>
              <Upload
                beforeUpload={actions.handleFileUpload}
                accept=".xlsx,.xls,.csv"
                showUploadList={false}
              >
                <Button icon={<UploadOutlined />}>导入用户</Button>
              </Upload>
              {state.selectedRowKeys.length > 0 && (
                <Button
                  danger
                  icon={<DownloadOutlined />}
                  onClick={actions.handleBatchDelete}
                >
                  批量删除 ({state.selectedRowKeys.length})
                </Button>
              )}
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={actions.handleAddUser}
              >
                添加用户
              </Button>
            </Space>
          </Col>
        </Row>
      </AdminCard>

      {/* 用户表格 */}
      <AdminTablePanel
        loading={state.loading}
        isEmpty={state.users.length === 0}
        emptyDescription={state.searchKeyword ? "未找到匹配的用户" : "暂无用户数据"}
        emptyAction={
          <Button type="primary" onClick={actions.handleAddUser}>
            添加第一个用户
          </Button>
        }
        pagination={
          state.users.length > 0 ? (
            <Pagination
              current={state.currentPage}
              pageSize={state.pageSize}
              total={state.total}
              onChange={actions.handlePageChange}
              showSizeChanger
              showQuickJumper
              showTotal={(total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`}
            />
          ) : null
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={state.users}
          rowSelection={rowSelection}
          pagination={false}
          scroll={{ x: 1000 }}
          size="middle"
          loading={state.loading}
        />
      </AdminTablePanel>

      {/* 用户表单弹窗 */}
      <UserForm
        visible={state.formVisible}
        editingUser={state.editingUser}
        onSubmit={actions.handleFormSubmit}
        onCancel={closeForm}
      />

      {/* 用户详情弹窗 */}
      <UserDetailModal
        visible={state.detailVisible}
        currentUser={state.currentUser}
        onCancel={closeDetail}
        onEdit={actions.handleEdit}
      />
    </AdminPage>
  );
};

export default AdminUsers;
