"""
文章服务 - CRUD操作
标签功能已移除，仅保留文章和分类功能
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy import select, update, delete, and_, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.articles import Article, Category
from app.models.core import User
from app.schemas.articles import (
    ArticleCreate, 
    ArticleUpdate, 
    ArticleResponse,
    ArticleWithRelations
)


class ArticleService:
    """文章服务类 - 提供文章的CRUD操作"""
    
    @staticmethod
    async def create_article(
        db: AsyncSession, 
        article_data: ArticleCreate, 
        author_id: int
    ) -> Article:
        """
        创建文章
        """
        # 检查slug是否已存在
        slug_check = await db.execute(
            select(Article).where(Article.slug == article_data.slug)
        )
        if slug_check.scalar_one_or_none():
            raise ValueError(f"slug '{article_data.slug}' 已存在")
        
        # 创建文章对象
        article = Article(
            title=article_data.title,
            slug=article_data.slug,
            content=article_data.content,
            summary=article_data.summary,
            published=article_data.published,
            author_id=author_id,
            category_id=article_data.category_id
        )
        
        db.add(article)
        await db.commit()
        await db.refresh(article)
        return article
    
    @staticmethod
    async def get_article_by_id(
        db: AsyncSession, 
        article_id: int,
        include_relations: bool = False
    ) -> Optional[Article]:
        """
        根据ID获取文章
        """
        query = select(Article).where(Article.id == article_id)
        
        if include_relations:
            query = query.options(
                selectinload(Article.author),
                selectinload(Article.category)
            )
        
        result = await db.execute(query)
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_article_by_slug(
        db: AsyncSession, 
        slug: str,
        include_relations: bool = False
    ) -> Optional[Article]:
        """
        根据slug获取文章
        """
        query = select(Article).where(Article.slug == slug)
        
        if include_relations:
            query = query.options(
                selectinload(Article.author),
                selectinload(Article.category)
            )
        
        result = await db.execute(query)
        return result.scalar_one_or_none()
    
    @staticmethod
    async def update_article(
        db: AsyncSession,
        article_id: int,
        article_data: ArticleUpdate
    ) -> Optional[Article]:
        """
        更新文章
        """
        # 检查文章是否存在
        article = await ArticleService.get_article_by_id(db, article_id)
        if not article:
            return None
        
        # 如果更新slug，检查是否与其他文章冲突
        if article_data.slug and article_data.slug != article.slug:
            slug_check = await db.execute(
                select(Article).where(
                    Article.slug == article_data.slug,
                    Article.id != article_id
                )
            )
            if slug_check.scalar_one_or_none():
                raise ValueError(f"slug '{article_data.slug}' 已存在")
        
        # 构建更新数据
        update_data = {}
        if article_data.title is not None:
            update_data['title'] = article_data.title
        if article_data.slug is not None:
            update_data['slug'] = article_data.slug
        if article_data.content is not None:
            update_data['content'] = article_data.content
        if article_data.summary is not None:
            update_data['summary'] = article_data.summary
        if article_data.published is not None:
            update_data['published'] = article_data.published
        if article_data.category_id is not None:
            update_data['category_id'] = article_data.category_id
        
        # 执行更新
        await db.execute(
            update(Article)
            .where(Article.id == article_id)
            .values(**update_data, updated_at=datetime.now())
        )
        
        await db.commit()
        
        # 返回更新后的文章
        return await ArticleService.get_article_by_id(db, article_id, include_relations=True)
    
    @staticmethod
    async def delete_article(db: AsyncSession, article_id: int) -> bool:
        """
        删除文章
        """
        # 检查文章是否存在
        article = await ArticleService.get_article_by_id(db, article_id)
        if not article:
            return False
        
        # 删除文章
        await db.execute(
            delete(Article).where(Article.id == article_id)
        )
        
        await db.commit()
        return True
    
    @staticmethod
    async def list_articles(
        db: AsyncSession,
        page: int = 1,
        size: int = 20,
        published_only: bool = True,
        category_id: Optional[int] = None,
        author_id: Optional[int] = None,
        include_relations: bool = False
    ) -> Dict[str, Any]:
        """
        获取文章列表（支持分页和筛选）
        """
        # 构建查询
        query = select(Article)
        
        # 应用筛选条件
        if published_only:
            query = query.where(Article.published == True)
        if category_id:
            query = query.where(Article.category_id == category_id)
        if author_id:
            query = query.where(Article.author_id == author_id)
        
        # 计算总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # 应用分页和排序
        query = query.order_by(desc(Article.created_at))
        query = query.offset((page - 1) * size).limit(size)
        
        # 加载关系
        if include_relations:
            query = query.options(
                selectinload(Article.author),
                selectinload(Article.category)
            )
        
        # 执行查询
        result = await db.execute(query)
        articles = list(result.scalars().all())
        
        # 计算分页信息
        total_pages = (total + size - 1) // size if total > 0 else 1
        
        return {
            "total": total,
            "articles": articles,
            "page": page,
            "size": size,
            "total_pages": total_pages
        }
    
    @staticmethod
    async def increment_view_count(db: AsyncSession, article_id: int) -> Optional[Article]:
        """
        增加文章浏览数（如果需要的话）
        注意：当前模型没有view_count字段，这里预留接口
        """
        article = await ArticleService.get_article_by_id(db, article_id)
        if not article:
            return None
        
        # 如果模型有view_count字段，可以在这里更新
        # await db.execute(
        #     update(Article)
        #     .where(Article.id == article_id)
        #     .values(view_count=Article.view_count + 1)
        # )
        # await db.commit()
        
        return article
    
    @staticmethod
    async def toggle_publish_status(
        db: AsyncSession,
        article_id: int,
        published: bool
    ) -> Optional[Article]:
        """
        切换文章发布状态
        """
        result = await db.execute(
            update(Article)
            .where(Article.id == article_id)
            .values(published=published, updated_at=datetime.now())
        )
        
        if result.rowcount == 0:
            return None
        
        await db.commit()
        return await ArticleService.get_article_by_id(db, article_id)