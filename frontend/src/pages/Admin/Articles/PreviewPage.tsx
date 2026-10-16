import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { articleApi } from "@services";
import type { ArticleWithRelations } from "@services";
import ArticlePreviewContent from "./components/ArticlePreviewContent";

const AdminArticlePreviewPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<ArticleWithRelations | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setArticle(null);
    setError(null);
    if (!slug) {
      setError("文章标识不存在");
      return () => {
        active = false;
      };
    }

    void articleApi
      .getArticleBySlug(slug)
      .then((response) => {
        if (active) setArticle(response.data);
      })
      .catch((reason: any) => {
        if (active) {
          setError(reason?.response?.data?.detail || "文章预览加载失败");
        }
      });

    return () => {
      active = false;
    };
  }, [slug]);

  if (!article && !error) {
    return <LoadingState label="正在加载文章预览…" size="xl" showLabel />;
  }

  if (error || !article) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Alert variant="destructive">
          <AlertTitle>文章预览失败</AlertTitle>
          <AlertDescription className="mt-2 flex items-center justify-between gap-3">
            <span>{error || "文章不存在"}</span>
            <Button variant="outline" onClick={() => void navigate("/admin/articles")}>
              返回文章管理
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-text-tertiary">受保护预览</p>
          <h1 className="mt-1 text-2xl font-semibold text-text-base">{article.title}</h1>
          {article.summary ? <p className="mt-2 text-sm text-text-secondary">{article.summary}</p> : null}
        </div>
        <Button variant="outline" onClick={() => void navigate("/admin/articles")}>返回</Button>
      </div>
      <ArticlePreviewContent
        content={article.content}
        scopeId={`admin-article-preview-${article.id}`}
        styleCss={article.style?.content}
        customCss={article.custom_css}
      />
    </main>
  );
};

export default AdminArticlePreviewPage;
