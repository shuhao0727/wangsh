"""提问时间线：时间戳归一与按时间桶分组。

从 ``agent_analysis.py`` 抽出——纯计算，不碰数据库、不发 LLM，
输入是已取出的行与教师标记，输出是可直接序列化的桶列表。
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def timestamp_value(value: Any) -> Optional[float]:
    """把 datetime / ISO 字符串 / 数字统一成 epoch 秒；无法识别返回 None。

    识别不了就跳过而不是抛错：分析结果宁可少一个桶，也不该因为
    某条脏数据让整个分析请求失败。
    """
    if value is None:
        return None
    if hasattr(value, "timestamp"):
        return value.timestamp()
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
        except ValueError:
            return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _nearest_teacher_mark(
    bucket_key: float,
    bucket_seconds: int,
    teacher_marks: List[Dict[str, Any]],
) -> Optional[str]:
    """返回该桶前 5 分钟内的最近一条教师标记；没有则 None。

    标记是「教师刚讲过什么」的线索，用于判断提问爆发是否由讲解引发，
    因此只回看 5 分钟、只看第一条命中。
    """
    for mark in teacher_marks or []:
        mark_ts = timestamp_value(mark.get("time"))
        if mark_ts is None:
            continue
        if bucket_key - 300 <= mark_ts <= bucket_key + bucket_seconds:
            return mark.get("question", "")
    return None


def _top_questions(items: List[Dict[str, Any]], top_n: int) -> List[Dict[str, Any]]:
    freq: Dict[str, int] = {}
    for item in items:
        text = (item.get("content") or "").strip().lower().rstrip("？?。.")
        if text:
            freq[text] = freq.get(text, 0) + 1
    ranked = sorted(freq.items(), key=lambda pair: pair[1], reverse=True)[:top_n]
    return [{"question": question, "count": count} for question, count in ranked]


def _unique_student_count(items: List[Dict[str, Any]]) -> int:
    return len(set(
        item.get("full_name") or item.get("student_id") or "unknown" for item in items
    ))


def build_timeline_buckets(
    rows: List[Dict[str, Any]],
    bucket_seconds: int,
    teacher_marks: List[Dict[str, Any]],
    start_at: datetime,
    end_at: datetime,
    top_n: int = 5,
) -> List[Dict[str, Any]]:
    """
    将提问记录按时间桶分组，检测爆发点，关联教师标记。
    rows: 每行含 content, created_at, full_name 等字段
    teacher_marks: [{"time": datetime, "question": str}, ...]
    返回: TimelineBucket 列表
    """
    from math import floor

    if not rows:
        return []

    # 计算桶边界
    start_epoch = start_at.timestamp()
    buckets_map: Dict[float, List[Dict[str, Any]]] = {}

    for row in rows:
        ts = timestamp_value(row.get("created_at"))
        if ts is None:
            continue
        bucket_key = floor((ts - start_epoch) / bucket_seconds) * bucket_seconds + start_epoch
        buckets_map.setdefault(bucket_key, []).append(row)

    timeline: List[Dict[str, Any]] = []
    prev_count = 0
    for bucket_key in sorted(buckets_map):
        items = buckets_map[bucket_key]
        question_count = len(items)
        timeline.append({
            "bucket_start": datetime.fromtimestamp(bucket_key, tz=timezone.utc).isoformat(),
            "bucket_end": datetime.fromtimestamp(bucket_key + bucket_seconds, tz=timezone.utc).isoformat(),
            "question_count": question_count,
            "unique_students": _unique_student_count(items),
            "top_questions": _top_questions(items, top_n),
            # 爆发点：提问量 > 前一桶的 2 倍且绝对值 >= 3
            "is_burst": prev_count > 0 and question_count >= prev_count * 2 and question_count >= 3,
            "near_teacher_mark": _nearest_teacher_mark(bucket_key, bucket_seconds, teacher_marks),
        })
        prev_count = question_count

    return timeline
