import base64
import logging
import mimetypes
import os
import posixpath
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Dict, List, Optional, Tuple
from urllib.parse import quote, urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.http_client import get_http_client
from app.models.informatics.github_sync_run import InformaticsGithubSyncRun
from app.models.informatics.github_sync_setting import InformaticsGithubSyncSetting
from app.models.informatics.github_sync_source import InformaticsGithubSyncSource
from app.models.informatics.typst_note import TypstNote
from app.services.informatics.typst_notes import compile_note_pdf, create_note, list_assets, update_note, upsert_asset
from app.utils.agent_secrets import decrypt_api_key, encrypt_api_key, last4, try_decrypt_api_key
from app.utils.cache import cache
from app.utils.typst_asset_validation import normalize_asset_path
from app.utils.typst_pdf_storage import abs_pdf_path

logger = logging.getLogger(__name__)


def parse_repo_from_url(repo_url: str) -> Tuple[str, str]:
    s = (repo_url or "").strip()
    if s.startswith("git@github.com:"):
        raw = s.split("git@github.com:", 1)[1]
    else:
        p = urlparse(s)
        raw = p.path.lstrip("/")
    raw = raw[:-4] if raw.endswith(".git") else raw
    parts = [x for x in raw.split("/") if x]
    if len(parts) < 2:
        raise ValueError("GitHub 仓库地址无效")
    return parts[0], parts[1]


def _auth_headers(token: str) -> Dict[str, str]:
    return {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "wangsh-github-sync",
    }


def _masked_token(encrypted: Optional[str]) -> str:
    if not encrypted:
        return ""
    try:
        from app.utils.agent_secrets import try_decrypt_api_key
        plain = try_decrypt_api_key(encrypted)
        if plain:
            return f"********{last4(plain)}"
        return "********(密钥未配置)"
    except Exception:
        return "********"


def _title_from_typst(content: str, fallback_path: str) -> str:
    base = posixpath.basename((fallback_path or "").strip())
    stem = base.rsplit(".", 1)[0] if "." in base else base
    if stem:
        return stem[:200]
    first_h1 = ""
    for line in (content or "").splitlines():
        m1 = re.match(r"^\s*=\s+(.+?)\s*$", line)
        if m1:
            first_h1 = m1.group(1).strip()
            break
    return first_h1[:200] if first_h1 else "untitled"


def _category_from_path(path: str) -> str:
    norm = (path or "").strip()
    if not norm.startswith("chapters/"):
        return ""
    parts = norm.split("/")
    if len(parts) >= 2:
        return parts[1]
    return ""


def _guess_mime(path: str) -> str:
    mime, _ = mimetypes.guess_type(path)
    return mime or "application/octet-stream"


def _extract_image_refs(content: str, source_path: str) -> List[str]:
    refs = re.findall(r'image\(\s*["\']([^"\']+)["\']', content or "")
    base = posixpath.dirname(source_path or "main.typ") or "."
    out: List[str] = []
    for ref in refs:
        if "://" in ref:
            continue
        joined = posixpath.normpath(posixpath.join(base, ref))
        if joined.startswith("../"):
            continue
        if not joined.startswith("image/"):
            continue
        try:
            out.append(normalize_asset_path(joined))
        except Exception:
            continue
    return sorted(set(out))


def _normalize_imported_typst_content(content: str, source_path: str) -> str:
    s = content or ""
    s = re.sub(r'#import\s+["\'](?:\.\./)+style/my_style\.typ["\']\s*:\s*my_style', '#import "style/my_style.typ":my_style', s)
    s = re.sub(r'#import\s+["\']\./style/my_style\.typ["\']\s*:\s*my_style', '#import "style/my_style.typ":my_style', s)
    base = posixpath.dirname(source_path or "main.typ") or "."

    def _replace_image_ref(m: re.Match) -> str:
        q = m.group(1)
        ref = m.group(2)
        joined = posixpath.normpath(posixpath.join(base, ref))
        while joined.startswith("../"):
            joined = joined[3:]
        if joined.startswith("image/"):
            return f'image({q}{joined}{q}'
        return m.group(0)

    s = re.sub(r'image\(\s*(["\'])([^"\']+)\1', _replace_image_ref, s)
    return s


async def get_or_create_sync_settings(db: AsyncSession) -> InformaticsGithubSyncSetting:
    res = await db.execute(
        select(InformaticsGithubSyncSetting)
        .order_by(InformaticsGithubSyncSetting.id.desc())
    )
    rows = list(res.scalars().all())
    if rows:
        item = rows[0]
        if len(rows) > 1:
            for old in rows[1:]:
                await db.delete(old)
            await db.commit()
            await db.refresh(item)
            logger.warning("GitHub 同步配置存在重复行，已自动清理: kept_id=%s removed=%s", item.id, len(rows) - 1)
        return item
    item = InformaticsGithubSyncSetting(
        repo_url=f"https://github.com/{getattr(settings, 'GITHUB_SYNC_REPO_OWNER', 'shuhao0727')}/{getattr(settings, 'GITHUB_SYNC_REPO_NAME', '2-My-notes')}",
        repo_owner=getattr(settings, "GITHUB_SYNC_REPO_OWNER", "shuhao0727"),
        repo_name=getattr(settings, "GITHUB_SYNC_REPO_NAME", "2-My-notes"),
        branch=getattr(settings, "GITHUB_SYNC_REPO_BRANCH", "main"),
        enabled=bool(getattr(settings, "GITHUB_SYNC_ENABLED", False)),
        interval_hours=max(1, int(getattr(settings, "GITHUB_SYNC_INTERVAL_HOURS", 48) or 48)),
        delete_mode=getattr(settings, "GITHUB_SYNC_DELETE_MODE", "unpublish") or "unpublish",
    )
    token = (getattr(settings, "GITHUB_SYNC_TOKEN", "") or "").strip()
    if token:
        try:
            item.token_encrypted = encrypt_api_key(token)
        except RuntimeError:
            item.token_encrypted = None
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def serialize_sync_settings(db: AsyncSession) -> dict:
    item = await get_or_create_sync_settings(db)
    return {
        "repo_url": item.repo_url or "",
        "repo_owner": item.repo_owner or "",
        "repo_name": item.repo_name or "",
        "branch": item.branch or "main",
        "token_masked": _masked_token(item.token_encrypted),
        "token_configured": bool(item.token_encrypted),
        "enabled": bool(item.enabled),
        "interval_hours": int(item.interval_hours or 48),
        "delete_mode": item.delete_mode or "unpublish",
        "last_test_status": item.last_test_status,
        "last_test_message": item.last_test_message,
        "last_test_at": item.last_test_at,
        "updated_at": item.updated_at,
    }


async def update_sync_settings(
    db: AsyncSession,
    *,
    repo_url: str,
    branch: str,
    enabled: bool,
    interval_hours: int,
    delete_mode: str,
    updated_by_id: Optional[int],
    token: Optional[str] = None,
) -> dict:
    owner, repo = parse_repo_from_url(repo_url)
    item = await get_or_create_sync_settings(db)
    item.repo_url = repo_url.strip()
    item.repo_owner = owner
    item.repo_name = repo
    item.branch = (branch or "main").strip()
    item.enabled = bool(enabled)
    item.interval_hours = max(1, int(interval_hours or 48))
    item.delete_mode = delete_mode if delete_mode in {"unpublish", "soft_delete"} else "unpublish"
    item.updated_by_id = int(updated_by_id) if updated_by_id is not None else None
    if token is not None and token.strip() and token.strip() != "__use_saved_token__":
        item.token_encrypted = encrypt_api_key(token.strip())
    await db.commit()
    await db.refresh(item)
    return await serialize_sync_settings(db)


async def test_connection(repo_url: str, branch: str, token: str) -> Tuple[bool, str, str, str]:
    owner, repo = parse_repo_from_url(repo_url)
    client = get_http_client()
    headers = _auth_headers(token.strip())
    url = f"https://api.github.com/repos/{quote(owner)}/{quote(repo)}"
    r = await client.get(url, headers=headers)
    if r.status_code >= 400:
        return False, f"仓库访问失败（{r.status_code}）", owner, repo
    rb = await client.get(f"{url}/branches/{quote((branch or 'main').strip())}", headers=headers)
    if rb.status_code >= 400:
        return False, f"分支不存在或不可访问（{rb.status_code}）", owner, repo
    return True, "连接成功", owner, repo


async def _github_get_json(owner: str, repo: str, path: str, branch: str, token: str):
    client = get_http_client()
    quoted = quote(path, safe="/")
    url = f"https://api.github.com/repos/{quote(owner)}/{quote(repo)}/contents/{quoted}" if path else f"https://api.github.com/repos/{quote(owner)}/{quote(repo)}/contents"
    r = await client.get(url, params={"ref": branch}, headers=_auth_headers(token))
    if r.status_code >= 400:
        raise RuntimeError(f"GitHub API 错误 {r.status_code}: {path or '/'}")
    return r.json()


async def _github_download_file(owner: str, repo: str, path: str, branch: str, token: str) -> Tuple[bytes, str]:
    data = await _github_get_json(owner, repo, path, branch, token)
    sha = str(data.get("sha") or "")
    if data.get("content"):
        return base64.b64decode(data["content"]), sha
    dl = data.get("download_url")
    if not dl:
        raise RuntimeError(f"无法下载文件: {path}")
    client = get_http_client()
    r = await client.get(dl, headers=_auth_headers(token))
    if r.status_code >= 400:
        raise RuntimeError(f"下载失败 {r.status_code}: {path}")
    return r.content, sha


async def _walk_dir(owner: str, repo: str, root: str, branch: str, token: str) -> List[dict]:
    stack = [root]
    files: List[dict] = []
    while stack:
        cur = stack.pop()
        data = await _github_get_json(owner, repo, cur, branch, token)
        if isinstance(data, dict):
            data = [data]
        for it in data:
            tp = it.get("type")
            p = str(it.get("path") or "")
            if tp == "dir":
                stack.append(p)
            elif tp == "file":
                files.append(it)
    return files


@dataclass
class SyncStats:
    created: int = 0
    updated: int = 0
    deleted: int = 0
    skipped: int = 0


async def _acquire_lock(lock_key: str, ttl_sec: int = 3600) -> bool:
    client = await cache.get_client()
    return bool(await client.set(lock_key, "1", ex=ttl_sec, nx=True))


async def _release_lock(lock_key: str) -> None:
    await cache.delete(lock_key)


async def run_github_sync(
    db: AsyncSession,
    trigger_type: str = "manual",
    dry_run: bool = False,
    force_recompile: bool = False,
    progress_hook: Optional[Callable[[dict], None]] = None,
) -> InformaticsGithubSyncRun:
    # 清理残留的 running 记录（进程异常退出导致）
    stale_runs = (
        await db.execute(
            select(InformaticsGithubSyncRun).where(InformaticsGithubSyncRun.status == "running")
        )
    ).scalars().all()
    for sr in stale_runs:
        sr.status = "failed"
        sr.error_summary = "进程异常中断，自动清理"
        sr.finished_at = datetime.now()
    if stale_runs:
        await db.commit()

    setting = await get_or_create_sync_settings(db)
    token: Optional[str] = None
    if setting.token_encrypted:
        token = try_decrypt_api_key(setting.token_encrypted)
    if not token:
        token = (getattr(settings, "GITHUB_SYNC_TOKEN", "") or "").strip() or None
    if not token:
        raise RuntimeError("尚未配置可用的 GitHub Token（缺少加密密钥或Token）")
    owner, repo, branch = setting.repo_owner, setting.repo_name, setting.branch or "main"
    lock_key = f"inf:github-sync:{owner}:{repo}:{branch}"
    if not await _acquire_lock(lock_key):
        # 锁可能是残留的，强制释放后重试一次
        await _release_lock(lock_key)
        if not await _acquire_lock(lock_key):
            raise RuntimeError("同步任务已在运行中，请稍后重试")
    run = InformaticsGithubSyncRun(
        trigger_type=trigger_type,
        status="running",
        repo_owner=owner,
        repo_name=repo,
        branch=branch,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    stats = SyncStats()
    done_count = 0
    created_paths: List[str] = []
    updated_paths: List[str] = []
    deleted_paths: List[str] = []
    compiled_note_ids: List[int] = []
    compile_failed: List[dict] = []

    def emit_progress(phase: str, current: str, total: int, done: int):
        if not progress_hook:
            return
        safe_total = max(1, int(total or 0))
        safe_done = max(0, min(int(done or 0), safe_total))
        percent = min(99, int(safe_done * 100 / safe_total))
        progress_hook(
            {
                "run_id": run.id,
                "phase": phase,
                "current": current,
                "total": safe_total,
                "done": safe_done,
                "percent": percent,
            }
        )

    try:
        chapter_files = [x for x in await _walk_dir(owner, repo, "chapters", branch, token) if str(x.get("name", "")).endswith(".typ")]
        total_count = len(chapter_files)
        emit_progress("scan", "扫描章节列表", total_count, done_count)
        image_files = await _walk_dir(owner, repo, "image", branch, token)
        image_map = {str(it.get("path")): it for it in image_files if it.get("type") == "file"}
        source_res = await db.execute(
            select(InformaticsGithubSyncSource).where(
                InformaticsGithubSyncSource.repo_owner == owner,
                InformaticsGithubSyncSource.repo_name == repo,
                InformaticsGithubSyncSource.branch == branch,
            )
        )
        existing_sources = {s.source_path: s for s in source_res.scalars().all()}
        seen_paths = set()
        for item in chapter_files:
            path = str(item.get("path") or "")
            if path.endswith(".DS_Store") or not path:
                continue
            emit_progress("sync", path, total_count, done_count)
            seen_paths.add(path)
            source = existing_sources.get(path)
            remote_sha = str(item.get("sha") or "")
            title = _title_from_typst("", path)
            note_changed = False
            if source and source.source_sha == remote_sha and source.is_active:
                metadata_updated = False
                note_res = await db.execute(select(TypstNote).where(TypstNote.id == source.note_id))
                note = note_res.scalar_one_or_none()
                if note is not None and (note.title or "") != title and not dry_run:
                    note.title = title
                    note.updated_at = datetime.now()
                    await db.commit()
                    stats.updated += 1
                    updated_paths.append(path)
                    metadata_updated = True
                if not metadata_updated:
                    stats.skipped += 1
                if force_recompile and not dry_run:
                    if note is not None:
                        try:
                            await compile_note_pdf(db=db, note=note)
                            if note.id is not None:
                                compiled_note_ids.append(int(note.id))
                        except Exception as ce:
                            compile_failed.append({"path": path, "note_id": int(note.id or 0), "error": str(ce)[:500]})
                done_count += 1
                emit_progress("sync", path, total_count, done_count)
                continue
            content_bytes, _ = await _github_download_file(owner, repo, path, branch, token)
            content = content_bytes.decode("utf-8")
            normalized_content = _normalize_imported_typst_content(content, path)
            category = _category_from_path(path)
            if source:
                note_res = await db.execute(select(TypstNote).where(TypstNote.id == source.note_id))
                note = note_res.scalar_one_or_none()
            else:
                note = None
            if note is None:
                if dry_run:
                    stats.created += 1
                    continue
                note = await create_note(db=db, title=title, content_typst=content, created_by_id=setting.updated_by_id)
                note = await update_note(
                    db=db,
                    note=note,
                    title=title,
                    category_path=category,
                    entry_path="main.typ",
                    files={"main.typ": normalized_content},
                    content_typst=normalized_content,
                    published=True,
                )
                source = InformaticsGithubSyncSource(
                    repo_owner=owner,
                    repo_name=repo,
                    branch=branch,
                    source_path=path,
                    source_sha=remote_sha,
                    note_id=note.id,
                    is_active=True,
                    last_synced_at=datetime.now(),
                )
                db.add(source)
                await db.commit()
                await db.refresh(source)
                stats.created += 1
                created_paths.append(path)
                note_changed = True
            else:
                if dry_run:
                    stats.updated += 1
                    continue
                await update_note(
                    db=db,
                    note=note,
                    title=title,
                    category_path=category,
                    entry_path="main.typ",
                    files={"main.typ": normalized_content},
                    content_typst=normalized_content,
                )
                source.source_sha = remote_sha
                source.is_active = True
                source.last_synced_at = datetime.now()
                await db.commit()
                stats.updated += 1
                updated_paths.append(path)
                note_changed = True

            if dry_run:
                continue

            refs = _extract_image_refs(content, path)
            if source is None:
                continue
            note_id = source.note_id
            for ref in refs:
                img_meta = image_map.get(ref)
                if not img_meta:
                    continue
                data, _ = await _github_download_file(owner, repo, ref, branch, token)
                await upsert_asset(
                    db=db,
                    note_id=note_id,
                    path=ref,
                    mime=_guess_mime(ref),
                    content=data,
                    uploaded_by_id=setting.updated_by_id,
                )
            current_assets = await list_assets(db=db, note_id=note_id)
            valid_refs = set(refs)
            for asset in current_assets:
                if asset.path.startswith("image/") and asset.path not in valid_refs:
                    await db.delete(asset)
                    await db.commit()
            if note_changed and note is not None:
                try:
                    await compile_note_pdf(db=db, note=note)
                    if note.id is not None:
                        compiled_note_ids.append(int(note.id))
                except Exception as ce:
                    compile_failed.append({"path": path, "note_id": int(note.id or 0), "error": str(ce)[:500]})
            done_count += 1
            emit_progress("sync", path, total_count, done_count)

        stale = [s for p, s in existing_sources.items() if p not in seen_paths and s.is_active]
        for s in stale:
            if dry_run:
                stats.deleted += 1
                continue
            note_res = await db.execute(select(TypstNote).where(TypstNote.id == s.note_id))
            note = note_res.scalar_one_or_none()
            if note:
                if note.compiled_pdf_path:
                    try:
                        old_pdf_path = abs_pdf_path(settings.TYPST_PDF_STORAGE_DIR, note.compiled_pdf_path)
                        if os.path.exists(old_pdf_path):
                            os.remove(old_pdf_path)
                    except Exception:
                        pass
                    note.compiled_pdf_path = None
                    note.compiled_pdf_size = None
                    note.compiled_hash = None
                    note.compiled_pdf = None
                    note.compiled_at = None
                if (setting.delete_mode or "unpublish") == "soft_delete":
                    note.is_deleted = True
                else:
                    note.published = False
            s.is_active = False
            s.last_synced_at = datetime.now()
            await db.commit()
            stats.deleted += 1
            deleted_paths.append(s.source_path)

        run.status = "success"
        run.created_count = stats.created
        run.updated_count = stats.updated
        run.deleted_count = stats.deleted
        run.skipped_count = stats.skipped
        run.finished_at = datetime.now()
        await db.commit()
        await db.refresh(run)
        if progress_hook:
            progress_hook(
                {
                    "run_id": run.id,
                    "phase": "done",
                    "current": "",
                    "total": max(1, total_count),
                    "done": max(1, total_count),
                    "percent": 100,
                    "created_paths": created_paths,
                    "updated_paths": updated_paths,
                    "deleted_paths": deleted_paths,
                    "compiled_note_ids": compiled_note_ids,
                    "compile_failed": compile_failed,
                }
            )
        return run
    except Exception as e:
        run.status = "failed"
        run.error_summary = str(e)[:4000]
        run.created_count = stats.created
        run.updated_count = stats.updated
        run.deleted_count = stats.deleted
        run.skipped_count = stats.skipped
        run.finished_at = datetime.now()
        await db.commit()
        await db.refresh(run)
        raise
    finally:
        await _release_lock(lock_key)
