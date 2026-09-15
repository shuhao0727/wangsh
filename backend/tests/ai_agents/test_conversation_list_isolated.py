"""Real route/service/SQL contract, synthetic SQLite view; no provider or normal DB."""
import asyncio
import os
import re
import uuid
from datetime import datetime
from contextlib import asynccontextmanager

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import event, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.endpoints.agents.ai_agents import conversations as api
from app.services.agents.agent_conversations import list_user_conversations


@asynccontextmanager
async def conversation_client(user_id=11, extra_rows=()):
    url = os.environ.get("CONVERSATION_TEST_DATABASE_URL", "").strip()
    admin = None
    schema = "test_conversations_" + uuid.uuid4().hex
    if url:
        parsed = make_url(url)
        if parsed.drivername != "postgresql+asyncpg" or not re.search(
            r"(?:^|[_-])(?:test|testing|ci)(?:$|[_-])", parsed.database or "", re.I
        ):
            raise ValueError("Refusing non-dedicated conversation test database")
        admin = create_async_engine(url)
        try:
            async with admin.begin() as db:
                await db.execute(text(f'CREATE SCHEMA "{schema}"'))
        except BaseException:
            await admin.dispose()
            raise
        engine = create_async_engine(url, connect_args={"server_settings": {
            "search_path": schema, "statement_timeout": "8000", "lock_timeout": "5000"
        }})
    else:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    try:
        async with engine.begin() as db:
            await db.execute(text("""CREATE TABLE conversation_fixture (
                id INTEGER PRIMARY KEY, user_id INTEGER, agent_id INTEGER,
                session_id TEXT, display_user_name TEXT, display_agent_name TEXT,
                message_type TEXT, content TEXT, created_at TIMESTAMP,
                response_time_ms INTEGER)"""))
            await db.execute(text("CREATE VIEW v_conversations_with_deleted AS SELECT * FROM conversation_fixture"))
            rows = [
                (1, 11, 7, "a", "question", "question A", "2026-09-08 10:00:00"),
                (2, 11, 7, "a", "answer", "answer A", "2026-09-08 10:00:01"),
                (3, 11, 8, "b", "question", "question B", "2026-09-08 11:00:00"),
                (4, 11, None, "deleted-agent", "answer", "deleted agent history", "2026-09-08 09:00:00"),
                (5, 99, 7, "foreign", "answer", "SECRET", "2026-09-08 12:00:00"),
                (6, 11, 7, None, "answer", "sessionless", "2026-09-08 13:00:00"),
                (7, 11, 7, "tie-z", "question", "tie Z", "2026-09-08 08:00:00"),
                (8, 11, 7, "tie-a", "question", "tie A", "2026-09-08 08:00:00"),
            ]
            rows.extend(extra_rows)
            await db.execute(text("""INSERT INTO conversation_fixture
                (id,user_id,agent_id,session_id,message_type,content,created_at,display_user_name,display_agent_name)
                VALUES (:id,:user,:agent,:session,:kind,:content,:at,'synthetic student','synthetic agent')"""), [
                {**dict(zip(("id", "user", "agent", "session", "kind", "content", "at"), row)), "at": datetime.fromisoformat(row[-1])} for row in rows
            ])
        factory = async_sessionmaker(engine, expire_on_commit=False)
        app = FastAPI()
        app.include_router(api.router, prefix="/ai-agents")

        async def synthetic_user():
            return {"id": user_id, "role_code": "student"}

        async def synthetic_db():
            async with factory() as session:
                yield session

        app.dependency_overrides[api.require_registered_user] = synthetic_user
        app.dependency_overrides[api.get_db] = synthetic_db
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://isolated") as client:
            yield client, factory
    finally:
        await engine.dispose()
        if admin is not None:
            try:
                async with admin.begin() as db:
                    await db.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            finally:
                await admin.dispose()


def run(coro):
    return asyncio.run(coro)


def test_omitted_filter_returns_own_mixed_agent_history_with_actual_ids():
    async def scenario():
        async with conversation_client() as (client, _):
            response = await client.get("/ai-agents/conversations")
            assert response.status_code == 200
            rows = response.json()
            assert [(r["session_id"], r["agent_id"]) for r in rows] == [
                ("b", 8), ("a", 7), ("deleted-agent", None), ("tie-a", 7), ("tie-z", 7)
            ]
            assert rows[1]["turns"] == 1
            assert rows[1]["preview"] == "answer A"
    run(scenario())


@pytest.mark.parametrize("agent,expected", [(7, ["a", "tie-a", "tie-z"]), (8, ["b"]), (999, [])])
def test_explicit_filter_preserves_exact_agent_and_ownership(agent, expected):
    async def scenario():
        async with conversation_client() as (client, _):
            response = await client.get("/ai-agents/conversations", params={"agent_id": agent})
            assert response.status_code == 200
            assert [r["session_id"] for r in response.json()] == expected
            assert all(r["agent_id"] == agent for r in response.json())
    run(scenario())


@pytest.mark.parametrize("user,expected", [(99, ["foreign"]), (100, [])])
def test_current_user_remains_mandatory_scope(user, expected):
    async def scenario():
        async with conversation_client(user) as (client, _):
            response = await client.get("/ai-agents/conversations")
            assert response.status_code == 200
            assert [r["session_id"] for r in response.json()] == expected
    run(scenario())


@pytest.mark.parametrize("limit,status", [(1, 200), (100, 200), (0, 422), (101, 422)])
def test_limit_contract_and_order(limit, status):
    async def scenario():
        async with conversation_client() as (client, _):
            response = await client.get("/ai-agents/conversations", params={"limit": limit})
            assert response.status_code == status
            if status == 200:
                assert response.json()[0]["session_id"] == "b"
                assert len(response.json()) == min(limit, 5)
    run(scenario())


def test_direct_service_can_omit_optional_filter():
    async def scenario():
        async with conversation_client() as (_, factory):
            async with factory() as db:
                rows = await list_user_conversations(db, user_id=11)
                assert len(rows) == 5
    run(scenario())


def test_detail_still_excludes_other_users():
    async def scenario():
        async with conversation_client() as (client, _):
            foreign = await client.get("/ai-agents/conversations/foreign")
            assert foreign.status_code == 200
            assert foreign.json() == []
            own = await client.get("/ai-agents/conversations/a")
            assert [m["id"] for m in own.json()] == [1, 2]
    run(scenario())


MIXED_SESSION_ROWS = [
    (20, 11, 7, "shared", "question", "agent7 Q", "2026-09-08 14:00:00"),
    (21, 11, 8, "shared", "question", "agent8 Q", "2026-09-08 14:00:01"),
    (22, 11, None, "shared", "answer", "null agent answer", "2026-09-08 14:00:02"),
    # Same session ID in another user's history must affect neither aggregates
    # nor membership selection. Their agent 9 must not make our session eligible.
    (23, 99, 9, "shared", "question", "FOREIGN QUESTION", "2026-09-08 18:00:00"),
    (24, 99, 9, "shared", "answer", "ZZZ FOREIGN ANSWER", "2026-09-08 18:00:01"),
    (25, 99, 8, "a", "answer", "FOREIGN MEMBERSHIP", "2026-09-08 19:00:00"),
]


@pytest.mark.parametrize("agent,expected", [
    (None, ["shared", "b", "a", "deleted-agent", "tie-a", "tie-z"]),
    (7, ["shared", "a", "tie-a", "tie-z"]),
    (8, ["shared", "b"]),
])
@pytest.mark.parametrize("limit", [1, 2, 3, 100])
def test_session_membership_filter_aggregates_whole_detail_without_duplicate_limits(agent, expected, limit):
    async def scenario():
        async with conversation_client(extra_rows=MIXED_SESSION_ROWS) as (client, _):
            params = {"limit": limit}
            if agent is not None:
                params["agent_id"] = agent
            response = await client.get("/ai-agents/conversations", params=params)
            assert response.status_code == 200
            rows = response.json()
            assert [r["session_id"] for r in rows] == expected[:limit]
            assert len({r["session_id"] for r in rows}) == len(rows)
            summary = rows[0]
            assert summary["agent_id"] is None
            assert summary["display_agent_name"] is None
            detail = await client.get("/ai-agents/conversations/shared")
            assert detail.status_code == 200
            messages = detail.json()
            assert [m["id"] for m in messages] == [20, 21, 22]
            assert [m["agent_id"] for m in messages] == [7, 8, None]
            assert summary["turns"] == sum(m["message_type"] == "question" for m in messages) == 2
            assert summary["last_at"] == messages[-1]["created_at"]
            assert summary["preview"] == "null agent answer"
            excluded = await client.get("/ai-agents/conversations", params={"agent_id": 9})
            assert excluded.status_code == 200
            assert excluded.json() == []
    run(scenario())


@pytest.mark.parametrize("agents,expected", [
    ([7, 7], 7), ([0, 0], 0), ([None, None], None),
    ([7, None], None), ([7, 8], None), ([7, 8, None], None),
])
def test_summary_agent_requires_every_message_to_have_same_non_null_id(agents, expected):
    async def scenario():
        extra = [(40 + i, 11, agent, "identity", "question", "synthetic Q",
                  f"2026-09-08 15:00:0{i}") for i, agent in enumerate(agents)]
        async with conversation_client(extra_rows=extra) as (client, _):
            response = await client.get("/ai-agents/conversations")
            assert response.status_code == 200
            summaries = [r for r in response.json() if r["session_id"] == "identity"]
            assert len(summaries) == 1
            assert summaries[0]["agent_id"] == expected
            assert summaries[0]["display_agent_name"] == ("synthetic agent" if expected is not None else None)
            assert summaries[0]["turns"] == len(agents)
    run(scenario())


def test_other_user_same_session_has_independent_summary_and_membership():
    async def scenario():
        async with conversation_client(user_id=99, extra_rows=MIXED_SESSION_ROWS) as (client, _):
            response = await client.get("/ai-agents/conversations", params={"agent_id": 9})
            assert response.status_code == 200
            rows = response.json()
            assert len(rows) == 1 and rows[0]["session_id"] == "shared"
            assert rows[0]["agent_id"] == 9
            assert rows[0]["display_agent_name"] == "synthetic agent"
            assert rows[0]["turns"] == 1
            assert rows[0]["preview"] == "ZZZ FOREIGN ANSWER"
            detail = (await client.get("/ai-agents/conversations/shared")).json()
            assert [m["id"] for m in detail] == [23, 24]
            assert rows[0]["last_at"] == detail[-1]["created_at"]
            filtered = (await client.get("/ai-agents/conversations", params={"agent_id": 7})).json()
            assert [r["session_id"] for r in filtered] == ["foreign"]
    run(scenario())


def test_preview_uses_latest_answer_not_lexical_max_even_after_unanswered_question():
    # Answer priority is unchanged; latest within a type is chronological, not lexical.
    async def scenario():
        extra = [
            (50, 11, 7, "preview", "answer", "z old answer", "2026-09-08 15:00:00"),
            (51, 11, 7, "preview", "answer", "a latest answer", "2026-09-08 16:00:00"),
            (52, 11, 7, "preview", "question", "latest unanswered Q", "2026-09-08 17:00:00"),
        ]
        async with conversation_client(extra_rows=extra) as (client, _):
            row = (await client.get("/ai-agents/conversations", params={"agent_id": 7})).json()[0]
            assert row["session_id"] == "preview"
            assert row["last_at"].startswith("2026-09-08T17:00:00")
            assert row["preview"] == "a latest answer"
    run(scenario())


@pytest.mark.parametrize("answer,question,expected", [
    ("  a 最新答案  ", "a later question", "a 最新答案"),
    ("", "  a 最新问题  ", "a 最新问题"),
    (" \n\t", "  a 最新问题  ", "a 最新问题"),
    ("", "", ""),
    (" \t", "\n", ""),
    (None, "a latest question", "a latest question"),
    ("a latest answer", None, "a latest answer"),
    (None, "", ""),
    ("  " + "答" * 81 + "  ", "latest Q", "答" * 80 + "…"),
    ("答" * 80, "latest Q", "答" * 80),
    ("", "  " + "问" * 81 + "  ", "问" * 80 + "…"),
])
def test_preview_latest_per_type_preserves_blank_fallback_and_truncation(answer, question, expected):
    async def scenario():
        extra = []
        for offset, kind, content in [(0, "answer", answer), (2, "question", question)]:
            if content is not None:
                extra.extend([
                    (100 + offset, 11, 7, "preview", kind, "z stale " + kind, "2026-09-08 14:00:00"),
                    (101 + offset, 11, 7, "preview", kind, content, f"2026-09-08 {16 + offset}:00:00"),
                ])
        async with conversation_client(extra_rows=extra) as (client, _):
            response = await client.get("/ai-agents/conversations", params={"agent_id": 7, "limit": 1})
            assert response.status_code == 200
            row = response.json()[0]
            assert row["session_id"] == "preview"
            # Do not search backwards for an older nonblank message of either type.
            assert row["preview"] == expected
    run(scenario())


@pytest.mark.parametrize("kind", ["question", "answer"])
@pytest.mark.parametrize("reverse_insert", [False, True])
def test_preview_timestamp_then_numeric_id_matches_detail_order(kind, reverse_insert):
    async def scenario():
        extra = [
            (990, 11, 7, "ordered", kind, "zzz older with greater id", "2026-09-08 14:00:00"),
            (99, 11, 7, "ordered", kind, "zz same time smaller id", "2026-09-08 15:00:00"),
            (100, 11, 7, "ordered", kind, "aa same time greatest id", "2026-09-08 15:00:00"),
            (991, 99, 7, "ordered", kind, "foreign same timestamp", "2026-09-08 15:00:00"),
        ]
        if reverse_insert:
            extra.reverse()
        async with conversation_client(extra_rows=extra) as (client, _):
            response = await client.get("/ai-agents/conversations/ordered")
            assert response.status_code == 200
            detail = response.json()
            assert [m["id"] for m in detail] == [990, 99, 100]
            for _ in range(2):
                response = await client.get("/ai-agents/conversations", params={"limit": 1})
                assert response.status_code == 200
                row = response.json()[0]
                assert row["session_id"] == "ordered"
                assert row["last_at"] == detail[-1]["created_at"]
                assert row["preview"] == detail[-1]["content"] == "aa same time greatest id"
    run(scenario())


@pytest.mark.parametrize("agent", [None, 7, 8])
def test_preview_ranks_whole_own_session_before_agent_membership_filter(agent):
    async def scenario():
        extra = [
            (100, 11, 7, "mixed-preview", "question", "z old Q", "2026-09-08 14:00:00"),
            (101, 11, 7, "mixed-preview", "answer", "z old selected-agent A", "2026-09-08 14:00:01"),
            (102, 11, 8, "mixed-preview", "question", "a latest Q", "2026-09-08 15:00:00"),
            (103, 11, None, "mixed-preview", "answer", "a latest NULL-agent A", "2026-09-08 15:00:01"),
            (104, 99, 9, "mixed-preview", "answer", "foreign newer A", "2026-09-08 16:00:00"),
        ]
        async with conversation_client(extra_rows=extra) as (client, _):
            params = {"limit": 1}
            if agent is not None:
                params["agent_id"] = agent
            response = await client.get("/ai-agents/conversations", params=params)
            assert response.status_code == 200
            row, = response.json()
            assert row["session_id"] == "mixed-preview"
            assert row["agent_id"] is None and row["display_agent_name"] is None
            assert row["turns"] == 2
            assert row["last_at"].startswith("2026-09-08T15:00:01")
            assert row["preview"] == "a latest NULL-agent A"
            assert (await client.get("/ai-agents/conversations", params={"agent_id": 9})).json() == []
            # Independently rank the other user's same session, without our agent membership.
            async with conversation_client(user_id=99, extra_rows=extra) as (other, _):
                other_row, = (await other.get("/ai-agents/conversations", params={"agent_id": 9})).json()
                assert other_row["preview"] == "foreign newer A"
                assert other_row["turns"] == 0 and other_row["agent_id"] == 9
    run(scenario())


@pytest.mark.parametrize("limit", [1, 5, 100])
@pytest.mark.parametrize("agent", [None, 7, 8, 999])
def test_preview_batch_stays_one_query_with_session_limits_and_full_aggregates(limit, agent):
    async def scenario():
        # All timestamps tie, so session and message tie-breakers are both exercised.
        # Every session has mixed/NULL agents; filtering cannot truncate its message set.
        extra = []
        for session in range(24):
            for message in range(6):
                extra.append((1000 + session * 6 + message, 11,
                              [7, 8, None][message % 3], f"batch-{session:02}",
                              "question" if message % 2 == 0 else "answer",
                              f"{9 - message} content {session}/{message}", "2026-09-09 10:00:00"))
        async with conversation_client(extra_rows=extra) as (_, factory):
            async with factory() as db:
                statements = []

                def record_statement(conn, cursor, statement, parameters, context, executemany):
                    statements.append(statement)

                engine = db.bind.sync_engine
                event.listen(engine, "before_cursor_execute", record_statement)
                try:
                    rows = await list_user_conversations(db, user_id=11, agent_id=agent, limit=limit)
                finally:
                    event.remove(engine, "before_cursor_execute", record_statement)
                assert len(statements) == 1, "list must remain one batched query, not N+1 detail queries"
                if agent == 999:
                    assert rows == []
                    return
                base = {None: ["b", "a", "deleted-agent", "tie-a", "tie-z"],
                        7: ["a", "tie-a", "tie-z"], 8: ["b"]}[agent]
                expected = [f"batch-{s:02}" for s in range(24)] + base
                assert [r["session_id"] for r in rows] == expected[:limit]
                for index, row in enumerate(rows[:24]):
                    assert row["turns"] == 3  # Counts ALL questions, not only rank 1 or selected agent.
                    assert row["agent_id"] is None and row["display_agent_name"] is None
                    assert row["display_user_name"] == "synthetic student"
                    assert row["preview"] == f"4 content {index}/5"
    run(scenario())
