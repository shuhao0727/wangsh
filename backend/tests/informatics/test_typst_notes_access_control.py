"""Informatics Typst 笔记端点行为级越权测试（审计 T-1）。

typst_notes.py 全量 require_staff 端点。审计基线记为 13，当前源码实为 15
（新增 compile-async / compile-jobs 两组）；本文件按实际路由全量覆盖，末尾
一致性用例保证测试表与路由表同步。

角色矩阵（TestClient + dependency_overrides，模式同 tests/it/test_games_api.py）：
  - student / guest → 403（require_staff 拒绝，守卫先于业务逻辑执行）
  - teacher / admin / super_admin → 守卫放行（业务码 200/4xx，绝不为 401/403）
  - 未认证（无 token，走真实 get_current_user）→ 401

读端点与写端点分别成组；rate_limiter、celery（AsyncResult / control / task.delay）
全部替换为 no-op，避免 Redis / broker 环境依赖。
"""

from datetime import datetime
import re
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.core.deps as deps
from app.api.endpoints.informatics import typst_notes as typst_api
from app.db.database import get_db

PREFIX = "/informatics/typst-notes"
_NOW = datetime(2026, 1, 1, 0, 0, 0)

_ROLE_IDS = {
    "student": 100,
    "teacher": 200,
    "admin": 300,
    "super_admin": 400,
    "guest": 500,
}

ALLOWED_ROLES = ["teacher", "admin", "super_admin"]


def _user(role_code):
    return {
        "id": _ROLE_IDS[role_code],
        "role_code": role_code,
        "full_name": role_code,
        "is_active": True,
    }


def _note(**overrides):
    base = dict(
        id=1,
        title="测试笔记",
        summary="",
        category_path="",
        published=False,
        published_at=None,
        style_key="my_style",
        entry_path="main.typ",
        files={},
        toc=[],
        content_typst="#test",
        created_by_id=1,
        compiled_hash=None,
        compiled_at=None,
        created_at=_NOW,
        updated_at=_NOW,
        compiled_pdf=None,
        compiled_pdf_path=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _asset(**overrides):
    base = dict(
        id=1,
        path="a.txt",
        mime="text/plain",
        sha256=None,
        size_bytes=7,
        uploaded_by_id=1,
        created_at=_NOW,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


class _NoopLimiter:
    async def check(self, *_args, **_kwargs):
        return None


class _NoopControl:
    def revoke(self, *_args, **_kwargs):
        return None


# (用例名, HTTP 方法, 相对路径, 请求参数, fake 类型)
TYPST_READ_ENDPOINTS = [
    ("list_notes", "get", "", {}, "list"),
    ("get_note", "get", "/1", {}, "get_note"),
    ("list_assets", "get", "/1/assets", {}, "assets"),
    ("download_asset", "get", "/1/assets/1", {}, "asset"),
    ("export_typ", "get", "/1/export.typ", {}, "get_note"),
    ("compile_job_status", "get", "/compile-jobs/1", {}, "job_status"),
    ("export_pdf", "get", "/1/export.pdf", {}, "export_pdf"),
]

TYPST_WRITE_ENDPOINTS = [
    ("create_note", "post", "", {"json": {"title": "新笔记"}}, "create"),
    ("update_note", "put", "/1", {"json": {"title": "改名"}}, "update"),
    (
        "upload_asset",
        "post",
        "/1/assets",
        {"data": {"path": "a.txt"}, "files": {"file": ("a.txt", b"content", "text/plain")}},
        "upload",
    ),
    ("delete_asset", "delete", "/1/assets/1", {}, "delete_asset"),
    ("delete_note", "delete", "/1", {}, "delete_note"),
    ("compile", "post", "/1/compile", {}, "compile"),
    ("compile_async", "post", "/1/compile-async", {}, "compile_async"),
    ("cancel_compile_job", "post", "/compile-jobs/1/cancel", {}, "cancel_job"),
]

TYPST_ENDPOINTS = [
    ("read", *case) for case in TYPST_READ_ENDPOINTS
] + [("write", *case) for case in TYPST_WRITE_ENDPOINTS]


def _patch_services(monkeypatch, case):
    kind = case[5]
    svc = typst_api

    if kind == "list":
        async def _fake(*_args, **_kwargs):
            return []

        monkeypatch.setattr(svc, "list_notes", _fake)
    elif kind == "get_note":
        async def _fake(*_args, **_kwargs):
            return _note()

        monkeypatch.setattr(svc, "get_note", _fake)
    elif kind == "assets":
        async def _fake_note(*_args, **_kwargs):
            return _note()

        async def _fake_assets(*_args, **_kwargs):
            return []

        monkeypatch.setattr(svc, "get_note", _fake_note)
        monkeypatch.setattr(svc, "list_assets", _fake_assets)
    elif kind == "asset":
        async def _fake_note(*_args, **_kwargs):
            return _note()

        async def _fake_asset(*_args, **_kwargs):
            return _asset()

        monkeypatch.setattr(svc, "get_note", _fake_note)
        monkeypatch.setattr(svc, "get_asset", _fake_asset)
    elif kind == "create":
        async def _fake(*_args, **_kwargs):
            return _note()

        monkeypatch.setattr(svc, "create_note", _fake)
        monkeypatch.setattr(svc, "update_note", _fake)
    elif kind == "update":
        async def _fake_note(*_args, **_kwargs):
            return _note()

        async def _fake_update(*_args, **_kwargs):
            return _note()

        monkeypatch.setattr(svc, "get_note", _fake_note)
        monkeypatch.setattr(svc, "update_note", _fake_update)
    elif kind == "upload":
        monkeypatch.setattr(svc, "rate_limiter", _NoopLimiter())

        def _fake_validate(path, filename, content_type, content, max_bytes, allowed_exts):
            return path, content_type or "application/octet-stream"

        async def _fake_note(*_args, **_kwargs):
            return _note()

        async def _fake_upsert(*_args, **_kwargs):
            return _asset()

        monkeypatch.setattr(svc, "validate_asset_upload", _fake_validate)
        monkeypatch.setattr(svc, "get_note", _fake_note)
        monkeypatch.setattr(svc, "upsert_asset", _fake_upsert)
    elif kind == "delete_asset":
        async def _fake_note(*_args, **_kwargs):
            return _note()

        async def _fake_del(*_args, **_kwargs):
            return None

        monkeypatch.setattr(svc, "get_note", _fake_note)
        monkeypatch.setattr(svc, "delete_asset", _fake_del)
    elif kind == "delete_note":
        async def _fake_note(*_args, **_kwargs):
            return _note()

        async def _fake_del(*_args, **_kwargs):
            return None

        monkeypatch.setattr(svc, "get_note", _fake_note)
        monkeypatch.setattr(svc, "delete_note", _fake_del)
    elif kind == "compile":
        monkeypatch.setattr(svc, "rate_limiter", _NoopLimiter())
        monkeypatch.setattr(svc.settings, "TYPST_COMPILE_USE_CELERY", False)

        async def _fake_note(*_args, **_kwargs):
            return _note()

        async def _fake_compile(*_args, **_kwargs):
            return b"%PDF-1.4-fake", {}

        monkeypatch.setattr(svc, "get_note", _fake_note)
        monkeypatch.setattr(svc, "compile_note_pdf", _fake_compile)
    elif kind == "compile_async":
        monkeypatch.setattr(svc, "rate_limiter", _NoopLimiter())
        monkeypatch.setattr(svc.settings, "TYPST_COMPILE_USE_CELERY", True)

        async def _fake_note(*_args, **_kwargs):
            return _note()

        monkeypatch.setattr(svc, "get_note", _fake_note)
        monkeypatch.setattr(
            svc.compile_typst_note,
            "delay",
            lambda _note_id: SimpleNamespace(id="job-1"),
        )
    elif kind == "job_status":
        monkeypatch.setattr(
            svc.celery,
            "AsyncResult",
            lambda _job_id: SimpleNamespace(state="PENDING", info=None),
        )
    elif kind == "export_pdf":
        async def _fake(*_args, **_kwargs):
            return _note(compiled_pdf=b"%PDF-1.4-fake")

        monkeypatch.setattr(svc, "get_note", _fake)
    elif kind == "cancel_job":
        monkeypatch.setattr(svc.celery, "control", _NoopControl())


def _make_app(user=None):
    app = FastAPI()
    app.include_router(typst_api.router)

    async def _fake_db():
        return object()

    app.dependency_overrides[get_db] = _fake_db
    if user is not None:
        async def _current_user():
            return user

        app.dependency_overrides[deps.get_current_user] = _current_user
    return app


def _request(client, case):
    method, path, kwargs = case[2], PREFIX + case[3], case[4]
    return getattr(client, method)(path, **kwargs)


@pytest.mark.parametrize(
    "case", TYPST_ENDPOINTS, ids=[f"{c[0]}-{c[1]}" for c in TYPST_ENDPOINTS]
)
@pytest.mark.parametrize("role_code", ALLOWED_ROLES)
def test_require_staff_allows_role(monkeypatch, case, role_code):
    _patch_services(monkeypatch, case)
    client = TestClient(_make_app(_user(role_code)), raise_server_exceptions=False)

    response = _request(client, case)

    assert response.status_code not in (401, 403), (
        f"{case[1]} role={role_code} status={response.status_code} body={response.text[:200]}"
    )


@pytest.mark.parametrize(
    "case", TYPST_ENDPOINTS, ids=[f"{c[0]}-{c[1]}" for c in TYPST_ENDPOINTS]
)
@pytest.mark.parametrize("role_code", ["student", "guest"])
def test_require_staff_rejects_student_and_guest(case, role_code):
    # 不替换业务服务：守卫必须在业务逻辑执行前拒绝
    client = TestClient(_make_app(_user(role_code)), raise_server_exceptions=False)

    response = _request(client, case)

    assert response.status_code == 403


@pytest.mark.parametrize(
    "case", TYPST_ENDPOINTS, ids=[f"{c[0]}-{c[1]}" for c in TYPST_ENDPOINTS]
)
def test_require_staff_rejects_unauthenticated(case):
    # 不覆盖 get_current_user：真实链路，无 token → 401
    client = TestClient(_make_app(None), raise_server_exceptions=False)

    response = _request(client, case)

    assert response.status_code == 401


def test_all_typst_notes_routes_are_covered():
    covered = {(case[2].upper(), PREFIX + case[3]) for case in TYPST_ENDPOINTS}
    actual = set()
    for route in typst_api.router.routes:
        methods = {
            m
            for m in (getattr(route, "methods", None) or ())
            if m in ("GET", "POST", "PUT", "DELETE", "PATCH")
        }
        if not methods:
            continue
        # 路由模板路径（/{note_id}/...）归一化为测试表使用的具体路径
        path = re.sub(r"\{[^}]+\}", "1", route.path)
        actual.add((sorted(methods)[0], path))
    assert covered == actual
