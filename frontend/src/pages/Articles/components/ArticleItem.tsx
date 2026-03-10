
import React from "react";
import { Typography, Tag } from "antd";
import { CalendarOutlined, FolderOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { ArticleWithRelations } from "@services";

const { Text } = Typography;

interface ArticleItemProps {
  article: ArticleWithRelations;
  onClick: (slug: string) => void;
}

const ArticleItem: React.FC<ArticleItemProps> = ({ article, onClick }) => {
  const articleId = article.id || "unknown";
  const articleSlug = article.slug || "";
  const articleTitle = article.title || "无标题";
  const articleDate = article.created_at
    ? dayjs(article.created_at).format("YYYY-MM-DD")
    : "未知日期";
  const articleSummary = article.summary || "暂无摘要";
  const categoryName = article.category?.name || "";
  const authorName = article.author?.username || "未知";

  return (
    <div
      key={articleId}
      onClick={() => articleSlug && onClick(articleSlug)}
      className="article-item-row"
    >
      <div className="article-card-title">{articleTitle}</div>
      <div className="article-card-row-bottom">
        <div className="article-card-summary">{articleSummary}</div>
        <div className="article-card-meta">
          <span className="meta-item">
            <CalendarOutlined /> {articleDate}
          </span>
          {categoryName && (
            <Tag bordered={false} className="meta-tag">
              {categoryName}
            </Tag>
          )}
          <span className="meta-item">
            作者：{authorName}
          </span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ArticleItem);
