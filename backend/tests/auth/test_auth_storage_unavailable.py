"""Initial identity storage failures: narrow 503, never a claims-only identity.

Run under the external no-dotenv/no-network harness. These are real JWT and
ASGI dependency tests with injected DB errors; real PG evidence is separate.
"""
import asyncio
import errno
import socket
from types import SimpleNamespace

import asyncpg
import httpx
import pytest
from fastapi import Depends, FastAPI
from sqlalchemy import exc as sa_exc

from app.core import deps
from app.core.config import settings
from app.services import auth


def admission_error(severity="FATAL"):
    error = asyncpg.ObjectNotInPrerequisiteStateError("synthetic unavailable")
    error.severity = severity
    error.severity_en = severity
    return error


def wrapped(error, invalidated=False):
    return sa_exc.DBAPIError(None, None, error, connection_invalidated=invalidated)


TEMPORARY = [
    ("pg_admission_55000", lambda: admission_error()),
    ("pg_connect_now", lambda: asyncpg.CannotConnectNowError("synthetic")),
    ("pg_capacity", lambda: asyncpg.TooManyConnectionsError("synthetic")),
    ("pg_shutdown", lambda: asyncpg.AdminShutdownError("synthetic")),
    ("pg_crash", lambda: asyncpg.CrashShutdownError("synthetic")),
    ("pg_connection_gone", lambda: asyncpg.ConnectionDoesNotExistError("synthetic")),
    ("wrapped_admission", lambda: wrapped(admission_error())),
    ("wrapped_disconnect", lambda: wrapped(asyncpg.ConnectionFailureError("synthetic"))),
    ("dialect_invalidated", lambda: wrapped(Exception("synthetic"), True)),
    ("pool_timeout", lambda: sa_exc.TimeoutError("synthetic")),
    ("connect_timeout", lambda: TimeoutError("synthetic")),
    ("connection_refused", lambda: ConnectionRefusedError(errno.ECONNREFUSED, "synthetic")),
    ("connection_reset", lambda: ConnectionResetError(errno.ECONNRESET, "synthetic")),
    ("network_unreachable", lambda: OSError(errno.ENETUNREACH, "synthetic")),
    ("dns_temporary", lambda: socket.gaierror(socket.EAI_AGAIN, "synthetic DNS diagnostics")),
    ("wrapped_dns_temporary", lambda: wrapped(socket.gaierror(socket.EAI_AGAIN, "synthetic DNS diagnostics"))),
]
NOT_TEMPORARY = [
    ("runtime_bug", lambda: RuntimeError("synthetic")),
    ("type_bug", lambda: TypeError("synthetic")),
    ("value_bug", lambda: ValueError("synthetic")),
    ("file_missing", lambda: FileNotFoundError(errno.ENOENT, "synthetic")),
    ("os_permission", lambda: PermissionError(errno.EACCES, "synthetic")),
    ("dns_name_missing", lambda: socket.gaierror(socket.EAI_NONAME, "synthetic")),
    ("dns_permanent", lambda: socket.gaierror(socket.EAI_FAIL, "synthetic")),
    ("dns_unknown_code", lambda: socket.gaierror(987654, "synthetic")),
    ("wrapped_dns_name_missing", lambda: wrapped(socket.gaierror(socket.EAI_NONAME, "synthetic"))),
    ("wrapped_dns_permanent", lambda: wrapped(socket.gaierror(socket.EAI_FAIL, "synthetic"))),
    ("non_dns_same_errno", lambda: OSError(socket.EAI_AGAIN, "synthetic")),
    ("wrapped_non_dns_same_errno", lambda: wrapped(OSError(socket.EAI_AGAIN, "synthetic"))),
    ("pg_state_statement", lambda: admission_error("ERROR")),
    ("pg_state_unknown_severity", lambda: asyncpg.ObjectNotInPrerequisiteStateError("synthetic")),
    ("pg_syntax", lambda: asyncpg.PostgresSyntaxError("synthetic")),
    ("pg_table_missing", lambda: asyncpg.UndefinedTableError("synthetic")),
    ("pg_integrity", lambda: asyncpg.UniqueViolationError("synthetic")),
    ("pg_permission", lambda: asyncpg.InsufficientPrivilegeError("synthetic")),
    ("pg_auth_config", lambda: asyncpg.InvalidPasswordError("synthetic")),
    ("pg_query_cancel", lambda: asyncpg.QueryCanceledError("synthetic")),
    ("sa_programming", lambda: sa_exc.ProgrammingError(None, None, Exception("synthetic"))),
    ("sa_integrity", lambda: sa_exc.IntegrityError(None, None, Exception("synthetic"))),
    ("sa_operational_unknown", lambda: sa_exc.OperationalError(None, None, Exception("synthetic"))),
    ("sa_statement", lambda: sa_exc.StatementError("synthetic", None, None, TypeError())),
    ("wrapped_statement_55000", lambda: wrapped(admission_error("ERROR"))),
    ("wrapped_syntax", lambda: wrapped(asyncpg.PostgresSyntaxError("synthetic"))),
]


class DB:
    def __init__(self, error=None):
        self.error = error
        self.calls = 0

    async def execute(self, query):
        self.calls += 1
        if self.error is not None:
            raise self.error
        return SimpleNamespace(scalar_one_or_none=lambda: None)


def app_for(db):
    app = FastAPI()

    async def database():
        yield db

    app.dependency_overrides[deps.get_db] = database

    @app.get("/mandatory")
    async def mandatory(user=Depends(deps.get_current_user)):
        return {"id": user["id"]}

    @app.get("/optional")
    async def optional(user=Depends(deps.get_current_user_or_none)):
        return {"id": user["id"] if user else None}

    @app.get("/sse-admission")
    async def sse(user=Depends(deps.get_current_user_sse)):
        return {"id": user["id"]}

    return app


async def request(db, path, credential="valid", *, raise_errors=False):
    token = auth.create_access_token({"sub": "synthetic-storage-user", "role_code": "student"})
    headers = {}
    if credential == "valid":
        headers["Authorization"] = "Bearer " + token
    elif credential == "invalid":
        headers["Authorization"] = "Bearer synthetic-not-a-jwt"
    elif credential == "fallback":
        headers.update(Authorization="Bearer synthetic-not-a-jwt", Cookie=settings.ACCESS_TOKEN_COOKIE_NAME + "=" + token)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app_for(db), raise_app_exceptions=raise_errors),
        base_url="http://isolated.invalid",
    ) as client:
        return await client.get(path, headers=headers)


@pytest.mark.parametrize("case,factory", TEMPORARY, ids=[x[0] for x in TEMPORARY])
@pytest.mark.parametrize("path,credential", [
    ("/mandatory", "valid"), ("/mandatory", "fallback"),
    ("/optional", "valid"), ("/sse-admission", "valid"),
])
def test_temporary_identity_storage_is_503(case, factory, path, credential):
    db = DB(factory())
    response = asyncio.run(request(db, path, credential))
    assert response.status_code == 503
    assert response.json() == {"detail": "无法核验身份，请稍后重试"}
    assert db.calls == 1
    assert "set-cookie" not in response.headers


@pytest.mark.parametrize("case,factory", NOT_TEMPORARY, ids=[x[0] for x in NOT_TEMPORARY])
@pytest.mark.parametrize("credential", ["valid", "fallback"])
def test_programming_and_unclassified_errors_propagate(case, factory, credential):
    error = factory()
    with pytest.raises(type(error)) as caught:
        asyncio.run(request(DB(error), "/mandatory", credential, raise_errors=True))
    assert caught.value is error


@pytest.mark.parametrize("credential", ["invalid", "missing"])
@pytest.mark.parametrize("path", ["/mandatory", "/optional", "/sse-admission"])
def test_invalid_credentials_never_query_unavailable_store(credential, path):
    db = DB(admission_error())
    response = asyncio.run(request(db, path, credential))
    assert response.status_code == (200 if path == "/optional" else 401)
    if path == "/optional":
        assert response.json() == {"id": None}
    assert db.calls == 0


@pytest.mark.parametrize("path", ["/mandatory", "/optional", "/sse-admission"])
def test_nonexistent_user_does_not_become_503_or_identity(path):
    db = DB()
    response = asyncio.run(request(db, path))
    assert response.status_code == (200 if path == "/optional" else 401)
    assert db.calls == 1
    assert response.json().get("id") is None


@pytest.mark.parametrize("temporary", [True, False])
def test_sqlalchemy_asyncpg_adapter_preserves_driver_classification(temporary):
    from sqlalchemy.dialects.postgresql.asyncpg import AsyncAdapt_asyncpg_dbapi

    driver = admission_error("FATAL" if temporary else "ERROR")
    adapter = AsyncAdapt_asyncpg_dbapi.Error("synthetic adapter")
    adapter.__cause__ = driver
    error = wrapped(adapter)
    if temporary:
        response = asyncio.run(request(DB(error), "/mandatory"))
        assert response.status_code == 503
    else:
        with pytest.raises(sa_exc.DBAPIError) as caught:
            asyncio.run(request(DB(error), "/mandatory", raise_errors=True))
        assert caught.value is error


def test_runtime_error_caused_by_transport_failure_is_not_swallowed():
    error = RuntimeError("synthetic programming failure")
    error.__cause__ = admission_error()
    with pytest.raises(RuntimeError) as caught:
        asyncio.run(request(DB(error), "/mandatory", raise_errors=True))
    assert caught.value is error


def test_unclassified_protocol_error_is_not_temporary():
    error = asyncpg.ProtocolViolationError("synthetic protocol misuse")
    with pytest.raises(asyncpg.ProtocolViolationError) as caught:
        asyncio.run(request(DB(error), "/mandatory", raise_errors=True))
    assert caught.value is error


@pytest.mark.parametrize("outer", [RuntimeError, TypeError])
def test_programming_error_caused_by_dns_failure_is_not_swallowed(outer):
    error = outer("synthetic programming failure")
    error.__cause__ = socket.gaierror(socket.EAI_AGAIN, "synthetic")
    with pytest.raises(outer) as caught:
        asyncio.run(request(DB(error), "/mandatory", raise_errors=True))
    assert caught.value is error


@pytest.mark.parametrize("wrapper", [sa_exc.ProgrammingError, sa_exc.IntegrityError, sa_exc.DataError])
def test_sql_error_wrapping_dns_failure_is_not_temporary(wrapper):
    error = wrapper(None, None, socket.gaierror(socket.EAI_AGAIN, "synthetic"))
    with pytest.raises(wrapper) as caught:
        asyncio.run(request(DB(error), "/mandatory", raise_errors=True))
    assert caught.value is error
