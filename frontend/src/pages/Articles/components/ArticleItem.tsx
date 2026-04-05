import React from "react";
import { Badge } from "@/components/ui/badge";
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
    <div
      onClick={() => slug && onClick(slug)}
      className="group px-3 py-3 rounded-lg cursor-pointer article-item-hover border-b"
    >
      <div className="font-semibold text-sm leading-snug mb-1 text-text-base">
        {title}
      </div>
      <div className="flex items-center gap-3">
        {summary && (
          <div className="flex-1 min-w-0 text-xs truncate text-text-secondary">
            {summary}
          </div>
        )}
        <div className="flex items-center gap-2 flex-shrink-0 text-xs text-text-tertiary">
          {date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />{date}
            </span>
          )}
          {categoryName && (
            <Badge variant="primarySubtle" className="!m-0 text-xs">
              {categoryName}
            </Badge>
          )}
          {authorName && <span>{authorName}</span>}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ArticleItem);
