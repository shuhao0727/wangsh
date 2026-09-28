"""Ephemeral, Redis-only classroom scores with a persistent deadline tombstone.

Only the deadline survives expiration: never expire/delete it to restart a lesson.
Change the configured round ID instead. Redis must preserve these metadata keys;
clearing/evicting Redis loses that guarantee (this is not durable exam storage).
"""

import asyncio
import hashlib
import json
from datetime import datetime, timezone

from fastapi import HTTPException
from loguru import logger

from app.core.config import settings
from app.schemas.ai_partner import LeaderboardResponse, LeaderboardRow, LeaderboardSubmission
from app.schemas.user_info import UserInfo
from app.utils.cache import cache

# All keys share a hash slot. TIME and every decision/write run in one operation.
# Rate state is also ephemeral: its TTL is capped at the round's fixed deadline.
LEADERBOARD_LUA = r"""
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local deadline = tonumber(redis.call('GET', KEYS[1]))
local write = ARGV[1] == 'POST'
if deadline and now >= deadline then
    redis.call('DEL', KEYS[2], KEYS[3])
    return {'ended', tostring(deadline), {}}
end

local entry = nil
if write then
    local raw = redis.call('GET', KEYS[4])
    if not raw then return {'invalid', '', {}} end
    local receipt = cjson.decode(raw)
    entry = cjson.decode(ARGV[5])
    if receipt.user_id ~= ARGV[2] or receipt.round_id ~= ARGV[6]
        or receipt.ai_name ~= entry.ai_name then return {'invalid', '', {}} end
    if type(receipt.score) ~= 'number' or receipt.score < 0 or receipt.score > 100
        or receipt.score ~= math.floor(receipt.score) then return {'invalid', '', {}} end
    entry.score = receipt.score
end
local ratefield = ARGV[1] .. ':' .. ARGV[2]
local previous = redis.call('HGET', KEYS[3], ratefield)
local window = now
local count = 0
if previous then
    local rate = cjson.decode(previous)
    if now < rate[1] + 60000 then
        window = rate[1]
        count = rate[2]
    end
end
local limit = write and 30 or 120
if count >= limit then
    return {'limited', tostring(math.ceil((window + 60000 - now) / 1000)), {}}
end
redis.call('HSET', KEYS[3], ratefield, cjson.encode({window, count + 1}))

if write then
    if not deadline then
        deadline = now + tonumber(ARGV[3]) * 1000
        redis.call('SET', KEYS[1], string.format('%.0f', deadline))
    end
    local existing = redis.call('HGET', KEYS[2], ARGV[2])
    if not existing or entry.score > cjson.decode(existing).score then
        redis.call('HSET', KEYS[2], ARGV[2], cjson.encode(entry))
    end
    redis.call('DEL', KEYS[4])
    redis.call('PEXPIREAT', KEYS[2], string.format('%.0f', deadline))
end
redis.call('PEXPIREAT', KEYS[3], string.format('%.0f', deadline or (now + 60000)))
if not deadline then
    return {'waiting', '', {}}
end
return {'open', string.format('%.0f', deadline), redis.call('HVALS', KEYS[2])}
"""


def round_keys(round_id: str) -> tuple[str, str, str]:
    digest = hashlib.sha256(round_id.encode("utf-8")).hexdigest()
    prefix = f"ai_partner:leaderboard:{{{digest}}}"
    return (f"{prefix}:deadline", f"{prefix}:scores", f"{prefix}:rates")


def _validate_submission(
    submission: LeaderboardSubmission | None, round_id: str, user_id: int
) -> None:
    if submission is None:
        return
    if submission.round_id != round_id:
        raise HTTPException(409, "榜单轮次已变更，请刷新页面")
    if submission.expected_user_id != user_id:
        raise HTTPException(409, "登录账号已变更，请刷新页面后重新提交")


def _serialize_entry(
    user: UserInfo, user_id: int, submission: LeaderboardSubmission | None
) -> str:
    student_name = (user.get("full_name") or "").strip()[:80] or "课堂参与者"
    return json.dumps(
        {
            "user_id": str(user_id),
            "student_name": student_name,
            "ai_name": submission.ai_name if submission else "",
            "score": 0,
        },
        ensure_ascii=False,
    )


def _evaluation_key(deadline_key: str, submission: LeaderboardSubmission | None) -> str:
    suffix = (
        f"evaluation:{submission.evaluation_id}" if submission else "unused"
    )
    return f"{deadline_key}:{suffix}"


async def _run_leaderboard_script(
    round_id: str,
    user_id: int,
    submission: LeaderboardSubmission | None,
    entry: str,
):
    keys = round_keys(round_id)
    # Use the real client, not cache.get/set (which deliberately swallow failures).
    async with asyncio.timeout(3):
        client = await cache.get_client()
        return await client.eval(
            LEADERBOARD_LUA,
            4,
            *keys,
            _evaluation_key(keys[0], submission),
            "POST" if submission else "GET",
            str(user_id),
            settings.AI_PARTNER_LEADERBOARD_DURATION_SECONDS,
            0,
            entry,
            round_id,
        )


def _build_rows(raw_rows, user_id: int) -> list[LeaderboardRow]:
    rows = [json.loads(value) for value in raw_rows]
    # Account ID is only an internal tie-breaker; it is never returned to clients.
    rows.sort(key=lambda row: (-row["score"], int(row["user_id"])))
    output = []
    rank = 0
    previous_score = None
    for index, row in enumerate(rows, start=1):
        if row["score"] != previous_score:
            rank = index
        previous_score = row["score"]
        output.append(
            LeaderboardRow(
                rank=rank,
                student_name=row["student_name"],
                ai_name=row["ai_name"],
                score=row["score"],
                is_me=row["user_id"] == str(user_id),
            )
        )
    return output


def _parse_script_result(result, user_id: int):
    state, deadline, raw_rows = result
    if isinstance(state, bytes):
        state = state.decode("utf-8")
    if state not in {"waiting", "open", "ended", "limited", "invalid"}:
        raise ValueError("Unexpected Redis leaderboard state")
    retry_after = int(deadline) if state == "limited" else None
    expires_at = (
        datetime.fromtimestamp(int(deadline) / 1000, tz=timezone.utc).isoformat()
        if state in {"open", "ended"}
        else None
    )
    return state, retry_after, expires_at, _build_rows(raw_rows, user_id)


def _raise_for_state(
    state: str, retry_after: int | None, submission: LeaderboardSubmission | None
) -> None:
    if state == "invalid":
        raise HTTPException(409, "评估凭证无效、已使用或已过期，请重新评分")
    if state == "limited":
        raise HTTPException(
            429,
            "请求过于频繁，请稍后重试",
            headers={"Retry-After": str(retry_after)},
        )
    if state == "ended" and submission is not None:
        raise HTTPException(410, "本轮榜单已结束")


async def get_leaderboard(
    user: UserInfo, submission: LeaderboardSubmission | None = None
) -> LeaderboardResponse:
    round_id = settings.AI_PARTNER_LEADERBOARD_ROUND_ID
    user_id = user["id"]  # Identity comes exclusively from the authenticated dependency.
    _validate_submission(submission, round_id, user_id)
    entry = _serialize_entry(user, user_id, submission)

    try:
        result = await _run_leaderboard_script(round_id, user_id, submission, entry)
        state, retry_after, expires_at, output = _parse_script_result(result, user_id)
    except Exception as exc:
        logger.warning("AI partner leaderboard unavailable: {}", type(exc).__name__)
        raise HTTPException(503, "榜单暂不可用，请稍后重试") from exc

    _raise_for_state(state, retry_after, submission)
    return LeaderboardResponse(
        round_id=round_id, status=state, expires_at=expires_at, rows=output
    )
