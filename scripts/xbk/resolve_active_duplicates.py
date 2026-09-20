#!/usr/bin/env python3
r"""XBK 历史重复有效选课 —— 按完整人工裁决执行软删除（resolve）。

前置流程（必须遵守）
====================
本脚本遵循 ``docs/docker/deploy/DEPLOY.md`` 的迁移前要求：先只读预检重复、完成可恢复
备份、**停止并排空所有旧版选课 writer**、在批准的维护窗口中复核后再处理。

裁决来源
========
保留哪一条记录是业务决定，本脚本**不做任何推断**。唯一裁决入口是
``--decisions <CSV>``：必须使用 ``audit_active_duplicates.py --output`` 导出的完整 CSV，
业务方在 ``keep`` 列中为每一组恰好标记一行 ``yes``。CSV 中每条记录的业务快照都会在
执行时与锁内重读结果逐项核对；记录缺失、新增、改名、换课或时间戳变化都会拒绝继续。
如果同一重复组内姓名或年级不一致，或任一身份字段为空，则视为疑似撞号并拒绝普通
``keep`` 二选一，必须先由业务侧按正确身份清理数据。

安全保证
========
- **默认 dry-run**：不带 ``--apply`` 时只打印将受影响的记录，**零写入**；
- ``--apply`` 还必须同时提供 ``--confirm-stop-writes``，否则拒绝执行；
- 目标不是「回环地址 + 测试库名」时默认拒绝连接，需 ``--allow-production``；
- 正式执行在单个事务中按 ``LOCK → 重读 → 校验 → 软删除 → 提交前复核 → COMMIT``
  的顺序完成；任何提交前异常都会整笔回滚；
- 只有 COMMIT 明确返回成功才报告已提交；提交往返期间连接中断或超时返回退出码 6，
  表示提交状态未知，必须重新只读审计；
- 提交前同时确认：每组恰好保留人工指定的原记录、计划删除行均已软删除、迁移同语义的
  重复检测查询返回空。

用法
====
    # 1) dry-run（默认）：校验当前快照并展示计划，不写入
    python scripts/xbk/resolve_active_duplicates.py \
        --dsn postgresql://user:pass@127.0.0.1:5432/wangsh_dup_test \
        --decisions test-results/xbk/active-duplicates.csv

    # 2) 正式执行（停写 + 备份 + 复核之后）
    python scripts/xbk/resolve_active_duplicates.py \
        --dsn postgresql://user:pass@127.0.0.1:5432/wangsh_dup_test \
        --decisions test-results/xbk/active-duplicates.csv \
        --apply --confirm-stop-writes

退出码
======
    0  成功（dry-run 已展示，或 apply 已提交且提交前复核通过）
    2  参数、连接或配置错误
    4  裁决不完整 / 歧义 / CSV 快照已过期或与数据库现状不符
    5  apply 写入或提交前复核失败（提交前失败均已回滚）
    6  COMMIT 往返中断，提交状态未知（必须重新只读审计）
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Mapping, Sequence, Tuple

if __package__ in (None, ""):
    sys.path.append(str(Path(__file__).resolve().parents[2]))

import asyncpg

from scripts.xbk._active_duplicate_common import (
    ENV_DSN_VAR,
    LOCK_WRITERS_SQL,
    ConsistencyError,
    DecisionError,
    TargetGuardError,
    connect,
    enforce_target_guard,
    fetch_duplicate_groups,
    fetch_duplicate_rows,
    format_timestamp,
    group_key,
    parse_target,
    read_only_snapshot,
    resolve_dsn,
)

_TRUE_VALUES = {"yes", "y", "true", "1", "是", "保留"}
_FALSE_VALUES = {"", "no", "n", "false", "0", "否", "删除"}

# audit 导出的完整合同。course_name 是课程表派生展示值，只保留供人工复核，不作为
# 强一致安全指纹；完整微秒 created_at/updated_at 则用于确认仍是审计时看到的原记录。
_REQUIRED_CSV_COLUMNS = (
    "year",
    "term",
    "grade",
    "student_no",
    "name",
    "group_size",
    "id",
    "course_code",
    "course_name",
    "created_at",
    "updated_at",
    "keep",
)
_CRITICAL_SNAPSHOT_FIELDS = (
    "year",
    "term",
    "student_no",
    "grade",
    "name",
    "course_code",
)
_STRICT_TIMESTAMP_FIELDS = ("created_at", "updated_at")

EXIT_COMMIT_UNKNOWN = 6
CONNECTION_CLOSE_TIMEOUT_SECONDS = 5.0

# 只用 ASCII 十进制数字：``str.isdigit()`` 对 ``'²'`` 等 Unicode 数字返回 True 而
# ``int()`` 抛 ValueError，``int()`` 又能接受 ``'٣'`` 这类非 ASCII 十进制数字。
_ASCII_INT_RE = re.compile(r"^[0-9]+$")


@dataclass(frozen=True)
class DecisionRow:
    """一条人工裁决及其审计时业务快照。"""

    id: int
    keep: bool
    year: str
    term: str
    grade: str
    student_no: str
    name: str
    group_size: int
    course_code: str
    course_name: str
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class ResolutionPlan:
    """已经过完整性和快照新鲜度校验的删除计划。"""

    groups: List[Dict[str, Any]]
    rows: List[Dict[str, Any]]
    keep_map: Dict[Tuple[str, str, str], int]
    to_delete: Dict[int, Dict[str, Any]]


@dataclass(frozen=True)
class ApplyResult:
    """事务成功提交后的摘要。"""

    plan: ResolutionPlan
    affected: int


class CommitStateUnknownError(RuntimeError):
    """COMMIT 已发出，但客户端无法确认服务端最终结果。"""


class RollbackConfirmationError(RuntimeError):
    """COMMIT 尚未发出，但客户端未能确认显式 rollback 已完成。"""

    def __init__(self, original_error: BaseException, rollback_error: BaseException) -> None:
        super().__init__(
            "提交前操作失败，且 rollback 确认也失败："
            f"原始错误={type(original_error).__name__}: {original_error}；"
            f"rollback 错误={type(rollback_error).__name__}: {rollback_error}"
        )
        self.original_error = original_error
        self.rollback_error = rollback_error


def parse_record_id(raw: str, *, where: str) -> int:
    """把裁决中的 id 解析为整数；不合法时抛 ``DecisionError``（退出码 4）。"""
    if not _ASCII_INT_RE.match(raw):
        raise DecisionError(f"{where} 不是整数 id：{raw!r}")
    return int(raw)


def _parse_positive_int(raw: str, *, where: str) -> int:
    value = parse_record_id(raw, where=where)
    if value <= 0:
        raise DecisionError(f"{where} 必须是正整数：{raw!r}")
    return value


def _parse_keep(raw: str, *, where: str) -> bool:
    normalized = raw.strip().lower()
    if normalized in _TRUE_VALUES:
        return True
    if normalized in _FALSE_VALUES:
        return False
    raise DecisionError(
        f"{where} 的 keep 值无法识别：{raw!r}；"
        "保留请填 yes，删除请留空或填 no。"
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="XBK 历史重复有效选课 —— 按完整人工裁决执行软删除（默认 dry-run）",
    )
    parser.add_argument(
        "--dsn",
        default=None,
        help=f"PostgreSQL 连接串；缺省时读取环境变量 {ENV_DSN_VAR}。不读取项目 .env。",
    )
    parser.add_argument(
        "--decisions",
        required=True,
        help="audit 脚本导出的完整裁决 CSV 路径；每组恰好一行 keep=yes。",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="真正执行软删除；缺省为 dry-run，只校验并打印，不写入。",
    )
    parser.add_argument(
        "--confirm-stop-writes",
        action="store_true",
        help="确认已停止并排空所有旧版 writer、已完成备份与复核（--apply 必需）。",
    )
    parser.add_argument(
        "--allow-production",
        action="store_true",
        help="显式允许连接非「回环地址 + 测试库名」的目标。",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="跳过生产确认交互；仅用于已获授权的自动化场景。",
    )
    return parser


def load_decisions_csv(path: Path) -> Dict[int, DecisionRow]:
    """读取完整审计 CSV；不丢弃任何用于新鲜度核对的业务快照字段。"""
    if not path.exists():
        raise DecisionError(f"裁决 CSV 不存在：{path}")

    decisions: Dict[int, DecisionRow] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        raw_fields = list(reader.fieldnames or [])
        normalized_field_list = [(name or "").strip().lower() for name in raw_fields]
        duplicate_fields = sorted(
            {name for name in normalized_field_list if normalized_field_list.count(name) > 1}
        )
        if duplicate_fields:
            labels = [name or "(空表头)" for name in duplicate_fields]
            raise DecisionError(
                f"裁决 CSV 规范化后存在重复表头：{labels}；实际列：{raw_fields}。"
                "列名会发生覆盖，已拒绝读取；请重新从 audit 导出。"
            )
        if "" in normalized_field_list:
            raise DecisionError(
                f"裁决 CSV 存在空表头；实际列：{raw_fields}。"
                "空列无法绑定到审计字段，已拒绝读取；请重新从 audit 导出。"
            )

        normalized_fields = set(normalized_field_list)
        missing = [name for name in _REQUIRED_CSV_COLUMNS if name not in normalized_fields]
        if missing:
            raise DecisionError(
                f"裁决 CSV 缺少完整审计所需列 {missing}；实际列：{reader.fieldnames}。"
                "请重新运行 audit_active_duplicates.py 导出，不要手工拼接简化 CSV。"
            )

        for line_no, raw in enumerate(reader, start=2):
            if None in raw:
                extras = raw[None] or []
                raise DecisionError(
                    f"裁决 CSV 第 {line_no} 行包含 {len(extras)} 个超出表头的多余单元格；"
                    "列数不一致，已拒绝读取。请重新从 audit 导出。"
                )
            row = {(key or "").strip().lower(): (value or "") for key, value in raw.items()}
            raw_id = row["id"].strip()
            if not raw_id:
                # Excel 尾部空行不构成裁决记录；含其他内容的无 id 行则拒绝。
                if any(value.strip() for key, value in row.items() if key != "keep"):
                    raise DecisionError(f"裁决 CSV 第 {line_no} 行缺少 id，不能核对业务快照。")
                continue

            record_id = parse_record_id(raw_id, where=f"裁决 CSV 第 {line_no} 行 id")
            if record_id in decisions:
                raise DecisionError(f"裁决 CSV 中 id={record_id} 出现多次。")

            decisions[record_id] = DecisionRow(
                id=record_id,
                keep=_parse_keep(row["keep"], where=f"裁决 CSV 第 {line_no} 行"),
                year=row["year"],
                term=row["term"],
                grade=row["grade"],
                student_no=row["student_no"],
                name=row["name"],
                group_size=_parse_positive_int(
                    row["group_size"].strip(), where=f"裁决 CSV 第 {line_no} 行 group_size"
                ),
                course_code=row["course_code"],
                course_name=row["course_name"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )

    if not decisions:
        raise DecisionError(f"裁决 CSV 没有任何有效数据行：{path}")
    return decisions


def _database_snapshot(row: Mapping[str, Any]) -> Dict[str, str]:
    return {
        "year": str(row.get("year") or ""),
        "term": str(row.get("term") or ""),
        "grade": str(row.get("grade") or ""),
        "student_no": str(row.get("student_no") or ""),
        "name": str(row.get("name") or ""),
        "course_code": str(row.get("course_code") or ""),
        "course_name": str(row.get("course_name") or ""),
        "created_at": format_timestamp(row.get("created_at")),
        "updated_at": format_timestamp(row.get("updated_at")),
    }


def _snapshot_mismatches(
    decision: DecisionRow,
    row: Mapping[str, Any],
    *,
    include_timestamps: bool = True,
) -> List[str]:
    actual = _database_snapshot(row)
    fields: List[str] = list(_CRITICAL_SNAPSHOT_FIELDS)
    if include_timestamps:
        fields.extend(_STRICT_TIMESTAMP_FIELDS)
    return [
        f"{field}: CSV={getattr(decision, field)!r}, 当前={actual[field]!r}"
        for field in fields
        if getattr(decision, field) != actual[field]
    ]


def _validate_group_identity(
    key: Tuple[str, str, str], members: Sequence[Mapping[str, Any]]
) -> None:
    """疑似撞号不得通过普通 keep 二选一被误删。"""
    empty_identity_ids = sorted(
        int(member["id"])
        for member in members
        if not str(member.get("name") or "").strip()
        or not str(member.get("grade") or "").strip()
    )
    if empty_identity_ids:
        raise DecisionError(
            f"重复组 {key[0]}/{key[1]}/{key[2]} 存在姓名或年级为空的记录 "
            f"id={empty_identity_ids}；身份不完整，禁止通过普通 keep 二选一处理。"
        )

    names = {str(member.get("name") or "").strip() for member in members}
    grades = {str(member.get("grade") or "").strip() for member in members}
    if len(names) != 1 or len(grades) != 1:
        raise DecisionError(
            f"重复组 {key[0]}/{key[1]}/{key[2]} 的组内姓名或年级不一致"
            f"（姓名={sorted(names)}，年级={sorted(grades)}）；疑似学号撞号，"
            "禁止通过普通 keep 二选一处理。"
        )


def build_keep_map(
    groups: List[Dict[str, Any]],
    rows: List[Dict[str, Any]],
    decisions: Mapping[int, DecisionRow],
) -> Dict[Tuple[str, str, str], int]:
    """校验裁决完整性和快照新鲜度，并转换为「每组保留哪一个 id」。"""
    grouped: Dict[Tuple[str, str, str], List[Dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(group_key(row), []).append(row)

    known_ids = {int(row["id"]) for row in rows}
    stale_ids = set(decisions) - known_ids
    if stale_ids:
        raise DecisionError(
            f"裁决 CSV 引用了当前重复组中不存在的记录 id={sorted(stale_ids)}。"
            "保留行可能已被更改/删除，或重复组已经变化；裁决已过期，请重新审计。"
        )

    keep_map: Dict[Tuple[str, str, str], int] = {}
    decision_ids = set(decisions)
    for group in groups:
        key = group_key(group)
        members = grouped.get(key, [])
        member_ids = {int(member["id"]) for member in members}
        expected_count = int(group["active_count"])
        if len(members) != expected_count:
            raise DecisionError(
                f"重复组 {key[0]}/{key[1]}/{key[2]} 的组计数为 {expected_count}，"
                f"但明细为 {len(members)}；当前快照不一致，拒绝继续。"
            )

        _validate_group_identity(key, members)

        unadjudicated = member_ids - decision_ids
        if unadjudicated:
            raise DecisionError(
                f"重复组 {key[0]}/{key[1]}/{key[2]} 中出现未参与裁决的当前记录："
                f"id={sorted(unadjudicated)}。可能新增了重复记录；请重新审计。"
            )

        for member in members:
            decision = decisions[int(member["id"])]
            if decision.group_size != expected_count:
                raise DecisionError(
                    f"id={decision.id} 的 CSV group_size={decision.group_size}，"
                    f"当前重复组大小={expected_count}；裁决已过期，请重新审计。"
                )
            mismatches = _snapshot_mismatches(decision, member)
            if mismatches:
                raise DecisionError(
                    f"id={decision.id} 的业务快照已变化：" + "; ".join(mismatches) +
                    "。dry-run/apply 均拒绝使用过期裁决，请重新审计。"
                )

        kept = [member for member in members if decisions[int(member["id"])].keep]
        if not kept:
            raise DecisionError(
                f"重复组 {key[0]}/{key[1]}/{key[2]}（有效记录 id={sorted(member_ids)}）"
                "缺少裁决：必须在 keep 列恰好标记一条记录。"
            )
        if len(kept) > 1:
            raise DecisionError(
                f"重复组 {key[0]}/{key[1]}/{key[2]} 被标记了多条保留记录："
                f"id={sorted(int(member['id']) for member in kept)}；每组只能保留一条。"
            )
        keep_map[key] = int(kept[0]["id"])

    unused = decision_ids - known_ids
    if unused:
        # 正常会被 stale_ids 提前捕获；保留防御性断言，避免未来重构静默忽略裁决行。
        raise DecisionError(f"以下裁决行未生效：id={sorted(unused)}；请重新审计。")
    if not keep_map:
        raise DecisionError("当前数据库没有与裁决 CSV 完整匹配的重复组；裁决已过期，请重新审计。")
    return keep_map


def plan_soft_deletes(
    groups: List[Dict[str, Any]],
    rows: List[Dict[str, Any]],
    keep_map: Dict[Tuple[str, str, str], int],
) -> Dict[int, Dict[str, Any]]:
    """计算需要软删除的记录：每组除保留项以外的全部有效记录。"""
    grouped: Dict[Tuple[str, str, str], List[Dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(group_key(row), []).append(row)

    to_delete: Dict[int, Dict[str, Any]] = {}
    for group in groups:
        key = group_key(group)
        keep_id = keep_map[key]
        for member in grouped.get(key, []):
            if int(member["id"]) != keep_id:
                to_delete[int(member["id"])] = member
    return to_delete


def build_resolution_plan(
    groups: List[Dict[str, Any]],
    rows: List[Dict[str, Any]],
    decisions: Mapping[int, DecisionRow],
) -> ResolutionPlan:
    keep_map = build_keep_map(groups, rows, decisions)
    to_delete = plan_soft_deletes(groups, rows, keep_map)
    if not to_delete:
        raise DecisionError("完整重复组裁决未产生待删除记录；当前状态与审计快照不一致。")
    return ResolutionPlan(groups=groups, rows=rows, keep_map=keep_map, to_delete=to_delete)


def render_plan(plan: ResolutionPlan) -> None:
    grouped: Dict[Tuple[str, str, str], List[Dict[str, Any]]] = {}
    for row in plan.rows:
        grouped.setdefault(group_key(row), []).append(row)

    print("=" * 68)
    print(f"重复组数         : {len(plan.groups)}")
    print(f"有效记录数       : {len(plan.rows)}")
    print(f"计划软删除条数   : {len(plan.to_delete)}")
    print("=" * 68)
    for index, group in enumerate(plan.groups, start=1):
        key = group_key(group)
        keep_id = plan.keep_map[key]
        members = grouped.get(key, [])
        print()
        print(f"--- 组 {index}/{len(plan.groups)} " + "-" * 46)
        print(f"学年 / 学期 / 学号 : {key[0]} / {key[1]} / {key[2]}")
        for member in members:
            action = "保留" if int(member["id"]) == keep_id else "软删"
            print(
                f"  [{action}] id={member['id']:<7} 年级={member.get('grade') or '(空)'} "
                f"姓名={member.get('name') or '(空)'} 课程={member.get('course_code') or '(空)'} "
                f"创建={format_timestamp(member.get('created_at'))}"
            )


_POST_WRITE_ROWS_SQL = """
SELECT id, student_no, name, year, term, grade, course_code,
       created_at, updated_at, is_deleted
FROM xbk_selections
WHERE id = ANY($1::int[])
ORDER BY id
"""


async def fetch_post_write_rows(conn: asyncpg.Connection, record_ids: Sequence[int]) -> List[Dict[str, Any]]:
    rows = await conn.fetch(_POST_WRITE_ROWS_SQL, list(record_ids))
    return [dict(row) for row in rows]


def validate_post_write_state(
    plan: ResolutionPlan,
    decisions: Mapping[int, DecisionRow],
    post_rows: List[Dict[str, Any]],
    remaining_groups: List[Dict[str, Any]],
) -> None:
    """在 COMMIT 前证明保留行仍是原记录、删除集合完整且全库无重复。"""
    if remaining_groups:
        keys = ["/".join(group_key(group)) for group in remaining_groups[:10]]
        raise ConsistencyError(
            f"提交前回查仍发现 {len(remaining_groups)} 个重复组（样本：{keys}）；事务已回滚。"
        )

    by_id = {int(row["id"]): row for row in post_rows}
    expected_ids = set(decisions)
    if set(by_id) != expected_ids:
        raise ConsistencyError(
            f"提交前回查记录集合变化：预期 id={sorted(expected_ids)}，"
            f"实际 id={sorted(by_id)}；事务已回滚。"
        )

    for key, keep_id in plan.keep_map.items():
        original_member_ids = {
            int(row["id"]) for row in plan.rows if group_key(row) == key
        }
        active_ids = {
            record_id
            for record_id in original_member_ids
            if not bool(by_id[record_id]["is_deleted"])
        }
        if active_ids != {keep_id}:
            raise ConsistencyError(
                f"提交前回查组 {key[0]}/{key[1]}/{key[2]} 的有效记录为 "
                f"id={sorted(active_ids)}，预期仅保留 id={keep_id}；事务已回滚。"
            )

        keeper = by_id[keep_id]
        keeper_mismatches = _snapshot_mismatches(
            decisions[keep_id], keeper, include_timestamps=False
        )
        # keeper 没有被 UPDATE，时间戳也必须保持审计时值。
        for field in ("created_at", "updated_at"):
            current = format_timestamp(keeper.get(field))
            if getattr(decisions[keep_id], field) != current:
                keeper_mismatches.append(
                    f"{field}: CSV={getattr(decisions[keep_id], field)!r}, 当前={current!r}"
                )
        if keeper_mismatches:
            raise ConsistencyError(
                f"提交前回查发现保留 id={keep_id} 已不是人工指定的原记录："
                + "; ".join(keeper_mismatches)
                + "；事务已回滚。"
            )

        for delete_id in original_member_ids - {keep_id}:
            deleted = by_id[delete_id]
            if not bool(deleted["is_deleted"]):
                raise ConsistencyError(
                    f"提交前回查发现计划删除 id={delete_id} 仍为有效记录；事务已回滚。"
                )
            # 删除操作只允许改变 is_deleted / updated_at，其余业务身份必须仍对应裁决原行。
            mismatches = _snapshot_mismatches(
                decisions[delete_id], deleted, include_timestamps=False
            )
            if format_timestamp(deleted.get("created_at")) != decisions[delete_id].created_at:
                mismatches.append("created_at 已变化")
            if mismatches:
                raise ConsistencyError(
                    f"提交前回查发现被软删除 id={delete_id} 的业务身份已变化："
                    + "; ".join(mismatches)
                    + "；事务已回滚。"
                )


async def apply_decisions_in_one_transaction(
    conn: asyncpg.Connection,
    decisions: Mapping[int, DecisionRow],
) -> ApplyResult:
    """LOCK→重读→校验→软删除→提交前复核→显式 COMMIT。"""
    transaction = conn.transaction()
    await transaction.start()
    try:
        await conn.execute("SET LOCAL lock_timeout = '10s'")
        await conn.execute("SET LOCAL statement_timeout = '60s'")
        try:
            await conn.execute(LOCK_WRITERS_SQL)
        except asyncpg.LockNotAvailableError as exc:
            raise ConsistencyError(
                "未能取得 xbk_selections 的写锁：仍存在活跃 writer。"
                "请完成停写并排空旧版 writer 后重试；事务已回滚。"
            ) from exc

        # 关键顺序：锁成功后才读取当前状态，裁决和删除计划不使用锁外旧快照。
        groups = await fetch_duplicate_groups(conn)
        rows = await fetch_duplicate_rows(conn)
        plan = build_resolution_plan(groups, rows, decisions)

        delete_ids = sorted(plan.to_delete)
        status = await conn.execute(
            """
            UPDATE xbk_selections
               SET is_deleted = TRUE,
                   updated_at = now()
             WHERE id = ANY($1::int[])
               AND is_deleted IS FALSE
            """,
            delete_ids,
        )
        affected = int(str(status).split()[-1])
        if affected != len(delete_ids):
            raise ConsistencyError(
                f"预期软删除 {len(delete_ids)} 条，实际影响 {affected} 条；"
                "事务已回滚，请重新审计。"
            )

        # 必须在显式 COMMIT 发出之前完成；任何失败都会先进入 rollback 分支。
        post_rows = await fetch_post_write_rows(conn, sorted(decisions))
        remaining_groups = await fetch_duplicate_groups(conn)
        validate_post_write_state(plan, decisions, post_rows, remaining_groups)
        result = ApplyResult(plan=plan, affected=affected)
    except BaseException as exc:
        # COMMIT 尚未发出：所有校验/写入失败都先回滚。回滚自身失败只补充诊断，
        # 不能覆盖真正的提交前失败原因。
        try:
            await transaction.rollback()
        except (Exception, asyncio.CancelledError) as rollback_exc:
            raise RollbackConfirmationError(exc, rollback_exc) from exc
        raise

    try:
        await transaction.commit()
    except (
        asyncpg.PostgresConnectionError,
        asyncpg.InterfaceError,
        OSError,
        asyncio.TimeoutError,
        asyncio.CancelledError,
    ) as exc:
        # COMMIT 请求可能已到达服务端；此时不能声称“事务未提交”，也不能安全重试。
        raise CommitStateUnknownError(
            f"COMMIT 往返期间连接中断或超时（{type(exc).__name__}: {exc}）"
        ) from exc
    return result


async def run_resolve(
    dsn: str,
    target_label: str,
    target_user: str,
    *,
    decisions_path: str,
    apply_changes: bool,
) -> int:
    decisions = load_decisions_csv(Path(decisions_path))
    conn, guard = await connect(dsn, read_only=not apply_changes)
    try:
        print(f"目标             : {target_label}")
        print(f"连接用户         : {target_user or '(未指定)'}")
        print(f"只读保护         : {guard}")
        print(f"模式             : {'APPLY（真实写入）' if apply_changes else 'DRY-RUN（零写入）'}")

        if not apply_changes:
            try:
                async with read_only_snapshot(conn):
                    groups = await fetch_duplicate_groups(conn)
                    rows = await fetch_duplicate_rows(conn)
                plan = build_resolution_plan(groups, rows, decisions)
            except DecisionError as exc:
                print(f"[错误] dry-run 裁决校验失败：{exc}", file=sys.stderr)
                return 4

            print()
            render_plan(plan)
            print()
            print("-" * 68)
            print("DRY-RUN：完整裁决与当前快照一致；本次没有执行锁表、UPDATE 或其他写操作。")
            print("确认无误后再加 --apply --confirm-stop-writes 正式执行。")
            print("-" * 68)
            return 0

        print()
        print("[执行] 正在锁定表并在同一事务内重读、校验和软删除……")
        try:
            result = await apply_decisions_in_one_transaction(conn, decisions)
        except CommitStateUnknownError as exc:
            print(
                f"[严重] {exc}。\n"
                "[严重] 提交状态未知：不要假定成功或失败，也不要直接重试写入；"
                "请立即重新运行只读 audit 核对数据库现状。",
                file=sys.stderr,
            )
            return EXIT_COMMIT_UNKNOWN
        except RollbackConfirmationError as exc:
            print(
                f"[严重] {exc}。\n"
                "[严重] COMMIT 请求尚未发出，但客户端未能确认显式 rollback 已完成；"
                "请不要继续迁移，先用新连接执行只读 audit 核对数据库现状。",
                file=sys.stderr,
            )
            return 5
        except DecisionError as exc:
            print(f"[错误] 锁内裁决校验失败，事务已回滚：{exc}", file=sys.stderr)
            return 4
        except ConsistencyError as exc:
            print(f"[错误] {exc}", file=sys.stderr)
            return 5
        except (
            asyncpg.ConnectionDoesNotExistError,
            asyncpg.InterfaceError,
            OSError,
            asyncio.TimeoutError,
        ) as exc:
            print(
                f"[错误] COMMIT 请求发出前连接或执行失败，事务已回滚或随连接关闭而终止："
                f"{type(exc).__name__}: {exc}",
                file=sys.stderr,
            )
            return 5
        except asyncpg.PostgresError as exc:
            print(f"[错误] 写入失败，事务未提交：{exc}", file=sys.stderr)
            return 5

        print()
        render_plan(result.plan)
        print()
        print("-" * 68)
        print(f"[完成] 已软删除 {result.affected} 条并提交。")
        print("[完成] 提交前已确认每组仅保留人工指定的原记录，且重复检测查询返回空。")
        print("请按 DEPLOY.md 继续执行迁移，并保留裁决 CSV 与本次输出作为复核证据。")
        print("-" * 68)
        return 0
    finally:
        try:
            await asyncio.wait_for(
                conn.close(),
                timeout=CONNECTION_CLOSE_TIMEOUT_SECONDS,
            )
        except (Exception, asyncio.CancelledError) as exc:
            print(
                f"[警告] 关闭数据库连接失败（{type(exc).__name__}: {exc}）；"
                "不改变此前已经确定的执行结果。",
                file=sys.stderr,
            )


def main() -> int:
    args = build_parser().parse_args()
    if args.apply and not args.confirm_stop_writes:
        print(
            "[错误] --apply 必须同时提供 --confirm-stop-writes，"
            "确认已完成停写、备份与复核（见 docs/docker/deploy/DEPLOY.md）。",
            file=sys.stderr,
        )
        return 2

    try:
        dsn = resolve_dsn(args.dsn)
        target = parse_target(dsn)
        mode = "执行软删除" if args.apply else "dry-run 预演"
        enforce_target_guard(
            target,
            allow_production=args.allow_production,
            assume_yes=args.yes,
            action_label=f"人工裁决 {mode}：xbk_selections 历史重复有效选课",
        )
    except TargetGuardError as exc:
        print(f"[错误] {exc}", file=sys.stderr)
        return 2

    try:
        return asyncio.run(
            run_resolve(
                dsn,
                target.label,
                target.user,
                decisions_path=args.decisions,
                apply_changes=args.apply,
            )
        )
    except DecisionError as exc:
        print(f"[错误] {exc}", file=sys.stderr)
        return 4
    except (asyncpg.PostgresError, asyncpg.InterfaceError, OSError, asyncio.TimeoutError) as exc:
        print(f"[错误] 数据库连接或访问失败：{type(exc).__name__}: {exc}", file=sys.stderr)
        return 2
    except TargetGuardError as exc:
        print(f"[错误] {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
