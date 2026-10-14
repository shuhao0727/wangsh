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
from app.db.migration_state import (
    DEFAULT_VERSIONS_DIR,
    VIEW_CONTRACT_REVISION,
    load_revision_graph,
    qualified_identifier as _qualified_identifier,
    validate_revision_state,
)
from app.core.celery_app import celery_app
from app.utils.security import hash_super_admin_password
from app.core.http_client import HttpClientManager
from app.core.session_family import lock_auth_mutation
from app.utils.cache import shutdown_cache, startup_cache
from app.core.pubsub import shutdown_pubsub
from app.models import User
from app.services.informatics.typst_styles import read_resource_style
from app.models.informatics.typst_style import TypstStyle
from app.services.articles.markdown_style_examples import ensure_style_examples
from app.services.articles.article_examples import ensure_article_examples
from app.services.informatics.github_sync import get_or_create_sync_settings


async def init_database():
    """开发环境空库使用 Alembic 初始化；启动过程只读校验视图合同。

    已有数据库必须通过 Alembic 迁移演进，避免 DEBUG 模式下
    应用启动自动修改或标记未经验证的 schema。目标视图的业务 DDL
    只允许由 Alembic forward migration 执行。
    """
    if not (settings.DEBUG or settings.AUTO_CREATE_TABLES):
        return
    logger.info("检查数据库初始化状态（生产请使用 Alembic 迁移）...")
    async with engine.begin() as conn:
        schema = await _current_schema(conn)
        existing_tables = await _get_existing_schema_tables(conn, schema)
        version_rows = await _alembic_version_rows(conn, schema)
        if existing_tables or version_rows is not None:
            if existing_tables and version_rows:
                logger.info("检测到已有数据库和 Alembic 版本，跳过自动 create_all")
            elif existing_tables:
                logger.warning(
                    "检测到非空数据库但 alembic_version 缺失或为空，已跳过自动 create_all；"
                    "请先运行 scripts/check_migration_state.py 并人工确认 schema 状态"
                )
            # A version table with rows must be validated even when the schema
            # has no application tables; an empty version table must also fail
            # closed instead of being mistaken for an uninitialized database.
            contract = await check_conversations_view_contract(conn)
            if contract["status"] != "healthy":
                raise RuntimeError(
                    "数据库未达到 v_conversations_with_deleted readiness contract: "
                    f"{contract.get('reason', 'unknown error')}"
                )
            return

    logger.info("检测到空数据库，执行 Alembic upgrade head")
    await _upgrade_database_to_head()
    async with engine.begin() as conn:
        contract = await check_conversations_view_contract(conn)
        if contract["status"] != "healthy":
            raise RuntimeError(
                "Alembic upgrade head 后视图 readiness contract 仍未满足: "
                f"{contract.get('reason', 'unknown error')}"
            )


async def init_super_admin():
    """Create the configured super administrator once, without overriding governance.

    Startup is a privileged writer.  It therefore joins the global AUTH lock
    order and never reactivates, promotes, or resets an existing account.
    Subsequent password and lifecycle changes must go through audited account
    administration instead of being silently undone by a restart.
    """
    logger.info("检查超级管理员账户...")
    admin_username = settings.SUPER_ADMIN_USERNAME
    admin_password = settings.SUPER_ADMIN_PASSWORD
    admin_full_name = settings.SUPER_ADMIN_FULL_NAME

    if not all([admin_username, admin_password]):
        logger.warning("超级管理员配置不完整，跳过创建")
        return

    try:
        async with AsyncSessionLocal() as session:
            await lock_auth_mutation(session, require_ready=False)
            existing_user = (
                await session.execute(
                    select(User)
                    .where(User.username == admin_username)
                    .with_for_update()
                )
            ).scalar_one_or_none()

            if existing_user is not None:
                if (
                    existing_user.role_code == "super_admin"
                    and existing_user.is_active
                    and not existing_user.is_deleted
                ):
                    logger.info("超级管理员账户已存在，启动过程不重置其凭据或资料: {}", admin_username)
                else:
                    logger.warning(
                        "配置的超级管理员用户名已被人工停用、删除、降权或占用；"
                        "启动过程不会覆盖治理结果: {}",
                        admin_username,
                    )
                await session.rollback()
                return

            new_admin = User(
                username=admin_username,
                hashed_password=hash_super_admin_password(),
                student_id="A001",
                full_name=admin_full_name or "系统超级管理员",
                role_code="super_admin",
                is_active=True,
            )
            session.add(new_admin)
            await session.commit()
            logger.info("超级管理员账户已创建: {}", admin_username)
    except Exception:
        logger.exception("创建超级管理员失败，应用启动已中止")
        raise


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

async def _current_schema(conn) -> str:
    schema = (await conn.execute(text("SELECT current_schema()"))).scalar_one_or_none()
    if not schema:
        raise RuntimeError("PostgreSQL search_path does not contain an existing schema")
    return str(schema)


async def _get_existing_schema_tables(conn, schema: str) -> set[str]:
    result = await conn.execute(
        text(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = :schema
              AND tablename != 'alembic_version'
            """
        ),
        {"schema": schema},
    )
    return {str(row[0]) for row in result}


async def _alembic_version_rows(conn, schema: str) -> list[object] | None:
    """Read every effective-schema version row, never only the first row."""
    table_result = await conn.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM pg_catalog.pg_class AS c
                JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
                WHERE n.nspname = :schema
                  AND c.relname = 'alembic_version'
                  AND c.relkind IN ('r', 'p')
            )
            """
        ),
        {"schema": schema},
    )
    if not bool(_result_scalar(table_result)):
        return None

    version_table = _qualified_identifier(schema, "alembic_version")
    result = await conn.execute(
        text(f"SELECT version_num FROM {version_table} ORDER BY version_num")
    )
    try:
        rows = list(result)
    except TypeError:
        rows = []
    if rows:
        return [row[0] for row in rows]
    # Small test doubles and scalar-only DB adapters may not expose iteration.
    scalar = _result_scalar(result)
    return [] if scalar is None else [scalar]


async def _has_alembic_revision(conn) -> bool:
    """Return whether the effective schema contains at least one version row.

    This is only the empty-schema discriminator.  Any non-empty row set is
    validated against the complete migration graph by
    :func:`_validate_migration_state` before application traffic is allowed.
    """
    schema = await _current_schema(conn)
    rows = await _alembic_version_rows(conn, schema)
    return bool(rows)


async def _validate_migration_state(conn, schema: str):
    rows = await _alembic_version_rows(conn, schema)
    if rows is None:
        return None, "alembic_version_missing"
    try:
        graph = load_revision_graph(DEFAULT_VERSIONS_DIR)
    except (RuntimeError, SyntaxError, ValueError) as exc:
        return None, f"migration_graph_invalid: {exc}"
    return validate_revision_state(rows, graph, contract_revision=VIEW_CONTRACT_MIGRATION), None


async def _ensure_dev_schema(conn):
    """历史遗留函数桩。

    原直接在此处执行 raw SQL ALTER TABLE，现已迁移为 Alembic migration:
        alembic/versions/20260430_migrate_dev_schema.py
    """
    logger.debug("_ensure_dev_schema: 已由 Alembic migration 20260430_migrate_dev_schema 接管")


VIEW_CONTRACT_MIGRATION = VIEW_CONTRACT_REVISION
VIEW_CONTRACT_NAME = "v_conversations_with_deleted"
VIEW_CONTRACT_COLUMNS = (
    "id",
    "user_id",
    "display_user_name",
    "agent_id",
    "display_agent_name",
    "session_id",
    "message_type",
    "content",
    "response_time_ms",
    "created_at",
    "is_archived",
    "archived_at",
    "is_user_deleted",
    "is_agent_deleted",
)


def _result_scalar(result):
    scalar = getattr(result, "scalar", None)
    if callable(scalar):
        return scalar()
    return result.scalar_one_or_none()


async def check_conversations_view_contract(conn) -> dict[str, str]:
    """Read-only readiness check for the migration-owned conversation view.

    This helper intentionally performs no DDL.  It verifies that the current
    effective schema has reached the view migration, that the view exposes the
    exact positional contract, and that PostgreSQL can resolve its dependencies.
    """
    try:
        schema_result = await conn.execute(text("SELECT current_schema()"))
        schema = _result_scalar(schema_result)
        if not schema:
            return {"status": "unhealthy", "reason": "no_effective_schema"}
        schema = str(schema)
        revision_state, missing_reason = await _validate_migration_state(conn, schema)
        if missing_reason is not None:
            return {
                "status": "unhealthy",
                "reason": missing_reason,
                "schema": schema,
            }
        if not revision_state.ok:
            return {
                "status": "unhealthy",
                "reason": f"migration_state_invalid: {revision_state.reason}: {revision_state.message}",
                "schema": schema,
            }

        expected_columns_sql = ", ".join(
            f"'{column}'" for column in VIEW_CONTRACT_COLUMNS
        )
        contract_result = await conn.execute(
            text(
                f"""
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_catalog.pg_class AS c
                    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
                    WHERE n.nspname = :schema
                      AND c.relname = :view_name
                      AND c.relkind = 'v'
                )
                AND COALESCE((
                    SELECT array_agg(a.attname::text ORDER BY a.attnum)
                           = ARRAY[{expected_columns_sql}]::text[]
                    FROM pg_catalog.pg_attribute AS a
                    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
                    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
                    WHERE n.nspname = :schema
                      AND c.relname = :view_name
                      AND c.relkind = 'v'
                      AND a.attnum > 0
                      AND NOT a.attisdropped
                ), false)
                """
            ),
            {"schema": schema, "view_name": VIEW_CONTRACT_NAME},
        )
        if not bool(_result_scalar(contract_result)):
            return {
                "status": "unhealthy",
                "reason": "view_missing_or_columns_mismatch",
                "schema": schema,
            }

        view_identifier = _qualified_identifier(schema, VIEW_CONTRACT_NAME)
        await conn.execute(text(f"SELECT * FROM {view_identifier} LIMIT 0"))
    except Exception as exc:
        logger.exception("v_conversations_with_deleted readiness contract 检查失败")
        return {
            "status": "unhealthy",
            "reason": f"dependency_check_failed: {exc}",
        }

    return {
        "status": "healthy",
        "reason": "ok",
        "schema": schema,
        "migration": VIEW_CONTRACT_MIGRATION,
    }


async def _upgrade_database_to_head() -> None:
    from scripts.bootstrap_db import main as bootstrap_database

    backend_dir = Path(__file__).resolve().parents[2]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    await bootstrap_database(initial_only=True)
    await asyncio.to_thread(command.upgrade, config, "head")
