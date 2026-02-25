"""
文章管理 API 端点
提供文章的完整CRUD操作，需要超级管理员权限
"""

from typing import List, Optional, Dict, Any, cast
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.deps import require_super_admin, require_user
from app.schemas.articles import (
    ArticleCreate, 
    ArticleUpdate, 
    ArticleResponse, 
    ArticleWithRelations,
    ArticleList
)
from app.services.articles.article import ArticleService
from app.core.config import settings
from app.utils.cache import cache, ArticleCacheKeys, clear_article_cache
from .markdown_styles import router as markdown_styles_router

router = APIRouter()
router.include_router(markdown_styles_router)


@router.get("", response_model=ArticleList)
async def list_articles(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(settings.ARTICLE_PAGE_SIZE_DEFAULT, ge=1, le=settings.ARTICLE_PAGE_SIZE_MAX, description="每页数量"),
    published_only: bool = Query(True, description="是否只显示已发布的文章"),
    category_id: Optional[int] = Query(None, description="按分类ID筛选"),
    author_id: Optional[int] = Query(None, description="按作者ID筛选"),
    include_relations: bool = Query(False, description="是否包含关联信息"),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_super_admin)
) -> Dict[str, Any]:
    """
    获取文章列表（支持分页和筛选）
    
    权限：超级管理员
    """
    # 生成缓存键 - 管理员列表缓存需要包含所有筛选参数和用户权限
    # 注意：所有超级管理员看到的数据相同，所以不需要包含用户ID
    cache_key = ArticleCacheKeys.admin_list(
        page=page,
        size=size,
        published_only=published_only,
        include_relations=include_relations,
        category_id=category_id,
        author_id=author_id
    )
    
    # 尝试从缓存获取
    cached_result = await cache.get(cache_key)
    if cached_result is not None:
        return cached_result
    
    # 缓存未命中，从数据库获取
    result = await ArticleService.list_articles(
        db=db,
        page=page,
        size=size,
        published_only=published_only,
        category_id=category_id,
        author_id=author_id,
        include_relations=include_relations
    )
    
    # 将SQLAlchemy对象转换为字典（匹配Pydantic模型）
    articles_list = []
    for article in result["articles"]:
        # 构建文章字典
        article_dict = {
            "id": article.id,
            "title": article.title or "",
            "slug": article.slug,
            "content": article.content or "",
            "summary": article.summary or "",
            "custom_css": getattr(article, "custom_css", None),
            "style_key": getattr(article, "style_key", None),
            "published": article.published,
            "author_id": article.author_id,  # Article模型有author_id字段
            "category_id": article.category_id,
            "created_at": article.created_at.isoformat(),
            "updated_at": article.updated_at.isoformat(),
        }
        
        # 如果包含关联信息，添加作者和分类
        if include_relations:
            # 添加作者信息
            if article.author:
                article_dict["author"] = {
                    "id": article.author.id,
                    "username": article.author.username,
                    "email": getattr(article.author, "email", None),
                    "full_name": article.author.full_name if hasattr(article.author, 'full_name') else None
                }
            else:
                article_dict["author"] = None
            
            # 添加分类信息
            if article.category:
                # 分类slug处理
                category_slug = None
                if hasattr(article.category, 'slug') and article.category.slug:
                    category_slug = article.category.slug
                else:
                    category_slug = f"category-{article.category.id}"
                
                article_dict["category"] = {
                    "id": article.category.id,
                    "name": article.category.name,
                    "slug": category_slug,
                    "description": article.category.description if hasattr(article.category, 'description') else None
                }
            else:
                article_dict["category"] = None

            if getattr(article, "style", None):
                article_dict["style"] = {
                    "key": article.style.key,
                    "title": article.style.title or "",
                    "sort_order": article.style.sort_order or 0,
                    "content": article.style.content or "",
                    "created_at": article.style.created_at.isoformat(),
                    "updated_at": article.style.updated_at.isoformat(),
                }
            else:
                article_dict["style"] = None
            
            # 标签功能已移除，不再返回标签信息
            article_dict["tags"] = []
        else:
            # 如果不包含关联信息，设置为None
            article_dict["author"] = None
            article_dict["category"] = None
            article_dict["style"] = None
            article_dict["tags"] = []
        
        articles_list.append(article_dict)
    
    response_data = {
        "total": result["total"],
        "articles": articles_list,
        "page": page,
        "size": size,
        "total_pages": result["total_pages"]
    }
    
    # 缓存结果，过期时间使用配置值 - 管理员列表更新较频繁
    await cache.set(cache_key, response_data, expire_seconds=settings.ARTICLE_CACHE_ADMIN_LIST_TTL)
    
    return response_data


@router.post("", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    article_data: ArticleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_super_admin)
) -> Any:
    """
    创建新文章
    
    权限：超级管理员
    """
    try:
        # 从current_user中获取作者ID
        author_id = current_user.get("id")
        if not author_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无法获取用户信息"
            )
        
        # 如果文章数据中没有提供作者ID，使用当前用户ID
        if not article_data.author_id:
            # 注意：ArticleCreate模式中author_id是必填字段，所以这里需要特殊处理
            # 实际上我们可以修改ArticleCreate模式，或者在这里创建一个新的数据结构
            pass
        
        article = await ArticleService.create_article(
            db=db,
            article_data=article_data,
            author_id=author_id
        )
        
        # 清理文章相关缓存
        if article:
            # 获取文章的ID和slug（SQLAlchemy对象在查询后属性已经是Python原生类型）
            article_id_val = cast(int, article.id)
            article_slug = cast(str, article.slug)
            # 清理缓存
            await clear_article_cache(article_id=article_id_val, slug=article_slug)
        
        return article
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建文章失败: {str(e)}"
        )


@router.get("/{article_id}", response_model=ArticleWithRelations)
async def get_article(
    article_id: int,
    include_relations: bool = Query(True, description="是否包含关联信息"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_user)
) -> Any:
    """
    根据ID获取文章详情
    
    权限：任何登录用户
    """
    # 生成缓存键 - 需要包含用户权限信息，因为不同用户（管理员vs普通用户）看到的内容可能不同
    user_id = current_user.get("id", 0)
    is_superuser = current_user.get("role_code") == "super_admin"
    
    # 如果用户是超级管理员，使用管理员缓存键，否则使用用户缓存键
    if is_superuser:
        cache_key = ArticleCacheKeys.admin_detail_by_id(
            article_id=article_id,
            include_relations=include_relations
        )
    else:
        cache_key = ArticleCacheKeys.user_detail_by_id(
            article_id=article_id,
            user_id=user_id,
            include_relations=include_relations
        )
    
    # 尝试从缓存获取
    cached_result = await cache.get(cache_key)
    if cached_result is not None:
        return cached_result
    
    # 缓存未命中，从数据库获取
    article = await ArticleService.get_article_by_id(
        db=db,
        article_id=article_id,
        include_relations=include_relations
    )
    
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"文章ID {article_id} 不存在"
        )
    
    # 检查权限：只有已发布的文章或管理员可以查看
    if article.published is not None and article.published is False and current_user.get("role_code") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限查看未发布的文章"
        )
    
    # 手动构建响应，确保正确处理空值和编码
    response_dict = {
        "id": article.id,
        "title": article.title or "",  # 处理可能的空值
        "slug": article.slug,
        "content": article.content or "",  # 处理可能的空值
        "summary": article.summary or "",  # 处理可能的空值
        "custom_css": getattr(article, "custom_css", None),
        "style_key": getattr(article, "style_key", None),
        "published": article.published,
        "author_id": article.author_id,
        "category_id": article.category_id,
        "created_at": article.created_at.isoformat(),
        "updated_at": article.updated_at.isoformat(),
    }
    
    if include_relations:
        if article.author:
            response_dict["author"] = {
                "id": article.author.id,
                "username": article.author.username,
                "email": getattr(article.author, "email", None),
                "full_name": article.author.full_name if hasattr(article.author, 'full_name') else None
            }
        else:
            response_dict["author"] = None
            
        if article.category:
            response_dict["category"] = {
                "id": article.category.id,
                "name": article.category.name or "",
                "slug": article.category.slug if hasattr(article.category, 'slug') else f"category-{article.category.id}"
            }
        else:
            response_dict["category"] = None
        if getattr(article, "style", None):
            response_dict["style"] = {
                "key": article.style.key,
                "title": article.style.title or "",
                "sort_order": article.style.sort_order or 0,
                "content": article.style.content or "",
                "created_at": article.style.created_at.isoformat(),
                "updated_at": article.style.updated_at.isoformat(),
            }
        else:
            response_dict["style"] = None
    else:
        response_dict["style"] = None
    
    # 缓存结果 - 缓存时间根据用户类型不同
    expire_seconds = settings.ARTICLE_CACHE_ADMIN_DETAIL_TTL if is_superuser else settings.ARTICLE_CACHE_USER_DETAIL_TTL
    await cache.set(cache_key, response_dict, expire_seconds)
    
    return response_dict


@router.get("/slug/{slug}", response_model=ArticleWithRelations)
async def get_article_by_slug(
    slug: str,
    include_relations: bool = Query(True, description="是否包含关联信息"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_user)
) -> Any:
    """
    根据slug获取文章详情
    
    权限：任何登录用户
    """
    article = await ArticleService.get_article_by_slug(
        db=db,
        slug=slug,
        include_relations=include_relations
    )
    
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"文章slug '{slug}' 不存在"
        )
    
    # 检查权限：只有已发布的文章或管理员可以查看
    if article.published is not None and article.published is False and current_user.get("role_code") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限查看未发布的文章"
        )
    
    # 手动构建响应，确保正确处理空值和编码
    response_dict = {
        "id": article.id,
        "title": article.title or "",  # 处理可能的空值
        "slug": article.slug,
        "content": article.content or "",  # 处理可能的空值
        "summary": article.summary or "",  # 处理可能的空值
        "custom_css": getattr(article, "custom_css", None),
        "style_key": getattr(article, "style_key", None),
        "published": article.published,
        "author_id": article.author_id,
        "category_id": article.category_id,
        "created_at": article.created_at.isoformat(),
        "updated_at": article.updated_at.isoformat(),
    }
    
    if include_relations:
        if article.author:
            response_dict["author"] = {
                "id": article.author.id,
                "username": article.author.username,
                "email": getattr(article.author, "email", None),
                "full_name": article.author.full_name if hasattr(article.author, 'full_name') else None
            }
        else:
            response_dict["author"] = None
            
        if article.category:
            response_dict["category"] = {
                "id": article.category.id,
                "name": article.category.name or "",
                "slug": article.category.slug if hasattr(article.category, 'slug') else f"category-{article.category.id}"
            }
        else:
            response_dict["category"] = None
        if getattr(article, "style", None):
            response_dict["style"] = {
                "key": article.style.key,
                "title": article.style.title or "",
                "sort_order": article.style.sort_order or 0,
                "content": article.style.content or "",
                "created_at": article.style.created_at.isoformat(),
                "updated_at": article.style.updated_at.isoformat(),
            }
        else:
            response_dict["style"] = None
    else:
        response_dict["style"] = None
    
    return response_dict


@router.put("/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: int,
    article_data: ArticleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_super_admin)
) -> Any:
    """
    更新文章
    
    权限：超级管理员
    """
    try:
        old_article = await ArticleService.get_article_by_id(db=db, article_id=article_id)
        old_slug = cast(Optional[str], getattr(old_article, "slug", None)) if old_article else None

        article = await ArticleService.update_article(
            db=db,
            article_id=article_id,
            article_data=article_data
        )
        
        if not article:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"文章ID {article_id} 不存在"
            )

        try:
            article_id_val = cast(int, article.id)
            new_slug = cast(Optional[str], getattr(article, "slug", None))
            await clear_article_cache(article_id=article_id_val, slug=old_slug or new_slug)
        except Exception:
            pass

        return article
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新文章失败: {str(e)}"
        )


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_article(
    article_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_super_admin)
) -> None:
    """
    删除文章
    
    权限：超级管理员
    """
    # 删除前获取文章信息，用于清理缓存
    article = await ArticleService.get_article_by_id(db=db, article_id=article_id)
    
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"文章ID {article_id} 不存在"
        )
    
    # 先清理缓存，然后删除文章
    try:
        # 转换类型：SQLAlchemy Column对象 -> Python原生类型
        article_id_val = cast(int, article.id)
        article_slug = cast(str, article.slug)
        await clear_article_cache(article_id=article_id_val, slug=article_slug)
    except Exception as e:
        # 缓存清理失败不应该阻止文章删除，但记录错误
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"清理文章缓存时出错: {e}")
    
    # 删除文章
    success = await ArticleService.delete_article(db=db, article_id=article_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除文章ID {article_id} 失败"
        )


@router.post("/{article_id}/publish", response_model=ArticleResponse)
async def publish_article(
    article_id: int,
    published: bool = Query(True, description="发布状态"),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_super_admin)
) -> Any:
    """
    发布或取消发布文章
    
    权限：超级管理员
    """
    article = await ArticleService.toggle_publish_status(
        db=db,
        article_id=article_id,
        published=published
    )
    
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"文章ID {article_id} 不存在"
        )
    
    # 清理文章相关缓存
    if article:
        # 获取文章的ID和slug（SQLAlchemy对象在查询后属性已经是Python原生类型）
        article_id_val = cast(int, article.id)
        article_slug = cast(str, article.slug)
        # 清理缓存
        await clear_article_cache(article_id=article_id_val, slug=article_slug)
    
    return article


@router.get("/{article_id}/tags", response_model=List[Dict[str, Any]])
async def get_article_tags(
    article_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_user)
) -> Any:
    """
    获取文章的所有标签（标签功能已移除，返回空列表）
    
    权限：任何登录用户
    """
    # 先检查文章是否存在
    article = await ArticleService.get_article_by_id(db=db, article_id=article_id)
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"文章ID {article_id} 不存在"
        )
    
    # 检查权限：只有已发布的文章或管理员可以查看
    if article.published is not None and article.published is False and current_user.get("role_code") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限查看未发布的文章"
        )
    
    # 标签功能已移除，返回空列表
    return []


@router.get("/public/list", response_model=ArticleList)
async def list_public_articles(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(settings.ARTICLE_PAGE_SIZE_DEFAULT, ge=1, le=settings.ARTICLE_PAGE_SIZE_MAX, description="每页数量"),
    category_id: Optional[int] = Query(None, description="按分类ID筛选"),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    获取已发布的文章列表（公开接口）
    
    权限：无需认证
    """
    # 生成缓存键
    cache_key = ArticleCacheKeys.public_list(
        page=page,
        size=size,
        category_id=category_id
    )
    
    # 尝试从缓存获取
    cached_result = await cache.get(cache_key)
    if cached_result is not None:
        return cached_result
    
    # 缓存未命中，从数据库获取
    result = await ArticleService.list_articles(
        db=db,
        page=page,
        size=size,
        published_only=True,  # 只获取已发布的文章
        category_id=category_id,
        author_id=None,
        include_relations=True  # 公开接口包含关联信息
    )
    
        # 将SQLAlchemy对象转换为字典（匹配Pydantic模型）
    articles_list = []
    for article in result["articles"]:
        # 构建文章字典
        article_dict = {
            "id": article.id,
            "title": article.title or "",
            "slug": article.slug,
            "content": article.content or "",
            "summary": article.summary or "",
            "custom_css": getattr(article, "custom_css", None),
            "style_key": getattr(article, "style_key", None),
            "published": article.published,
            "author_id": article.author_id,  # Article模型有author_id字段
            "created_at": article.created_at.isoformat(),
            "updated_at": article.updated_at.isoformat(),
        }
        
        # 添加作者信息
        if article.author:
            article_dict["author"] = {
                "id": article.author.id,
                "username": article.author.username,
                "email": getattr(article.author, "email", None),
                "full_name": article.author.full_name if hasattr(article.author, 'full_name') else None
            }
        else:
            article_dict["author"] = None
        
        # 添加分类信息
        if article.category:
            article_dict["category_id"] = article.category_id
            # 分类slug处理
            category_slug = None
            if hasattr(article.category, 'slug') and article.category.slug:
                category_slug = article.category.slug
            else:
                category_slug = f"category-{article.category.id}"
            
            article_dict["category"] = {
                "id": article.category.id,
                "name": article.category.name,
                "slug": category_slug,
                "description": article.category.description if hasattr(article.category, 'description') else None
            }
        else:
            article_dict["category_id"] = None
            article_dict["category"] = None

        if getattr(article, "style", None):
            article_dict["style"] = {
                "key": article.style.key,
                "title": article.style.title or "",
                "sort_order": article.style.sort_order or 0,
                "content": article.style.content or "",
                "created_at": article.style.created_at.isoformat(),
                "updated_at": article.style.updated_at.isoformat(),
            }
        else:
            article_dict["style"] = None
        
        # 标签功能已移除，不再返回标签信息
        article_dict["tags"] = []
        
        articles_list.append(article_dict)
    
    response_data = {
        "total": result["total"],
        "articles": articles_list,
        "page": page,
        "size": size,
        "total_pages": result["total_pages"]
    }
    
    # 缓存结果，过期时间使用配置值
    await cache.set(cache_key, response_data, expire_seconds=settings.ARTICLE_CACHE_PUBLIC_LIST_TTL)
    
    return response_data


@router.get("/public/{slug}", response_model=ArticleWithRelations)
async def get_public_article_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    根据slug获取已发布的文章详情（公开接口）
    
    权限：无需认证
    """
    # 生成缓存键
    cache_key = ArticleCacheKeys.public_detail(slug)
    
    # 尝试从缓存获取
    cached_result = await cache.get(cache_key)
    if cached_result is not None:
        return cached_result
    
    # 缓存未命中，从数据库获取
    article = await ArticleService.get_article_by_slug(
        db=db,
        slug=slug,
        include_relations=True
    )
    
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"文章slug '{slug}' 不存在"
        )
    
    # 公开接口只返回已发布的文章
    if article.published is False:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文章不存在"
        )
    
    # 手动构建响应，确保正确处理空值和编码
    article_dict = {
        "id": article.id,
        "title": article.title or "",  # 处理可能的空值
        "slug": article.slug,
        "content": article.content or "",  # 处理可能的空值
        "summary": article.summary or "",  # 处理可能的空值
        "custom_css": getattr(article, "custom_css", None),
        "style_key": getattr(article, "style_key", None),
        "published": article.published,
        "author_id": article.author_id,
        "category_id": article.category_id,
        "created_at": article.created_at.isoformat(),
        "updated_at": article.updated_at.isoformat(),
        "author": {
            "id": article.author.id,
            "username": article.author.username,
            "email": getattr(article.author, "email", None),
            "full_name": article.author.full_name if hasattr(article.author, 'full_name') else None
        } if article.author else None,
        "category": {
            "id": article.category.id,
            "name": article.category.name or "",
            "slug": article.category.slug if hasattr(article.category, 'slug') else f"category-{article.category.id}",
            "description": article.category.description if hasattr(article.category, 'description') else None
        } if article.category else None,
        "style": {
            "key": article.style.key,
            "title": article.style.title or "",
            "sort_order": article.style.sort_order or 0,
            "content": article.style.content or "",
            "created_at": article.style.created_at.isoformat(),
            "updated_at": article.style.updated_at.isoformat(),
        } if getattr(article, "style", None) else None,
        "tags": []
    }
    
    # 缓存结果，过期时间使用配置值
    await cache.set(cache_key, article_dict, expire_seconds=settings.ARTICLE_CACHE_PUBLIC_DETAIL_TTL)
    
    return article_dict
