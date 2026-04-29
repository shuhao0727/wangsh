"""
应用启动初始化逻辑
从 main.py lifespan 中拆分出来，保持单一职责
"""

import asyncio
from sqlalchemy import select, text
from loguru import logger

from app.core.config import settings
from app.db.database import engine, Base, AsyncSessionLocal
from app.core.celery_app import celery_app
from app.utils.security import hash_super_admin_password
from app.core.http_client import HttpClientManager
from app.utils.cache import shutdown_cache, startup_cache
from app.core.pubsub import shutdown_pubsub
from app.models import User
from app.services.informatics.typst_styles import read_resource_style
from app.models.informatics.typst_style import TypstStyle
from app.services.articles.markdown_style_examples import ensure_style_examples
from app.services.articles.article_examples import ensure_article_examples
from app.services.informatics.github_sync import get_or_create_sync_settings


async def init_database():
    """开发环境/首次部署时自动创建表、视图并同步 Alembic 版本"""
    if not (settings.DEBUG or settings.AUTO_CREATE_TABLES):
        return
    logger.info("创建数据库表（仅开发环境/首次部署可选，生产请使用 Alembic 迁移）...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _ensure_dev_schema(conn)
        await _ensure_views(conn)
        await _sync_alembic_version(conn)


async def init_super_admin():
    """创建或更新超级管理员账户"""
    logger.info("检查超级管理员账户...")
    try:
        admin_username = settings.SUPER_ADMIN_USERNAME
        admin_password = settings.SUPER_ADMIN_PASSWORD
        admin_full_name = settings.SUPER_ADMIN_FULL_NAME

        if not all([admin_username, admin_password]):
            logger.warning("超级管理员配置不完整，跳过创建")
            return

        hashed_password = hash_super_admin_password()

        async with AsyncSessionLocal() as session:
            query = select(User).where(
                User.username == admin_username,
                User.role_code.in_(["admin", "super_admin"]),
            )
            result = await session.execute(query)
            existing_admin = result.scalar_one_or_none()

            if existing_admin:
                existing_admin.hashed_password = hashed_password  # type: ignore[assignment]
                existing_admin.role_code = "super_admin"  # type: ignore[assignment]
                existing_admin.is_active = True  # type: ignore
                existing_admin.full_name = admin_full_name if admin_full_name else existing_admin.full_name  # type: ignore[assignment]
                logger.info(f"超级管理员账户已更新: {admin_username}")
            else:
                new_admin = User(
                    username=admin_username,
                    hashed_password=hashed_password,
                    full_name=admin_full_name if admin_full_name else "系统超级管理员",
                    role_code="super_admin",
                    is_active=True,
                )
                session.add(new_admin)
                logger.info(f"超级管理员账户已创建: {admin_username}")

            await session.commit()
            logger.info("超级管理员账户设置完成")
    except Exception as e:
        logger.error(f"创建超级管理员失败: {e}")


async def init_seed_data():
    """初始化种子数据：Typst 样式、文章样式示例、文章示例"""
    async with AsyncSessionLocal() as db:
        try:
            res = await db.execute(select(TypstStyle))
            any_style = res.scalar_one_or_none()
            if not any_style:
                content = read_resource_style("my_style")
                if content.strip():
                    db.add(TypstStyle(key="my_style", title="my_style", content=content, sort_order=0))
                    await db.commit()
        except Exception:
            logger.exception("初始化 TypstStyle 失败")
        try:
            await ensure_style_examples(db)
        except Exception:
            logger.exception("初始化 style examples 失败")
        try:
            await ensure_article_examples(db)
        except Exception:
            logger.exception("初始化 article examples 失败")


async def init_services():
    """初始化缓存和 HTTP 客户端"""
    try:
        await startup_cache()
        logger.info("缓存服务初始化完成")
    except Exception as e:
        logger.error(f"缓存服务初始化失败: {e}")

    HttpClientManager.get_client()
    logger.info("全局 HTTP 客户端初始化完成")


def start_background_tasks() -> "asyncio.Task[None] | None":
    """启动后台定时任务（PythonLab 清理 + GitHub 同步）"""
    if not bool(getattr(settings, "PYTHONLAB_ORPHAN_CLEANUP_ENABLED", True)):
        return None

    interval = int(getattr(settings, "PYTHONLAB_ORPHAN_CLEANUP_INTERVAL_SECONDS", 300) or 300)

    async def loop():
        last_sync_ts = 0.0
        while True:
            try:
                celery_app.send_task("app.tasks.pythonlab.cleanup_orphans")
                celery_app.send_task("app.tasks.pythonlab.cleanup_stale_sessions")
                async with AsyncSessionLocal() as db:
                    cfg = await get_or_create_sync_settings(db)
                    enabled = bool(cfg.enabled)  # type: ignore[arg-type]
                    _hours: int = getattr(cfg, "interval_hours", None) or 48  # type: ignore[assignment]
                    sync_interval = max(1, _hours)
                now_ts = asyncio.get_event_loop().time()
                if enabled and now_ts - last_sync_ts >= sync_interval * 3600:
                    celery_app.send_task("app.tasks.informatics_sync.sync_informatics_from_github")
                    last_sync_ts = now_ts
            except Exception:
                logger.exception("定时清理/同步任务执行异常")
            await asyncio.sleep(max(30, interval))

    return asyncio.create_task(loop())


async def shutdown(cleanup_task: "asyncio.Task[None] | None"):
    """应用关闭时清理资源"""
    if cleanup_task is not None:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.debug("清理后台任务时发生异常（应用正在关闭，可安全忽略）")

    try:
        await shutdown_pubsub()
    except Exception as e:
        logger.error(f"pubsub 关闭失败: {e}")

    try:
        await shutdown_cache()
        logger.info("缓存服务已关闭")
    except Exception as e:
        logger.error(f"缓存服务关闭失败: {e}")

    await HttpClientManager.close()
    logger.info("全局 HTTP 客户端已关闭")

    await engine.dispose()
    logger.info("应用已关闭")


# ---- 内部辅助函数 ----

async def _ensure_dev_schema(conn):
    """⚠️ 开发环境专用：绕过 Alembic 直接修补历史遗留表结构。

    这些 ALTER TABLE 直接操作数据库，可能导致开发库与生产库的
    schema 逐渐不一致。每一条都应该尽快迁移为正式的 Alembic migration，
    然后从此函数中移除。
    """
    logger.warning(
        "⚠️ _ensure_dev_schema 正在绕过 Alembic 直接修改表结构 —— "
        "仅限开发环境，生产部署请使用 Alembic 迁移"
    )
    try:
        # TODO: 应迁移为 Alembic migration
        # 历史兼容：xxjs_dianming 早期缺少 updated_at 列
        # 该列已在生产库通过手动操作添加，但新开发库首次创建时仍需此补丁
        await conn.execute(
            text(
                "ALTER TABLE xxjs_dianming "
                "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"
            )
        )
        await conn.execute(
            text(
                "UPDATE xxjs_dianming "
                "SET updated_at = created_at "
                "WHERE updated_at IS NULL"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE xxjs_dianming "
                "ALTER COLUMN updated_at SET NOT NULL"
            )
        )

        # TODO: 应迁移为 Alembic migration
        # 群组讨论功能扩展：group_name 列和索引
        await conn.execute(
            text(
                "ALTER TABLE znt_group_discussion_sessions "
                "ADD COLUMN IF NOT EXISTS group_name VARCHAR(64)"
            )
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_znt_group_discussion_sessions_group_name "
                "ON znt_group_discussion_sessions (group_name)"
            )
        )
        # TODO: 应迁移为 Alembic migration
        await conn.execute(
            text(
                "ALTER TABLE znt_group_discussion_analyses "
                "ADD COLUMN IF NOT EXISTS compare_session_ids TEXT"
            )
        )
    except Exception:
        logger.exception(
            "_ensure_dev_schema 执行失败（表可能尚未创建），"
            "如果这是首次启动且 Alembic 迁移已包含这些变更，可安全忽略"
        )


async def _ensure_views(conn):
    """确保视图存在"""
    try:
        await conn.execute(
            text("""
                CREATE OR REPLACE VIEW v_conversations_with_deleted AS
                SELECT
                    c.id, c.user_id,
                    COALESCE(c.user_name, u.full_name, '未知用户') AS display_user_name,
                    c.agent_id,
                    COALESCE(c.agent_name, a.name, '未知智能体') AS display_agent_name,
                    c.session_id, c.message_type, c.content, c.response_time_ms, c.created_at,
                    CASE WHEN u.id IS NULL OR u.is_deleted = true THEN true ELSE false END AS is_user_deleted,
                    CASE WHEN a.id IS NULL OR a.is_deleted = true THEN true ELSE false END AS is_agent_deleted
                FROM znt_conversations c
                LEFT JOIN sys_users u ON c.user_id = u.id
                LEFT JOIN znt_agents a ON c.agent_id = a.id
            """)
        )
        logger.info("视图 v_conversations_with_deleted 已创建/更新")
    except Exception:
        logger.warning("创建视图失败，跳过")


async def _sync_alembic_version(conn):
    """开发环境：Alembic 版本表不存在时自动创建并同步到最新。

    ⚠️ 生产环境应始终使用 `alembic upgrade head`，不要依赖此函数。
    """
    try:
        result = await conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
        current = result.scalar_one_or_none()
        if not current:
            head_rev = _find_alembic_head()
            if not head_rev:
                logger.warning("无法自动检测 Alembic head，跳过版本标记")
                return
            # 开发环境首次创建表时 Alembic 版本表可能为空，
            # 此时所有迁移都通过 Base.metadata.create_all 落实，
            # 直接 stamp head 标记当前 schema 为最新版本
            logger.info(
                "开发环境：Alembic 版本表为空，正在标记为 head (%s) —— "
                "后续请运行 alembic upgrade head 确认迁移状态一致",
                head_rev,
            )
            await conn.execute(text("DELETE FROM alembic_version"))
            await conn.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:rev)"),
                {"rev": head_rev},
            )
    except Exception:
        logger.warning("同步 Alembic 版本失败，如果数据库已是最新状态可安全忽略")


def _find_alembic_head() -> "str | None":
    """扫描 alembic/versions/ 目录，找出迁移链的 head 版本号。

    通过解析每个迁移文件中的 revision / down_revision 变量，
    找出不被任何其他迁移作为 down_revision 引用的 revision（即 head）。
    """
    import re
    from pathlib import Path

    versions_dir = Path(__file__).resolve().parents[2] / "alembic" / "versions"
    if not versions_dir.is_dir():
        return None

    revisions: set[str] = set()
    down_revisions: set[str] = set()

    for f in versions_dir.glob("*.py"):
        try:
            content = f.read_text(encoding="utf-8")
            rev_match = re.search(r'''^revision\s*=\s*['"]([^'"]+)['"]''', content, re.MULTILINE)
            if rev_match:
                revisions.add(rev_match.group(1))
            # down_revision 可能是单字符串 'abc' 或元组 ('abc', 'def')
            if re.search(r'''^down_revision\s*=\s*\(''', content, re.MULTILINE):
                for m in re.finditer(r'''['"]([^'"]+)['"]''', content.split("down_revision")[1].split("\n")[0]):
                    rev = m.group(1)
                    if rev != "None":
                        down_revisions.add(rev)
            else:
                down_match = re.search(r'''^down_revision\s*=\s*['"]([^'"]+)['"]''', content, re.MULTILINE)
                if down_match and down_match.group(1) != "None":
                    down_revisions.add(down_match.group(1))
        except Exception:
            logger.debug("解析迁移文件 %s 失败，跳过", f.name)

    heads = revisions - down_revisions
    if len(heads) == 1:
        return heads.pop()
    if len(heads) > 1:
        logger.warning("检测到多个 Alembic head: %s，将使用第一个", sorted(heads))
        return sorted(heads)[0]
    return None
