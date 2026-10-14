"""rebuild conversations_with_deleted view

修复 v_conversations_with_deleted 视图漂移缺陷。

背景：
    视图最早由 20260211_0004 用 `CREATE OR REPLACE VIEW` 建立，只含列
        ... created_at, is_archived, archived_at, is_user_deleted, is_agent_deleted
    随后 4a85c94b5c4c 给底表 znt_conversations 追加 is_archived/archived_at 时，
    顺序与旧视图不同。PostgreSQL 的 CREATE OR REPLACE 只能**追加列**，不能改
    列序/列名，旧库上会报
        cannot change name of view column "is_user_deleted" to "is_archived"
    该错误在 startup.py 的 `except Exception` 里被降级为 warning 静默跳过，
    视图永久保持旧结构，而查询已使用 is_archived → 接口 500。

修复：
    用 DROP VIEW + CREATE VIEW 重建视图，列序与查询方（含 is_archived）一致，
    使旧库、已修复库、空库都能收敛到同一结构。

    DROP 前读取并保存 view 的 owner、显式 ACL、comment 和对象级 security label；
    CREATE 后在同一 Alembic 事务中恢复这些元数据。恢复任何必需元数据失败都会
    使整个 migration 回滚，避免把权限或对象属性静默丢失。列级 security label
    不是本 migration 的恢复范围；如果检测到列级 label，会在 DROP 前 fail-fast。
    列级 ACL/comment、view reloptions、自定义 trigger/rule 同样不在恢复范围，
    必须在 DROP 前拒绝，不能静默移除授权或 security_invoker 等安全语义。

单一来源：
    本迁移是视图定义的**唯一权威来源**。startup.py / scripts/bootstrap_db.py
    不再创建视图，只做存在性校验（fail-fast）。

Revision ID: f1a2b3c4d5e6
Revises: 2de7995a8f24
Create Date: 2026-10-03 00:00:00.000000

"""
from dataclasses import dataclass
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401  （保持与其它迁移一致的导入习惯）


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = '2de7995a8f24'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_VIEW_NAME = "v_conversations_with_deleted"


@dataclass(frozen=True)
class _AclEntry:
    """One explicit ACL entry, without preserving the historical grantor.

    PostgreSQL does not provide a portable DDL operation to assign an arbitrary
    historical grantor. Replaying the grantee, privilege and grant option as
    the migration owner preserves the effective grants; the migration is not
    intended to preserve audit provenance of the original grantor.
    """

    grantee: str | None  # None means PUBLIC.
    privilege: str
    grantable: bool


@dataclass(frozen=True)
class _SecurityLabel:
    provider: str
    label: str


@dataclass(frozen=True)
class _ViewMetadata:
    owner: str
    comment: str | None
    acl: tuple[_AclEntry, ...]
    security_labels: tuple[_SecurityLabel, ...]


# 视图定义：单一来源。列序必须与运行时查询保持一致。
# 期望列序：
#   id, user_id, display_user_name, agent_id, display_agent_name, session_id,
#   message_type, content, response_time_ms, created_at,
#   is_archived, archived_at, is_user_deleted, is_agent_deleted
_CREATE_VIEW_SQL = """
CREATE VIEW v_conversations_with_deleted AS
SELECT
    c.id,
    c.user_id,
    COALESCE(c.user_name, u.full_name, '未知用户') AS display_user_name,
    c.agent_id,
    COALESCE(c.agent_name, a.name, '未知智能体') AS display_agent_name,
    c.session_id,
    c.message_type,
    c.content,
    c.response_time_ms,
    c.created_at,
    c.is_archived,
    c.archived_at,
    CASE WHEN u.id IS NULL OR u.is_deleted = true THEN true ELSE false END AS is_user_deleted,
    CASE WHEN a.id IS NULL OR a.is_deleted = true THEN true ELSE false END AS is_agent_deleted
FROM znt_conversations c
LEFT JOIN sys_users u ON c.user_id = u.id
LEFT JOIN znt_agents a ON c.agent_id = a.id
"""


def _quote_identifier(connection, value: str) -> str:
    return connection.dialect.identifier_preparer.quote(value)


def _sql_literal(connection, value: str) -> str:
    """Return a server-quoted literal, including embedded quotes safely."""
    return str(
        connection.execute(
            sa.text("SELECT pg_catalog.quote_literal(:value)"),
            {"value": value},
        ).scalar_one()
    )


def _read_acl(connection, view_oid: int) -> tuple[_AclEntry, ...]:
    """Read explicit ACL entries before DROP or after CREATE.

    ``relacl IS NULL`` intentionally yields no rows: owner privileges are
    implicit and are restored by restoring the owner. Any explicit default ACL
    entries are replayed. An unresolvable grantee is treated as a hard error so
    a role grant cannot disappear silently.
    """
    try:
        rows = connection.execute(
            sa.text(
                """
                SELECT acl.grantee,
                       grantee_role.rolname AS grantee_name,
                       acl.privilege_type,
                       acl.is_grantable
                FROM pg_catalog.pg_class AS c
                CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) AS acl
                LEFT JOIN pg_catalog.pg_roles AS grantee_role
                  ON grantee_role.oid = acl.grantee
                WHERE c.oid = :view_oid
                ORDER BY acl.grantee, acl.privilege_type, acl.is_grantable
                """
            ),
            {"view_oid": view_oid},
        ).mappings()
        entries: list[_AclEntry] = []
        for row in rows:
            grantee_id = int(row["grantee"])
            grantee_name = row["grantee_name"]
            if grantee_id != 0 and not grantee_name:
                raise RuntimeError(
                    f"{_VIEW_NAME} 的 ACL 包含无法解析的 grantee oid={grantee_id}；"
                    "拒绝在重建时静默丢失授权"
                )
            entries.append(
                _AclEntry(
                    grantee=None if grantee_id == 0 else str(grantee_name),
                    privilege=str(row["privilege_type"]).upper(),
                    grantable=bool(row["is_grantable"]),
                )
            )
        return tuple(entries)
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(
            f"无法读取 {_VIEW_NAME} 的 PostgreSQL ACL；为避免权限静默丢失，migration 已中止"
        ) from exc


def _read_security_labels(connection, view_oid: int) -> tuple[_SecurityLabel, ...]:
    """Read object labels and reject unsupported column labels before DROP.

    Object labels can be replayed with ``SECURITY LABEL`` when the provider is
    installed and the migration role has the provider's required privileges.
    Column labels need column-position-aware replay and are deliberately outside
    this migration's safe scope; detecting one is therefore a hard preflight
    failure rather than silent loss.
    """
    try:
        rows = connection.execute(
            sa.text(
                """
                SELECT provider, label, objsubid
                FROM pg_catalog.pg_seclabel
                WHERE classoid = 'pg_catalog.pg_class'::pg_catalog.regclass
                  AND objoid = :view_oid
                ORDER BY objsubid, provider
                """
            ),
            {"view_oid": view_oid},
        ).mappings()
        labels: list[_SecurityLabel] = []
        for row in rows:
            objsubid = int(row["objsubid"])
            if objsubid != 0:
                raise RuntimeError(
                    f"{_VIEW_NAME} 存在列级 security label（objsubid={objsubid}）；"
                    "当前 migration 不支持安全恢复，拒绝 DROP"
                )
            labels.append(
                _SecurityLabel(provider=str(row["provider"]), label=str(row["label"]))
            )
        return tuple(labels)
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(
            f"无法读取 {_VIEW_NAME} 的 security label；为避免安全标签静默丢失，migration 已中止"
        ) from exc


def _assert_supported_view_properties(connection, view_oid: int) -> None:
    """Reject properties this rebuild cannot safely replay before any DROP."""
    row = connection.execute(
        sa.text(
            """
            SELECT c.reloptions,
                   EXISTS (
                       SELECT 1 FROM pg_catalog.pg_attribute AS attribute
                       WHERE attribute.attrelid = c.oid
                         AND attribute.attnum > 0 AND NOT attribute.attisdropped
                         AND (attribute.attacl IS NOT NULL OR
                              pg_catalog.col_description(c.oid, attribute.attnum) IS NOT NULL)
                   ) AS column_metadata,
                   EXISTS (
                       SELECT 1 FROM pg_catalog.pg_trigger AS t
                       WHERE t.tgrelid = c.oid AND NOT t.tgisinternal
                   ) AS user_triggers,
                   EXISTS (
                       SELECT 1 FROM pg_catalog.pg_rewrite AS r
                       WHERE r.ev_class = c.oid AND r.rulename <> '_RETURN'
                   ) AS custom_rules
            FROM pg_catalog.pg_class AS c
            WHERE c.oid = :view_oid
            """
        ),
        {"view_oid": view_oid},
    ).mappings().one()
    unsupported = [
        name for name in ("reloptions", "column_metadata", "user_triggers", "custom_rules")
        if row[name]
    ]
    if unsupported:
        raise RuntimeError(
            f"{_VIEW_NAME} 存在未支持的 view 属性 {', '.join(unsupported)}；"
            "当前 migration 不支持安全恢复，拒绝 DROP"
        )


def _read_view_metadata(connection) -> _ViewMetadata | None:
    """Capture metadata from the effective schema before destructive DDL."""
    schema = connection.execute(sa.text("SELECT current_schema()")).scalar_one_or_none()
    if not schema:
        raise RuntimeError(
            f"无法解析 {_VIEW_NAME} 的 current_schema()；拒绝执行 destructive DDL"
        )
    row = connection.execute(
        sa.text(
            """
            SELECT c.oid,
                   pg_catalog.pg_get_userbyid(c.relowner) AS owner,
                   c.relacl,
                   pg_catalog.obj_description(c.oid, 'pg_class') AS comment
            FROM pg_catalog.pg_class AS c
            JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
            WHERE n.nspname = :schema
              AND c.relname = :view_name
              AND c.relkind = 'v'
            """
        ),
        {"schema": str(schema), "view_name": _VIEW_NAME},
    ).mappings().one_or_none()
    if row is None:
        return None

    owner = row["owner"]
    if not owner:
        raise RuntimeError(
            f"无法解析 {_VIEW_NAME} 的 owner；拒绝在重建时丢失对象所有权"
        )
    view_oid = int(row["oid"])
    _assert_supported_view_properties(connection, view_oid)
    return _ViewMetadata(
        owner=str(owner),
        comment=None if row["comment"] is None else str(row["comment"]),
        acl=_read_acl(connection, view_oid),
        security_labels=_read_security_labels(connection, view_oid),
    )


def _current_acl_grantees(connection, view_oid: int) -> tuple[str | None, ...]:
    return tuple(dict.fromkeys(entry.grantee for entry in _read_acl(connection, view_oid)))


def _restore_view_metadata(connection, metadata: _ViewMetadata | None) -> None:
    if metadata is None:
        return

    schema = connection.execute(sa.text("SELECT current_schema()")).scalar_one_or_none()
    if not schema:
        raise RuntimeError(
            f"无法解析 {_VIEW_NAME} 的 current_schema()；拒绝恢复 view 元数据"
        )
    qualified_view = (
        f"{_quote_identifier(connection, str(schema))}."
        f"{_quote_identifier(connection, _VIEW_NAME)}"
    )
    view_row = connection.execute(
        sa.text(
            """
            SELECT c.oid
            FROM pg_catalog.pg_class AS c
            JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
            WHERE n.nspname = :schema
              AND c.relname = :view_name
              AND c.relkind = 'v'
            """
        ),
        {"schema": str(schema), "view_name": _VIEW_NAME},
    ).mappings().one()
    new_view_oid = int(view_row["oid"])

    # CREATE may apply the runner's default ACL. Remove every explicit entry
    # before replaying the captured ACL, otherwise unrelated default grants
    # would survive the rebuild.
    for grantee in _current_acl_grantees(connection, new_view_oid):
        target = "PUBLIC" if grantee is None else _quote_identifier(connection, grantee)
        connection.execute(
            sa.text(f"REVOKE ALL PRIVILEGES ON TABLE {qualified_view} FROM {target}")
        )

    for entry in metadata.acl:
        if not entry.privilege.isidentifier() or entry.privilege.upper() != entry.privilege:
            raise RuntimeError(
                f"{_VIEW_NAME} 的 ACL 包含无法安全重放的 privilege={entry.privilege!r}"
            )
        target = "PUBLIC" if entry.grantee is None else _quote_identifier(
            connection, entry.grantee
        )
        grant_option = " WITH GRANT OPTION" if entry.grantable else ""
        connection.execute(
            sa.text(
                f"GRANT {entry.privilege} ON TABLE {qualified_view} TO {target}"
                f"{grant_option}"
            )
        )

    if metadata.comment is not None:
        comment_literal = _sql_literal(connection, metadata.comment)
        connection.execute(
            sa.text(f"COMMENT ON VIEW {qualified_view} IS {comment_literal}")
        )

    for label in metadata.security_labels:
        provider = _quote_identifier(connection, label.provider)
        label_literal = _sql_literal(connection, label.label)
        connection.execute(
            sa.text(
                f"SECURITY LABEL FOR {provider} ON TABLE {qualified_view} "
                f"IS {label_literal}"
            )
        )

    # Transfer ownership last. Until this point the migration connection owns
    # the newly-created view and can replay its ACL/comment/labels. If this
    # operation lacks permission, the surrounding Alembic transaction fails and
    # rolls back the DROP, CREATE, and all metadata changes together.
    owner = _quote_identifier(connection, metadata.owner)
    connection.execute(
        sa.text(f"ALTER VIEW {qualified_view} OWNER TO {owner}")
    )


def upgrade() -> None:
    """幂等重建视图并保留可恢复的 PostgreSQL 对象元数据。

    先完成依赖列检查和 metadata/security-label 预读，再执行不带级联的
    DROP。Alembic 的单事务边界保证任何 DROP、CREATE 或 metadata 恢复失败
    都会回滚，依赖对象不会被偷偷删除。
    """
    # 先探测依赖列是否齐全，缺失时给出可诊断的报错，避免 DROP 后 CREATE 才失败。
    # 若本迁移早于加列迁移执行（人为乱序），底表可能还没有 is_archived，直接报错。
    conn = op.get_bind()
    missing = conn.execute(
        sa.text(
            """
            SELECT col
            FROM (VALUES ('is_archived'), ('archived_at'), ('user_name'), ('agent_name')) AS need(col)
            WHERE col NOT IN (
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'znt_conversations'
            )
            """
        )
    ).scalars().all()
    if missing:
        raise RuntimeError(
            "znt_conversations 缺少视图所需列: "
            f"{sorted(missing)}；请先确认迁移链已正确执行到包含归档字段的版本"
        )

    metadata = _read_view_metadata(conn)
    op.execute("DROP VIEW IF EXISTS v_conversations_with_deleted")
    op.execute(_CREATE_VIEW_SQL)
    _restore_view_metadata(conn, metadata)


def downgrade() -> None:
    """回滚到迁移前状态。

    迁移前视图处于"结构可能陈旧"的状态，没有一个"正确的旧定义"可还原，
    因此 downgrade 采取安全结果：删除视图。

    「downgrade 后视图缺失」是**预期且显式的不可用状态**，由 readiness
    contract 检测并拒绝业务流量，而不是静默提供错误列序的旧视图。
    如需恢复功能，重新 `alembic upgrade head` 即可重建视图。
    这比"还原成导致 500 的旧定义"更符合可用性要求。
    """
    op.execute("DROP VIEW IF EXISTS v_conversations_with_deleted")
