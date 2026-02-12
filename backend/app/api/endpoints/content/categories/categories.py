"""
分类管理 API 端点
提供分类的完整CRUD操作，需要超级管理员权限
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.deps import require_super_admin, require_user
from app.schemas.articles import CategoryCreate, CategoryUpdate, CategoryResponse
from app.services.articles.category import CategoryService
from app.core.config import settings

router = APIRouter()


@router.get("", response_model=Dict[str, Any])
async def list_categories(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(settings.CATEGORY_PAGE_SIZE_DEFAULT, ge=1, le=settings.CATEGORY_PAGE_SIZE_MAX, description="每页数量"),
    include_usage_count: bool = Query(False, description="是否包含使用次数"),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_user)
) -> Dict[str, Any]:
    """
    获取分类列表（支持分页）
    
    权限：任何登录用户
    """
    result = await CategoryService.list_categories(
        db=db,
        page=page,
        size=size,
        include_usage_count=include_usage_count
    )
    
    return {
        "total": result["total"],
        "categories": result["categories"],
        "page": page,
        "size": size,
        "total_pages": result["total_pages"]
    }


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_super_admin)
) -> Any:
    """
    创建新分类
    
    权限：超级管理员
    """
    try:
        category = await CategoryService.create_category(
            db=db,
            category_data=category_data
        )
        
        return category
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建分类失败: {str(e)}"
        )


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_user)
) -> Any:
    """
    根据ID获取分类详情
    
    权限：任何登录用户
    """
    category = await CategoryService.get_category_by_id(db=db, category_id=category_id)
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"分类ID {category_id} 不存在"
        )
    
    return category


@router.get("/slug/{slug}", response_model=CategoryResponse)
async def get_category_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_user)
) -> Any:
    """
    根据slug获取分类详情
    
    权限：任何登录用户
    """
    category = await CategoryService.get_category_by_slug(db=db, slug=slug)
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"分类slug '{slug}' 不存在"
        )
    
    return category


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_super_admin)
) -> Any:
    """
    更新分类
    
    权限：超级管理员
    """
    try:
        category = await CategoryService.update_category(
            db=db,
            category_id=category_id,
            category_data=category_data
        )
        
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"分类ID {category_id} 不存在"
            )
        
        return category
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新分类失败: {str(e)}"
        )


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_super_admin)
) -> None:
    """
    删除分类
    
    权限：超级管理员
    """
    success = await CategoryService.delete_category(db=db, category_id=category_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"分类ID {category_id} 不存在"
        )


@router.get("/search", response_model=List[CategoryResponse])
async def search_categories(
    keyword: str = Query(..., min_length=1, description="搜索关键词"),
    limit: int = Query(settings.CATEGORY_SEARCH_LIMIT, ge=1, le=100, description="返回结果数量限制"),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_user)
) -> Any:
    """
    搜索分类（按名称或slug模糊匹配）
    
    权限：任何登录用户
    """
    categories = await CategoryService.search_categories(
        db=db,
        keyword=keyword,
        limit=limit
    )
    
    return categories


@router.get("/popular", response_model=List[Dict[str, Any]])
async def get_popular_categories(
    limit: int = Query(settings.CATEGORY_POPULAR_LIMIT, ge=1, le=50, description="返回热门分类数量"),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_user)
) -> Any:
    """
    获取热门分类（按文章数量排序）
    
    权限：任何登录用户
    """
    popular_categories = await CategoryService.get_popular_categories(
        db=db,
        limit=limit
    )
    
    return popular_categories


@router.post("/get-or-create", response_model=CategoryResponse)
async def get_or_create_category(
    name: str = Query(..., min_length=1, description="分类名称"),
    slug: Optional[str] = Query(None, description="分类slug，如果不提供则从名称生成"),
    description: Optional[str] = Query(None, description="分类描述"),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_super_admin)
) -> Any:
    """
    获取或创建分类
    如果分类不存在，则创建新分类；如果已存在，则返回现有分类
    
    权限：超级管理员
    """
    try:
        category = await CategoryService.get_or_create_category(
            db=db,
            name=name,
            slug=slug,
            description=description
        )
        
        return category
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取或创建分类失败: {str(e)}"
        )


@router.get("/{category_id}/stats", response_model=Dict[str, Any])
async def get_category_stats(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_user)
) -> Any:
    """
    获取分类统计信息
    
    权限：任何登录用户
    """
    try:
        stats = await CategoryService.get_category_stats(
            db=db,
            category_id=category_id
        )
        
        return stats
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取分类统计信息失败: {str(e)}"
        )


@router.get("/{category_id}/articles", response_model=Dict[str, Any])
async def get_category_articles(
    category_id: int,
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(settings.ARTICLE_PAGE_SIZE_DEFAULT, ge=1, le=settings.ARTICLE_PAGE_SIZE_MAX, description="每页数量"),
    published_only: bool = Query(True, description="是否只显示已发布的文章"),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_user)
) -> Dict[str, Any]:
    """
    获取属于该分类的文章列表
    
    权限：任何登录用户
    """
    # 先检查分类是否存在
    category = await CategoryService.get_category_by_id(db=db, category_id=category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"分类ID {category_id} 不存在"
        )
    
    # 通过文章服务获取该分类的文章
    from app.services.articles.article import ArticleService
    
    result = await ArticleService.list_articles(
        db=db,
        page=page,
        size=size,
        published_only=published_only,
        category_id=category_id,
        include_relations=True
    )
    
    return {
        "category": {
            "id": category.id,
            "name": category.name,
            "slug": category.slug,
            "description": category.description
        },
        "total": result["total"],
        "articles": result["articles"],
        "page": page,
        "size": size,
        "total_pages": result["total_pages"]
    }


@router.get("/public/list", response_model=Dict[str, Any])
async def list_public_categories(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(50, ge=1, le=100, description="每页数量"),
    include_usage_count: bool = Query(True, description="是否包含文章数量统计"),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    获取公开分类列表（支持分页）
    
    权限：无需认证，公开访问
    注意：公开接口可以返回使用次数统计，默认包含文章数量
    """
    # 调用分类服务，设置 include_usage_count=True（默认）
    result = await CategoryService.list_categories(
        db=db,
        page=page,
        size=size,
        include_usage_count=include_usage_count  # 公开接口也返回使用次数
    )
    
    return {
        "total": result["total"],
        "categories": result["categories"],
        "page": page,
        "size": size,
        "total_pages": result["total_pages"]
    }
