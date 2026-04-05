#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
from typing import Any, Dict

import asyncpg

if __package__ in (None, ""):
    import sys
    from pathlib import Path

    sys.path.append(str(Path(__file__).resolve().parents[2]))

from scripts.xbk.common import dump_json, ensure_dir, get_settings, utc_now_iso
from scripts.xbk.dataset import build_seed_dataset


async def reset_and_seed(reset: bool = True) -> Dict[str, Any]:
    settings = get_settings()
    dataset = build_seed_dataset(settings)

    conn = await asyncpg.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password,
        database=settings.db_name,
    )

    try:
        async with conn.transaction():
            if reset:
                await conn.execute(
                    "TRUNCATE TABLE xbk_selections, xbk_courses, xbk_students RESTART IDENTITY"
                )

            await conn.executemany(
                """
                INSERT INTO xbk_students (year, term, grade, class_name, student_no, name, gender, is_deleted)
                VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
                """,
                [
                    (
                        row["year"],
                        row["term"],
                        row["grade"],
                        row["class_name"],
                        row["student_no"],
                        row["name"],
                        row["gender"],
                    )
                    for row in dataset["students"]
                ],
            )

            await conn.executemany(
                """
                INSERT INTO xbk_courses (year, term, grade, course_code, course_name, teacher, quota, location, is_deleted)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
                """,
                [
                    (
                        row["year"],
                        row["term"],
                        row["grade"],
                        row["course_code"],
                        row["course_name"],
                        row["teacher"],
                        row["quota"],
                        row["location"],
                    )
                    for row in dataset["courses"]
                ],
            )

            await conn.executemany(
                """
                INSERT INTO xbk_selections (year, term, grade, student_no, name, course_code, is_deleted)
                VALUES ($1, $2, $3, $4, $5, $6, FALSE)
                """,
                [
                    (
                        row["year"],
                        row["term"],
                        row["grade"],
                        row["student_no"],
                        row["name"],
                        row["course_code"],
                    )
                    for row in dataset["selections"]
                ],
            )

            await conn.execute(
                """
                INSERT INTO sys_feature_flags (key, value, updated_at)
                VALUES ('xbk_public_enabled', '{"enabled": true}'::jsonb, now())
                ON CONFLICT (key) DO UPDATE
                SET value = EXCLUDED.value,
                    updated_at = now()
                """
            )

        summary = {
            "students": int(
                await conn.fetchval(
                    "SELECT count(*) FROM xbk_students WHERE is_deleted = FALSE"
                )
                or 0
            ),
            "courses": int(
                await conn.fetchval(
                    "SELECT count(*) FROM xbk_courses WHERE is_deleted = FALSE"
                )
                or 0
            ),
            "selections": int(
                await conn.fetchval(
                    "SELECT count(*) FROM xbk_selections WHERE is_deleted = FALSE"
                )
                or 0
            ),
            "unselected": int(
                await conn.fetchval(
                    """
                    SELECT count(*)
                    FROM xbk_selections
                    WHERE is_deleted = FALSE
                      AND year = $1
                      AND term = $2
                      AND course_code = ''
                    """,
                    settings.year,
                    settings.term,
                )
                or 0
            ),
            "suspended": int(
                await conn.fetchval(
                    """
                    SELECT count(*)
                    FROM xbk_students s
                    WHERE s.is_deleted = FALSE
                      AND s.year = $1
                      AND s.term = $2
                      AND NOT EXISTS (
                        SELECT 1
                        FROM xbk_selections x
                        WHERE x.is_deleted = FALSE
                          AND x.year = s.year
                          AND x.term = s.term
                          AND x.student_no = s.student_no
                      )
                    """,
                    settings.year,
                    settings.term,
                )
                or 0
            ),
        }

        result = {
            "timestamp": utc_now_iso(),
            "year": settings.year,
            "term": settings.term,
            "reset": reset,
            "seed_rows": {
                "students": len(dataset["students"]),
                "courses": len(dataset["courses"]),
                "selections": len(dataset["selections"]),
            },
            "db_counts": summary,
        }

        ensure_dir(settings.test_result_dir)
        dump_json(settings.test_result_dir / "seed-summary.json", result)
        return result
    finally:
        await conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset and seed XBK tables.")
    parser.add_argument(
        "--no-reset",
        action="store_true",
        help="Do not truncate existing XBK tables before inserting seed data.",
    )
    args = parser.parse_args()

    result = asyncio.run(reset_and_seed(reset=not args.no_reset))
    print("[xbk-seed] done")
    print(result)


if __name__ == "__main__":
    main()
