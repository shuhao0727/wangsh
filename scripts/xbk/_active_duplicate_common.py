"""共享工具：XBK 历史重复有效选课的人工裁决（只读审计 + 受控软删除）。

被 ``audit_active_duplicates.py`` 与 ``resolve_active_duplicates.py`` 共同导入，
集中实现安全关键逻辑，避免两个入口各自实现而产生分歧：

1. 连接串解析与目标识别 —— **不读取项目 ``.env``**，连接串必须显式提供；
2. 生产库连接守卫 —— 默认拒绝，必须 ``--allow-production`` 并交互确认；
3. 与候选迁移完全一致的重复检测查询。

检测语义必须与
``backend/alembic/versions/20260914_0001_xbk_active_selection_unique.py`` 中的
``_DUPLICATE_QUERY`` 保持一致：按 ``(year, term, student_no)`` 分组、
``is_deleted IS FALSE``、``HAVING COUNT(*) > 1``。本模块刻意不加 ``LIMIT``，
以便一次展示全部重复组（迁移侧只展示前 20 个样本）。
"""
from __future__ import annotations

import getpass
import os
import re
import sys
import urllib.parse
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, List, Optional, Tuple

import asyncpg

ENV_DSN_VAR = "XBK_DUPLICATE_DSN"

# 与迁移 ``_lock_selection_writers`` 相同：阻塞所有并发 writer。
# 人工裁决写入窗口内复用它，保证「读到的一致快照」在写入时仍然成立。
LOCK_WRITERS_SQL = "LOCK TABLE xbk_selections IN SHARE ROW EXCLUSIVE MODE"

# 与迁移 ``_DUPLICATE_QUERY`` 同语义，仅去掉 LIMIT 20。
DUPLICATE_GROUPS_SQL = """
SELECT year, term, student_no, COUNT(*) AS active_count
FROM xbk_selections
WHERE is_deleted IS FALSE
GROUP BY year, term, student_no
HAVING COUNT(*) > 1
ORDER BY year, term, student_no
"""

_GROUP_SUBQUERY = """
    SELECT year, term, student_no
    FROM xbk_selections
    WHERE is_deleted IS FALSE
    GROUP BY year, term, student_no
    HAVING COUNT(*) > 1
"""

DETAIL_ROWS_SQL_WITH_COURSE = f"""
SELECT s.id, s.student_no, s.name, s.year, s.term, s.grade, s.course_code,
       c.course_name AS course_name,
       s.created_at, s.updated_at
FROM xbk_selections s
LEFT JOIN xbk_courses c
       ON c.year = s.year AND c.term = s.term AND c.course_code = s.course_code
WHERE s.is_deleted IS FALSE
  AND (s.year, s.term, s.student_no) IN ({_GROUP_SUBQUERY})
ORDER BY s.year, s.term, s.student_no, s.id
"""

DETAIL_ROWS_SQL_PLAIN = f"""
SELECT s.id, s.student_no, s.name, s.year, s.term, s.grade, s.course_code,
       NULL::varchar AS course_name,
       s.created_at, s.updated_at
FROM xbk_selections s
WHERE s.is_deleted IS FALSE
  AND (s.year, s.term, s.student_no) IN ({_GROUP_SUBQUERY})
ORDER BY s.year, s.term, s.student_no, s.id
"""

_LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1", ""}
_TEST_DB_PATTERN = re.compile(r"(?:^|[_-])(?:test|testing|ci)(?:$|[_-])", re.I)


class TargetGuardError(RuntimeError):
    """目标库守卫拒绝继续（未授权连接疑似生产库或连接串缺失）。"""


class DecisionError(ValueError):
    """人工裁决输入不完整或自相矛盾。"""


class ConsistencyError(RuntimeError):
    """实际影响行数与裁决计划不符；必须在事务内触发整笔回滚。"""


@dataclass(frozen=True)
class TargetInfo:
    """解析后的连接目标。

    ``dsn`` 保留原始连接串（可能含明文密码），因此用 ``repr=False`` 把它排除在
    自动生成的 ``__repr__`` 之外：直接 ``print(target)``、``logger.debug(target)``
    或异常回溯渲染该对象时都不会泄露凭据。需要展示目标时请用 :attr:`label`。
    """

    dsn: str = field(repr=False)
    host: str
    port: int
    database: str
    user: str
    has_query: bool = False
    unresolved_sources: Tuple[str, ...] = ()

    @property
    def label(self) -> str:
        host = self.host or "(unix socket)"
        return f"{host}:{self.port}/{self.database}"

    @property
    def is_loopback(self) -> bool:
        return self.host in _LOOPBACK_HOSTS

    @property
    def looks_like_test_database(self) -> bool:
        return bool(_TEST_DB_PATTERN.search(self.database))

    @property
    def requires_production_flag(self) -> bool:
        """只有「回环地址 + 测试库名 + 无查询参数」才允许不加开关直接连接。

        查询参数、环境默认值和 service 都可能改变实际连接目标。可确定的环境默认值
        会在 :func:`parse_target` 中展开；service 等无法安全展开的来源会记录在
        ``unresolved_sources`` 并由 :func:`enforce_target_guard` 直接拒绝。任何 query
        仍按 fail-closed 处理，一律要求 ``--allow-production`` 与交互确认。
        """
        if self.has_query or self.unresolved_sources:
            return True
        return not (self.is_loopback and self.looks_like_test_database)


_SQLALCHEMY_PREFIX = re.compile(r"^postgres(?:ql)?\+[a-z0-9_]+://", re.I)
_POSTGRES_PREFIX = re.compile(r"^postgres://", re.I)


def _redact_dsn(dsn: str) -> str:
    """把连接串中的密码替换为 ``***``，用于错误信息与日志。

    解析失败时 ``urlparse`` 仍能给出 netloc，因此可以只重写密码部分；若连 netloc
    都取不到，退化为不显示原始连接串，避免把凭据写进 stderr。
    """
    try:
        parsed = urllib.parse.urlsplit(dsn)
        netloc = parsed.netloc
        if parsed.username is not None:
            host = parsed.hostname or ""
            if ":" in host and not host.startswith("["):
                host = f"[{host}]"
            if parsed.port is not None:
                host = f"{host}:{parsed.port}"
            netloc = f"{parsed.username}:***@{host}"

        # asyncpg also accepts credentials in the query string.  Never echo a
        # query password while reporting a malformed/unsafe target.
        query_items = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
        redacted_query = urllib.parse.urlencode(
            [
                (
                    key,
                    "***" if key.lower() in {"password", "sslpassword"} else value,
                )
                for key, value in query_items
            ],
            doseq=True,
        )
        return urllib.parse.urlunsplit(
            (parsed.scheme, netloc, parsed.path, redacted_query, parsed.fragment)
        )
    except ValueError:
        return "(连接串含非法字符，已隐去)"


def normalize_dsn(raw: str) -> str:
    """把 SQLAlchemy 风格前缀规范化为 asyncpg 可接受的形式。

    ``postgresql+asyncpg://`` / ``postgres+psycopg2://`` 这类带驱动后缀的前缀
    一律剥掉：asyncpg 只认 ``postgresql://``，保留 ``+driver`` 会让它在解析阶段
    抛 ``ClientConfigurationError``（属于 ``ValueError``，不是 ``PostgresError``）。
    """
    dsn = raw.strip()
    dsn = _SQLALCHEMY_PREFIX.sub("postgresql://", dsn, count=1)
    dsn = _POSTGRES_PREFIX.sub("postgresql://", dsn, count=1)
    return dsn


# asyncpg 在 DSN 缺少对应字段时，依次采纳 query 参数与 libpq 风格环境变量。
# 守卫必须复现这部分优先级；否则展示的“本地测试库”可能与驱动实际连接目标不同。
_HOST_QUERY_KEYS = ("host",)
_DATABASE_QUERY_KEYS = ("dbname", "database")
_SERVICE_ENV_VARS = ("PGSERVICE", "PGSERVICEFILE")
_ASYNCPG_QUERY_KEYS = frozenset(
    {
        "port",
        "host",
        "dbname",
        "database",
        "user",
        "password",
        "passfile",
        "sslmode",
        "sslcert",
        "sslkey",
        "sslrootcert",
        "sslnegotiation",
        "sslcrl",
        "sslpassword",
        "ssl_min_protocol_version",
        "ssl_max_protocol_version",
        "target_session_attrs",
        "krbsrvname",
        "gsslib",
        "service",
    }
)


def resolve_dsn(explicit: Optional[str]) -> str:
    """连接串只能来自 ``--dsn`` 或环境变量；绝不回退到项目 ``.env``。"""
    raw = explicit or os.environ.get(ENV_DSN_VAR, "")
    if not raw.strip():
        raise TargetGuardError(
            "缺少连接串：请用 --dsn 或环境变量 "
            f"{ENV_DSN_VAR} 显式提供。本工具不会读取项目 .env，以免误连生产库。"
        )
    return normalize_dsn(raw)


def _first_query_value(query: Dict[str, List[str]], keys: Tuple[str, ...]) -> Optional[str]:
    """按键优先级取值；同名参数重复时与 asyncpg 一样采用最后一个值。"""
    for key in keys:
        values = query.get(key)
        if values:
            for value in reversed(values):
                if value:
                    return value
    return None


def _single_value(value: str, *, source: str) -> str:
    """只接受单一目标值；多主机 failover 无法用一个标签完整确认。"""
    if "," in value:
        raise TargetGuardError(
            f"{source} 指定了多个候选值，无法安全确认唯一数据库目标，已拒绝连接。"
        )
    return value


def _parse_port(value: Optional[str], *, source: str) -> int:
    """按 asyncpg 的整数端口语义解析，并在连接前完成范围校验。"""
    raw = value or "5432"
    _single_value(raw, source=source)
    try:
        port = int(raw)
    except ValueError as exc:
        raise TargetGuardError(f"{source} 不是整数：{raw!r}") from exc
    if not 1 <= port <= 65535:
        raise TargetGuardError(f"{source} 超出有效范围 1..65535：{port!r}")
    return port


def _parse_host_spec(
    hostspec: str,
    *,
    explicit_port: Optional[int],
    source: str,
    unquote: bool,
) -> Tuple[str, int]:
    """解析 asyncpg 的单主机 ``host[:port]`` 语义。

    asyncpg 的顺序很重要：没有显式 ``port`` 参数时，它先解析 ``PGPORT``，随后
    hostspec 自带端口再覆盖默认端口；一旦显式 ``port`` 已存在，hostspec 内端口会
    被忽略。多主机 failover 无法用一个确认标签完整表达，因此直接 fail-closed。
    """
    raw = _single_value(hostspec, source=source)
    if not raw:
        raise TargetGuardError(f"{source} 为空，无法确认数据库目标。")

    default_port = explicit_port
    if default_port is None:
        pgport = os.environ.get("PGPORT")
        default_port = _parse_port(pgport, source="PGPORT" if pgport else "default port")

    embedded_port: Optional[str] = None
    if raw.startswith("/"):
        host = raw
    elif raw.startswith("["):
        match = re.fullmatch(r"\[([^\]]+)\](?::([0-9]+))?", raw)
        if not match:
            raise TargetGuardError(f"{source} 中的 IPv6 地址格式无效，已拒绝连接。")
        host, embedded_port = match.groups()
    else:
        if raw.count(":") > 1:
            raise TargetGuardError(
                f"{source} 包含未加方括号的 IPv6 或歧义端口，已拒绝连接。"
            )
        host, separator, embedded_port = raw.partition(":")
        if not separator:
            embedded_port = None

    if unquote:
        host = urllib.parse.unquote(host)
        if embedded_port:
            embedded_port = urllib.parse.unquote(embedded_port)
    if not host:
        raise TargetGuardError(f"{source} 缺少主机名，已拒绝连接。")

    port = default_port
    if explicit_port is None and embedded_port:
        port = _parse_port(embedded_port, source=f"{source} 内嵌端口")
    normalized_host = host if host.startswith("/") else host.lower()
    return normalized_host, port


def parse_target(dsn: str) -> TargetInfo:
    """解析连接串，返回可安全展示的目标信息。

    ``urlparse`` 自身很宽容，但 ``port``/``hostname`` 属性在取值时才校验，非法值
    会抛 ``ValueError``。这里统一转成 ``TargetGuardError``，让入口返回约定的退出码
    ``2``（参数错误），而不是让它冒泡成未捕获异常、以 ``1`` 结束。
    """
    try:
        parsed = urllib.parse.urlparse(dsn)
        if parsed.scheme not in {"postgresql", "postgres"}:
            raise ValueError(f"不支持的 scheme {parsed.scheme!r}")
        if parsed.netloc:
            if "@" in parsed.netloc:
                _, _, netloc_hostspec = parsed.netloc.partition("@")
            else:
                netloc_hostspec = parsed.netloc
        else:
            netloc_hostspec = ""
        netloc_database = None
        if parsed.path:
            raw_database = parsed.path[1:] if parsed.path.startswith("/") else parsed.path
            netloc_database = urllib.parse.unquote(raw_database)
        netloc_user = urllib.parse.unquote(parsed.username or "")
        query = urllib.parse.parse_qs(
            parsed.query,
            keep_blank_values=False,
            strict_parsing=True,
        )
    except ValueError as exc:
        raise TargetGuardError(f"连接串无法解析（{exc}）：{_redact_dsn(dsn)}") from exc

    override_host = _first_query_value(query, _HOST_QUERY_KEYS)
    override_port = _first_query_value(query, ("port",))
    override_database = _first_query_value(query, _DATABASE_QUERY_KEYS)
    override_user = _first_query_value(query, ("user",))

    unresolved_sources: List[str] = []
    unknown_query_keys = sorted(set(query) - _ASYNCPG_QUERY_KEYS - {"hostaddr"})
    if unknown_query_keys:
        unresolved_sources.append(
            "DSN query server_settings: " + ", ".join(unknown_query_keys)
        )
    if _first_query_value(query, ("service",)):
        unresolved_sources.append("DSN query service")
    if _first_query_value(query, ("hostaddr",)):
        # asyncpg 0.31 does not use libpq's hostaddr as its socket target. Treating
        # it as host would hide a real PGHOST fallback, so reject this ambiguity.
        unresolved_sources.append("DSN query hostaddr")
    unresolved_sources.extend(name for name in _SERVICE_ENV_VARS if os.environ.get(name))

    # 精确复现 asyncpg 0.31 的组合顺序：netloc host 一经解析就已经获得端口，后续
    # query port 会被忽略；没有 netloc host 时，query port 先于 query host 生效。
    if netloc_hostspec:
        host, port = _parse_host_spec(
            netloc_hostspec,
            explicit_port=None,
            source="DSN host",
            unquote=True,
        )
    else:
        query_port = (
            _parse_port(override_port, source="DSN query port")
            if override_port
            else None
        )
        if override_host:
            host, port = _parse_host_spec(
                override_host,
                explicit_port=query_port,
                source="DSN query host",
                unquote=False,
            )
        elif os.environ.get("PGHOST"):
            host, port = _parse_host_spec(
                os.environ["PGHOST"],
                explicit_port=query_port,
                source="PGHOST",
                unquote=False,
            )
        else:
            host = ""
            if query_port is not None:
                port = query_port
            else:
                pgport = os.environ.get("PGPORT")
                port = _parse_port(
                    pgport,
                    source="PGPORT" if pgport else "default port",
                )

    try:
        default_user = getpass.getuser()
    except (ImportError, KeyError, OSError):
        default_user = ""
        unresolved_sources.append("操作系统默认用户")
    user = netloc_user or override_user or os.environ.get("PGUSER", "") or default_user
    if netloc_database is not None:
        database = netloc_database
    else:
        database = override_database or os.environ.get("PGDATABASE", "") or user

    return TargetInfo(
        dsn=dsn,
        host=host,
        port=port,
        database=database,
        user=user,
        has_query=bool(parsed.query),
        unresolved_sources=tuple(unresolved_sources),
    )


def enforce_target_guard(
    target: TargetInfo,
    *,
    allow_production: bool,
    assume_yes: bool,
    action_label: str,
) -> None:
    """默认拒绝连接疑似生产库；必须显式开关，且通常还要交互确认。"""
    if target.unresolved_sources:
        sources = "、".join(target.unresolved_sources)
        raise TargetGuardError(
            f"连接目标受无法安全展开的配置影响（{sources}），已拒绝连接。"
            "请移除 service/PGSERVICE/PGSERVICEFILE，并在 DSN 中显式写出主机、端口、"
            "用户和数据库后重试。"
        )
    if not target.requires_production_flag:
        print(f"[目标] 回环测试目标，无需生产开关：{target.label}")
        return
    if not allow_production:
        raise TargetGuardError(
            f"目标 {target.label} 不是「回环地址 + 测试库名」，已默认拒绝连接。"
            "确认这是已获批准的运维目标后，再显式加上 --allow-production。"
        )
    print("!" * 68)
    print(f"[警告] 目标库不是回环测试库：{target.label}")
    print(f"[警告] 即将执行：{action_label}")
    print("[警告] 生产操作必须已完成只读预检、可恢复备份、停写与复核；")
    print("[警告] 要求见 docs/docker/deploy/DEPLOY.md。")
    print("!" * 68)
    if assume_yes:
        print("[警告] 已通过 --yes 跳过交互确认。")
        return
    if not sys.stdin.isatty():
        raise TargetGuardError("非交互环境且未提供 --yes，拒绝继续连接该目标。")
    typed = input(f"请核对后输入数据库名 {target.database!r} 以确认：").strip()
    if typed != target.database:
        raise TargetGuardError("确认输入与数据库名不一致，已中止。")


async def connect(dsn: str, *, read_only: bool) -> Tuple[asyncpg.Connection, str]:
    """建立连接；``read_only=True`` 时同时启用数据库级只读保护。

    返回 ``(连接, 只读保护说明)``。``read_only=False`` 只应由 resolve 脚本在
    ``--apply`` 路径使用。
    """
    conn = await asyncpg.connect(dsn)
    if not read_only:
        return conn, "已关闭（本次将写入，请确认已完成停写与备份）"
    try:
        await conn.execute("SET default_transaction_read_only = on")
        state = await conn.fetchval("SHOW default_transaction_read_only")
    except Exception as exc:  # 连接器拒绝该 GUC 时降级为提示，脚本本身仍只 SELECT
        return conn, f"未启用（{exc!r}）；脚本本身仍只执行 SELECT"
    return conn, f"default_transaction_read_only = {state}"


@asynccontextmanager
async def read_only_snapshot(conn: asyncpg.Connection) -> AsyncIterator[asyncpg.Connection]:
    """把多条 SELECT 放进同一个只读快照，避免组清单与明细来自不同时刻。

    审计要「列出重复组」并「列出组内明细」，分两次 autocommit 查询时，两次之间若有
    并发写入，就可能出现某组在第一次查询里存在、在第二次查询里已消失（或反之），
    导出的裁决 CSV 与实际状态不符。REPEATABLE READ + READ ONLY 让两次查询看到同一
    个一致性快照，与 ``scripts/check_migration_state.py`` 的预检口径一致。
    """
    async with conn.transaction(isolation="repeatable_read", readonly=True):
        yield conn


async def course_table_exists(conn: asyncpg.Connection) -> bool:
    """``xbk_courses`` 可能不存在（例如只建了 xbk_selections 的最小隔离 schema）。"""
    return bool(await conn.fetchval("SELECT to_regclass('xbk_courses') IS NOT NULL"))


async def fetch_duplicate_groups(conn: asyncpg.Connection) -> List[Dict[str, Any]]:
    """返回全部重复组；语义与迁移预检查询一致。"""
    try:
        rows = await conn.fetch(DUPLICATE_GROUPS_SQL)
    except asyncpg.UndefinedTableError as exc:
        raise TargetGuardError(
            "目标库缺少 xbk_selections 表，请确认连接串指向正确的数据库。"
        ) from exc
    return [dict(row) for row in rows]


async def fetch_duplicate_rows(conn: asyncpg.Connection) -> List[Dict[str, Any]]:
    """返回重复组内的全部有效记录明细（含课程名，若课程表存在）。"""
    sql = (
        DETAIL_ROWS_SQL_WITH_COURSE
        if await course_table_exists(conn)
        else DETAIL_ROWS_SQL_PLAIN
    )
    rows = await conn.fetch(sql)
    return [dict(row) for row in rows]


def group_key(row: Dict[str, Any]) -> Tuple[str, str, str]:
    """重复组的分组键，与唯一索引 ``(year, term, student_no)`` 一致。"""
    return (row["year"], row["term"], row["student_no"])


def format_timestamp(value: Any) -> str:
    """稳定输出完整微秒；有时区值统一转换为 UTC，naive 值保持 naive。"""
    if value is None:
        return ""
    if not isinstance(value, datetime):
        return str(value)
    if value.tzinfo is not None and value.utcoffset() is not None:
        value = value.astimezone(timezone.utc)
    return value.isoformat(sep=" ", timespec="microseconds")
