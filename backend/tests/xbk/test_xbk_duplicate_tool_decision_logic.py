"""XBK 历史重复裁决工具的安全关键逻辑回归测试（不连接数据库）。

覆盖完整 CSV 快照校验、同一事务内的锁后重读/写入/提交前复核，以及连接目标守卫。
数据库事务测试使用内存合成连接：可以证明调用顺序、回滚和零写入，但不替代 PostgreSQL
真实锁与并发语义测试。
"""
from __future__ import annotations

import asyncio
import copy
import csv
import importlib.util
import sys
import types
from datetime import datetime
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
XBK_DIR = REPO_ROOT / "scripts" / "xbk"

_MODULE_NAMES = (
    "scripts.xbk._active_duplicate_common",
    "scripts.xbk.audit_active_duplicates",
    "scripts.xbk.resolve_active_duplicates",
)


def _load_root_xbk_modules() -> dict:
    """按文件路径加载根目录的 XBK 工具模块，避免与 backend/scripts 同名包冲突。"""
    saved = {name: sys.modules.get(name) for name in ("scripts", "scripts.xbk", *_MODULE_NAMES)}
    for name in _MODULE_NAMES:
        sys.modules.pop(name, None)

    root_pkg = types.ModuleType("scripts")
    root_pkg.__path__ = [str(REPO_ROOT / "scripts")]
    xbk_pkg = types.ModuleType("scripts.xbk")
    xbk_pkg.__path__ = [str(XBK_DIR)]
    sys.modules["scripts"] = root_pkg
    sys.modules["scripts.xbk"] = xbk_pkg

    try:
        loaded = {}
        for name, filename in (
            ("scripts.xbk._active_duplicate_common", "_active_duplicate_common.py"),
            ("scripts.xbk.audit_active_duplicates", "audit_active_duplicates.py"),
            ("scripts.xbk.resolve_active_duplicates", "resolve_active_duplicates.py"),
        ):
            spec = importlib.util.spec_from_file_location(name, XBK_DIR / filename)
            if spec is None or spec.loader is None:
                raise RuntimeError(f"无法加载测试模块：{name}")
            module = importlib.util.module_from_spec(spec)
            sys.modules[name] = module
            spec.loader.exec_module(module)
            loaded[name.rsplit(".", 1)[-1]] = module
    finally:
        for name, original in saved.items():
            if original is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = original
    return loaded


@pytest.fixture(scope="module")
def tools():
    return _load_root_xbk_modules()


def _group(student_no: str, count: int) -> dict:
    return {
        "year": "2026-2027",
        "term": "上学期",
        "student_no": student_no,
        "active_count": count,
    }


def _row(record_id: int, student_no: str, course_code: str, **changes) -> dict:
    row = {
        "id": record_id,
        "student_no": student_no,
        "name": "测试学生",
        "year": "2026-2027",
        "term": "上学期",
        "grade": "高二",
        "course_code": course_code,
        "course_name": f"课程{course_code}",
        "created_at": None,
        "updated_at": None,
    }
    row.update(changes)
    return row


GROUP = _group("150", 3)
ROWS = [_row(5, "150", "6"), _row(9, "150", "19"), _row(17, "150", "21")]
KEY = ("2026-2027", "上学期", "150")

CSV_COLUMNS = [
    "year", "term", "grade", "student_no", "name", "group_size",
    "id", "course_code", "course_name", "created_at", "updated_at", "keep",
]


def _decision(resolve, row: dict, keep: bool, *, group_size: int = 3, **changes):
    values = {
        "id": int(row["id"]),
        "keep": keep,
        "year": str(row.get("year") or ""),
        "term": str(row.get("term") or ""),
        "grade": str(row.get("grade") or ""),
        "student_no": str(row.get("student_no") or ""),
        "name": str(row.get("name") or ""),
        "group_size": group_size,
        "course_code": str(row.get("course_code") or ""),
        "course_name": str(row.get("course_name") or ""),
        "created_at": resolve.format_timestamp(row.get("created_at")),
        "updated_at": resolve.format_timestamp(row.get("updated_at")),
    }
    values.update(changes)
    return resolve.DecisionRow(**values)


def _decisions(resolve, rows=ROWS, keep_id=5, *, group_size=3):
    return {
        int(row["id"]): _decision(
            resolve, row, int(row["id"]) == keep_id, group_size=group_size
        )
        for row in rows
    }


def _write_decisions_csv(path: Path, resolve, rows, keep_id: int, *, group_size: int) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "year": row["year"],
                    "term": row["term"],
                    "grade": row.get("grade") or "",
                    "student_no": row["student_no"],
                    "name": row.get("name") or "",
                    "group_size": group_size,
                    "id": row["id"],
                    "course_code": row.get("course_code") or "",
                    "course_name": row.get("course_name") or "",
                    "created_at": resolve.format_timestamp(row.get("created_at")),
                    "updated_at": resolve.format_timestamp(row.get("updated_at")),
                    "keep": "yes" if int(row["id"]) == keep_id else "",
                }
            )


# --- 完整裁决与业务快照 -------------------------------------------------------

def test_unadjudicated_member_blocks_instead_of_being_deleted(tools):
    resolve = tools["resolve_active_duplicates"]
    decisions = _decisions(resolve)
    decisions.pop(17)
    with pytest.raises(resolve.DecisionError, match="未参与裁决"):
        resolve.build_keep_map([GROUP], ROWS, decisions)


def test_explicitly_adjudicated_rows_produce_exact_delete_set(tools):
    resolve = tools["resolve_active_duplicates"]
    decisions = _decisions(resolve)
    keep_map = resolve.build_keep_map([GROUP], ROWS, decisions)
    assert keep_map == {KEY: 5}
    assert sorted(resolve.plan_soft_deletes([GROUP], ROWS, keep_map)) == [9, 17]


def test_decision_referencing_unknown_id_is_rejected_as_stale(tools):
    resolve = tools["resolve_active_duplicates"]
    decisions = _decisions(resolve)
    decisions[999] = _decision(resolve, _row(999, "150", "99"), False)
    with pytest.raises(resolve.DecisionError, match="裁决已过期"):
        resolve.build_keep_map([GROUP], ROWS, decisions)


def test_group_without_any_keep_marker_is_rejected(tools):
    resolve = tools["resolve_active_duplicates"]
    decisions = {row["id"]: _decision(resolve, row, False) for row in ROWS}
    with pytest.raises(resolve.DecisionError, match="缺少裁决"):
        resolve.build_keep_map([GROUP], ROWS, decisions)


def test_group_with_multiple_keep_markers_is_rejected(tools):
    resolve = tools["resolve_active_duplicates"]
    decisions = _decisions(resolve)
    decisions[9] = _decision(resolve, ROWS[1], True)
    with pytest.raises(resolve.DecisionError, match="多条保留记录"):
        resolve.build_keep_map([GROUP], ROWS, decisions)


@pytest.mark.parametrize("builder_name", ["build_keep_map", "build_resolution_plan"])
def test_group_with_different_names_is_rejected_as_identity_collision(tools, builder_name):
    resolve = tools["resolve_active_duplicates"]
    rows = [
        _row(1, "150", "6", name="周毅"),
        _row(2, "150", "19", name="刘宇轩"),
    ]
    decisions = _decisions(resolve, rows, 1, group_size=2)

    with pytest.raises(resolve.DecisionError, match="姓名或年级不一致.*疑似学号撞号"):
        getattr(resolve, builder_name)([_group("150", 2)], rows, decisions)


@pytest.mark.parametrize("builder_name", ["build_keep_map", "build_resolution_plan"])
def test_same_name_with_different_grades_is_rejected_as_identity_collision(tools, builder_name):
    resolve = tools["resolve_active_duplicates"]
    rows = [
        _row(1, "150", "6", name="同名学生", grade="高一"),
        _row(2, "150", "19", name="同名学生", grade="高二"),
    ]
    decisions = _decisions(resolve, rows, 1, group_size=2)

    with pytest.raises(resolve.DecisionError, match="姓名或年级不一致.*疑似学号撞号"):
        getattr(resolve, builder_name)([_group("150", 2)], rows, decisions)


@pytest.mark.parametrize("builder_name", ["build_keep_map", "build_resolution_plan"])
@pytest.mark.parametrize("empty_field", ["name", "grade"])
def test_group_with_empty_identity_is_rejected(tools, builder_name, empty_field):
    resolve = tools["resolve_active_duplicates"]
    rows = [_row(1, "150", "6"), _row(2, "150", "19", **{empty_field: "   "})]
    decisions = _decisions(resolve, rows, 1, group_size=2)

    with pytest.raises(resolve.DecisionError, match="姓名或年级为空.*身份不完整"):
        getattr(resolve, builder_name)([_group("150", 2)], rows, decisions)


@pytest.mark.parametrize("raw", ["²", "٣", "-1", "1.0", "12 ", " 12", "0x10", "abc", "", "1e3"])
def test_record_id_rejects_anything_that_is_not_plain_ascii_digits(tools, raw):
    resolve = tools["resolve_active_duplicates"]
    with pytest.raises(resolve.DecisionError):
        resolve.parse_record_id(raw, where="测试")


def test_record_id_accepts_plain_digits(tools):
    resolve = tools["resolve_active_duplicates"]
    assert resolve.parse_record_id("12", where="测试") == 12


def test_parser_has_only_complete_csv_decision_source(tools):
    resolve = tools["resolve_active_duplicates"]
    destinations = {action.dest for action in resolve.build_parser()._actions}
    assert "decisions" in destinations
    assert "keep" not in destinations


def test_decisions_csv_roundtrip_preserves_full_audit_snapshot(tools, tmp_path):
    resolve = tools["resolve_active_duplicates"]
    path = tmp_path / "active-duplicates.csv"
    _write_decisions_csv(path, resolve, ROWS, 5, group_size=3)

    decisions = resolve.load_decisions_csv(path)
    assert decisions[5].keep is True
    assert decisions[9].keep is False
    assert decisions[5].grade == "高二"
    assert decisions[5].course_name == "课程6"
    assert resolve.build_keep_map([GROUP], ROWS, decisions) == {KEY: 5}


def test_decisions_csv_missing_snapshot_column_is_rejected(tools, tmp_path):
    resolve = tools["resolve_active_duplicates"]
    path = tmp_path / "bad.csv"
    path.write_text("year,term,student_no,id,keep\n2026-2027,上学期,150,5,yes\n", encoding="utf-8")
    with pytest.raises(resolve.DecisionError, match="缺少完整审计所需列"):
        resolve.load_decisions_csv(path)


@pytest.mark.parametrize(
    "first_header, duplicate_header",
    [("keep", "Keep"), ("name", " name")],
)
def test_decisions_csv_rejects_headers_that_collide_after_normalization(
    tools, tmp_path, first_header, duplicate_header
):
    resolve = tools["resolve_active_duplicates"]
    path = tmp_path / "duplicate-header.csv"
    headers = [*CSV_COLUMNS, duplicate_header]
    assert first_header in CSV_COLUMNS
    path.write_text(",".join(headers) + "\n", encoding="utf-8-sig")

    with pytest.raises(resolve.DecisionError, match="规范化后存在重复表头"):
        resolve.load_decisions_csv(path)


def test_decisions_csv_rejects_a_single_empty_header(tools, tmp_path):
    resolve = tools["resolve_active_duplicates"]
    path = tmp_path / "empty-header.csv"
    path.write_text(",".join([*CSV_COLUMNS, ""]) + "\n", encoding="utf-8-sig")

    with pytest.raises(resolve.DecisionError, match="存在空表头"):
        resolve.load_decisions_csv(path)


def test_decisions_csv_rejects_rows_with_cells_beyond_the_header(tools, tmp_path):
    resolve = tools["resolve_active_duplicates"]
    path = tmp_path / "extra-cell.csv"
    _write_decisions_csv(path, resolve, ROWS, 5, group_size=3)
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    lines[1] += ",unexpected"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8-sig")

    with pytest.raises(resolve.DecisionError, match="超出表头的多余单元格"):
        resolve.load_decisions_csv(path)


def test_decisions_csv_duplicate_id_is_rejected(tools, tmp_path):
    resolve = tools["resolve_active_duplicates"]
    path = tmp_path / "dup.csv"
    _write_decisions_csv(path, resolve, [ROWS[0], ROWS[0]], 5, group_size=2)
    with pytest.raises(resolve.DecisionError, match="出现多次"):
        resolve.load_decisions_csv(path)


def test_decisions_csv_unknown_keep_value_is_rejected(tools, tmp_path):
    resolve = tools["resolve_active_duplicates"]
    path = tmp_path / "bad-keep.csv"
    _write_decisions_csv(path, resolve, ROWS, 5, group_size=3)
    text = path.read_text(encoding="utf-8-sig").replace(",yes\n", ",maybe\n", 1)
    path.write_text(text, encoding="utf-8-sig")
    with pytest.raises(resolve.DecisionError, match="keep 值无法识别"):
        resolve.load_decisions_csv(path)


def test_csv_business_snapshot_change_is_rejected(tools, tmp_path):
    resolve = tools["resolve_active_duplicates"]
    path = tmp_path / "stale.csv"
    _write_decisions_csv(path, resolve, ROWS, 5, group_size=3)
    decisions = resolve.load_decisions_csv(path)
    current_rows = [dict(row) for row in ROWS]
    current_rows[1]["course_code"] = "88"
    current_rows[1]["course_name"] = "新课程"
    with pytest.raises(resolve.DecisionError, match="业务快照已变化"):
        resolve.build_keep_map([GROUP], current_rows, decisions)


def test_course_name_change_does_not_expire_a_decision(tools):
    resolve = tools["resolve_active_duplicates"]
    decisions = _decisions(resolve)
    current_rows = [dict(row) for row in ROWS]
    current_rows[0]["course_name"] = "课程目录中的新展示名称"

    assert resolve.build_keep_map([GROUP], current_rows, decisions) == {KEY: 5}


def test_full_microsecond_timestamp_change_requires_reaudit(tools):
    resolve = tools["resolve_active_duplicates"]
    rows = [
        _row(
            1,
            "150",
            "6",
            created_at=datetime(2026, 9, 19, 12, 0, 0, 123456),
            updated_at=datetime(2026, 9, 19, 12, 1, 0, 654321),
        ),
        _row(
            2,
            "150",
            "19",
            created_at=datetime(2026, 9, 19, 12, 2, 0, 111111),
            updated_at=datetime(2026, 9, 19, 12, 3, 0, 222222),
        ),
    ]
    decisions = _decisions(resolve, rows, 1, group_size=2)
    decisions[1] = _decision(
        resolve,
        rows[0],
        True,
        group_size=2,
        updated_at="2026-09-19 12:01:00.654320",
    )

    with pytest.raises(resolve.DecisionError, match="业务快照已变化"):
        resolve.build_keep_map([_group("150", 2)], rows, decisions)


# --- 合成事务：不连接数据库 ---------------------------------------------------

class _SyntheticTransaction:
    def __init__(self, conn, **kwargs):
        self.conn = conn
        self.kwargs = kwargs
        self.before = None

    async def start(self):
        self.before = copy.deepcopy(self.conn.records)
        self.conn.events.append("begin")

    async def commit(self):
        self.conn.events.append("commit_attempt")
        if self.conn.commit_error is not None:
            raise self.conn.commit_error
        self.conn.events.append("commit")

    async def rollback(self):
        self.conn.events.append("rollback_attempt")
        if self.conn.rollback_error is not None:
            raise self.conn.rollback_error
        self.conn.records = self.before
        self.conn.events.append("rollback")

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc, tb):
        if exc_type is None:
            await self.commit()
        else:
            await self.rollback()
        return False


class _SyntheticConnection:
    def __init__(self, rows):
        self.records = {int(row["id"]): {**copy.deepcopy(row), "is_deleted": False} for row in rows}
        self.events = []
        self.force_remaining_duplicate = False
        self.commit_error: BaseException | None = None
        self.rollback_error: BaseException | None = None
        self.close_error: Exception | None = None
        self.close_hangs = False
        self.closed = False

    def transaction(self, **kwargs):
        return _SyntheticTransaction(self, **kwargs)

    async def execute(self, sql, *args):
        normalized = " ".join(str(sql).split())
        if normalized.startswith("SET LOCAL"):
            self.events.append("set")
            return "SET"
        if normalized.startswith("LOCK TABLE"):
            self.events.append("lock")
            return "LOCK TABLE"
        if normalized.startswith("UPDATE xbk_selections"):
            self.events.append("update")
            affected = 0
            for record_id in args[0]:
                row = self.records.get(int(record_id))
                if row and not row["is_deleted"]:
                    row["is_deleted"] = True
                    row["updated_at"] = "synthetic-update"
                    affected += 1
            return f"UPDATE {affected}"
        raise AssertionError(f"unexpected execute: {normalized}")

    async def fetch(self, sql, *args):
        if "WHERE id = ANY" not in str(sql):
            raise AssertionError("synthetic fetch only supports the post-write id query")
        self.events.append("post_rows")
        return [copy.deepcopy(self.records[int(record_id)]) for record_id in args[0] if int(record_id) in self.records]

    async def close(self):
        if self.close_hangs:
            await asyncio.Event().wait()
        if self.close_error is not None:
            raise self.close_error
        self.closed = True
        self.events.append("close")


def _install_state_readers(monkeypatch, resolve):
    calls = {"groups": 0}

    async def fetch_groups(conn):
        calls["groups"] += 1
        conn.events.append("groups")
        counts = {}
        for row in conn.records.values():
            if not row["is_deleted"]:
                key = (row["year"], row["term"], row["student_no"])
                counts[key] = counts.get(key, 0) + 1
        groups = [
            {"year": key[0], "term": key[1], "student_no": key[2], "active_count": count}
            for key, count in sorted(counts.items())
            if count > 1
        ]
        if conn.force_remaining_duplicate and calls["groups"] > 1:
            return [_group("forced", 2)]
        return groups

    async def fetch_rows(conn):
        conn.events.append("rows")
        counts = {}
        for row in conn.records.values():
            if not row["is_deleted"]:
                key = (row["year"], row["term"], row["student_no"])
                counts[key] = counts.get(key, 0) + 1
        duplicate_keys = {key for key, count in counts.items() if count > 1}
        return [
            copy.deepcopy(row)
            for row in conn.records.values()
            if not row["is_deleted"]
            and (row["year"], row["term"], row["student_no"]) in duplicate_keys
        ]

    monkeypatch.setattr(resolve, "fetch_duplicate_groups", fetch_groups)
    monkeypatch.setattr(resolve, "fetch_duplicate_rows", fetch_rows)


def test_apply_rejects_changed_keeper_before_any_update(tools, monkeypatch):
    resolve = tools["resolve_active_duplicates"]
    rows = [_row(1, "150", "6"), _row(2, "150", "19")]
    decisions = _decisions(resolve, rows, 1, group_size=2)
    conn = _SyntheticConnection(rows)
    conn.records[1]["course_code"] = "88"
    _install_state_readers(monkeypatch, resolve)

    with pytest.raises(resolve.DecisionError, match="业务快照已变化"):
        asyncio.run(resolve.apply_decisions_in_one_transaction(conn, decisions))

    assert "update" not in conn.events
    assert conn.events[-1] == "rollback"


def test_apply_rejects_deleted_keeper_before_any_update(tools, monkeypatch):
    resolve = tools["resolve_active_duplicates"]
    rows = [_row(1, "150", "6"), _row(2, "150", "19")]
    decisions = _decisions(resolve, rows, 1, group_size=2)
    conn = _SyntheticConnection(rows)
    conn.records[1]["is_deleted"] = True
    _install_state_readers(monkeypatch, resolve)

    with pytest.raises(resolve.DecisionError, match="裁决已过期"):
        asyncio.run(resolve.apply_decisions_in_one_transaction(conn, decisions))

    assert "update" not in conn.events
    assert conn.events[-1] == "rollback"


def test_apply_rejects_new_duplicate_inserted_since_audit(tools, monkeypatch):
    resolve = tools["resolve_active_duplicates"]
    audited_rows = [_row(1, "150", "6"), _row(2, "150", "19")]
    decisions = _decisions(resolve, audited_rows, 1, group_size=2)
    conn = _SyntheticConnection([*audited_rows, _row(3, "150", "21")])
    _install_state_readers(monkeypatch, resolve)

    with pytest.raises(resolve.DecisionError, match="未参与裁决"):
        asyncio.run(resolve.apply_decisions_in_one_transaction(conn, decisions))

    assert "update" not in conn.events
    assert conn.events[-1] == "rollback"


def test_precommit_failure_rolls_back_soft_deletes(tools, monkeypatch):
    resolve = tools["resolve_active_duplicates"]
    rows = [_row(1, "150", "6"), _row(2, "150", "19")]
    decisions = _decisions(resolve, rows, 1, group_size=2)
    conn = _SyntheticConnection(rows)
    conn.force_remaining_duplicate = True
    _install_state_readers(monkeypatch, resolve)

    with pytest.raises(resolve.ConsistencyError, match="提交前回查仍发现"):
        asyncio.run(resolve.apply_decisions_in_one_transaction(conn, decisions))

    assert "update" in conn.events
    assert conn.events[-1] == "rollback"
    assert conn.records[2]["is_deleted"] is False


@pytest.mark.parametrize(
    "error_kind",
    [
        "connection_lost",
        "connection_failure",
        "protocol_violation",
        "transaction_unknown",
        "interface",
        "oserror",
        "timeout",
        "cancelled",
    ],
)
def test_commit_round_trip_transport_failures_are_unknown_not_rolled_back(
    tools, monkeypatch, error_kind
):
    resolve = tools["resolve_active_duplicates"]
    rows = [_row(1, "150", "6"), _row(2, "150", "19")]
    decisions = _decisions(resolve, rows, 1, group_size=2)
    conn = _SyntheticConnection(rows)
    error_factories = {
        "connection_lost": lambda: resolve.asyncpg.ConnectionDoesNotExistError("lost"),
        "connection_failure": lambda: resolve.asyncpg.ConnectionFailureError("lost"),
        "protocol_violation": lambda: resolve.asyncpg.ProtocolViolationError("bad protocol"),
        "transaction_unknown": lambda: resolve.asyncpg.TransactionResolutionUnknownError(
            "server outcome unknown"
        ),
        "interface": lambda: resolve.asyncpg.InterfaceError("closed"),
        "oserror": lambda: OSError("socket closed"),
        "timeout": lambda: TimeoutError("commit timed out"),
        "cancelled": asyncio.CancelledError,
    }
    conn.commit_error = error_factories[error_kind]()
    _install_state_readers(monkeypatch, resolve)

    with pytest.raises(resolve.CommitStateUnknownError, match="COMMIT 往返期间"):
        asyncio.run(resolve.apply_decisions_in_one_transaction(conn, decisions))

    assert "commit_attempt" in conn.events
    assert "rollback" not in conn.events


def test_rollback_confirmation_failure_is_reported_explicitly(
    tools, monkeypatch, tmp_path, capsys
):
    resolve = tools["resolve_active_duplicates"]
    rows = [_row(1, "150", "6"), _row(2, "150", "19")]
    path = tmp_path / "decisions.csv"
    _write_decisions_csv(path, resolve, rows, 1, group_size=2)
    conn = _SyntheticConnection(rows)
    conn.force_remaining_duplicate = True
    conn.rollback_error = resolve.asyncpg.InterfaceError("rollback unavailable")
    _install_state_readers(monkeypatch, resolve)

    async def fake_connect(dsn, *, read_only):
        assert read_only is False
        return conn, "synthetic-write"

    monkeypatch.setattr(resolve, "connect", fake_connect)
    exit_code = asyncio.run(
        resolve.run_resolve(
            "postgresql://example/dup_test",
            "example/dup_test",
            "tester",
            decisions_path=str(path),
            apply_changes=True,
        )
    )

    err = capsys.readouterr().err
    assert exit_code == 5
    assert "rollback 确认也失败" in err
    assert "不要继续迁移" in err
    assert "commit_attempt" not in conn.events
    assert "rollback_attempt" in conn.events


def test_run_resolve_returns_6_for_unknown_commit_state(tools, monkeypatch, tmp_path, capsys):
    resolve = tools["resolve_active_duplicates"]
    rows = [_row(1, "150", "6"), _row(2, "150", "19")]
    path = tmp_path / "decisions.csv"
    _write_decisions_csv(path, resolve, rows, 1, group_size=2)
    conn = _SyntheticConnection(rows)
    conn.commit_error = resolve.asyncpg.ConnectionDoesNotExistError("lost during commit")
    _install_state_readers(monkeypatch, resolve)

    async def fake_connect(dsn, *, read_only):
        assert read_only is False
        return conn, "synthetic-write"

    monkeypatch.setattr(resolve, "connect", fake_connect)
    exit_code = asyncio.run(
        resolve.run_resolve(
            "postgresql://example/dup_test",
            "example/dup_test",
            "tester",
            decisions_path=str(path),
            apply_changes=True,
        )
    )

    assert exit_code == resolve.EXIT_COMMIT_UNKNOWN == 6
    assert "提交状态未知" in capsys.readouterr().err
    assert "commit_attempt" in conn.events
    assert "rollback" not in conn.events
    assert conn.events[-1] == "close"


def test_precommit_transport_failure_is_rolled_back_and_not_reported_unknown(
    tools, monkeypatch, tmp_path, capsys
):
    resolve = tools["resolve_active_duplicates"]
    rows = [_row(1, "150", "6"), _row(2, "150", "19")]
    path = tmp_path / "decisions.csv"
    _write_decisions_csv(path, resolve, rows, 1, group_size=2)
    conn = _SyntheticConnection(rows)

    async def fail_before_commit(current_conn):
        current_conn.events.append("groups")
        raise OSError("lost before commit")

    async def fake_connect(dsn, *, read_only):
        assert read_only is False
        return conn, "synthetic-write"

    monkeypatch.setattr(resolve, "fetch_duplicate_groups", fail_before_commit)
    monkeypatch.setattr(resolve, "connect", fake_connect)
    exit_code = asyncio.run(
        resolve.run_resolve(
            "postgresql://example/dup_test",
            "example/dup_test",
            "tester",
            decisions_path=str(path),
            apply_changes=True,
        )
    )

    err = capsys.readouterr().err
    assert exit_code == 5
    assert "COMMIT 请求发出前" in err
    assert "提交状态未知" not in err
    assert "rollback" in conn.events
    assert "commit_attempt" not in conn.events
    assert conn.events[-1] == "close"


def test_apply_success_obeys_lock_read_validate_update_verify_commit_order(tools, monkeypatch):
    resolve = tools["resolve_active_duplicates"]
    rows = [_row(1, "150", "6"), _row(2, "150", "19")]
    decisions = _decisions(resolve, rows, 1, group_size=2)
    conn = _SyntheticConnection(rows)
    _install_state_readers(monkeypatch, resolve)

    result = asyncio.run(resolve.apply_decisions_in_one_transaction(conn, decisions))

    assert result.affected == 1
    assert conn.records[1]["is_deleted"] is False
    assert conn.records[2]["is_deleted"] is True
    assert conn.events.index("lock") < conn.events.index("groups") < conn.events.index("rows")
    assert conn.events.index("rows") < conn.events.index("update") < conn.events.index("post_rows")
    assert conn.events[-1] == "commit"


def test_dry_run_validates_but_never_locks_or_updates(tools, monkeypatch, tmp_path):
    resolve = tools["resolve_active_duplicates"]
    rows = [_row(1, "150", "6"), _row(2, "150", "19")]
    path = tmp_path / "decisions.csv"
    _write_decisions_csv(path, resolve, rows, 1, group_size=2)
    conn = _SyntheticConnection(rows)
    _install_state_readers(monkeypatch, resolve)

    async def fake_connect(dsn, *, read_only):
        assert read_only is True
        return conn, "synthetic-read-only"

    monkeypatch.setattr(resolve, "connect", fake_connect)
    exit_code = asyncio.run(resolve.run_resolve(
        "postgresql://example/dup_test",
        "example/dup_test",
        "tester",
        decisions_path=str(path),
        apply_changes=False,
    ))

    assert exit_code == 0
    assert "lock" not in conn.events
    assert "update" not in conn.events
    assert all(not row["is_deleted"] for row in conn.records.values())
    assert conn.closed is True


def test_dry_run_reports_stale_snapshot_and_still_writes_nothing(
    tools, monkeypatch, tmp_path, capsys
):
    resolve = tools["resolve_active_duplicates"]
    rows = [_row(1, "150", "6"), _row(2, "150", "19")]
    path = tmp_path / "stale-decisions.csv"
    _write_decisions_csv(path, resolve, rows, 1, group_size=2)
    conn = _SyntheticConnection(rows)
    conn.records[1]["name"] = "锁外已改名"
    _install_state_readers(monkeypatch, resolve)

    async def fake_connect(dsn, *, read_only):
        assert read_only is True
        return conn, "synthetic-read-only"

    monkeypatch.setattr(resolve, "connect", fake_connect)
    exit_code = asyncio.run(
        resolve.run_resolve(
            "postgresql://example/dup_test",
            "example/dup_test",
            "tester",
            decisions_path=str(path),
            apply_changes=False,
        )
    )

    assert exit_code == 4
    assert "dry-run 裁决校验失败" in capsys.readouterr().err
    assert "lock" not in conn.events
    assert "update" not in conn.events
    assert all(not row["is_deleted"] for row in conn.records.values())


def test_close_failure_is_only_a_warning_and_keeps_success_result(
    tools, monkeypatch, tmp_path, capsys
):
    resolve = tools["resolve_active_duplicates"]
    rows = [_row(1, "150", "6"), _row(2, "150", "19")]
    path = tmp_path / "decisions.csv"
    _write_decisions_csv(path, resolve, rows, 1, group_size=2)
    conn = _SyntheticConnection(rows)
    conn.close_error = OSError("close failed")
    _install_state_readers(monkeypatch, resolve)

    async def fake_connect(dsn, *, read_only):
        assert read_only is True
        return conn, "synthetic-read-only"

    monkeypatch.setattr(resolve, "connect", fake_connect)
    exit_code = asyncio.run(
        resolve.run_resolve(
            "postgresql://example/dup_test",
            "example/dup_test",
            "tester",
            decisions_path=str(path),
            apply_changes=False,
        )
    )

    assert exit_code == 0
    assert "关闭数据库连接失败" in capsys.readouterr().err


def test_close_timeout_is_only_a_warning_and_keeps_success_result(
    tools, monkeypatch, tmp_path, capsys
):
    resolve = tools["resolve_active_duplicates"]
    rows = [_row(1, "150", "6"), _row(2, "150", "19")]
    path = tmp_path / "decisions.csv"
    _write_decisions_csv(path, resolve, rows, 1, group_size=2)
    conn = _SyntheticConnection(rows)
    conn.close_hangs = True
    _install_state_readers(monkeypatch, resolve)

    async def fake_connect(dsn, *, read_only):
        assert read_only is True
        return conn, "synthetic-read-only"

    monkeypatch.setattr(resolve, "connect", fake_connect)
    monkeypatch.setattr(resolve, "CONNECTION_CLOSE_TIMEOUT_SECONDS", 0.01)
    exit_code = asyncio.run(
        resolve.run_resolve(
            "postgresql://example/dup_test",
            "example/dup_test",
            "tester",
            decisions_path=str(path),
            apply_changes=False,
        )
    )

    assert exit_code == 0
    assert "关闭数据库连接失败" in capsys.readouterr().err


# --- 4. 目标守卫回归：查询参数不得成为绕过生产开关的通道 ----------------------

@pytest.mark.parametrize(
    "dsn",
    [
        "postgresql:///dup_test?host=10.0.0.5",
        "postgresql:///dup_test?hostaddr=10.0.0.5",
        "postgresql:///dup_test?port=6543",
        "postgresql:///dup_test?dbname=wangsh_db",
        "postgresql:///dup_test?service=prod",
        "postgresql:///dup_test?user=admin",
        "postgresql:///dup_test?sslmode=require",
    ],
)
def test_query_parameters_always_require_the_production_flag(tools, dsn):
    """netloc 为空时 asyncpg 会采纳 ``?host=``，据此可把生产库伪装成回环测试库。"""
    common = tools["_active_duplicate_common"]
    target = common.parse_target(dsn)
    assert target.has_query
    assert target.requires_production_flag, f"{dsn} 不应被视为回环测试目标"


def test_query_parameter_host_is_reflected_in_the_displayed_label(tools):
    """守卫拒绝时要打印真实目标，因此 ?host= 的覆盖值必须体现在 label 上。"""
    common = tools["_active_duplicate_common"]
    assert common.parse_target("postgresql:///dup_test?host=10.0.0.5").label == "10.0.0.5:5432/dup_test"


def test_plain_loopback_test_target_still_needs_no_flag(tools):
    common = tools["_active_duplicate_common"]
    for dsn in ("postgresql://u:p@127.0.0.1:5432/dup_test", "postgresql:///dup_test"):
        assert not common.parse_target(dsn).requires_production_flag


@pytest.mark.parametrize(
    "dsn",
    [
        "postgresql://127.0.0.1:5432/wangsh_db",
        "postgresql://10.0.0.5:5432/wangsh_test",
        "postgresql://127.0.0.1:5432/contest",
    ],
)
def test_non_test_database_names_still_require_the_flag(tools, dsn):
    """生产库名 ``wangsh_db`` 不匹配测试库正则；``contest`` 也不能被子串误判。"""
    common = tools["_active_duplicate_common"]
    assert common.parse_target(dsn).requires_production_flag


@pytest.mark.parametrize(
    "dsn",
    ["postgresql://u:p@127.0.0.1:notaport/dup_test", "postgresql://u:p@127.0.0.1:99999/dup_test"],
)
def test_malformed_port_raises_guard_error_not_value_error(tools, dsn):
    """``urlparse().port`` 在取值时才校验；必须转成 TargetGuardError（退出码 2）。"""
    common = tools["_active_duplicate_common"]
    with pytest.raises(common.TargetGuardError):
        common.parse_target(dsn)


# --- 5. 凭据与驱动前缀 -------------------------------------------------------

def test_target_repr_never_contains_the_password(tools):
    common = tools["_active_duplicate_common"]
    target = common.parse_target("postgresql://admin:SuperSecret@127.0.0.1:5432/dup_test")
    assert "SuperSecret" not in repr(target)
    assert target.label == "127.0.0.1:5432/dup_test"


def test_redact_dsn_hides_the_password_but_keeps_the_target(tools):
    common = tools["_active_duplicate_common"]
    redacted = common._redact_dsn("postgresql://admin:SuperSecret@127.0.0.1:5432/dup_test?host=x")
    assert "SuperSecret" not in redacted
    assert "127.0.0.1:5432/dup_test" in redacted


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("postgresql+asyncpg://u:p@h/d", "postgresql://u:p@h/d"),
        ("postgresql+psycopg2://u:p@h/d", "postgresql://u:p@h/d"),
        ("postgres+asyncpg://u:p@h/d", "postgresql://u:p@h/d"),
        ("postgres://u:p@h/d", "postgresql://u:p@h/d"),
        ("postgresql://u:p@h/d", "postgresql://u:p@h/d"),
        ("  postgresql+psycopg://u:p@h/d  ", "postgresql://u:p@h/d"),
    ],
)
def test_normalize_dsn_strips_any_driver_suffix(tools, raw, expected):
    """asyncpg 只认 ``postgresql://``；残留 ``+driver`` 会抛 ValueError 而非 PostgresError。"""
    common = tools["_active_duplicate_common"]
    assert common.normalize_dsn(raw) == expected


def test_sql_copies_stay_in_sync_with_the_migration(tools):
    """检测语义必须与迁移一致；此处固定住关键片段，防止两边各自漂移。"""
    common = tools["_active_duplicate_common"]
    migration = (
        REPO_ROOT
        / "backend/alembic/versions/20260914_0001_xbk_active_selection_unique.py"
    ).read_text(encoding="utf-8")
    for fragment in ("is_deleted IS FALSE", "GROUP BY year, term, student_no", "HAVING COUNT(*) > 1"):
        assert fragment in common.DUPLICATE_GROUPS_SQL
        assert fragment in migration, f"迁移中未找到 {fragment!r}，检测语义可能已分歧"


# --- 4. 撞号诊断：组内不同姓名必须被显式告警，不能伪装成单人重复 ---------------

def _member(record_id: int, grade: str, name: str, course_code: str) -> dict:
    """构造明细行；year/term/student_no 必须与 ``KEY`` 一致才会归入同一组。"""
    return {
        "id": record_id,
        "year": KEY[0],
        "term": KEY[1],
        "student_no": KEY[2],
        "grade": grade,
        "name": name,
        "course_code": course_code,
        "course_name": f"课程{course_code}",
        "created_at": None,
        "updated_at": None,
    }


def test_render_flags_a_group_whose_rows_are_different_students(tools, capsys):
    """唯一索引不含 grade，原学号又只在年级内唯一：同组两个姓名＝两名学生撞号。

    这种组一旦按「同一名学生保留一门课」裁决，就会抹掉另一名学生的有效选课——
    这是本工具最危险的误删路径，必须由脚本主动喊停。
    """
    audit = tools["audit_active_duplicates"]
    members = [
        _member(1, "高一", "周毅", "11"),
        _member(2, "高二", "刘宇轩", "19"),
    ]

    audit._render_groups([_group("150", 2)], {KEY: members})
    out = capsys.readouterr().out

    assert "姓名不一致" in out
    # 两名学生、两个年级都必须逐行可见，不能被「首个非空姓名」掩盖
    for text in ("周毅", "刘宇轩", "高一", "高二"):
        assert text in out


def test_render_does_not_warn_when_the_group_is_one_student(tools, capsys):
    """真正的单人重复（同一姓名）不应触发撞号告警，避免噪音淹没真实告警。"""
    audit = tools["audit_active_duplicates"]
    members = [
        _member(1, "高二", "刘宇轩", "6"),
        _member(2, "高二", "刘宇轩", "19"),
    ]

    audit._render_groups([_group("150", 2)], {KEY: members})
    out = capsys.readouterr().out

    assert "姓名不一致" not in out
    assert "刘宇轩" in out


def test_audit_csv_columns_include_grade_for_collision_diagnosis(tools):
    """grade 必须出现在导出列里，否则业务方在 Excel 里看不出撞号。"""
    audit = tools["audit_active_duplicates"]
    assert "grade" in audit.CSV_COLUMNS
