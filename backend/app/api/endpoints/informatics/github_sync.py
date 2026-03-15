from datetime import datetime
from typing import Any, Dict, List

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.celery_app import celery
from app.core.deps import get_db, require_admin
from app.core.config import settings
from app.models.informatics.github_sync_run import InformaticsGithubSyncRun
from app.schemas.informatics.github_sync import (
    GithubSyncRunItem,
    GithubSyncSettingsResponse,
    GithubSyncTaskStatusResponse,
    GithubSyncSettingsUpdate,
    GithubSyncTestRequest,
    GithubSyncTestResponse,
    GithubSyncTriggerRequest,
)
from app.services.informatics.github_sync import (
    decrypt_api_key,
    get_or_create_sync_settings,
    run_github_sync,
    serialize_sync_settings,
    test_connection,
    try_decrypt_api_key,
    update_sync_settings,
)

router = APIRouter(prefix="/informatics/sync/github", tags=["Informatics - GitHub Sync"])


@router.get("/settings", response_model=GithubSyncSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    try:
        return await serialize_sync_settings(db)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings", response_model=GithubSyncSettingsResponse)
async def put_settings(
    payload: GithubSyncSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_admin),
):
    try:
        return await update_sync_settings(
            db,
            repo_url=payload.repo_url,
            branch=payload.branch,
            token=payload.token,
            enabled=payload.enabled,
            interval_hours=payload.interval_hours,
            delete_mode=payload.delete_mode,
            updated_by_id=current_user.get("id"),
        )
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/test-connection", response_model=GithubSyncTestResponse)
async def post_test_connection(
    payload: GithubSyncTestRequest,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    token = (payload.token or "").strip()
    if token in {"", "__use_saved_token__"}:
        cfg = await get_or_create_sync_settings(db)
        if cfg.token_encrypted:
            token = try_decrypt_api_key(cfg.token_encrypted)
        if not token:
            token = (getattr(settings, "GITHUB_SYNC_TOKEN", "") or "").strip()
        if not token:
            raise HTTPException(status_code=400, detail="未提供可用 Token（缺少加密密钥或未保存 Token）")
    try:
        ok, msg, owner, repo = await test_connection(payload.repo_url, payload.branch, token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    item = await get_or_create_sync_settings(db)
    item.last_test_status = "success" if ok else "failed"
    item.last_test_message = msg

    item.last_test_at = datetime.now()
    await db.commit()
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return GithubSyncTestResponse(ok=True, message=msg, repo_owner=owner, repo_name=repo, branch=payload.branch)


@router.post("/trigger", response_model=GithubSyncRunItem)
async def post_trigger_sync(
    payload: GithubSyncTriggerRequest,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    use_celery = bool(getattr(settings, "TYPST_COMPILE_USE_CELERY", False))
    if use_celery and not payload.dry_run:
        task = celery.send_task(
            "app.tasks.informatics_sync.sync_informatics_from_github",
            kwargs={"dry_run": payload.dry_run, "trigger_type": "manual", "force_recompile": bool(payload.force_recompile)},
            queue="typst",
        )
        return GithubSyncRunItem(
            id=0,
            trigger_type="manual",
            status=f"queued:{task.id}",
            repo_owner="",
            repo_name="",
            branch="",
            created_count=0,
            updated_count=0,
            deleted_count=0,
            skipped_count=0,
            started_at=datetime.now(),
            task_id=task.id,
        )
    try:
        run = await run_github_sync(
            db,
            trigger_type="manual",
            dry_run=payload.dry_run,
            force_recompile=bool(payload.force_recompile),
        )
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return GithubSyncRunItem.model_validate(run, from_attributes=True)


@router.get("/runs", response_model=List[GithubSyncRunItem])
async def get_runs(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
):
    lim = max(1, min(limit, 100))
    res = await db.execute(select(InformaticsGithubSyncRun).order_by(desc(InformaticsGithubSyncRun.id)).limit(lim))
    rows = list(res.scalars().all())
    return [GithubSyncRunItem.model_validate(x, from_attributes=True) for x in rows]


@router.get("/task-status", response_model=GithubSyncTaskStatusResponse)
async def get_task_status(
    task_id: str = Query(..., min_length=1),
    _: Dict[str, Any] = Depends(require_admin),
):
    result = AsyncResult(task_id, app=celery)
    state = str(result.state or "PENDING")
    meta = result.info if isinstance(result.info, dict) else {}
    error = None
    if state == "FAILURE":
        error = str(result.info) if result.info else "同步任务失败"
    percent = int(meta.get("progress_percent") or (100 if state == "SUCCESS" else 0))
    done = int(meta.get("progress_done") or 0)
    total = int(meta.get("progress_total") or 0)
    phase = str(meta.get("progress_phase") or "")
    current = str(meta.get("progress_current") or "")
    created_paths = list(meta.get("created_paths") or [])
    updated_paths = list(meta.get("updated_paths") or [])
    deleted_paths = list(meta.get("deleted_paths") or [])
    compiled_note_ids = [int(x) for x in (meta.get("compiled_note_ids") or [])]
    compile_failed = list(meta.get("compile_failed") or [])
    return GithubSyncTaskStatusResponse(
        task_id=task_id,
        state=state,
        ready=bool(result.ready()),
        successful=bool(result.successful()),
        progress_percent=max(0, min(100, percent)),
        progress_done=done,
        progress_total=total,
        progress_phase=phase,
        progress_current=current,
        created_paths=created_paths,
        updated_paths=updated_paths,
        deleted_paths=deleted_paths,
        compiled_note_ids=compiled_note_ids,
        compile_failed=compile_failed,
        error=error,
    )
