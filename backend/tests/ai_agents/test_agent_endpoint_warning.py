"""保存端点软校验的自含隔离回归，不导入正常 app / Settings / conftest。

仅用标准库，运行实际 ai_agent / endpoint_security / 白名单匹配源码；其余依赖合成。
直接运行（不用 pytest，也不加载 site / 插件，不生成缓存）：
  env -i PATH=/usr/bin:/bin PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 \
    backend/venv/bin/python -I -B -S backend/tests/ai_agents/test_agent_endpoint_warning.py
"""

import asyncio
from contextlib import ExitStack
import importlib.abc
import importlib.util
import ipaddress
import linecache
import os
from pathlib import Path
import socket
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch


_ROOT = Path(__file__).resolve().parents[2]
_SOURCES = {
    "app.core.config._services": _ROOT / "app/core/config/_services.py",
    "app.services.agents.endpoint_security": _ROOT / "app/services/agents/endpoint_security.py",
    "app.services.agents.ai_agent": _ROOT / "app/services/agents/ai_agent.py",
}
_SECRETS = ("USER_SECRET", "KEY_SECRET", "PATH_SECRET", "QUERY_SECRET", "FRAGMENT_SECRET",
            "ERROR_SECRET", "NAME_SECRET", "HOST_SECRET")
_SECRET_URL = ("http://USER_SECRET:KEY_SECRET@192.168.1.5/PATH_SECRET"
               "?key=QUERY_SECRET#FRAGMENT_SECRET")


class _IsolationGuard(importlib.abc.MetaPathFinder):
    """导入前生效；不准读业务文件/配置、外连或意外加载正常 app。"""

    def __init__(self):
        self.active = True
        self.blocked = []
        self.stdlib = Path(asyncio.__file__).resolve().parent.parent
        self.sources = {*_SOURCES.values(), Path(__file__).resolve()}

    def deny(self, reason):
        self.blocked.append(reason)
        raise PermissionError("endpoint-warning isolation: " + reason)

    def find_spec(self, fullname, path=None, target=None):
        if fullname.split(".")[0] in {
            "app", "dotenv", "pydantic_settings", "pytest", "sqlalchemy",
            "asyncpg", "redis", "httpx", "requests",
        }:
            self.deny("unexpected import")
        return None

    def audit(self, event, args):
        if not self.active:
            return
        if event in {"socket.connect", "socket.bind", "socket.getaddrinfo",
                     "socket.gethostbyname", "socket.gethostbyaddr", "socket.sendto",
                     "socket.sendmsg", "subprocess.Popen", "os.system"}:
            self.deny("network/DNS/process")
        if event != "open":
            return
        path, mode, flags = args
        if isinstance(path, int):
            return
        path = Path(os.fsdecode(path)).absolute()
        if any(part.lower().startswith((".env", ".secrets")) for part in path.parts):
            self.deny("dotenv/secrets read")
        if flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND):
            self.deny("file write")
        if path not in self.sources and not path.is_relative_to(self.stdlib):
            self.deny("unexpected file read: " + str(path))


class _Column:
    def __eq__(self, other):
        return self

    def __ne__(self, other):
        return self


class _Agent:
    id = name = is_deleted = _Column()

    def __init__(self, **values):
        self.__dict__.update(values)


class _Query:
    def where(self, *args):
        return self


class _Update:
    def __init__(self, **values):
        self.values = values
        self.name = values.get("name")

    def model_dump(self, **kwargs):
        return self.values.copy()


class _Cache(dict):
    def __init__(self, **kwargs):
        super().__init__()


def _unused(*args, **kwargs):
    raise AssertionError("unrelated business dependency called")


def _module(name, **attrs):
    module = ModuleType(name)
    module.__path__ = []
    module.__dict__.update(attrs)
    sys.modules[name] = module
    return module


def _load_source(name):
    spec = importlib.util.spec_from_file_location(name, _SOURCES[name])
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    # exec_module 即使 -B 也可能先读旧 pyc；显式编译目标源码以固定本轮基线。
    exec(compile(_SOURCES[name].read_text(), str(_SOURCES[name]), "exec"), module.__dict__)
    return module


def setUpModule():
    global _STACK, _GUARD, _SETTINGS, _LOG, _SECURITY, _SERVICE
    if not (sys.flags.isolated and sys.flags.dont_write_bytecode and sys.flags.no_site):
        raise RuntimeError("Use the trusted venv interpreter with -I -B -S")
    if any(name == "app" or name.startswith("app.") for name in sys.modules):
        raise RuntimeError("normal app was already imported")
    _STACK = ExitStack()
    _GUARD = _IsolationGuard()
    sys.addaudithook(_GUARD.audit)
    sys.meta_path.insert(0, _GUARD)
    _STACK.callback(sys.meta_path.remove, _GUARD)
    _STACK.enter_context(patch.dict(os.environ, {"PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1"}, clear=True))
    _STACK.enter_context(patch.dict(sys.modules))
    getlines = linecache.getlines
    _STACK.enter_context(patch.object(linecache, "getlines", side_effect=lambda filename, *args:
        [] if filename.startswith("<") and filename.endswith(">") else getlines(filename, *args)))
    try:
        for name in ("app", "app.core", "app.models", "app.schemas", "app.utils",
                     "app.services", "app.services.agents", "sqlalchemy", "sqlalchemy.ext"):
            _module(name)
        _SETTINGS = SimpleNamespace(AGENT_CACHE_MAXSIZE=8, AGENT_CACHE_TTL=5,
                                    AGENT_TRUSTED_INTERNAL_ENDPOINTS="",
                                    _env_file=None, _secrets_dir=None)
        _LOG = Mock()
        _module("app.core.config", settings=_SETTINGS)
        _module("loguru", logger=_LOG)
        _module("cachetools", TTLCache=_Cache)
        _module("sqlalchemy.ext.asyncio", AsyncSession=object)
        _module("sqlalchemy", select=lambda *args: _Query(), func=SimpleNamespace(),
                and_=lambda *args: args, or_=lambda *args: args,
                inspect=lambda obj: SimpleNamespace(mapper=SimpleNamespace(
                    column_attrs=[SimpleNamespace(key=k) for k in vars(obj)])))
        _module("app.models.agents", AIAgent=_Agent)
        _module("app.schemas.agents", **dict.fromkeys(("AIAgentCreate", "AIAgentUpdate",
                "AgentTestRequest", "AgentTestResponse", "AgentStatisticsData"), object))
        _module("app.utils.agent_secrets", encrypt_api_key=_unused,
                last4=lambda value: value[-4:] if value else None)
        _module("app.services.agents.agent_testing", **dict.fromkeys((
            "AgentProviderContext", "build_provider_context", "build_test_headers",
            "display_test_message", "elapsed_ms", "join_api_url", "model_display_name",
            "resolve_provider_type", "resolve_test_endpoint", "test_basic_endpoint",
            "test_models_endpoint"), _unused))
        _module("pydantic", Field=lambda default=None, **kwargs: default,
                field_validator=lambda *args, **kwargs: lambda fn: fn)
        _load_source("app.core.config._services")
        _SECURITY = _load_source("app.services.agents.endpoint_security")
        _SERVICE = _load_source("app.services.agents.ai_agent")
        if _GUARD.blocked:
            raise RuntimeError("isolation violation while loading sources")
    except BaseException:
        tearDownModule()
        raise


def tearDownModule():
    _GUARD.active = False
    _STACK.close()


class EndpointWarningTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        _LOG.reset_mock(side_effect=True)
        _SETTINGS.AGENT_TRUSTED_INTERNAL_ENDPOINTS = ""
        _SECURITY.reset_trusted_endpoint_cache()
        _SERVICE._AGENT_CACHE.clear()
        self.expected_blocks = len(_GUARD.blocked)

    def tearDown(self):
        self.assertEqual(len(_GUARD.blocked), self.expected_blocks,
                         f"unexpected IO/import blocked: {_GUARD.blocked[self.expected_blocks:]}")

    def assert_safe_logs(self):
        for name, args, kwargs in _LOG.mock_calls:
            self.assertIn(name, ("warning", "info"))
            self.assertEqual(len(args), 1, "no raw URL/name/error in log arguments")
            self.assertIsInstance(args[0], str)
            self.assertFalse(kwargs, "no exception, traceback or bound secret fields")
            self.assertNotIn("://", args[0])
            for secret in _SECRETS:
                self.assertNotIn(secret, args[0])

    def save(self, operation, endpoint, **changes):
        agent = _Agent(id=42, name="NAME_SECRET", api_endpoint="http://10.0.0.1/old")
        db = SimpleNamespace(execute=AsyncMock(return_value=SimpleNamespace(
            scalar_one_or_none=lambda: agent if operation == "update" else None)),
            add=Mock(), commit=AsyncMock(), refresh=AsyncMock())
        if operation == "create":
            request = SimpleNamespace(name="NAME_SECRET", agent_type="general", description=None,
                model_name=None, api_key=None, is_active=True, api_endpoint=endpoint)
            call = _SERVICE.create_agent(db, request)
        else:
            call = _SERVICE.update_agent(db, 42, _Update(api_endpoint=endpoint, **changes))
        return db, call

    def assert_saved(self, db, agent, endpoint):
        db.commit.assert_awaited_once_with()
        db.refresh.assert_awaited_once_with(agent)
        self.assertEqual(agent.api_endpoint, endpoint)

    async def wait_at_dns(self, task, entered):
        waiter = asyncio.create_task(entered.wait())
        try:
            await asyncio.wait({task, waiter}, timeout=1, return_when=asyncio.FIRST_COMPLETED)
            self.assertTrue(entered.is_set(), "save did not await the async DNS path")
            self.assertFalse(task.done(), "save completed before DNS was released")
        finally:
            waiter.cancel()
            await asyncio.gather(waiter, return_exceptions=True)

    async def test_isolation_is_active_before_source_imports(self):
        self.assertEqual(dict(os.environ), {"PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1"})
        self.assertIsNone(_SETTINGS._env_file)
        self.assertIsNone(_SETTINGS._secrets_dir)
        self.assertFalse(hasattr(sys.modules["app"], "__file__"))
        self.assertNotIn("pytest", sys.modules)
        for probe in (lambda: __import__("app.main"),
                      lambda: open(_ROOT / ".env.must-not-exist"),
                      lambda: socket.getaddrinfo("must-not-resolve.invalid", 443)):
            with self.assertRaises(PermissionError):
                probe()
            self.expected_blocks += 1

    async def test_create_and_update_await_real_async_guard_and_yield(self):
        for operation in ("create", "update"):
            with self.subTest(operation=operation):
                entered, release, heartbeat = asyncio.Event(), asyncio.Event(), asyncio.Event()

                async def dns(*args, **kwargs):
                    entered.set()
                    await release.wait()
                    return [(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", ("8.8.8.8", 0))]

                loop = asyncio.get_running_loop()
                with patch.object(loop, "getaddrinfo", side_effect=dns) as resolver, patch.object(
                        _SECURITY, "_resolve_host_addresses_sync", side_effect=AssertionError("sync DNS")) as sync:
                    db, call = self.save(operation, "https://public.invalid/v1")
                    task = asyncio.create_task(call)
                    try:
                        await self.wait_at_dns(task, entered)
                        loop.call_soon(heartbeat.set)
                        await asyncio.wait_for(heartbeat.wait(), 1)
                        db.commit.assert_not_awaited()
                        release.set()
                        agent = await task
                        self.assert_saved(db, agent, "https://public.invalid/v1")
                        resolver.assert_awaited_once_with("public.invalid", None, proto=socket.IPPROTO_TCP)
                        sync.assert_not_called()
                    finally:
                        release.set()
                        task.cancel()
                        await asyncio.gather(task, return_exceptions=True)
                _LOG.warning.assert_not_called()

    async def test_create_and_update_soft_save_empty_public_internal_and_malformed(self):
        cases = ((None, False), ("", False), ("https://8.8.8.8/v1", False),
                 ("http://192.168.1.5/v1", True), ("http://169.254.169.254/meta", True),
                 ("not-a-url", True), ("ftp://example.invalid", True),
                 ("http://[bad", True), ("http://example.invalid:bad/v1", True), (_SECRET_URL, True))
        for operation in ("create", "update"):
            for endpoint, warns in cases:
                with self.subTest(operation=operation, endpoint=endpoint):
                    _LOG.reset_mock()
                    db, call = self.save(operation, endpoint)
                    with patch.object(_SECURITY, "_assert_safe_endpoint_async",
                                      wraps=_SECURITY._assert_safe_endpoint_async) as guard:
                        agent = await call
                    expected = (endpoint or None) if operation == "create" else endpoint
                    self.assert_saved(db, agent, expected)
                    self.assertEqual(guard.await_count, int(bool(endpoint)))
                    self.assertEqual(_LOG.warning.call_count, int(warns))
                    self.assert_safe_logs()

    async def test_create_and_update_keep_url_object_string_conversion(self):
        class UrlValue:
            def __str__(self):
                return "https://8.8.8.8/v1"
        url = UrlValue()
        for operation in ("create", "update"):
            db, call = self.save(operation, url)
            self.assert_saved(db, await call, str(url))
        _LOG.warning.assert_not_called()

    async def test_validator_exceptions_are_soft_and_never_logged(self):
        for operation in ("create", "update"):
            for error in (_SECURITY.EndpointNotAllowedError("ERROR_SECRET"),
                          RuntimeError("ERROR_SECRET"), socket.gaierror("ERROR_SECRET")):
                with self.subTest(operation=operation, error=type(error).__name__):
                    _LOG.reset_mock()
                    db, call = self.save(operation, _SECRET_URL)
                    with patch.object(_SECURITY, "_assert_safe_endpoint_async", side_effect=error) as guard:
                        self.assert_saved(db, await call, _SECRET_URL)
                    guard.assert_awaited_once_with(_SECRET_URL, allow_local_ollama=True,
                                                  allow_trusted_internal=True)
                    _LOG.warning.assert_called_once()
                    self.assert_safe_logs()

    async def test_warning_sink_exception_does_not_block_create_or_update(self):
        _LOG.warning.side_effect = RuntimeError("ERROR_SECRET")
        for operation in ("create", "update"):
            with self.subTest(operation=operation):
                db, call = self.save(operation, _SECRET_URL)
                self.assert_saved(db, await call, _SECRET_URL)
        self.assert_safe_logs()

    async def test_whitelist_info_sink_failure_is_also_soft_saved(self):
        _SETTINGS.AGENT_TRUSTED_INTERNAL_ENDPOINTS = "http://trusted.invalid:8080/v1"
        _LOG.info.side_effect = RuntimeError("ERROR_SECRET")
        for operation in ("create", "update"):
            db, call = self.save(operation, "http://trusted.invalid:8080/v1")
            self.assert_saved(db, await call, "http://trusted.invalid:8080/v1")
        self.assertEqual(_LOG.warning.call_count, 2)
        self.assert_safe_logs()

    async def test_cancelled_warning_sink_is_not_swallowed(self):
        _LOG.warning.side_effect = asyncio.CancelledError
        for operation in ("create", "update"):
            db, call = self.save(operation, _SECRET_URL)
            with self.assertRaises(asyncio.CancelledError):
                await call
            db.commit.assert_not_awaited()
        self.assert_safe_logs()

    async def test_cancellation_during_dns_propagates_without_commit(self):
        for operation in ("create", "update"):
            with self.subTest(operation=operation):
                entered, release = asyncio.Event(), asyncio.Event()
                async def dns(*args, **kwargs):
                    entered.set()
                    await release.wait()
                with patch.object(asyncio.get_running_loop(), "getaddrinfo", side_effect=dns), patch.object(
                        _SECURITY, "_resolve_host_addresses_sync", side_effect=AssertionError("sync DNS")):
                    db, call = self.save(operation, "https://cancel.invalid/v1")
                    task = asyncio.create_task(call)
                    try:
                        await self.wait_at_dns(task, entered)
                        task.cancel()
                        with self.assertRaises(asyncio.CancelledError):
                            await task
                        db.commit.assert_not_awaited()
                        db.refresh.assert_not_awaited()
                        db.add.assert_not_called()
                        _LOG.warning.assert_not_called()
                    finally:
                        task.cancel()
                        await asyncio.gather(task, return_exceptions=True)

    async def test_validator_cancelled_error_is_not_soft_saved(self):
        for operation in ("create", "update"):
            db, call = self.save(operation, _SECRET_URL)
            with patch.object(_SECURITY, "_assert_safe_endpoint_async", side_effect=asyncio.CancelledError):
                with self.assertRaises(asyncio.CancelledError):
                    await call
            db.commit.assert_not_awaited()
        _LOG.warning.assert_not_called()

    async def test_update_without_endpoint_does_not_validate(self):
        db, unused_call = self.save("update", None)
        unused_call.close()
        with patch.object(_SECURITY, "_assert_safe_endpoint") as sync, patch.object(
                _SECURITY, "_assert_safe_endpoint_async") as guard:
            agent = await _SERVICE.update_agent(db, 42, _Update(description="changed"))
        self.assert_saved(db, agent, "http://10.0.0.1/old")
        self.assertEqual(agent.description, "changed")
        sync.assert_not_called()
        guard.assert_not_awaited()
        _LOG.warning.assert_not_called()

    async def test_sync_compatibility_and_async_helper_share_fixed_log(self):
        _SERVICE.warn_if_endpoint_unsafe(_SECRET_URL, agent_name="NAME_SECRET")
        sync_call = _LOG.warning.call_args
        _LOG.reset_mock()
        await _SERVICE.warn_if_endpoint_unsafe_async(_SECRET_URL, agent_name="NAME_SECRET")
        self.assertEqual(_LOG.warning.call_args, sync_call)
        self.assert_safe_logs()

    async def test_sync_helper_handles_sink_failure_and_empty_public_inputs(self):
        for endpoint in (None, "", "https://8.8.8.8/v1"):
            _SERVICE.warn_if_endpoint_unsafe(endpoint, agent_name="NAME_SECRET")
        _LOG.warning.assert_not_called()
        _LOG.warning.side_effect = RuntimeError("ERROR_SECRET")
        _SERVICE.warn_if_endpoint_unsafe(_SECRET_URL, agent_name="NAME_SECRET")
        self.assert_safe_logs()

    async def test_async_helper_does_not_format_validation_exception(self):
        class UnprintableError(Exception):
            def __str__(self):
                raise AssertionError("exception text must not be formatted")
        with patch.object(_SECURITY, "_assert_safe_endpoint_async", side_effect=UnprintableError()):
            await _SERVICE.warn_if_endpoint_unsafe_async(_SECRET_URL, agent_name="NAME_SECRET")
        _LOG.warning.assert_called_once()
        self.assert_safe_logs()

    async def test_async_helper_string_conversion_failure_is_soft(self):
        class InvalidValue:
            def __str__(self):
                raise ValueError("ERROR_SECRET")
        await _SERVICE.warn_if_endpoint_unsafe_async(InvalidValue(), agent_name="NAME_SECRET")
        _LOG.warning.assert_called_once()
        self.assert_safe_logs()

    async def test_guard_still_rejects_internal_metadata_and_mapped_addresses(self):
        for host in ("127.0.0.1", "192.168.1.5", "169.254.169.254", "100.100.100.200",
                     "[fd00:ec2::254]", "[::ffff:127.0.0.1]"):
            with self.subTest(host=host):
                with self.assertRaises(_SECURITY.EndpointNotAllowedError):
                    _SECURITY._assert_safe_endpoint(f"http://{host}/v1")
                with self.assertRaises(_SECURITY.EndpointNotAllowedError):
                    await _SECURITY._assert_safe_endpoint_async(f"http://{host}/v1")
        for host in ("8.8.8.8", "198.18.1.8", "[2001:2::1]"):
            _SECURITY._assert_safe_endpoint(f"https://{host}/v1")
            await _SECURITY._assert_safe_endpoint_async(f"https://{host}/v1")

    async def test_async_guard_checks_all_dns_records_and_resolution_failure(self):
        for addresses in (("8.8.8.8", "10.0.0.1"), ("2606:4700:4700::1111",), ()):
            infos = [(socket.AF_INET6 if ":" in ip else socket.AF_INET, socket.SOCK_STREAM,
                      socket.IPPROTO_TCP, "", (ip, 0)) for ip in addresses]
            with patch.object(asyncio.get_running_loop(), "getaddrinfo", return_value=infos) as dns:
                db, call = self.save("create", "https://public.invalid/v1")
                self.assert_saved(db, await call, "https://public.invalid/v1")
                dns.assert_awaited_once()
            self.assertEqual(_LOG.warning.call_count, int(len(addresses) != 1))
            self.assert_safe_logs()
            _LOG.reset_mock()
        with patch.object(asyncio.get_running_loop(), "getaddrinfo", side_effect=OSError("ERROR_SECRET")):
            db, call = self.save("create", "https://public.invalid/v1")
            self.assert_saved(db, await call, "https://public.invalid/v1")
        _LOG.warning.assert_called_once()
        self.assert_safe_logs()

    async def test_whitelist_activation_and_hits_log_no_url_or_secret(self):
        _SETTINGS.AGENT_TRUSTED_INTERNAL_ENDPOINTS = "http://HOST_SECRET.internal:8080/PATH_SECRET"
        endpoint = "http://host_secret.internal:8080/PATH_SECRET/v1?key=QUERY_SECRET#FRAGMENT_SECRET"
        with patch.object(_SECURITY, "_resolve_host_addresses_sync", side_effect=_unused) as sync, patch.object(
                _SECURITY, "_resolve_host_addresses_async", side_effect=_unused) as dns:
            _SECURITY._assert_safe_endpoint(endpoint, allow_trusted_internal=True)
            await _SECURITY._assert_safe_endpoint_async(endpoint, allow_trusted_internal=True)
        sync.assert_not_called()
        dns.assert_not_awaited()
        self.assertEqual(_LOG.info.call_count, 3)
        self.assert_safe_logs()

    async def test_explicit_whitelist_and_local_port_scope_are_unchanged(self):
        _SETTINGS.AGENT_TRUSTED_INTERNAL_ENDPOINTS = "http://trusted.invalid:8080/v1"
        private = [ipaddress.ip_address("10.0.0.1")]
        with patch.object(_SECURITY, "_resolve_host_addresses_sync", return_value=private), patch.object(
                _SECURITY, "_resolve_host_addresses_async", return_value=private):
            for endpoint in ("https://trusted.invalid:8080/v1", "http://other.invalid:8080/v1",
                             "http://trusted.invalid:8081/v1", "http://trusted.invalid:8080/v10"):
                with self.assertRaises(_SECURITY.EndpointNotAllowedError):
                    _SECURITY._assert_safe_endpoint(endpoint, allow_trusted_internal=True)
                with self.assertRaises(_SECURITY.EndpointNotAllowedError):
                    await _SECURITY._assert_safe_endpoint_async(endpoint, allow_trusted_internal=True)
            for host in ("localhost", "127.0.0.1", "[::1]"):
                await _SECURITY._assert_safe_endpoint_async(f"http://{host}:11434", allow_local_ollama=True)
                with self.assertRaises(_SECURITY.EndpointNotAllowedError):
                    await _SECURITY._assert_safe_endpoint_async(f"http://{host}:11435", allow_local_ollama=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
