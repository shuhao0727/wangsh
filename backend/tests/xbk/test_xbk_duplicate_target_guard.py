"""XBK 重复裁决工具的数据库目标守卫测试（纯解析，不连数据库）。

这些测试固定 asyncpg 0.31 的目标参数优先级：当 DSN 缺少主机、端口、用户或
数据库时，驱动会继续读取相应的 ``PG*`` 环境变量。测试只调用参数解析器，不建立
socket，也不访问数据库。
"""
from __future__ import annotations

import importlib.util
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from asyncpg import connect_utils

REPO_ROOT = Path(__file__).resolve().parents[3]
COMMON_PATH = REPO_ROOT / "scripts" / "xbk" / "_active_duplicate_common.py"
MODULE_NAME = "xbk_duplicate_target_guard_common"
TARGET_ENV_VARS = (
    "PGHOST",
    "PGPORT",
    "PGDATABASE",
    "PGUSER",
    "PGSERVICE",
    "PGSERVICEFILE",
)


def _load_common_module():
    spec = importlib.util.spec_from_file_location(MODULE_NAME, COMMON_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[MODULE_NAME] = module
    spec.loader.exec_module(module)
    return module


COMMON = _load_common_module()


@pytest.fixture(autouse=True)
def _clear_target_environment(monkeypatch):
    """每个用例显式声明环境默认值，避免开发机配置影响结论。"""
    for name in TARGET_ENV_VARS:
        monkeypatch.delenv(name, raising=False)


def _asyncpg_effective_target(dsn: str):
    """只运行 asyncpg 的同步参数解析，绝不创建网络连接。"""
    addresses, parameters, _ = connect_utils._parse_connect_arguments(
        dsn=dsn,
        host=None,
        port=None,
        user=None,
        password="unused-test-password",
        passfile=None,
        database=None,
        command_timeout=None,
        statement_cache_size=100,
        max_cached_statement_lifetime=300,
        max_cacheable_statement_size=15 * 1024,
        ssl=False,
        direct_tls=None,
        server_settings=None,
        target_session_attrs=None,
        krbsrvname=None,
        gsslib=None,
        service=None,
        servicefile=None,
    )
    return addresses, parameters


def test_pghost_pgport_cannot_make_remote_target_look_local(monkeypatch):
    """回归 F1：hostless DSN 必须展示并拦截 asyncpg 将采用的远端环境目标。"""
    monkeypatch.setenv("PGHOST", "203.0.113.42")
    monkeypatch.setenv("PGPORT", "6543")
    dsn = "postgresql:///review_test"

    addresses, _ = _asyncpg_effective_target(dsn)
    target = COMMON.parse_target(dsn)

    assert addresses == [("203.0.113.42", 6543)]
    assert target.label == "203.0.113.42:6543/review_test"
    assert target.requires_production_flag
    with pytest.raises(COMMON.TargetGuardError, match="默认拒绝连接"):
        COMMON.enforce_target_guard(
            target,
            allow_production=False,
            assume_yes=True,
            action_label="测试",
        )


def test_explicit_loopback_test_dsn_overrides_environment_defaults(monkeypatch):
    """主机、端口、用户和库名均显式给出时，环境变量不得改变守卫结论。"""
    monkeypatch.setenv("PGHOST", "203.0.113.42")
    monkeypatch.setenv("PGPORT", "6543")
    monkeypatch.setenv("PGUSER", "environment_user")
    monkeypatch.setenv("PGDATABASE", "production")
    dsn = "postgresql://local_user:secret@127.0.0.1:5432/review_test"

    addresses, parameters = _asyncpg_effective_target(dsn)
    target = COMMON.parse_target(dsn)

    assert addresses == [("127.0.0.1", 5432)]
    assert parameters.user == "local_user"
    assert parameters.database == "review_test"
    assert target.label == "127.0.0.1:5432/review_test"
    assert target.user == "local_user"
    assert not target.requires_production_flag


def test_pgport_is_effective_when_explicit_host_omits_port(monkeypatch):
    """asyncpg 即使拿到显式 host，缺省 port 时仍会读取 PGPORT。"""
    monkeypatch.setenv("PGPORT", "6543")
    dsn = "postgresql://local_user@127.0.0.1/review_test"

    addresses, _ = _asyncpg_effective_target(dsn)
    target = COMMON.parse_target(dsn)

    assert addresses == [("127.0.0.1", 6543)]
    assert target.label == "127.0.0.1:6543/review_test"


def test_pgdatabase_and_pguser_are_reflected_when_dsn_omits_them(monkeypatch):
    monkeypatch.setenv("PGDATABASE", "environment_test")
    monkeypatch.setenv("PGUSER", "environment_user")
    dsn = "postgresql://127.0.0.1:5432"

    addresses, parameters = _asyncpg_effective_target(dsn)
    target = COMMON.parse_target(dsn)

    assert addresses == [("127.0.0.1", 5432)]
    assert parameters.user == "environment_user"
    assert parameters.database == "environment_test"
    assert target.user == "environment_user"
    assert target.database == "environment_test"
    assert target.label == "127.0.0.1:5432/environment_test"


def test_pguser_becomes_database_default_when_both_are_omitted(monkeypatch):
    monkeypatch.setenv("PGUSER", "operator")
    dsn = "postgresql://127.0.0.1:5432"

    _, parameters = _asyncpg_effective_target(dsn)
    target = COMMON.parse_target(dsn)

    assert parameters.user == "operator"
    assert parameters.database == "operator"
    assert target.user == "operator"
    assert target.database == "operator"
    assert target.requires_production_flag


def test_query_host_and_port_match_asyncpg_effective_target():
    dsn = "postgresql:///review_test?host=203.0.113.55&port=7654"

    addresses, _ = _asyncpg_effective_target(dsn)
    target = COMMON.parse_target(dsn)

    assert addresses == [("203.0.113.55", 7654)]
    assert target.label == "203.0.113.55:7654/review_test"
    assert target.requires_production_flag


def test_query_host_embedded_port_matches_asyncpg_effective_target():
    dsn = "postgresql:///review_test?host=203.0.113.1:6543"

    addresses, _ = _asyncpg_effective_target(dsn)
    target = COMMON.parse_target(dsn)

    assert addresses == [("203.0.113.1", 6543)]
    assert target.label == "203.0.113.1:6543/review_test"
    assert target.requires_production_flag


def test_netloc_host_ignores_query_port_like_asyncpg():
    """netloc host 已解析出端口后，asyncpg 不再采用 query port。"""
    dsn = "postgresql://local_user@127.0.0.1/review_test?port=6543"

    addresses, _ = _asyncpg_effective_target(dsn)
    target = COMMON.parse_target(dsn)

    assert addresses == [("127.0.0.1", 5432)]
    assert target.label == "127.0.0.1:5432/review_test"


def test_netloc_host_ignores_query_host_and_port_like_asyncpg():
    dsn = (
        "postgresql://local_user@127.0.0.1/review_test"
        "?host=203.0.113.1:6543&port=7654"
    )

    addresses, _ = _asyncpg_effective_target(dsn)
    target = COMMON.parse_target(dsn)

    assert addresses == [("127.0.0.1", 5432)]
    assert target.label == "127.0.0.1:5432/review_test"


def test_netloc_host_uses_pgport_before_ignoring_query_port(monkeypatch):
    """netloc host 缺端口时先采用 PGPORT，后续 query port 仍被忽略。"""
    monkeypatch.setenv("PGPORT", "7777")
    dsn = "postgresql://local_user@127.0.0.1/review_test?port=6543"

    addresses, _ = _asyncpg_effective_target(dsn)
    target = COMMON.parse_target(dsn)

    assert addresses == [("127.0.0.1", 7777)]
    assert target.label == "127.0.0.1:7777/review_test"


def test_query_port_overrides_embedded_query_host_port():
    dsn = "postgresql:///review_test?host=203.0.113.1:6543&port=7654"

    addresses, _ = _asyncpg_effective_target(dsn)
    target = COMMON.parse_target(dsn)

    assert addresses == [("203.0.113.1", 7654)]
    assert target.label == "203.0.113.1:7654/review_test"


def test_repeated_query_host_uses_asyncpg_last_value():
    """不能显示第一个 localhost，而让 asyncpg 使用最后一个远端 host。"""
    dsn = (
        "postgresql:///review_test?host=127.0.0.1"
        "&host=203.0.113.77&port=5432"
    )

    addresses, _ = _asyncpg_effective_target(dsn)
    target = COMMON.parse_target(dsn)

    assert addresses == [("203.0.113.77", 5432)]
    assert target.label == "203.0.113.77:5432/review_test"
    assert target.requires_production_flag


def test_hostaddr_cannot_hide_pghost_fallback(monkeypatch):
    """asyncpg 不用 hostaddr 建连；守卫仍须展示实际生效的 PGHOST 并拒绝歧义。"""
    monkeypatch.setenv("PGHOST", "203.0.113.88")
    dsn = "postgresql:///review_test?hostaddr=127.0.0.1"

    addresses, _ = _asyncpg_effective_target(dsn)
    target = COMMON.parse_target(dsn)

    assert addresses == [("203.0.113.88", 5432)]
    assert target.label == "203.0.113.88:5432/review_test"
    assert "DSN query hostaddr" in target.unresolved_sources
    with pytest.raises(COMMON.TargetGuardError, match="无法安全展开"):
        COMMON.enforce_target_guard(
            target,
            allow_production=True,
            assume_yes=True,
            action_label="测试",
        )


@pytest.mark.parametrize(
    "name,value",
    [
        ("PGSERVICE", "production"),
        ("PGSERVICEFILE", "/tmp/production-service.conf"),
    ],
)
def test_service_environment_is_rejected_even_with_production_override(
    monkeypatch, name, value
):
    monkeypatch.setenv(name, value)
    target = COMMON.parse_target(
        "postgresql://local_user@127.0.0.1:5432/review_test"
    )

    assert name in target.unresolved_sources
    with pytest.raises(COMMON.TargetGuardError, match="无法安全展开"):
        COMMON.enforce_target_guard(
            target,
            allow_production=True,
            assume_yes=True,
            action_label="测试",
        )


def test_query_service_is_rejected_even_with_production_override():
    target = COMMON.parse_target(
        "postgresql://local_user@127.0.0.1:5432/review_test?service=production"
    )

    assert "DSN query service" in target.unresolved_sources
    with pytest.raises(COMMON.TargetGuardError, match="无法安全展开"):
        COMMON.enforce_target_guard(
            target,
            allow_production=True,
            assume_yes=True,
            action_label="测试",
        )


@pytest.mark.parametrize(
    ("query", "expected_settings", "source"),
    [
        ("search_path=evil", {"search_path": "evil"}, "search_path"),
        (
            "options=-csearch_path%3Devil",
            {"options": "-csearch_path=evil"},
            "options",
        ),
    ],
)
def test_unknown_query_server_settings_are_rejected_before_connect(
    query, expected_settings, source
):
    dsn = f"postgresql://local_user@127.0.0.1:5432/review_test?{query}"

    addresses, parameters = _asyncpg_effective_target(dsn)
    target = COMMON.parse_target(dsn)

    assert addresses == [("127.0.0.1", 5432)]
    assert parameters.server_settings == expected_settings
    assert f"DSN query server_settings: {source}" in target.unresolved_sources
    with pytest.raises(COMMON.TargetGuardError, match="无法安全展开"):
        COMMON.enforce_target_guard(
            target,
            allow_production=True,
            assume_yes=True,
            action_label="测试",
        )


def test_known_safe_query_is_consumed_instead_of_becoming_server_setting():
    dsn = (
        "postgresql://local_user@127.0.0.1:5432/review_test"
        "?sslmode=require"
    )

    addresses, parameters = _asyncpg_effective_target(dsn)
    target = COMMON.parse_target(dsn)

    assert addresses == [("127.0.0.1", 5432)]
    assert parameters.server_settings is None
    assert target.unresolved_sources == ()
    assert target.label == "127.0.0.1:5432/review_test"


def test_multi_host_environment_is_rejected_instead_of_partially_displayed(monkeypatch):
    monkeypatch.setenv("PGHOST", "127.0.0.1,203.0.113.42")
    with pytest.raises(COMMON.TargetGuardError, match="多个候选值"):
        COMMON.parse_target("postgresql:///review_test")


def test_multi_query_host_is_rejected_instead_of_partially_displayed():
    with pytest.raises(COMMON.TargetGuardError, match="多个候选值"):
        COMMON.parse_target(
            "postgresql:///review_test?host=127.0.0.1,203.0.113.42"
        )


def test_password_redaction_covers_authority_and_query_passwords():
    dsn = (
        "postgresql://admin:AuthoritySecret@127.0.0.1:5432/review_test"
        "?password=QuerySecret&sslpassword=SslSecret&sslmode=require"
    )
    redacted = COMMON._redact_dsn(dsn)

    assert "AuthoritySecret" not in redacted
    assert "QuerySecret" not in redacted
    assert "SslSecret" not in redacted
    assert redacted.count("%2A%2A%2A") == 2
    assert "admin:***@127.0.0.1:5432" in redacted


def test_parse_error_never_echoes_query_password():
    dsn = (
        "postgresql://admin:AuthoritySecret@127.0.0.1:notaport/review_test"
        "?password=QuerySecret"
    )

    with pytest.raises(COMMON.TargetGuardError) as excinfo:
        COMMON.parse_target(dsn)

    message = str(excinfo.value)
    assert "AuthoritySecret" not in message
    assert "QuerySecret" not in message


def test_format_timestamp_preserves_distinct_microseconds_in_same_second():
    first = datetime(2026, 9, 19, 12, 34, 56, 123456)
    second = datetime(2026, 9, 19, 12, 34, 56, 123457)

    assert COMMON.format_timestamp(first) == "2026-09-19 12:34:56.123456"
    assert COMMON.format_timestamp(second) == "2026-09-19 12:34:56.123457"
    assert COMMON.format_timestamp(first) != COMMON.format_timestamp(second)


def test_format_timestamp_converts_aware_value_to_utc_with_microseconds():
    value = datetime(
        2026,
        9,
        19,
        20,
        34,
        56,
        654321,
        tzinfo=timezone(timedelta(hours=8)),
    )

    assert COMMON.format_timestamp(value) == "2026-09-19 12:34:56.654321+00:00"


def test_format_timestamp_none_remains_empty():
    assert COMMON.format_timestamp(None) == ""
