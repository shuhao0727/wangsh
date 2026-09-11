"""BIZ-03: real HTTP/JWT/guards/schema/service/SQLite ORM authorization regression.

Run with --noconftest under an import-time socket/dotenv-blocking runner and
synthetic settings (see the BIZ-03 evidence runner). Do not load app.main.
Adapted from test_assessment_availability_isolated's maintained fixture pattern;
only DB sessions and the nonce cache are replaced, never the profile service or
permission dependencies. SQLite does not validate production PG/Redis behavior.
"""

import asyncio
import socket
from contextlib import asynccontextmanager
from datetime import date
from types import SimpleNamespace
from typing import get_args

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.endpoints.assessment import router
from app.core import session_guard
from app.core.config import settings
from app.db.database import Base, get_db
from app.models import AuthAuthority, AuthSessionState, User
from app.models.agents import AIAgent
from app.models.agents.group_discussion import GroupDiscussionMember, GroupDiscussionSession
from app.models.assessment import AssessmentConfig, StudentProfile
from app.schemas.assessment.profile import ProfileListResponse, ProfileResponse, ProfileType
from app.services.agents import chat_blocking
from app.services.auth import create_access_token

PREFIX = "/api/v1/assessment"
ROLES = {101: "student", 102: "student", 103: "teacher", 104: "admin", 105: "super_admin", 106: "guest"}
ALLOWED_USERS = [uid for uid, role in ROLES.items() if role != "guest"]
PROFILE_TYPES = get_args(ProfileType)


class ProfileHarness:
    async def request(self, path, *, user_id=101):
        headers = {}
        if user_id is not None:
            headers["Authorization"] = "Bearer " + create_access_token({
                "sub": f"profile-user-{user_id}", "sn": f"profile-nonce-{user_id}",
            })
        async with AsyncClient(transport=ASGITransport(app=self.app),
                               base_url="http://isolated.invalid") as client:
            return await client.get(PREFIX + path, headers=headers)

    async def seed(self, profile_type="individual", target_id="101"):
        async with self.db_factory() as db:
            profile = StudentProfile(
                profile_type=profile_type, target_id=target_id, config_id=1,
                discussion_session_id=int(target_id) if profile_type == "group" else None,
                created_by_user_id=104, result_text=f"SYNTHETIC PRIVATE {profile_type} {target_id}",
                scores='{"dimensions":{"synthetic":73}}', data_sources='["assessment"]',
            )
            db.add(profile)
            await db.commit()
            return profile.id


@pytest.fixture
def isolated(monkeypatch):
    h = ProfileHarness()
    h.reads = []
    h.writes = []
    h.ai_calls = []

    def deny_network(*args, **kwargs):
        raise AssertionError("BIZ-03 forbids network access")

    async def read_memory_nonce(key):
        return next(({"nonce": f"profile-nonce-{uid}"} for uid in ROLES
                     if key == f"auth:session:uid:{uid}"), None)

    async def deny_ai(*args, **kwargs):
        h.ai_calls.append(True)
        raise AssertionError("Profile detail must not invoke AI")

    monkeypatch.setattr(socket.socket, "connect", deny_network)
    monkeypatch.setattr(socket.socket, "connect_ex", deny_network)
    monkeypatch.setattr(settings, "AUTH_ENFORCE_SAME_IP_PER_REQUEST", False)
    monkeypatch.setattr(session_guard, "cache", SimpleNamespace(get=read_memory_nonce))
    monkeypatch.setattr(chat_blocking, "run_agent_chat_blocking", deny_ai)

    @asynccontextmanager
    async def context():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")

        @event.listens_for(engine.sync_engine, "connect")
        def enable_fk(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

        @event.listens_for(engine.sync_engine, "before_cursor_execute")
        def track_sql(_conn, _cursor, statement, _params, _ctx, _many):
            sql = statement.lstrip().upper()
            if sql.startswith("SELECT") and "znt_student_profiles" in statement:
                h.reads.append(statement)
            if sql.startswith(("INSERT", "UPDATE", "DELETE")):
                h.writes.append(statement)

        h.db_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with engine.begin() as connection:
                await connection.run_sync(lambda c: Base.metadata.create_all(c, tables=[
                    User.__table__, AIAgent.__table__, AssessmentConfig.__table__,
                    GroupDiscussionSession.__table__, GroupDiscussionMember.__table__,
                    StudentProfile.__table__, AuthAuthority.__table__, AuthSessionState.__table__,
                ]))
            async with h.db_factory() as db:
                db.add_all([User(
                    id=uid, username=f"profile-user-{uid}", full_name=f"Synthetic {uid}",
                    student_id=f"PROFILE-{uid}", role_code=role, class_name="own-class",
                    is_active=True, is_deleted=False,
                ) for uid, role in ROLES.items()])
                await db.flush()
                db.add(AuthAuthority(id=1, ready=True))
                db.add_all([AuthSessionState(
                    user_id=uid, nonce=f"profile-nonce-{uid}", ip="", active=True,
                ) for uid in ROLES])
                await db.flush()
                db.add(AssessmentConfig(id=1, title="Synthetic profile assessment"))
                db.add_all([GroupDiscussionSession(
                    id=uid, session_date=date(2032, 6, 1), class_name=str(uid),
                    group_no=str(uid), created_by_user_id=102,
                ) for uid in ALLOWED_USERS])
                await db.flush()
                # The colliding user 101 is NOT in group 101. Only user 102 is.
                db.add(GroupDiscussionMember(session_id=101, user_id=102))
                await db.commit()
                members = (await db.execute(select(GroupDiscussionMember.user_id).where(
                    GroupDiscussionMember.session_id == 101))).scalars().all()
                assert members == [102]
            h.writes.clear()

            async def isolated_db():
                async with h.db_factory() as db:
                    yield db

            h.app = FastAPI()
            h.app.include_router(router, prefix=PREFIX)
            h.app.dependency_overrides[get_db] = isolated_db
            yield h
            assert not h.ai_calls
        finally:
            await engine.dispose()

    return context


@pytest.mark.parametrize("user_id", ALLOWED_USERS, ids=lambda uid: f"{ROLES[uid]}-{uid}")
@pytest.mark.parametrize("profile_type", PROFILE_TYPES)
def test_my_detail_requires_individual_and_owner(isolated, user_id, profile_type):
    async def scenario():
        async with isolated() as h:
            pid = await h.seed(profile_type, str(user_id))
            h.writes.clear()
            response = await h.request(f"/my-profiles/{pid}", user_id=user_id)
            if profile_type == "individual":
                assert response.status_code == 200, response.text
                result = ProfileResponse.model_validate(response.json())
                assert (result.id, result.profile_type, result.target_id) == (pid, "individual", str(user_id))
                assert result.result_text == f"SYNTHETIC PRIVATE individual {user_id}"
                assert result.scores == '{"dimensions":{"synthetic":73}}'
                assert result.config_title == "Synthetic profile assessment"
                assert result.created_by_user_id == 104
            else:
                assert response.status_code == 403, response.text
                assert response.json() == {"detail": "无权查看此画像"}
            assert h.reads  # Real get_profile executed SQL, not a mocked profile object.
            assert h.writes == []
    asyncio.run(scenario())


@pytest.mark.parametrize("user_id", ALLOWED_USERS)
@pytest.mark.parametrize("profile_type", PROFILE_TYPES)
def test_other_target_is_forbidden_on_personal_route(isolated, user_id, profile_type):
    async def scenario():
        async with isolated() as h:
            other = 102 if user_id != 102 else 101
            pid = await h.seed(profile_type, str(other))
            response = await h.request(f"/my-profiles/{pid}", user_id=user_id)
            assert response.status_code == 403, response.text
            assert response.json() == {"detail": "无权查看此画像"}
    asyncio.run(scenario())


def test_my_list_and_detail_agree_despite_colliding_targets(isolated):
    async def scenario():
        async with isolated() as h:
            own = await h.seed()
            for kind in PROFILE_TYPES:
                await h.seed(kind, "102")
                if kind != "individual":
                    await h.seed(kind, "101")
            response = await h.request("/my-profiles")
            assert response.status_code == 200, response.text
            result = ProfileListResponse.model_validate(response.json())
            assert result.total == 1
            assert [item.id for item in result.items] == [own]
            detail = await h.request(f"/my-profiles/{own}")
            assert detail.status_code == 200
            assert detail.json() == response.json()["items"][0]
    asyncio.run(scenario())


@pytest.mark.parametrize("user_id", [104, 105], ids=["admin", "super_admin"])
@pytest.mark.parametrize("profile_type", PROFILE_TYPES)
def test_admin_detail_retains_cross_target_access(isolated, user_id, profile_type):
    async def scenario():
        async with isolated() as h:
            pid = await h.seed(profile_type)
            h.writes.clear()
            response = await h.request(f"/admin/profiles/{pid}", user_id=user_id)
            assert response.status_code == 200, response.text
            result = ProfileResponse.model_validate(response.json())
            assert (result.id, result.profile_type, result.target_id) == (pid, profile_type, "101")
            assert result.result_text == f"SYNTHETIC PRIVATE {profile_type} 101"
            assert result.config_title == "Synthetic profile assessment"
            assert result.creator_name == "Synthetic 104"
            assert h.reads and not h.writes
    asyncio.run(scenario())


@pytest.mark.parametrize("route,user_id,status,detail,exists", [
    (*case, exists)
    for case in [
    *[("my-profiles", uid, 404, "画像不存在") for uid in ALLOWED_USERS],
    ("admin/profiles", 104, 404, "画像不存在"),
    ("admin/profiles", 105, 404, "画像不存在"),
    ("my-profiles", None, 401, "未提供认证令牌"),
    ("admin/profiles", None, 401, "未提供认证令牌"),
    ("my-profiles", 106, 403, "需要学生或教职工权限"),
    *[("admin/profiles", uid, 403, "需要管理员权限") for uid in (101, 103, 106)],
    ]
    for exists in (False, True) if not (exists and case[2] == 404)
])
def test_not_found_and_permission_contract(isolated, route, user_id, status, detail, exists):
    async def scenario():
        async with isolated() as h:
            # Authorized existing cases are covered above; here also check missing
            # IDs do not bypass role/auth guards or reveal resource existence.
            pid = await h.seed() if exists else 999999
            response = await h.request(f"/{route}/{pid}", user_id=user_id)
            assert response.status_code == status, response.text
            assert response.json() == {"detail": detail}
            if status != 404:
                assert not h.reads  # Permission guard rejects before profile lookup.
    asyncio.run(scenario())
