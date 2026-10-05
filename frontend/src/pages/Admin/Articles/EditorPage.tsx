import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LoadingState } from "@/components/ui/loading-state";
import ArticleEditForm from "./EditForm";
import { articleApi, categoryApi } from "@services";
import type { ArticleWithRelations } from "@services";

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
    } catch (_error) {
      showMessage.error("加载文章失败");
      void navigate("/admin/articles");
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
    void loadCategories();
    if (isCreateMode) {
      setArticle(null);
      setLoading(false);
      return;
    }
    const articleId = parseInt(String(id), 10);
    if (!Number.isFinite(articleId)) {
      showMessage.error("文章ID格式错误");
      void navigate("/admin/articles");
      return;
    }
    void loadArticle(articleId);
  }, [id, isCreateMode, loadArticle, loadCategories, navigate]);

  const handleSaveSuccess = () => {
    showMessage.success(isCreateMode ? "文章创建成功" : "文章更新成功");
    void navigate("/admin/articles");
  };

  const handleCancel = () => {
    void navigate("/admin/articles");
  };

  if (loading) {
    // 原写法有可见文案「加载中...」，但它**不是** role="status" 的可访问名称
    // （status 不是 name-from-content 角色，实测无障碍树里 Name 为空 → 屏幕阅读器静默）。
    // LoadingState 显式 aria-label + showLabel，兼顾视觉文案与语义播报。
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-28 text-text-secondary">
        <LoadingState label="正在加载文章…" size="xl" showLabel />
      </div>
    );
  }

  return (
    <div className="w-full flex-1 min-h-0 overflow-hidden">
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
