"""
自主检测 - 学生端 API
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from loguru import logger

from app.db.database import get_db
from app.core.deps import get_current_user
from app.schemas.user_info import UserInfo
from app.schemas.assessment import (
    SessionStartRequest,
    AnswerSubmitRequest,
    BasicProfileResponse,
    ProfileResponse,
    ProfileListResponse,
)
from app.services.assessment import (
    get_available_configs,
    start_session,
    get_session_questions,
    submit_answer,
    submit_session,
    get_session_result,
    get_basic_profile,
    get_my_profiles,
    get_profile,
)

router = APIRouter()


@router.get("/available")
async def api_available(
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    """获取学生可用的测评列表"""
    try:
        return await get_available_configs(db, current_user.get("id"))
    except Exception as e:
        logger.exception("获取可用测评列表失败")
        raise HTTPException(status_code=500, detail="获取可用测评列表失败")


@router.post("/sessions/start")
async def api_start_session(
    req: SessionStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    """开始检测"""
    try:
        return await start_session(db, req.config_id, current_user.get("id"))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("开始检测失败")
        raise HTTPException(status_code=500, detail="开始检测失败")


@router.get("/sessions/{session_id}/questions")
async def api_get_questions(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    """获取本次检测的题目列表（不含答案）"""
    try:
        return await get_session_questions(db, session_id, current_user.get("id"))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("获取题目列表失败")
        raise HTTPException(status_code=500, detail="获取题目列表失败")


@router.post("/sessions/{session_id}/answer")
async def api_submit_answer(
    session_id: int,
    req: AnswerSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    """提交单题答案"""
    try:
        return await submit_answer(
            db, session_id, current_user.get("id"),
            req.answer_id, req.student_answer,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("提交答案失败")
        raise HTTPException(status_code=500, detail="提交答案失败")


@router.post("/sessions/{session_id}/submit")
async def api_submit_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    """提交整卷"""
    try:
        result = await submit_session(db, session_id, current_user.get("id"))
        # 触发后台初级画像生成
        bg_basic = result.pop("_bg_basic_params", None)
        if bg_basic:
            from app.services.assessment.session_service import _generate_basic_profile_bg
            background_tasks.add_task(
                _generate_basic_profile_bg,
                bg_basic["session_id"], bg_basic["config_id"],
            )
        # 触发后台三维画像生成（FastAPI BackgroundTasks 按添加顺序串行执行）
        bg_params = result.pop("_bg_profile_params", None)
        if bg_params:
            from app.services.assessment.session_service import _generate_advanced_profile_bg
            background_tasks.add_task(
                _generate_advanced_profile_bg,
                bg_params["config_id"], bg_params["user_id"], bg_params["agent_id"],
            )
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("提交检测失败")
        raise HTTPException(status_code=500, detail="提交检测失败")


@router.get("/sessions/{session_id}/result")
async def api_get_result(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    """查看检测结果"""
    try:
        return await get_session_result(db, session_id, current_user.get("id"))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("获取检测结果失败")
        raise HTTPException(status_code=500, detail="获取检测结果失败")


@router.get("/sessions/{session_id}/basic-profile")
async def api_get_basic_profile(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    """查看初级画像"""
    try:
        from app.services.assessment.session_service import _calc_knowledge_rates

        profile = await get_basic_profile(db, session_id)
        if not profile:
            raise HTTPException(status_code=404, detail="初级画像不存在")
        if profile.user_id != current_user.get("id"):
            raise HTTPException(status_code=403, detail="无权查看此画像")
        # 动态计算班级平均知识点得分率
        class_rates = await _calc_knowledge_rates(db, profile.config_id)
        return {
            "id": profile.id,
            "session_id": profile.session_id,
            "user_id": profile.user_id,
            "config_id": profile.config_id,
            "earned_score": profile.earned_score,
            "total_score": profile.total_score,
            "knowledge_scores": profile.knowledge_scores,
            "wrong_points": profile.wrong_points,
            "ai_summary": profile.ai_summary,
            "created_at": profile.created_at,
            "class_knowledge_rates": class_rates,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("获取初级画像失败")
        raise HTTPException(status_code=500, detail="获取初级画像失败")


@router.get("/sessions/{session_id}/profile-status")
async def api_profile_status(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    """查询画像生成进度（轮询用）"""
    from sqlalchemy import select
    from app.models.assessment import AssessmentBasicProfile, AssessmentSession
    from app.models.assessment import StudentProfile

    # 验证 session 归属
    sess_result = await db.execute(
        select(AssessmentSession).where(AssessmentSession.id == session_id)
    )
    session = sess_result.scalar_one_or_none()
    if not session or session.user_id != current_user.get("id"):
        raise HTTPException(status_code=404, detail="会话不存在")

    # 检查初级画像
    bp_result = await db.execute(
        select(AssessmentBasicProfile.id)
        .where(AssessmentBasicProfile.session_id == session_id)
        .limit(1)
    )
    basic_ready = bp_result.scalar_one_or_none() is not None

    # 检查三维画像
    ap_result = await db.execute(
        select(StudentProfile.id)
        .where(
            StudentProfile.profile_type == "individual",
            StudentProfile.target_id == str(session.user_id),
            StudentProfile.config_id == session.config_id,
        )
        .limit(1)
    )
    advanced_exists = ap_result.scalar_one_or_none() is not None
    advanced_ready = bool(basic_ready and advanced_exists)

    return {"basic_ready": basic_ready, "advanced_ready": advanced_ready}


# ─── 三维融合画像（学生端） ───


def _format_student_profile(profile) -> dict:
    """格式化学生画像响应"""
    config_title = None
    if profile.config and hasattr(profile.config, "title"):
        config_title = profile.config.title
    return {
        "id": profile.id,
        "profile_type": profile.profile_type,
        "target_id": profile.target_id,
        "config_id": profile.config_id,
        "config_title": config_title,
        "discussion_session_id": profile.discussion_session_id,
        "agent_ids": profile.agent_ids,
        "data_sources": profile.data_sources,
        "result_text": profile.result_text,
        "scores": profile.scores,
        "created_by_user_id": profile.created_by_user_id,
        "creator_name": None,
        "created_at": profile.created_at,
    }


@router.get("/my-profiles", response_model=ProfileListResponse)
async def api_my_profiles(
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """学生查看自己的三维画像列表"""
    items, total = await get_my_profiles(db, current_user.get("id"), skip=skip, limit=limit)
    page = (skip // limit) + 1 if limit > 0 else 1
    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    return {
        "items": [_format_student_profile(p) for p in items],
        "total": total,
        "page": page,
        "page_size": limit,
        "total_pages": total_pages,
    }


@router.get("/my-profiles/{profile_id}", response_model=ProfileResponse)
async def api_my_profile_detail(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    """学生查看自己的三维画像详情"""
    profile = await get_profile(db, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="画像不存在")
    if not current_user.get("id") or profile.target_id != str(current_user.get("id")):
        raise HTTPException(status_code=403, detail="无权查看此画像")
    return _format_student_profile(profile)
