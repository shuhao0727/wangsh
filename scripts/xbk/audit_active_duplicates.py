#!/usr/bin/env python3
r"""XBK 历史重复有效选课 —— 只读人工裁决清单（audit）。

背景
====
候选迁移 ``20260914_0001_xbk_active_selection_unique`` 会为 ``xbk_selections`` 建立
``(year, term, student_no) WHERE is_deleted IS FALSE`` 部分唯一索引
``uq_xbk_selections_active_period_student``。生产库存在历史重复有效选课时，迁移按设计
``raise RuntimeError`` 并整笔回滚，见
``backend/alembic/versions/20260914_0001_xbk_active_selection_unique.py``。

**保留哪一条记录是业务决定，代码无法推断。** 本脚本只生成裁决清单，不做裁决、不做写入；
处理动作必须由业务方逐组确认后，再用
``scripts/xbk/resolve_active_duplicates.py`` 在停写窗口内执行。

安全保证
========
- 全程只有 SELECT；连接建立后设置 ``default_transaction_read_only = on``，
  即使脚本自身出错也无法写入。该保护**不可关闭**：若目标库不支持该 GUC，
  脚本会降级为提示并继续只读查询，因此没有提供关闭开关。
- **不读取项目 ``.env``**：连接串只能通过 ``--dsn`` 或环境变量
  ``XBK_DUPLICATE_DSN`` 显式给出，避免误连生产。
- 目标不是「回环地址 + 测试库名」时默认拒绝连接；必须显式 ``--allow-production``，
  且仍会打印醒目警告并要求交互输入库名确认（``--yes`` 可跳过交互）。

用法
====
    # 只读列出全部重复组（回环测试库）
    python scripts/xbk/audit_active_duplicates.py \
        --dsn postgresql://user:pass@127.0.0.1:5432/wangsh_dup_test

    # 导出 CSV，交给业务方填写 keep 列
    python scripts/xbk/audit_active_duplicates.py \
        --dsn postgresql://user:pass@127.0.0.1:5432/wangsh_dup_test \
        --output test-results/xbk/active-duplicates.csv

    # 生产只读审计（停写/备份/复核要求见 docs/docker/deploy/DEPLOY.md）
    python scripts/xbk/audit_active_duplicates.py --dsn ... --allow-production

输出 CSV 列
===========
``year, term, grade, student_no, name, group_size, id, course_code, course_name,
created_at, updated_at, keep``

``grade`` 是诊断列：唯一索引不含年级，而原学号只在年级内唯一，若同组出现不同年级或
不同姓名，说明这组重复是**两名学生撞号**，不能按「同一名学生保留一门课」裁决。

``keep`` 列留空，由业务方在每一组内**恰好标记一行**为 ``yes``，表示要保留的记录；
其余行保持为空。该文件可直接交给 ``resolve_active_duplicates.py --decisions``。

退出码
======
    0  未发现重复有效选课
    3  发现重复组，需要人工裁决（不是错误，而是「有待处理工作」）
    2  参数、连接或配置错误
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import sys
from pathlib import Path
from typing import Any, Dict, List

if __package__ in (None, ""):
    sys.path.append(str(Path(__file__).resolve().parents[2]))

import asyncpg

from scripts.xbk._active_duplicate_common import (
    ENV_DSN_VAR,
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
from scripts.xbk.common import ensure_dir

CSV_COLUMNS = [
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
]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="XBK 历史重复有效选课 —— 只读裁决清单（不写入数据库）",
    )
    parser.add_argument(
        "--dsn",
        default=None,
        help=f"PostgreSQL 连接串；缺省时读取环境变量 {ENV_DSN_VAR}。不读取项目 .env。",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="导出裁决清单 CSV 的路径（UTF-8 with BOM，便于 Excel 打开中文）。",
    )
    parser.add_argument(
        "--allow-production",
        action="store_true",
        help="显式允许连接非「回环地址 + 测试库名」的目标，例如生产库只读审计。",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="跳过生产确认交互；仅用于已获授权的自动化场景。",
    )
    return parser


def _rows_by_group(rows: List[Dict[str, Any]]) -> Dict[Any, List[Dict[str, Any]]]:
    grouped: Dict[Any, List[Dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(group_key(row), []).append(row)
    return grouped


def _render_groups(
    groups: List[Dict[str, Any]],
    grouped_rows: Dict[Any, List[Dict[str, Any]]],
) -> None:
    """按 (year, term, student_no) 分组打印，便于业务方逐组勾选。

    组内**逐行**打印年级与姓名快照。唯一索引 ``(year, term, student_no)`` 不含
    ``grade``，而原学号只在年级内唯一，因此一组重复有可能是**两名不同学生撞了同一个
    原学号**，而不是同一名学生录了两门课。只打印「首个非空姓名」会把这种情形掩盖成
    单人重复，从而误导裁决——那才是真正危险的误删。所以这里逐行展示，并在姓名不一致
    时显式告警。
    """
    for index, group in enumerate(groups, start=1):
        key = group_key(group)
        members = grouped_rows.get(key, [])
        names = {m.get("name") for m in members if m.get("name")}
        grades = {m.get("grade") for m in members if m.get("grade")}
        print()
        print(f"--- 组 {index}/{len(groups)} " + "-" * 46)
        print(f"学年 / 学期 / 学号 : {key[0]} / {key[1]} / {key[2]}")
        print(f"年级（组内去重）   : {'、'.join(sorted(grades)) or '(无)'}")
        print(f"姓名（组内去重）   : {'、'.join(sorted(names)) or '(无)'}")
        print(f"有效记录数         : {group['active_count']}")
        if len(names) > 1:
            print()
            print("  [!] 本组姓名不一致：极可能是**不同学生共用同一个原学号**，")
            print("      而非同一名学生重复选课。删除任一行都会抹掉另一名学生的有效选课，")
            print("      请先用《校本上课》选课结果核对，不要直接裁决。")
        for member in members:
            print(
                f"  * id={member['id']:<7} 年级={member.get('grade') or '(空)':<5}"
                f" 姓名={member.get('name') or '(无)':<6}"
                f" 课程代码={member['course_code'] or '(空)'}"
            )
            print(f"        课程名称  = {member['course_name'] or '(未知)'}")
            print(f"        创建时间  = {format_timestamp(member['created_at'])}")
            print(f"        更新时间  = {format_timestamp(member['updated_at'])}")


def _write_csv(
    path: Path,
    groups: List[Dict[str, Any]],
    grouped_rows: Dict[Any, List[Dict[str, Any]]],
) -> int:
    """导出裁决清单；``keep`` 列留空待业务方填写。"""
    ensure_dir(path.parent)
    written = 0
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for group in groups:
            key = group_key(group)
            for member in grouped_rows.get(key, []):
                writer.writerow(
                    {
                        "year": member["year"],
                        "term": member["term"],
                        "grade": member.get("grade") or "",
                        "student_no": member["student_no"],
                        "name": member.get("name") or "",
                        "group_size": group["active_count"],
                        "id": member["id"],
                        "course_code": member["course_code"] or "",
                        "course_name": member.get("course_name") or "",
                        "created_at": format_timestamp(member["created_at"]),
                        "updated_at": format_timestamp(member["updated_at"]),
                        "keep": "",
                    }
                )
                written += 1
    return written


async def run_audit(
    dsn: str,
    target_label: str,
    target_user: str,
    *,
    output: str | None,
) -> Dict[str, Any]:
    conn, guard = await connect(dsn, read_only=True)
    try:
        # 组清单与组内明细必须来自同一个一致性快照，否则并发写入会让导出的
        # 裁决 CSV 与实际库内状态不符。
        async with read_only_snapshot(conn):
            groups = await fetch_duplicate_groups(conn)
            rows = await fetch_duplicate_rows(conn)
        grouped_rows = _rows_by_group(rows)

        print("=" * 68)
        print("XBK 历史重复有效选课 —— 只读裁决清单")
        print(f"目标             : {target_label}")
        print(f"连接用户         : {target_user or '(未指定)'}")
        print(f"只读保护         : {guard}")
        print(f"重复组数         : {len(groups)}")
        print(f"受影响有效记录数 : {len(rows)}")
        print("=" * 68)

        if not groups:
            print()
            print("未发现重复有效选课：迁移的唯一约束预检应当可以通过。")
            return {"group_count": 0, "row_count": 0, "csv_rows": 0}

        _render_groups(groups, grouped_rows)

        csv_rows = 0
        if output:
            csv_path = Path(output)
            csv_rows = _write_csv(csv_path, groups, grouped_rows)
            print()
            print(f"[导出] 裁决清单 CSV（{csv_rows} 行）：{csv_path}")

        print()
        print("-" * 68)
        print("下一步（必须由业务方完成，工具不代替裁决）：")
        print("  1. 在导出 CSV 的 keep 列中，为每一组恰好标记一行 yes；")
        print("  2. 复核标记结果并留档；")
        print("  3. 按 docs/docker/deploy/DEPLOY.md 完成停写与备份后，运行：")
        print("     python scripts/xbk/resolve_active_duplicates.py \\")
        print("         --dsn <DSN> --decisions <CSV>")
        print("     （先看 dry-run 输出，确认后再加 --apply --confirm-stop-writes）")
        print("-" * 68)
        return {"group_count": len(groups), "row_count": len(rows), "csv_rows": csv_rows}
    finally:
        await conn.close()


def main() -> int:
    args = build_parser().parse_args()
    try:
        dsn = resolve_dsn(args.dsn)
        target = parse_target(dsn)
        enforce_target_guard(
            target,
            allow_production=args.allow_production,
            assume_yes=args.yes,
            action_label="只读审计 xbk_selections 历史重复有效选课",
        )
    except TargetGuardError as exc:
        print(f"[错误] {exc}", file=sys.stderr)
        return 2

    try:
        summary = asyncio.run(
            run_audit(
                dsn,
                target.label,
                target.user,
                output=args.output,
            )
        )
    except (asyncpg.PostgresError, OSError) as exc:
        # 连接类失败（拒绝连接、DNS 解析失败、连接中断）是 OSError 的子类，
        # **不是** asyncpg.PostgresError；只捕后者会让它们以未捕获异常结束（退出码 1）。
        print(f"[错误] 数据库连接或访问失败：{type(exc).__name__}: {exc}", file=sys.stderr)
        return 2
    except TargetGuardError as exc:
        print(f"[错误] {exc}", file=sys.stderr)
        return 2

    return 3 if summary["group_count"] else 0


if __name__ == "__main__":
    sys.exit(main())
