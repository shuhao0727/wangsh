"""自主检测学生端 10 端点行为级越权测试（审计 T-1）。

覆盖 assessment/student.py:38-279 全部 require_student_or_staff 端点
（审计基线 10 个，无一例外）。测试模式采用 TestClient + dependency_overrides
（同 tests/it/test_games_api.py）：覆盖 deps.get_current_user 注入各角色 fake
UserInfo，require_student_or_staff 守卫本身跑真实代码；未认证用例不覆盖
get_current_user，走真实"无 token → 401"链路。业务服务用最小 fake 替换，
重点断言**守卫行为**而非业务数据正确性：

  - student / teacher / admin / super_admin → 守卫放行（业务码 200/4xx，绝不为 401/403）
  - guest → 403（require_student_or_staff 语义：student/teacher/admin/super_admin 之外拒绝）
  - 未认证（无 token）→ 401

末尾一致性用例保证：测试表与 student_api.router 路由表同步，后续新增端点
必须补充用例。
"""

from datetime import datetime
import re
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.core.deps as deps
from app.api.endpoints.assessment import student as student_api
from app.db.database import get_db
from app.services.assessment import session_service as session_service_mod

PREFIX = "/assessment"

_ROLE_IDS = {
    "student": 100,
    "teacher": 200,
    "admin": 300,
    "super_admin": 400,
    "guest": 500,
}

ALLOWED_ROLES = ["student", "teacher", "admin", "super_admin"]

# (用例名, HTTP 方法, 相对路径, 请求参数, 被替换的服务属性, fake 类型)
# fake 类型: list=[] / dict={} / profile_list=([],0) / basic_profile=按用户构造画像
#           / none_profile=None / none=不替换服务（fake DB 直查返回空 → 业务 404）
ASSESSMENT_ENDPOINTS = [
    ("available", "get", "/available", {}, "get_available_configs", "list"),
    ("start_session", "post", "/sessions/start", {"json": {"config_id": 1}}, "start_session", "dict"),
    ("questions", "get", "/sessions/1/questions", {}, "get_session_questions", "dict"),
    ("answer", "post", "/sessions/1/answer", {"json": {"answer_id": 1, "student_answer": "A"}}, "submit_answer", "dict"),
    ("submit", "post", "/sessions/1/submit", {}, "submit_session", "dict"),
    ("result", "get", "/sessions/1/result", {}, "get_session_result", "dict"),
    ("basic_profile", "get", "/sessions/1/basic-profile", {}, "get_basic_profile", "basic_profile"),
    ("profile_status", "get", "/sessions/1/profile-status", {}, None, "none"),
    ("my_profiles", "get", "/my-profiles", {}, "get_my_profiles", "profile_list"),
    ("my_profile_detail", "get", "/my-profiles/1", {}, "get_profile", "none_profile"),
]


def _user(role_code):
    return {
        "id": _ROLE_IDS[role_code],
        "role_code": role_code,
        "full_name": role_code,
        "is_active": True,
    }


class _FakeResult:
    def scalar_one_or_none(self):
        return None


class _FakeDB:
    """最小 fake DB：profile-status 等直查端点在空结果下返回业务 404。"""

    def __init__(self, current_user_id=None):
        self.current_user_id = current_user_id

    async def execute(self, _stmt):
        return _FakeResult()


def _patch_services(monkeypatch, fake_db, case):
    _, _, _, _, service_attr, kind = case
    if kind == "none":
        return

    if kind == "list":
        async def _fake(*_args, **_kwargs):
            return []
    elif kind == "dict":
        async def _fake(*_args, **_kwargs):
            return {}
    elif kind == "profile_list":
        async def _fake(*_args, **_kwargs):
            return [], 0
    elif kind == "basic_profile":
        async def _fake(_db, session_id):
            return SimpleNamespace(
                id=1,
                session_id=session_id,
                user_id=_db.current_user_id,
                config_id=1,
                earned_score=0,
                total_score=100,
                knowledge_scores={},
                wrong_points=[],
                ai_summary=None,
                created_at=datetime(2026, 1, 1),
            )

        async def _fake_rates(*_args, **_kwargs):
            return {}

        monkeypatch.setattr(session_service_mod, "_calc_knowledge_rates", _fake_rates)
    elif kind == "none_profile":
        async def _fake(*_args, **_kwargs):
            return None
    monkeypatch.setattr(student_api, service_attr, _fake)


def _make_app(user=None, fake_db=None):
    app = FastAPI()
    app.include_router(student_api.router, prefix=PREFIX)

    async def _fake_db():
        return fake_db

    app.dependency_overrides[get_db] = _fake_db
    if user is not None:
        async def _current_user():
            return user

        app.dependency_overrides[deps.get_current_user] = _current_user
    return app


def _request(client, case):
    method, path, kwargs = case[1], PREFIX + case[2], case[3]
    return getattr(client, method)(path, **kwargs)


@pytest.mark.parametrize(
    "case", ASSESSMENT_ENDPOINTS, ids=[c[0] for c in ASSESSMENT_ENDPOINTS]
)
@pytest.mark.parametrize("role_code", ALLOWED_ROLES)
def test_require_student_or_staff_allows_role(monkeypatch, case, role_code):
    user = _user(role_code)
    fake_db = _FakeDB(current_user_id=user["id"])
    _patch_services(monkeypatch, fake_db, case)
    client = TestClient(_make_app(user, fake_db), raise_server_exceptions=False)

    response = _request(client, case)

    assert response.status_code not in (401, 403), (
        f"{case[0]} role={role_code} status={response.status_code} body={response.text[:200]}"
    )


@pytest.mark.parametrize(
    "case", ASSESSMENT_ENDPOINTS, ids=[c[0] for c in ASSESSMENT_ENDPOINTS]
)
def test_require_student_or_staff_rejects_guest(case):
    # 不替换业务服务：守卫必须在业务逻辑执行前拒绝 guest
    client = TestClient(_make_app(_user("guest"), _FakeDB()), raise_server_exceptions=False)

    response = _request(client, case)

    assert response.status_code == 403


@pytest.mark.parametrize(
    "case", ASSESSMENT_ENDPOINTS, ids=[c[0] for c in ASSESSMENT_ENDPOINTS]
)
def test_require_student_or_staff_rejects_unauthenticated(case):
    # 不覆盖 get_current_user：真实链路，无 token → 401
    client = TestClient(_make_app(None, _FakeDB()), raise_server_exceptions=False)

    response = _request(client, case)

    assert response.status_code == 401


def test_all_assessment_student_routes_are_covered():
    covered = {(case[1].upper(), case[2]) for case in ASSESSMENT_ENDPOINTS}
    actual = set()
    for route in student_api.router.routes:
        methods = {
            m
            for m in (getattr(route, "methods", None) or ())
            if m in ("GET", "POST", "PUT", "DELETE", "PATCH")
        }
        if not methods:
            continue
        # 路由模板路径（/sessions/{session_id}/...）归一化为测试表使用的具体路径
        path = re.sub(r"\{[^}]+\}", "1", route.path)
        actual.add((sorted(methods)[0], path))
    assert covered == actual
