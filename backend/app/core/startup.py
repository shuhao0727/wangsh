"""
应用启动初始化逻辑
从 main.py lifespan 中拆分出来，保持单一职责
"""

import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import select, text
from loguru import logger

from app.core.config import settings
from app.db.database import engine, AsyncSessionLocal
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
    """开发环境空库使用 Alembic 初始化；已有库只维护兼容视图。

    已有数据库必须通过 Alembic 迁移演进，避免 DEBUG 模式下
    应用启动自动修改或标记未经验证的 schema。
    """
    if not (settings.DEBUG or settings.AUTO_CREATE_TABLES):
        return
    logger.info("检查数据库初始化状态（生产请使用 Alembic 迁移）...")
    async with engine.begin() as conn:
        existing_tables = await _get_existing_public_tables(conn)
        has_alembic_revision = await _has_alembic_revision(conn)
        if existing_tables:
            if has_alembic_revision:
                logger.info("检测到已有数据库和 Alembic 版本，跳过自动 create_all")
            else:
                logger.warning(
                    "检测到非空数据库但 alembic_version 缺失或为空，已跳过自动 create_all；"
                    "请先运行 scripts/check_migration_state.py 并人工确认 schema 状态"
                )
            await _ensure_views(conn)
            return

    logger.info("检测到空数据库，执行 Alembic upgrade head")
    await _upgrade_database_to_head()
    async with engine.begin() as conn:
        await _ensure_views(conn)


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
                if not existing_admin.student_id:
                    existing_admin.student_id = "A001"  # type: ignore[assignment]
                logger.info(f"超级管理员账户已更新: {admin_username}")
            else:
                new_admin = User(
                    username=admin_username,
                    hashed_password=hashed_password,
                    student_id="A001",
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

async def _get_existing_public_tables(conn) -> set[str]:
    result = await conn.execute(
        text(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename != 'alembic_version'
            """
        )
    )
    return {str(row[0]) for row in result}


async def _has_alembic_revision(conn) -> bool:
    version_table = await conn.execute(text("SELECT to_regclass('public.alembic_version')"))
    if version_table.scalar_one_or_none() is None:
        return False
    result = await conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
    return result.scalar_one_or_none() is not None


async def _ensure_dev_schema(conn):
    """历史遗留函数桩。

    原直接在此处执行 raw SQL ALTER TABLE，现已迁移为 Alembic migration:
        alembic/versions/20260430_migrate_dev_schema.py
    """
    logger.debug("_ensure_dev_schema: 已由 Alembic migration 20260430_migrate_dev_schema 接管")


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


async def _upgrade_database_to_head() -> None:
    from scripts.bootstrap_db import main as bootstrap_database

    backend_dir = Path(__file__).resolve().parents[2]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    await bootstrap_database(initial_only=True)
    await asyncio.to_thread(command.upgrade, config, "head")
