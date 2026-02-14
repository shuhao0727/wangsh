/**
 * 后端管理页面
 * 只有超级管理员可以访问
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Statistic,
  Divider,
  Tabs,
  Button,
  Table,
  Tag,
  Alert,
  Space,
  Descriptions,
  Spin,
} from "antd";
import {
  UserOutlined,
  DatabaseOutlined,
  SettingOutlined,
  SafetyOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import useAuth from "@hooks/useAuth";

// 用户数据接口
interface UserData {
  id: number;
  username: string;
  is_active: boolean;
  is_superuser: boolean;
  full_name: string;
  created_at: string;
}

// 系统统计接口
interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  superAdmins: number;
  databaseSize: string;
  uptime: string;
  apiRequests: number;
}

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    activeUsers: 0,
    superAdmins: 0,
    databaseSize: "0 MB",
    uptime: "0分钟",
    apiRequests: 0,
  });

  // 加载用户数据
  const loadUserData = useCallback(async () => {
    try {
      // 这里应该调用API获取用户列表，暂时模拟数据
      const mockUsers: UserData[] = [
        {
          id: 1,
          username: "admin",
          is_active: true,
          is_superuser: true,
          full_name: "系统超级管理员",
          created_at: "2026-02-03T05:57:37.780150Z",
        },
        {
          id: 2,
          username: "user1",
          is_active: true,
          is_superuser: false,
          full_name: "普通用户1",
          created_at: "2026-02-03T06:00:00.000000Z",
        },
        {
          id: 3,
          username: "user2",
          is_active: false,
          is_superuser: false,
          full_name: "普通用户2",
          created_at: "2026-02-03T06:30:00.000000Z",
        },
      ];

      setUsers(mockUsers);

      // 计算统计信息
      setStats({
        totalUsers: mockUsers.length,
        activeUsers: mockUsers.filter((u) => u.is_active).length,
        superAdmins: mockUsers.filter((u) => u.is_superuser).length,
        databaseSize: "7.7 MB", // 从API获取实际数据
        uptime: "约1小时", // 从API获取实际数据
        apiRequests: 1245, // 从API获取实际数据
      });

      setLoading(false);
    } catch (error) {
      console.error("加载用户数据失败:", error);
      setLoading(false);
    }
  }, []);

  // 检查权限 - 如果不是超级管理员，重定向到首页
  useEffect(() => {
    if (!auth.isLoading && !auth.isSuperAdmin()) {
      navigate("/home");
    }
  }, [auth.isLoading, auth.isSuperAdmin, navigate]);

  // 初始化加载
  useEffect(() => {
    if (auth.isSuperAdmin && auth.isSuperAdmin()) {
      loadUserData();
    }
  }, [auth.isSuperAdmin, loadUserData]);

  // 如果正在加载或不是管理员，显示加载中
  if (auth.isLoading || loading) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <Spin size="large" tip="加载管理员面板..." />
      </div>
    );
  }

  // 用户表格列定义
  const userColumns = [
    {
      title: "用户ID",
      dataIndex: "id",
      key: "id",
      width: 80,
    },
    {
      title: "用户名",
      dataIndex: "username",
      key: "username",
      width: 120,
    },
    {
      title: "全名",
      dataIndex: "full_name",
      key: "full_name",
      width: 150,
    },
    {
      title: "状态",
      key: "status",
      width: 100,
      render: (_: any, record: UserData) => (
        <Space>
          {record.is_active ? (
            <Tag icon={<CheckCircleOutlined />} color="success">
              活跃
            </Tag>
          ) : (
            <Tag icon={<WarningOutlined />} color="error">
              禁用
            </Tag>
          )}
          {record.is_superuser && (
            <Tag icon={<SafetyOutlined />} color="purple">
              管理员
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (date: string) => new Date(date).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "action",
      width: 150,
      render: () => (
        <Space size="small">
          <Button type="link" size="small">
            编辑
          </Button>
          <Button type="link" size="small" danger>
            禁用
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div
      className="admin-page"
      style={{ maxWidth: "1400px", margin: "0 auto", padding: "20px" }}
    >
      {/* 权限警告 */}
      {!auth.isSuperAdmin() && (
        <Alert
          title="权限不足"
          description="您没有权限访问后端管理页面。只有超级管理员可以访问此页面。"
          type="error"
          showIcon
          style={{ marginBottom: "24px" }}
        />
      )}

      {/* 系统概览统计卡片 */}
      <Row gutter={[24, 24]} style={{ marginBottom: "32px" }}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={stats.totalUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="活跃用户"
              value={stats.activeUsers}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="管理员数量"
              value={stats.superAdmins}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="数据库大小"
              value={stats.databaseSize}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
      </Row>

      <Divider />

      {/* 管理功能标签页 */}
      <Tabs
        defaultActiveKey="users"
        size="large"
        items={[
          {
            key: "users",
            label: (
              <span>
                <UserOutlined />
                用户管理
              </span>
            ),
            children: (
              <Card
                title="用户列表"
                extra={
                  <Button type="primary" icon={<UserOutlined />}>
                    添加用户
                  </Button>
                }
              >
                <Table
                  columns={userColumns}
                  dataSource={users}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 800 }}
                />
              </Card>
            ),
          },
          {
            key: "api",
            label: (
              <span>
                <ApiOutlined />
                API 管理
              </span>
            ),
            children: (
              <Row gutter={[24, 24]}>
                <Col xs={24} lg={12}>
                  <Card title="API 统计">
                    <Descriptions column={1} bordered>
                      <Descriptions.Item label="总请求数">
                        <Tag color="blue">{stats.apiRequests}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="服务状态">
                        <Tag icon={<CheckCircleOutlined />} color="success">
                          正常运行
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="运行时间">
                        <Tag icon={<ClockCircleOutlined />} color="processing">
                          {stats.uptime}
                        </Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="API 配置">
                    <Descriptions column={1} bordered>
                      <Descriptions.Item label="JWT 有效期">
                        8天 (11520分钟)
                      </Descriptions.Item>
                      <Descriptions.Item label="API 版本">
                        v1.0.0
                      </Descriptions.Item>
                      <Descriptions.Item label="调试模式">
                        <Tag
                          color={
                            process.env.NODE_ENV === "development"
                              ? "warning"
                              : "success"
                          }
                        >
                          {process.env.NODE_ENV === "development"
                            ? "已启用"
                            : "已禁用"}
                        </Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "settings",
            label: (
              <span>
                <SettingOutlined />
                系统设置
              </span>
            ),
            children: (
              <Card title="系统配置">
                <Descriptions title="环境配置" bordered column={2}>
                  <Descriptions.Item label="后端服务">
                    <Tag color="blue">{window.location.origin}{"/api/v1"}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="前端服务">
                    <Tag color="green">{window.location.origin}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="数据库">
                    <Tag color="purple">PostgreSQL 15.15</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Redis">
                    <Tag color="red">redis://localhost:6379</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="环境变量">
                    <Button type="link" size="small">
                      查看 .env 配置
                    </Button>
                  </Descriptions.Item>
                  <Descriptions.Item label="系统重启">
                    <Button icon={<SyncOutlined />} type="dashed">
                      重启后端服务
                    </Button>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
        ]}
      />

      {/* 管理员信息 */}
      <Divider />
      <Card title="当前管理员信息">
        <Descriptions bordered>
          <Descriptions.Item label="用户名">
            {auth.user?.username}
          </Descriptions.Item>
          <Descriptions.Item label="全名">
            {auth.user?.full_name || "未设置"}
          </Descriptions.Item>
          <Descriptions.Item label="权限级别" span={2}>
            <Tag icon={<SafetyOutlined />} color="purple">
              超级管理员
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="账户创建时间">
            {auth.user?.created_at
              ? new Date(auth.user.created_at).toLocaleString("zh-CN")
              : "未知"}
          </Descriptions.Item>
          <Descriptions.Item label="最后登录" span={3}>
            刚刚
          </Descriptions.Item>
        </Descriptions>
      </Card>

    </div>
  );
};

export default AdminPage;
