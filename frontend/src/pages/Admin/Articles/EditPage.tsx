import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Button, Space, Spin, message, Typography, Row, Col } from "antd";
import {
  ArrowLeftOutlined,
  SaveOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import ArticleEditForm from "./EditForm";
import { articleApi, categoryApi } from "@services";
import type { ArticleWithRelations } from "@services";
import "./EditPage.css";

const { Title } = Typography;

const ArticleEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [article, setArticle] = useState<ArticleWithRelations | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  const isCreateMode = !id || id === "new";

  // 加载文章数据（编辑模式下）
  const loadArticle = async (articleId: number) => {
    try {
      setLoading(true);
      const response = await articleApi.getArticle(articleId);
      setArticle(response.data);
    } catch (error) {
      console.error("加载文章失败:", error);
      message.error("加载文章失败");
      navigate("/admin/articles");
    } finally {
      setLoading(false);
    }
  };

  // 加载分类列表
  const loadCategories = async () => {
    try {
      const response = await categoryApi.listCategories({
        page: 1,
        size: 100,
      });
      const categoriesData = response.data?.categories || [];
      setCategories(categoriesData);
    } catch (error) {
      console.error("加载分类列表失败:", error);
      message.warning("加载分类列表失败，可能无法选择分类");
    }
  };

  // 初始加载
  useEffect(() => {
    loadCategories();

    if (isCreateMode) {
      setLoading(false);
    } else {
      const articleId = parseInt(id!);
      if (isNaN(articleId)) {
        message.error("文章ID格式错误");
        navigate("/admin/articles");
        return;
      }
      loadArticle(articleId);
    }
  }, [id]);

  // 处理保存成功
  const handleSaveSuccess = () => {
    message.success(isCreateMode ? "文章创建成功" : "文章更新成功");
    navigate("/admin/articles");
  };

  // 处理取消
  const handleCancel = () => {
    navigate("/admin/articles");
  };

  // 页面头部
  const renderHeader = () => (
    <Card
      style={{
        marginBottom: 24,
        borderRadius: 8,
        boxShadow: "none",
        border: "1px solid var(--ws-color-border)",
      }}
    >
      <Row align="middle" justify="space-between">
        <Col>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={handleCancel}>
              返回列表
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              {isCreateMode ? "创建新文章" : "编辑文章"}
            </Title>
          </Space>
        </Col>
        <Col>{/* 取消按钮已移除，只有底部操作栏有取消按钮 */}</Col>
      </Row>
    </Card>
  );

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载文章数据...</div>
      </div>
    );
  }

  return (
    <div className="article-edit-page">
      {renderHeader()}

      <ArticleEditForm
        article={article}
        categories={categories}
        isCreateMode={isCreateMode}
        onSave={handleSaveSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default ArticleEditPage;
