"""
分类服务 - CRUD操作
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.articles import Category, Article
from app.schemas.articles import CategoryCreate, CategoryUpdate, CategoryResponse


class CategoryService:
    """分类服务类 - 提供分类的CRUD操作"""
    
    @staticmethod
    async def create_category(
        db: AsyncSession, 
        category_data: CategoryCreate
    ) -> Category:
        """
        创建分类
        """
        # 检查分类名是否已存在
        name_check = await db.execute(
            select(Category).where(Category.name == category_data.name)
        )
        if name_check.scalar_one_or_none():
            raise ValueError(f"分类名 '{category_data.name}' 已存在")
        
        # 检查slug是否已存在
        slug_check = await db.execute(
            select(Category).where(Category.slug == category_data.slug)
        )
        if slug_check.scalar_one_or_none():
            raise ValueError(f"slug '{category_data.slug}' 已存在")
        
        # 创建分类对象
        category = Category(
            name=category_data.name,
            slug=category_data.slug,
            description=category_data.description
        )
        
        db.add(category)
        await db.commit()
        await db.refresh(category)
        return category
    
    @staticmethod
    async def get_category_by_id(
        db: AsyncSession, 
        category_id: int
    ) -> Optional[Category]:
        """
        根据ID获取分类
        """
        result = await db.execute(
            select(Category).where(Category.id == category_id)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_category_by_slug(
        db: AsyncSession, 
        slug: str
    ) -> Optional[Category]:
        """
        根据slug获取分类
        """
        result = await db.execute(
            select(Category).where(Category.slug == slug)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_category_by_name(
        db: AsyncSession, 
        name: str
    ) -> Optional[Category]:
        """
        根据名称获取分类
        """
        result = await db.execute(
            select(Category).where(Category.name == name)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def update_category(
        db: AsyncSession,
        category_id: int,
        category_data: CategoryUpdate
    ) -> Optional[Category]:
        """
        更新分类
        """
        # 检查分类是否存在
        category = await CategoryService.get_category_by_id(db, category_id)
        if not category:
            return None
        
        # 如果更新名称，检查是否与其他分类冲突
        if category_data.name and category_data.name != category.name:
            name_check = await db.execute(
                select(Category).where(
                    Category.name == category_data.name,
                    Category.id != category_id
                )
            )
            if name_check.scalar_one_or_none():
                raise ValueError(f"分类名 '{category_data.name}' 已存在")
        
        # 如果更新slug，检查是否与其他分类冲突
        if category_data.slug and category_data.slug != category.slug:
            slug_check = await db.execute(
                select(Category).where(
                    Category.slug == category_data.slug,
                    Category.id != category_id
                )
            )
            if slug_check.scalar_one_or_none():
                raise ValueError(f"slug '{category_data.slug}' 已存在")
        
        # 构建更新数据
        update_data = {}
        if category_data.name is not None:
            update_data['name'] = category_data.name
        if category_data.slug is not None:
            update_data['slug'] = category_data.slug
        if category_data.description is not None:
            update_data['description'] = category_data.description
        
        # 执行更新
        await db.execute(
            update(Category)
            .where(Category.id == category_id)
            .values(**update_data, updated_at=datetime.now())
        )
        
        await db.commit()
        
        # 返回更新后的分类
        return await CategoryService.get_category_by_id(db, category_id)
    
    @staticmethod
    async def delete_category(db: AsyncSession, category_id: int) -> bool:
        """
        删除分类
        """
        # 检查分类是否存在
        category = await CategoryService.get_category_by_id(db, category_id)
        if not category:
            return False
        
        # 检查是否有文章使用该分类
        article_check = await db.execute(
            select(Article).where(Article.category_id == category_id).limit(1)
        )
        if article_check.scalar_one_or_none():
            # 如果有文章使用该分类，不能删除
            # 可以改为将所有相关文章的category_id设置为null
            await db.execute(
                update(Article)
                .where(Article.category_id == category_id)
                .values(category_id=None)
            )
        
        # 删除分类
        await db.execute(
            delete(Category).where(Category.id == category_id)
        )
        
        await db.commit()
        return True
    
    @staticmethod
    async def list_categories(
        db: AsyncSession,
        page: int = 1,
        size: int = 20,
        include_usage_count: bool = False
    ) -> Dict[str, Any]:
        """
        获取分类列表（支持分页）
        """
        # 构建查询
        query = select(Category).order_by(Category.name)
        
        # 计算总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # 应用分页
        query = query.offset((page - 1) * size).limit(size)
        
        # 执行查询
        result = await db.execute(query)
        categories = result.scalars().all()
        
        # 如果需要使用次数，计算每个分类的使用次数
        category_list = []
        for category in categories:
            category_dict = {
                "id": category.id,
                "name": category.name,
                "slug": category.slug,
                "description": category.description,
                "created_at": category.created_at,
                "updated_at": category.updated_at
            }
            
            if include_usage_count:
                usage_query = select(func.count()).select_from(Article).where(Article.category_id == category.id)
                usage_result = await db.execute(usage_query)
                category_dict["article_count"] = usage_result.scalar() or 0
            
            category_list.append(category_dict)
        
        # 计算分页信息
        total_pages = (total + size - 1) // size if total > 0 else 1
        
        return {
            "total": total,
            "categories": category_list,
            "page": page,
            "size": size,
            "total_pages": total_pages
        }
    
    @staticmethod
    async def search_categories(
        db: AsyncSession,
        keyword: str,
        limit: int = 20
    ) -> List[Category]:
        """
        搜索分类（按名称或slug模糊匹配）
        """
        query = select(Category).where(
            (Category.name.ilike(f"%{keyword}%")) |
            (Category.slug.ilike(f"%{keyword}%"))
        ).order_by(Category.name).limit(limit)
        
        result = await db.execute(query)
        return list(result.scalars().all())
    
    @staticmethod
    async def get_popular_categories(
        db: AsyncSession,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        获取热门分类（按文章数量排序）
        """
        # 按文章数量分组和排序
        subquery = (
            select(
                Article.category_id,
                func.count().label('article_count')
            )
            .where(Article.category_id.isnot(None))
            .group_by(Article.category_id)
            .subquery()
        )
        
        query = (
            select(Category, subquery.c.article_count)
            .join(subquery, Category.id == subquery.c.category_id)
            .order_by(subquery.c.article_count.desc())
            .limit(limit)
        )
        
        result = await db.execute(query)
        popular_categories = []
        
        for category, article_count in result:
            popular_categories.append({
                "id": category.id,
                "name": category.name,
                "slug": category.slug,
                "description": category.description,
                "article_count": article_count
            })
        
        return popular_categories
    
    @staticmethod
    async def get_or_create_category(
        db: AsyncSession,
        name: str,
        slug: Optional[str] = None,
        description: Optional[str] = None
    ) -> Category:
        """
        获取或创建分类
        """
        # 如果没有提供slug，从名称生成
        if not slug:
            slug = name.lower().replace(" ", "-")
        
        # 先尝试获取现有分类（按名称或slug）
        category = await CategoryService.get_category_by_name(db, name)
        if not category:
            category = await CategoryService.get_category_by_slug(db, slug)
        
        if category:
            return category
        
        # 创建新分类
        category = Category(
            name=name,
            slug=slug,
            description=description
        )
        
        db.add(category)
        await db.commit()
        await db.refresh(category)
        return category
    
    @staticmethod
    async def get_category_stats(db: AsyncSession, category_id: int) -> Dict[str, Any]:
        """
        获取分类统计信息
        """
        category = await CategoryService.get_category_by_id(db, category_id)
        if not category:
            raise ValueError(f"分类ID {category_id} 不存在")
        
        # 统计文章数量
        article_count_query = select(func.count()).select_from(Article).where(Article.category_id == category_id)
        article_count_result = await db.execute(article_count_query)
        article_count = article_count_result.scalar() or 0
        
        # 统计已发布的文章数量
        published_article_count_query = select(func.count()).select_from(Article).where(
            Article.category_id == category_id,
            Article.published == True
        )
        published_article_count_result = await db.execute(published_article_count_query)
        published_article_count = published_article_count_result.scalar() or 0
        
        # 获取最新的5篇文章
        latest_articles_query = select(Article).where(
            Article.category_id == category_id,
            Article.published == True
        ).order_by(Article.created_at.desc()).limit(5)
        
        latest_articles_result = await db.execute(latest_articles_query)
        latest_articles = latest_articles_result.scalars().all()
        
        return {
            "id": category.id,
            "name": category.name,
            "slug": category.slug,
            "total_articles": article_count,
            "published_articles": published_article_count,
            "draft_articles": article_count - published_article_count,
            "latest_articles": [
                {
                    "id": article.id,
                    "title": article.title,
                    "slug": article.slug,
                    "created_at": article.created_at
                }
                for article in latest_articles
            ]
        }