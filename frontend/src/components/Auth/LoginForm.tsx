import React from "react";
import { Modal, Form, Input, Button, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import useAuth from "@hooks/useAuth";

interface LoginFormProps {
  /** 是否可见 */
  visible: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 登录成功回调 */
  onSuccess?: () => void;
  /** 标题 */
  title?: string;
  /** 是否为管理员登录 */
  isAdmin?: boolean;
}

/**
 * 模块化登录表单组件
 * 支持管理员和普通用户登录
 */
const LoginForm: React.FC<LoginFormProps> = ({
  visible,
  onClose,
  onSuccess,
  title,
  isAdmin = false,
}) => {
  const [form] = Form.useForm();
  const auth = useAuth();

  // 处理登录提交
  const handleLogin = async (values: {
    username: string;
    password: string;
  }) => {
    try {
      const result = await auth.login(values.username, values.password);
      if (result.success) {
        message.success(isAdmin ? "管理员登录成功！" : "登录成功！");

        // 如果是管理员登录，检查权限
        if (isAdmin && !auth.isAdmin()) {
          message.warning("当前账号不是管理员，无法访问管理后台");
          auth.logout();
          return;
        }

        // 关闭模态框
        onClose();
        form.resetFields();

        // 触发成功回调
        if (onSuccess) {
          onSuccess();
        }

      } else {
        message.error(result.error || "登录失败");
      }
    } catch (error) {
      console.error("登录过程中发生错误:", error);
      message.error("登录过程中发生错误");
    }
  };

  // 处理取消
  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  // 表单验证规则
  const usernameRules = [
    { required: true, message: isAdmin ? "请输入管理员账号" : "请输入用户名" },
  ];

  const passwordRules = [
    { required: true, message: "请输入密码" },
    { min: 6, message: "密码至少6个字符" },
  ];

  // 确定模态框标题
  const modalTitle = title || (isAdmin ? "管理员登录" : "用户登录");

  return (
    <Modal
      title={modalTitle}
      open={visible}
      onCancel={handleCancel}
      footer={null}
      destroyOnHidden
      centered
    >
      <Form
        form={form}
        name="login"
        onFinish={handleLogin}
        layout="vertical"
        autoComplete="off"
      >
        <Form.Item
          label={isAdmin ? "管理员账号" : "用户名"}
          name="username"
          rules={usernameRules}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder={isAdmin ? "请输入管理员账号" : "请输入用户名"}
            size="large"
          />
        </Form.Item>

        <Form.Item label="密码" name="password" rules={passwordRules}>
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入密码"
            size="large"
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={auth.isLoading}
            icon={<UserOutlined />}
          >
            {isAdmin ? "管理员登录" : "用户登录"}
          </Button>
        </Form.Item>

        {isAdmin && (
          <div style={{ textAlign: "center", marginTop: "16px" }}>
            <p style={{ fontSize: "12px", color: "var(--ws-color-text-secondary)" }}>提示：仅支持管理员账号登录</p>
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default LoginForm;
