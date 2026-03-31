"""
自主检测 - 管理端 API
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from urllib.parse import quote
from datetime import datetime

from loguru import logger

from app.db.database import get_db
from app.core.deps import get_current_user, require_super_admin
from app.schemas.user_info import UserInfo
from app.core.pubsub import publish
from app.schemas.assessment import (
    AssessmentConfigCreate,
    AssessmentConfigUpdate,
    AssessmentConfigResponse,
    AssessmentConfigListResponse,
    QuestionCreate,
    QuestionUpdate,
    QuestionResponse,
    QuestionListResponse,
    GenerateQuestionsRequest,
    SessionListResponse,
    StatisticsResponse,
    BasicProfileResponse,
    ProfileGenerateRequest,
    ProfileBatchGenerateRequest,
    ProfileResponse,
    ProfileListResponse,
)
from app.services.assessment import (
    create_config,
    get_config,
    get_configs,
    update_config,
    delete_config,
    toggle_config,
    get_config_question_count,
    get_config_session_count,
    create_question,
    get_questions,
    get_question,
    update_question,
    delete_question,
    generate_questions,
    get_config_sessions,
    get_config_statistics,
    get_session_result,
    get_basic_profile,
    generate_profile,
    batch_generate_profiles,
    get_profiles,
    get_profile,
    delete_profile,
    allow_retest,
    batch_allow_retest,
)

router = APIRouter()


# ─── 测评配置管理 ───

def _format_config_response(config, question_count: int = 0, session_count: int = 0) -> dict:
    """格式化配置响应"""
    agent_name = None
    if config.agent and hasattr(config.agent, "name"):
        agent_name = config.agent.name

    creator_name = None
    if config.creator and hasattr(config.creator, "full_name"):
        creator_name = config.creator.full_name

    config_agents = []
    if config.config_agents:
        for ca in config.config_agents:
            if ca.agent:
                config_agents.append({
                    "id": ca.agent.id,
                    "name": ca.agent.name,
                    "agent_type": ca.agent.agent_type,
                })

    return {
        "id": config.id,
        "title": config.title,
        "grade": config.grade,
        "teaching_objectives": config.teaching_objectives,
        "knowledge_points": config.knowledge_points,
        "total_score": config.total_score,
        "question_config": config.question_config,
        "ai_prompt": config.ai_prompt,
        "agent_id": config.agent_id,
        "agent_name": agent_name,
        "time_limit_minutes": config.time_limit_minutes,
        "available_start": config.available_start.isoformat() if config.available_start else None,
        "available_end": config.available_end.isoformat() if config.available_end else None,
        "enabled": config.enabled,
        "created_by_user_id": config.created_by_user_id,
        "creator_name": creator_name,
        "question_count": question_count,
        "session_count": session_count,
        "config_agents": config_agents,
        "created_at": config.created_at,
        "updated_at": config.updated_at,
    }


@router.post("/configs", response_model=AssessmentConfigResponse, dependencies=[Depends(require_super_admin)])
async def api_create_config(
    config_in: AssessmentConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    """创建测评配置"""
    try:
        config = await create_config(db, config_in, current_user.get("id"))
        config = await get_config(db, config.id)  # type: ignore[arg-type]

        # 发布事件
        publish("admin_global", {"type": "assessment_changed", "action": "create", "id": config.id})  # type: ignore[union-attr]

        return _format_config_response(config)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("创建测评配置失败")
        raise HTTPException(status_code=500, detail="创建测评配置失败")


@router.get("/configs", response_model=AssessmentConfigListResponse, dependencies=[Depends(require_super_admin)])
async def api_list_configs(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    grade: Optional[str] = Query(None),
    enabled: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
):
    """测评配置列表"""
    try:
        items, total = await get_configs(db, skip=skip, limit=limit, grade=grade, enabled=enabled, search=search)

        result_items = []
        for config in items:
            qcount = await get_config_question_count(db, config.id)  # type: ignore[arg-type]
            scount = await get_config_session_count(db, config.id)  # type: ignore[arg-type]
            result_items.append(_format_config_response(config, qcount, scount))

        page = (skip // limit) + 1 if limit > 0 else 1
        total_pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "items": result_items,
            "total": total,
            "page": page,
            "page_size": limit,
            "total_pages": total_pages,
        }
    except Exception as e:
        logger.exception("获取测评配置列表失败")
        raise HTTPException(status_code=500, detail="获取测评配置列表失败")


@router.get("/configs/{config_id}", response_model=AssessmentConfigResponse, dependencies=[Depends(require_super_admin)])
async def api_get_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
):
    """测评配置详情"""
    config = await get_config(db, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="测评配置不存在")

    qcount = await get_config_question_count(db, config_id)
    scount = await get_config_session_count(db, config_id)
    return _format_config_response(config, qcount, scount)


@router.put("/configs/{config_id}", response_model=AssessmentConfigResponse, dependencies=[Depends(require_super_admin)])
async def api_update_config(
    config_id: int,
    config_in: AssessmentConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    """更新测评配置"""
    try:
        config = await update_config(db, config_id, config_in)
        if not config:
            raise HTTPException(status_code=404, detail="测评配置不存在")

        config = await get_config(db, config.id)  # type: ignore[arg-type]
        qcount = await get_config_question_count(db, config_id)
        scount = await get_config_session_count(db, config_id)

        # 发布事件
        publish("admin_global", {"type": "assessment_changed", "action": "update", "id": config_id})

        return _format_config_response(config, qcount, scount)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("更新测评配置失败")
        raise HTTPException(status_code=500, detail="更新测评配置失败")


@router.delete("/configs/{config_id}", dependencies=[Depends(require_super_admin)])
async def api_delete_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
):
    """删除测评配置"""
    success = await delete_config(db, config_id)
    if not success:
        raise HTTPException(status_code=404, detail="测评配置不存在")

    # 发布事件
    publish("admin_global", {"type": "assessment_changed", "action": "delete", "id": config_id})

    return {"message": "删除成功"}


@router.put("/configs/{config_id}/toggle", response_model=AssessmentConfigResponse, dependencies=[Depends(require_super_admin)])
async def api_toggle_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
):
    """切换测评配置启用状态"""
    config = await toggle_config(db, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="测评配置不存在")

    config = await get_config(db, config.id)  # type: ignore[arg-type]
    qcount = await get_config_question_count(db, config_id)
    scount = await get_config_session_count(db, config_id)
    return _format_config_response(config, qcount, scount)


# ─── 题库管理 ───

@router.post("/configs/{config_id}/generate-questions", dependencies=[Depends(require_super_admin)])
async def api_generate_questions(
    config_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """AI 批量生成题目"""
    try:
        try:
            body = await request.json()
        except Exception:
            body = {}
        questions = await generate_questions(
            db, config_id,
            count=body.get("count", 5),  # type: ignore[arg-type]
            question_type=body.get("question_type", ""),  # type: ignore[arg-type]
            difficulty=body.get("difficulty", ""),  # type: ignore[arg-type]
            knowledge_points=body.get("knowledge_points", []),  # type: ignore[arg-type]
        )
        return {
            "message": f"成功生成 {len(questions)} 道题目",
            "count": len(questions),
            "items": [QuestionResponse.from_orm(q) for q in questions],
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("AI 生成题目失败")
        raise HTTPException(status_code=500, detail=f"AI 生成题目失败: {str(e)}")


@router.get("/configs/{config_id}/questions", response_model=QuestionListResponse, dependencies=[Depends(require_super_admin)])
async def api_list_questions(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    question_type: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
):
    """题库列表"""
    items, total = await get_questions(db, config_id, skip=skip, limit=limit, question_type=question_type, difficulty=difficulty)

    page = (skip // limit) + 1 if limit > 0 else 1
    total_pages = (total + limit - 1) // limit if limit > 0 else 1

    return {
        "items": [QuestionResponse.from_orm(q) for q in items],
        "total": total,
        "page": page,
        "page_size": limit,
        "total_pages": total_pages,
    }


@router.post("/questions", response_model=QuestionResponse, dependencies=[Depends(require_super_admin)])
async def api_create_question(
    question_in: QuestionCreate,
    db: AsyncSession = Depends(get_db),
):
    """手动添加题目"""
    try:
        question = await create_question(db, question_in)
        return QuestionResponse.from_orm(question)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("创建题目失败")
        raise HTTPException(status_code=500, detail="创建题目失败")


@router.put("/questions/{question_id}", response_model=QuestionResponse, dependencies=[Depends(require_super_admin)])
async def api_update_question(
    question_id: int,
    question_in: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """编辑题目"""
    try:
        question = await update_question(db, question_id, question_in)
        if not question:
            raise HTTPException(status_code=404, detail="题目不存在")
        return QuestionResponse.from_orm(question)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("更新题目失败")
        raise HTTPException(status_code=500, detail="更新题目失败")


@router.delete("/questions/{question_id}", dependencies=[Depends(require_super_admin)])
async def api_delete_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
):
    """删除题目"""
    success = await delete_question(db, question_id)
    if not success:
        raise HTTPException(status_code=404, detail="题目不存在")
    return {"message": "删除成功"}


# ─── 答题统计 ───

@router.get("/configs/{config_id}/class-names", dependencies=[Depends(require_super_admin)])
async def api_get_class_names(
    config_id: int,
    db: AsyncSession = Depends(get_db),
):
    """获取该测评下参与学生的班级列表"""
    try:
        from sqlalchemy import select
        from app.models.core.user import User
        from app.models.assessment.session import AssessmentSession as Sess
        result = await db.execute(
            select(User.class_name)
            .join(Sess, Sess.user_id == User.id)
            .where(Sess.config_id == config_id)
            .where(User.class_name.isnot(None))
            .where(User.class_name != "")
            .distinct()
            .order_by(User.class_name)
        )
        names = [r[0] for r in result.all()]
        return {"class_names": names}
    except Exception as e:
        logger.exception("获取班级列表失败")
        raise HTTPException(status_code=500, detail="获取班级列表失败")


@router.get("/configs/{config_id}/sessions", response_model=SessionListResponse, dependencies=[Depends(require_super_admin)])
async def api_list_sessions(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    class_name: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """学生答题情况列表"""
    try:
        items, total = await get_config_sessions(
            db, config_id, skip=skip, limit=limit,
            class_name=class_name or None, status=status or None,
            search=search.strip() if search else None,
        )
        page = (skip // limit) + 1 if limit > 0 else 1
        total_pages = (total + limit - 1) // limit if limit > 0 else 1
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": limit,
            "total_pages": total_pages,
        }
    except Exception as e:
        logger.exception("获取答题列表失败")
        raise HTTPException(status_code=500, detail="获取答题列表失败")


@router.post("/sessions/{session_id}/allow-retest", dependencies=[Depends(require_super_admin)])
async def api_allow_retest(
    session_id: int,
    db: AsyncSession = Depends(get_db),
):
    """管理员允许学生重新测试"""
    try:
        result = await allow_retest(db, session_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("允许重测失败")
        raise HTTPException(status_code=500, detail="允许重测失败")


@router.post("/configs/{config_id}/batch-retest", dependencies=[Depends(require_super_admin)])
async def api_batch_retest(
    config_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """批量允许重测"""
    try:
        body = await request.json()
        session_ids = body.get("session_ids")
        class_name = body.get("class_name")
        result = await batch_allow_retest(db, config_id, session_ids=session_ids, class_name=class_name)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("批量重测失败")
        raise HTTPException(status_code=500, detail="批量重测失败")


@router.get("/sessions/{session_id}", dependencies=[Depends(require_super_admin)])
async def api_get_session_detail(
    session_id: int,
    db: AsyncSession = Depends(get_db),
):
    """管理员查看学生答题详情"""
    try:
        from app.models.assessment import AssessmentSession, AssessmentAnswer, AssessmentConfig, AssessmentBasicProfile
        from sqlalchemy import select as sa_select
        from sqlalchemy.orm import selectinload as sa_selectinload

        result = await db.execute(
            sa_select(AssessmentSession)
            .options(
                sa_selectinload(AssessmentSession.answers)
                .selectinload(AssessmentAnswer.question)
            )
            .where(AssessmentSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")

        config_r = await db.execute(
            sa_select(AssessmentConfig).where(AssessmentConfig.id == session.config_id)
        )
        config = config_r.scalar_one()

        bp_r = await db.execute(
            sa_select(AssessmentBasicProfile).where(AssessmentBasicProfile.session_id == session_id)
        )
        bp = bp_r.scalar_one_or_none()

        answers_detail = []
        for a in session.answers:
            q = a.question
            answers_detail.append({
                "id": a.id,
                "question_type": a.question_type,
                "content": q.content if q else "",
                "options": q.options if q else None,
                "student_answer": a.student_answer,
                "correct_answer": q.correct_answer if q else "",
                "is_correct": a.is_correct,
                "earned_score": a.ai_score,
                "max_score": a.max_score,
                "ai_feedback": a.ai_feedback,
                "explanation": q.explanation if q else None,
            })

        return {
            "session_id": session.id,
            "config_id": config.id,
            "config_title": config.title,
            "status": session.status,
            "earned_score": session.earned_score,
            "total_score": session.total_score,
            "started_at": session.started_at,
            "submitted_at": session.submitted_at,
            "answers": answers_detail,
            "basic_profile_id": bp.id if bp else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("获取答题详情失败")
        raise HTTPException(status_code=500, detail="获取答题详情失败")


@router.get("/sessions/{session_id}/basic-profile", dependencies=[Depends(require_super_admin)])
async def api_admin_get_basic_profile(
    session_id: int,
    db: AsyncSession = Depends(get_db),
):
    """管理员查看学生初级画像"""
    from app.services.assessment.session_service import _calc_knowledge_rates

    profile = await get_basic_profile(db, session_id)
    if not profile:
        raise HTTPException(status_code=404, detail="初级画像不存在")
    class_rates = await _calc_knowledge_rates(db, profile.config_id)  # type: ignore[arg-type]
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


@router.get("/configs/{config_id}/statistics", response_model=StatisticsResponse, dependencies=[Depends(require_super_admin)])
async def api_get_statistics(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    class_name: Optional[str] = Query(None),
):
    """答题统计"""
    try:
        return await get_config_statistics(db, config_id, class_name=class_name or None)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("获取统计数据失败")
        raise HTTPException(status_code=500, detail="获取统计数据失败")


# ─── 三维融合画像 ───


def _format_profile_response(profile) -> dict:
    """格式化画像响应"""
    config_title = None
    if profile.config and hasattr(profile.config, "title"):
        config_title = profile.config.title
    creator_name = None
    if profile.creator and hasattr(profile.creator, "full_name"):
        creator_name = profile.creator.full_name

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
        "creator_name": creator_name,
        "created_at": profile.created_at,
    }


@router.post("/profiles/generate", response_model=ProfileResponse, dependencies=[Depends(require_super_admin)])
async def api_generate_profile(
    req: ProfileGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    """生成三维融合画像"""
    try:
        profile = await generate_profile(db, req, current_user.get("id"))
        profile = await get_profile(db, profile.id)  # type: ignore[arg-type]
        return _format_profile_response(profile)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("生成画像失败")
        raise HTTPException(status_code=500, detail=f"生成画像失败: {str(e)}")


@router.post("/profiles/batch-generate", dependencies=[Depends(require_super_admin)])
async def api_batch_generate_profiles(
    req: ProfileBatchGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    """批量生成画像"""
    try:
        profile_ids = await batch_generate_profiles(db, req, current_user.get("id"))
        items = []
        for pid in profile_ids:
            loaded = await get_profile(db, pid)
            if loaded:
                items.append(_format_profile_response(loaded))
        return {"items": items, "count": len(items)}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("批量生成画像失败")
        raise HTTPException(status_code=500, detail=f"批量生成画像失败: {str(e)}")


@router.get("/profiles", response_model=ProfileListResponse, dependencies=[Depends(require_super_admin)])
async def api_list_profiles(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    profile_type: Optional[str] = Query(None),
    target_id: Optional[str] = Query(None),
):
    """画像列表"""
    items, total = await get_profiles(db, skip=skip, limit=limit, profile_type=profile_type, target_id=target_id)
    page = (skip // limit) + 1 if limit > 0 else 1
    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    return {
        "items": [_format_profile_response(p) for p in items],
        "total": total,
        "page": page,
        "page_size": limit,
        "total_pages": total_pages,
    }


@router.get("/profiles/{profile_id}", response_model=ProfileResponse, dependencies=[Depends(require_super_admin)])
async def api_get_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
):
    """画像详情"""
    profile = await get_profile(db, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="画像不存在")
    return _format_profile_response(profile)


@router.delete("/profiles/{profile_id}", dependencies=[Depends(require_super_admin)])
async def api_delete_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
):
    """删除画像"""
    success = await delete_profile(db, profile_id)
    if not success:
        raise HTTPException(status_code=404, detail="画像不存在")
    return {"message": "删除成功"}


@router.get("/configs/{config_id}/export", dependencies=[Depends(require_super_admin)])
async def api_export_sessions(
    config_id: int,
    class_name: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """导出答题数据 XLSX"""
    from app.services.assessment.export_service import build_assessment_export_xlsx

    config = await get_config(db, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="测评配置不存在")

    output = await build_assessment_export_xlsx(db, config_id, class_name, status, search)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    parts = [config.title or "测评数据"]
    if class_name:
        parts.append(class_name)
    if status:
        parts.append(status)
    parts.append(timestamp)
    filename = "_".join(str(p) for p in parts) + ".xlsx"
    fallback = f"assessment_export_{timestamp}.xlsx"
    quoted = quote(filename)
    headers = {"Content-Disposition": f'attachment; filename="{fallback}"; filename*=UTF-8\'\'{quoted}'}
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )
