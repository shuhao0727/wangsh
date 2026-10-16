import React from "react";
import { badgeVariants } from "@/components/ui/badge-variants";
import { Calendar } from "lucide-react";
import dayjs from "dayjs";
import type { ArticleWithRelations } from "@services";

interface ArticleItemProps {
  article: ArticleWithRelations;
  onClick: (slug: string) => void;
}

const ArticleItem: React.FC<ArticleItemProps> = ({ article, onClick }) => {
  const slug = article.slug || "";
  const title = article.title || "无标题";
  const date = article.created_at ? dayjs(article.created_at).format("YYYY-MM-DD") : "";
  const summary = article.summary || "";
  const categoryName = article.category?.name || "";
  const authorName = article.author?.username || "";

  return (
    <button
      type="button"
      disabled={!slug}
      aria-label={title}
      onClick={() => slug && onClick(slug)}
      className="article-item-row w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-default"
    >
      <span className="article-card-title">
        {title}
      </span>
      <span className="article-card-subline">
        {summary && (
          <span className="article-card-summary">
            {summary}
          </span>
        )}
        <span className="article-card-meta">
          {date && (
            <span className="inline-flex shrink-0 items-center gap-2xs">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              <time dateTime={date}>{date}</time>
            </span>
          )}
          {categoryName && (
            <span className={badgeVariants({ variant: "info", className: "article-card-category !m-0 text-xs" })} title={categoryName}>
              <span className="truncate">{categoryName}</span>
            </span>
          )}
          {authorName && <span className="article-card-author" title={authorName}>{authorName}</span>}
        </span>
      </span>
    </button>
  );
};

export default React.memo(ArticleItem);
