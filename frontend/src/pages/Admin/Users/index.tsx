/**
 * 用户管理主页面
 * 使用自定义Hook和组件架构
 */

import React from "react";
import {
  Button,
  Dropdown,
  Input,
  Space,
  Table,
  Pagination,
  Select,
  Upload,
  Divider,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  DownOutlined,
  UploadOutlined,
  DeleteOutlined,
  UserOutlined,
} from "@ant-design/icons";

// 导入自定义Hook和组件
import { useUsers } from "./hooks/useUsers";
import { getUserColumns } from "./columns";
import UserForm from "./components/UserForm";
import UserDetailModal from "./components/UserDetailModal";
import { roleOptions, statusOptions } from "./data";
import { AdminPage, AdminTablePanel } from "@components/Admin";
import "./index.css";

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
      {/* 顶部工具栏 (Toolbar) - 类似于 PythonLab 的 CanvasToolbar */}
      <div
        className="admin-users-toolbar ws-responsive-toolbar"
      >
        <div className="ws-responsive-toolbar__group ws-responsive-toolbar__group--grow">
          <Space size={8} wrap>
            <Search
              placeholder="搜索用户..."
              allowClear
              size="middle"
              value={state.searchKeyword}
              onChange={(e) => actions.handleSearch(e.target.value)}
              onSearch={actions.handleSearch}
              className="admin-users-search"
              prefix={<SearchOutlined style={{ color: "rgba(0,0,0,0.25)" }} />}
            />
            <Select
              placeholder="角色"
              className="admin-users-select"
              allowClear
              size="middle"
              onChange={(value) => actions.handleRoleFilter(value as string)}
              bordered={false}
              showArrow
            >
              {roleOptions.map((role) => (
                <Option key={role.value} value={role.value}>
                  {role.label}
                </Option>
              ))}
            </Select>
            <Select
              placeholder="状态"
              className="admin-users-select"
              allowClear
              size="middle"
              onChange={(value) => actions.handleStatusFilter(value as boolean)}
              bordered={false}
              showArrow
            >
              {statusOptions.map((status) => (
                <Option key={String(status.value)} value={status.value}>
                  {status.label}
                </Option>
              ))}
            </Select>
          </Space>
        </div>

        <Space size={4} wrap className="ws-responsive-toolbar__group">
          <Button type="text" icon={<ReloadOutlined />} onClick={actions.handleReset} title="重置" />
          <Dropdown
            menu={{
              items: [
                {
                  key: "xlsx",
                  label: "下载 XLSX 模板",
                  onClick: () => actions.handleDownloadTemplate("xlsx"),
                },
                {
                  key: "csv",
                  label: "下载 CSV 模板",
                  onClick: () => actions.handleDownloadTemplate("csv"),
                },
              ],
            }}
          >
            <Button type="text" icon={<DownloadOutlined />} title="下载模板">
              模板
              <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />
            </Button>
          </Dropdown>
          <Upload
            beforeUpload={actions.handleFileUpload}
            accept=".xlsx,.csv,.txt"
            showUploadList={false}
          >
            <Button type="text" icon={<UploadOutlined />} title="导入用户" />
          </Upload>
          <Divider orientation="vertical" />
          {state.selectedRowKeys.length > 0 && (
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={actions.handleBatchDelete}
              title="批量删除"
            >
              删除 ({state.selectedRowKeys.length})
            </Button>
          )}
          <Button
            type="primary"
            size="middle"
            icon={<PlusOutlined />}
            onClick={actions.handleAddUser}
          >
            添加用户
          </Button>
        </Space>
      </div>

      {/* 表格区域 */}
      <div className="admin-users-table-wrap">
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
                size="small"
                showTotal={(total) => `共 ${total} 条`}
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
            scroll={{ x: 1000, y: "calc(100vh - 200px)" }} // Dynamic height calculation
            size="middle"
            loading={state.loading}
            bordered={false}
          />
        </AdminTablePanel>
      </div>

      {/* 弹窗组件 */}
      <UserForm
        visible={state.formVisible}
        editingUser={state.editingUser}
        onSubmit={actions.handleFormSubmit}
        onCancel={closeForm}
      />

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
