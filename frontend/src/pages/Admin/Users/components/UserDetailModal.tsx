/**
 * 用户详情弹窗组件
 */

import React from "react";
import { Modal, Row, Col, Tag, Button, Typography } from "antd";
import dayjs from "dayjs";
import { UserDetailModalProps } from "../types";

const { Text } = Typography;

const UserDetailModal: React.FC<UserDetailModalProps> = ({
  visible,
  currentUser,
  onCancel,
  onEdit,
}) => {
  if (!currentUser) return null;

  const renderUserDetail = () => {
    return (
      <div>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Text strong>ID：</Text>
            <Text>{currentUser.id}</Text>
          </Col>
          <Col span={12}>
            <Text strong>用户名：</Text>
            <Text>{currentUser.username || "无"}</Text>
          </Col>
        </Row>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Text strong>学号：</Text>
            <Text>{currentUser.student_id || "无"}</Text>
          </Col>
          <Col span={12}>
            <Text strong>姓名：</Text>
            <Text>{currentUser.full_name}</Text>
          </Col>
        </Row>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Text strong>学年：</Text>
            {currentUser.study_year ? (
              <Tag color="blue">{currentUser.study_year}</Tag>
            ) : (
              <Text>无</Text>
            )}
          </Col>
          <Col span={12}>
            <Text strong>班级：</Text>
            {currentUser.class_name ? (
              <Tag color="green">{currentUser.class_name}</Tag>
            ) : (
              <Text>无</Text>
            )}
          </Col>
        </Row>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Text strong>角色：</Text>
            <Tag color="purple">{currentUser.role_code}</Tag>
          </Col>
          <Col span={12}>
            <Text strong>状态：</Text>
            <Tag color={currentUser.is_active ? "success" : "error"}>
              {currentUser.is_active ? "活跃" : "停用"}
            </Tag>
          </Col>
        </Row>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Text strong>创建时间：</Text>
            <Text>
              {currentUser.created_at
                ? dayjs(currentUser.created_at).format("YYYY-MM-DD HH:mm")
                : "无"}
            </Text>
          </Col>
          <Col span={12}>
            <Text strong>更新时间：</Text>
            <Text>
              {currentUser.updated_at
                ? dayjs(currentUser.updated_at).format("YYYY-MM-DD HH:mm")
                : "无"}
            </Text>
          </Col>
        </Row>
      </div>
    );
  };

  return (
    <Modal
      title="用户详情"
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="close" onClick={onCancel}>
          关闭
        </Button>,
        <Button
          key="edit"
          type="primary"
          onClick={() => {
            onCancel();
            onEdit(currentUser);
          }}
        >
          编辑
        </Button>,
      ]}
      width={600}
    >
      {renderUserDetail()}
    </Modal>
  );
};

export default UserDetailModal;
