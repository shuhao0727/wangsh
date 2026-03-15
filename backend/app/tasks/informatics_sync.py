from app.celery_app import celery
from app.db.database import AsyncSessionLocal
from app.tasks._async_runner import run as run_async
from app.services.informatics.github_sync import run_github_sync


async def _sync(dry_run: bool = False, trigger_type: str = "schedule", force_recompile: bool = False, progress_hook=None):
    async with AsyncSessionLocal() as db:
        run = await run_github_sync(
            db,
            trigger_type=trigger_type,
            dry_run=dry_run,
            force_recompile=force_recompile,
            progress_hook=progress_hook,
        )
        return {
            "run_id": run.id,
            "status": run.status,
            "created_count": run.created_count,
            "updated_count": run.updated_count,
            "deleted_count": run.deleted_count,
            "skipped_count": run.skipped_count,
        }


@celery.task(bind=True, track_started=True, name="app.tasks.informatics_sync.sync_informatics_from_github")
def sync_informatics_from_github(self, dry_run: bool = False, trigger_type: str = "schedule", force_recompile: bool = False):
    progress_snapshot = {"percent": 0, "done": 0, "total": 0, "phase": "", "current": ""}
    sync_snapshot = {
        "created_paths": [],
        "updated_paths": [],
        "deleted_paths": [],
        "compiled_note_ids": [],
        "compile_failed": [],
    }

    def progress_hook(payload: dict):
        progress_snapshot["percent"] = int(payload.get("percent", 0))
        progress_snapshot["done"] = int(payload.get("done", 0))
        progress_snapshot["total"] = int(payload.get("total", 0))
        progress_snapshot["phase"] = str(payload.get("phase") or "")
        progress_snapshot["current"] = str(payload.get("current") or "")
        sync_snapshot["created_paths"] = payload.get("created_paths") or sync_snapshot["created_paths"]
        sync_snapshot["updated_paths"] = payload.get("updated_paths") or sync_snapshot["updated_paths"]
        sync_snapshot["deleted_paths"] = payload.get("deleted_paths") or sync_snapshot["deleted_paths"]
        sync_snapshot["compiled_note_ids"] = payload.get("compiled_note_ids") or sync_snapshot["compiled_note_ids"]
        sync_snapshot["compile_failed"] = payload.get("compile_failed") or sync_snapshot["compile_failed"]
        self.update_state(
            state="PROGRESS",
            meta={
                "run_id": payload.get("run_id"),
                "progress_percent": progress_snapshot["percent"],
                "progress_done": progress_snapshot["done"],
                "progress_total": progress_snapshot["total"],
                "progress_phase": progress_snapshot["phase"],
                "progress_current": progress_snapshot["current"],
            },
        )

    result = run_async(
        _sync(
            dry_run=dry_run,
            trigger_type=trigger_type,
            force_recompile=force_recompile,
            progress_hook=progress_hook,
        )
    )
    if isinstance(result, dict):
        result["progress_percent"] = 100
        result["progress_done"] = max(progress_snapshot["done"], progress_snapshot["total"])
        result["progress_total"] = max(progress_snapshot["total"], progress_snapshot["done"])
        result["progress_phase"] = "done"
        result["progress_current"] = ""
        result["created_paths"] = sync_snapshot["created_paths"]
        result["updated_paths"] = sync_snapshot["updated_paths"]
        result["deleted_paths"] = sync_snapshot["deleted_paths"]
        result["compiled_note_ids"] = sync_snapshot["compiled_note_ids"]
        result["compile_failed"] = sync_snapshot["compile_failed"]
    return result
