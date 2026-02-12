import React from "react";
import { Dropdown, Avatar, Button, Typography } from "antd";
import {
  UserOutlined,
  DashboardOutlined,
  RobotOutlined,
  HomeOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import useAuth from "@hooks/useAuth";
import { logger } from "@services/logger";

const { Text } = Typography;

interface UserMenuProps {
  /** 显示模式：avatar（头像）或 button（按钮） */
  mode?: "avatar" | "button";
  /** 是否显示用户名称 */
  showName?: boolean;
  /** 点击菜单项的回调 */
  onMenuClick?: (key: string) => void;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 模块化用户菜单组件
 * 根据用户角色显示不同的菜单项
 */
const UserMenu: React.FC<UserMenuProps> = ({
  mode = "avatar",
  showName = true,
  onMenuClick,
  style = {},
}) => {
  const navigate = useNavigate();
  const auth = useAuth();

  // 生成用户菜单项（已移除个人资料和设置）
  const getUserMenuItems = () => {
    const menuItems: any[] = [];

    if (!auth.isLoggedIn()) {
      // 未登录状态，只显示登录按钮
      return [];
    }

    // 根据用户角色显示不同的菜单
    if (auth.isAdmin()) {
      // 管理员（包括超级管理员）能看到后端管理
      menuItems.push({
        key: "/admin",
        icon: <DashboardOutlined />,
        label: "后端管理",
        onClick: () => {
          handleMenuClick("/admin");
          // 在新标签页中打开后端管理
          const adminUrl = `${window.location.origin}/admin`;
          window.open(adminUrl, "_blank", "noopener,noreferrer");
        },
      });
    } else if (auth.isLoggedIn()) {
      // 普通登录用户（学生）看到我的AI助手
      menuItems.push({
        key: "/ai-agents",
        icon: <RobotOutlined />,
        label: "我的AI助手",
        onClick: () => {
          handleMenuClick("/ai-agents");
          navigate("/ai-agents");
        },
      });
    }

    // 分隔线
    menuItems.push({
      key: "divider-1",
      type: "divider" as const,
    });

    // 返回首页（所有用户）
    menuItems.push({
      key: "/home",
      icon: <HomeOutlined />,
      label: "返回首页",
      onClick: () => {
        handleMenuClick("/home");
        navigate("/home");
      },
    });

    // 退出登录（所有登录用户）
    menuItems.push({
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
      danger: true,
      onClick: () => {
        handleMenuClick("logout");
        auth.logout();
        navigate("/home");
      },
    });

    return menuItems;
  };

  // 处理菜单点击
  const handleMenuClick = (key: string) => {
    if (onMenuClick) {
      onMenuClick(key);
    }
  };

  // 获取用户显示名称
  const getDisplayName = () => {
    if (!auth.user) return "用户";

    if (auth.user.role_code === "student") {
      return auth.user.full_name || auth.user.student_id || "学生";
    } else {
      return auth.user.username || auth.user.full_name || "管理员";
    }
  };

  // 获取用户角色显示文本
  const getRoleText = () => {
    const role = auth.getUserRole();
    switch (role) {
      case "super_admin":
        return "超级管理员";
      case "admin":
        return "管理员";
      case "student":
        return "学生";
      default:
        return "访客";
    }
  };

  // 获取用户头像颜色
  const getAvatarColor = () => {
    const role = auth.getUserRole();
    switch (role) {
      case "super_admin":
        return "#ff4d4f"; // 红色
      case "admin":
        return "#1890ff"; // 蓝色
      case "student":
        return "#52c41a"; // 绿色
      default:
        return "#722ed1"; // 紫色
    }
  };

  // 如果用户未登录，显示登录按钮
  if (!auth.isLoggedIn()) {
    if (mode === "button") {
      return (
        <Button
          type="primary"
          icon={<UserOutlined />}
          onClick={() => {
            // 触发菜单点击事件
            if (onMenuClick) {
              onMenuClick("login");
            }
          }}
          style={style}
        >
          登录
        </Button>
      );
    }

    // avatar模式下，添加点击事件来触发登录弹窗
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          ...style,
        }}
        onClick={(e) => {
          logger.debug("UserMenu - 点击未登录区域");
          e.stopPropagation(); // 防止事件冒泡
          // 触发菜单点击事件
          if (onMenuClick) {
            logger.debug("UserMenu - 调用 onMenuClick('login')");
            onMenuClick("login");
          } else {
            logger.warn("UserMenu - onMenuClick 回调未定义");
          }
        }}
        title="点击登录"
      >
        <Avatar
          size="default"
          icon={<UserOutlined />}
          style={{ backgroundColor: "#d9d9d9", marginRight: showName ? 8 : 0 }}
        />
        {showName && <Text>未登录</Text>}
      </div>
    );
  }

  // 用户已登录，显示用户菜单
  const menuItems = getUserMenuItems();

  // 用户信息显示
  const userInfo = (
    <div style={{ display: "flex", alignItems: "center", ...style }}>
      <Avatar
        size={mode === "button" ? "small" : "default"}
        icon={<UserOutlined />}
        style={{
          backgroundColor: getAvatarColor(),
          marginRight: showName ? 8 : 0,
        }}
      />
      {showName && (
        <div
          style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}
        >
          <Text strong style={{ fontSize: "14px" }}>
            {getDisplayName()}
          </Text>
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {getRoleText()}
          </Text>
        </div>
      )}
    </div>
  );

  if (mode === "button") {
    return (
      <Dropdown menu={{ items: menuItems }} placement="bottomRight" arrow>
        <Button type="text" style={{ padding: "4px 8px", ...style }}>
          {userInfo}
        </Button>
      </Dropdown>
    );
  }

  return (
    <Dropdown menu={{ items: menuItems }} placement="bottomRight" arrow>
      <div style={{ cursor: "pointer" }}>{userInfo}</div>
    </Dropdown>
  );
};

export default UserMenu;
