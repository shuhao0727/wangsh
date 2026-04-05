from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user, require_super_admin, require_admin
from app.schemas.agents import (
    AIAgentCreate,
    AIAgentUpdate,
    AIAgentResponse,
    AIAgentListResponse,
    AgentTestRequest,
    AgentTestResponse,
    AgentRevealKeyRequest,
    AgentRevealKeyResponse,
    AgentStatisticsData,
    ModelDiscoveryRequest,
    ModelDiscoveryResponse,
)
from app.services.agents import (
    create_agent,
    get_agent,
    get_agents,
    update_agent,
    delete_agent,
    test_agent,
    discover_models_service,
    get_agent_statistics,
    get_active_agents,
)
from app.core.pubsub import publish
from app.utils.agent_secrets import last4, try_decrypt_api_key
from app.services.auth import authenticate_user
from app.utils.errors import safe_error_detail

router = APIRouter()

def _api_key_last4(agent) -> Optional[str]:
    v = getattr(agent, "api_key_last4", None)
    if v:
        return v
    legacy = getattr(agent, "api_key", None)
    return last4(legacy)


def _format_agent_response(agent) -> AIAgentResponse:
    """统一的 agent → AIAgentResponse 转换"""
    api_key_last = _api_key_last4(agent)
    has_key = bool(getattr(agent, "has_api_key", False) or api_key_last)
    return AIAgentResponse(**{
        "id": agent.id,
        "name": agent.name,
        "agent_name": agent.name,
        "agent_type": agent.agent_type,
        "description": agent.description,
        "model_name": agent.model_name,
        "system_prompt": getattr(agent, "system_prompt", None),
        "api_endpoint": agent.api_endpoint,
        "api_key": None,
        "has_api_key": has_key,
        "api_key_last4": api_key_last,
        "is_active": agent.is_active,
        "status": agent.is_active,
        "is_deleted": agent.is_deleted,
        "created_at": agent.created_at,
        "deleted_at": agent.deleted_at,
    })


@router.get("/", response_model=AIAgentListResponse)
async def read_agents(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0, description="跳过的记录数"),
    limit: int = Query(100, ge=1, le=1000, description="每页记录数"),
    search: Optional[str] = Query(None, description="搜索关键词（名称或类型）"),
    agent_type: Optional[str] = Query(None, description="智能体类型过滤"),
    is_active: Optional[bool] = Query(None, description="是否启用过滤"),
    include_deleted: bool = Query(False, description="是否包含已删除的智能体"),
    _: dict = Depends(require_admin),
):
    try:
        agents = await get_agents(
            db,
            skip=skip,
            limit=limit,
            search=search,
            agent_type=agent_type,
            is_active=is_active,
            include_deleted=include_deleted,
        )

        agent_responses = []
        for agent in agents:
            agent_responses.append(_format_agent_response(agent))

        total = len(agents)
        page = (skip // limit) + 1 if limit > 0 else 1
        total_pages = (total + limit - 1) // limit if limit > 0 else 1

        return AIAgentListResponse(
            items=agent_responses,
            total=total,
            page=page,
            page_size=limit,
            total_pages=total_pages,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("获取智能体列表失败", e),
        )


@router.get("/active", response_model=List[AIAgentResponse])
async def read_active_agents(
    db: AsyncSession = Depends(get_db),
):
    try:
        agents = await get_active_agents(db)

        agent_responses = []
        for agent in agents:
            agent_responses.append(_format_agent_response(agent))

        return agent_responses
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("获取启用智能体列表失败", e),
        )


@router.get("/statistics", response_model=AgentStatisticsData)
async def get_agents_statistics(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    try:
        return await get_agent_statistics(db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("获取智能体统计数据失败", e),
        )


@router.get("/{agent_id}", response_model=AIAgentResponse)
async def read_agent(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    try:
        agent = await get_agent(db, agent_id)
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"智能体ID {agent_id} 不存在",
            )

        return _format_agent_response(agent)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("获取智能体详情失败", e),
        )


@router.post("/", response_model=AIAgentResponse, status_code=status.HTTP_201_CREATED)
async def create_new_agent(
    agent_in: AIAgentCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    try:
        agent = await create_agent(db, agent_in=agent_in)

        # 发布事件
        await publish("admin_global", {"type": "agent_changed", "action": "create", "id": agent.id})

        return _format_agent_response(agent)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("创建智能体失败", e),
        )


@router.put("/{agent_id}", response_model=AIAgentResponse)
async def update_existing_agent(
    agent_id: int,
    agent_in: AIAgentUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    try:
        agent = await update_agent(db, agent_id=agent_id, agent_in=agent_in)
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"智能体ID {agent_id} 不存在",
            )

        # 发布事件
        await publish("admin_global", {"type": "agent_changed", "action": "update", "id": agent_id})

        return _format_agent_response(agent)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("更新智能体失败", e),
        )


@router.delete("/{agent_id}")
async def delete_existing_agent(
    agent_id: int,
    hard_delete: bool = Query(False, description="是否硬删除（永久删除）"),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    try:
        success = await delete_agent(db, agent_id=agent_id, hard_delete=hard_delete)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"智能体ID {agent_id} 不存在",
            )

        # 发布事件
        await publish("admin_global", {"type": "agent_changed", "action": "delete", "id": agent_id})

        return {"success": True, "message": "智能体删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("删除智能体失败", e),
        )


@router.post("/test", response_model=AgentTestResponse)
async def test_agent_connection(
    test_request: AgentTestRequest,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    try:
        return await test_agent(db, test_request=test_request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("测试智能体失败", e),
        )


@router.post("/{agent_id}/discover-models", response_model=ModelDiscoveryResponse)
async def discover_agent_models(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    try:
        agent = await get_agent(db, agent_id)
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"智能体ID {agent_id} 不存在",
            )

        api_key = try_decrypt_api_key(getattr(agent, "api_key_encrypted", None)) or getattr(agent, "api_key", None)
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该智能体未配置API密钥",
            )

        if not agent.api_endpoint:  # type: ignore[truthy-bool]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该智能体未配置API地址",
            )

        request = ModelDiscoveryRequest(api_endpoint=str(agent.api_endpoint), api_key=str(api_key), provider=None)
        return await discover_models_service(request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_detail("发现模型失败", e),
        )


@router.post(
    "/{agent_id}/reveal-api-key",
    response_model=AgentRevealKeyResponse,
    dependencies=[Depends(require_super_admin)],
)
async def reveal_agent_api_key(
    agent_id: int,
    req: AgentRevealKeyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user = await authenticate_user(db, current_user["username"], req.admin_password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="管理员密码验证失败")

    agent = await get_agent(db, agent_id)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"智能体ID {agent_id} 不存在")

    api_key = try_decrypt_api_key(getattr(agent, "api_key_encrypted", None)) or getattr(agent, "api_key", None)
    if not api_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="该智能体未配置API密钥")

    return AgentRevealKeyResponse(api_key=str(api_key))
