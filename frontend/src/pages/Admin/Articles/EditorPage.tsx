import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Spin, message } from "antd";
import ArticleEditForm from "./EditForm";
import { articleApi, categoryApi } from "@services";
import type { ArticleWithRelations } from "@services";
import "./EditorPage.css";

const ArticleEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<ArticleWithRelations | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  const isCreateMode = !id || id === "new";

  const loadArticle = useCallback(async (articleId: number) => {
    try {
      setLoading(true);
      const response = await articleApi.getArticle(articleId);
      setArticle(response.data);
    } catch (error) {
      message.error("加载文章失败");
      navigate("/admin/articles");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await categoryApi.listCategories({ page: 1, size: 200 });
      const categoriesData = response.data?.categories || [];
      setCategories(categoriesData);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    if (isCreateMode) {
      setArticle(null);
      setLoading(false);
      return;
    }
    const articleId = parseInt(String(id), 10);
    if (!Number.isFinite(articleId)) {
      message.error("文章ID格式错误");
      navigate("/admin/articles");
      return;
    }
    loadArticle(articleId);
  }, [id, isCreateMode, loadArticle, loadCategories, navigate]);

  const handleSaveSuccess = () => {
    message.success(isCreateMode ? "文章创建成功" : "文章更新成功");
    navigate("/admin/articles");
  };

  const handleCancel = () => {
    navigate("/admin/articles");
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "120px 0" }}>
        <Spin size="large" />
        <div style={{ marginTop: 12 }}>加载中...</div>
      </div>
    );
  }

  return (
    <div className="article-editor-page">
      <ArticleEditForm
        article={article}
        categories={categories}
        isCreateMode={isCreateMode}
        layout="editor"
        onSave={handleSaveSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default ArticleEditorPage;
