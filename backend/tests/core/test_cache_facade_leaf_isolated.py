"""Direct cache-leaf contracts; no article/learning services or mixed tests.

Run only through a collection-before-IO isolation runner (see tests/README.md).
Storage and transport are synthetic; the cache facade and extracted helpers
execute unchanged. Lifecycle tests deliberately use asyncio, not Trio.
"""

import asyncio
from fnmatch import fnmatchcase
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, call

import pytest

from app.utils import cache as facade
from app.utils import cache_invalidation, cache_keys, cache_query, redis_client


def _fresh_cache():
    """Avoid mutating the shared singleton or borrowing another test's state."""
    instance = object.__new__(facade.RedisCache)
    instance._client = None
    instance._initialized = False
    instance._loop = None
    instance._initialize_locks = {}
    return instance


def _logger():
    return SimpleNamespace(debug=Mock(), info=Mock(), warning=Mock(), error=Mock())


def test_key_leaf_reexports_and_order_boolean_none_contract():
    assert facade.cache_key_generator is cache_keys.cache_key_generator
    assert facade.compact_cache_key_generator is cache_keys.compact_cache_key_generator
    assert facade.AnalysisCacheKeys is cache_keys.AnalysisCacheKeys
    assert facade.cache_key_generator("key", z=False, a=None, b=True) == "key:0:1:0"
    assert facade.cache_key_generator("key", b=True, z=False, a=None) == "key:0:1:0"
    assert facade.compact_cache_key_generator("key", None, False, "汉字") == "key:None:False:汉字"
    assert facade.cache_key_generator("key") == "key"
    assert facade.compact_cache_key_generator("key") == "key"
    assert facade.RedisCache() is facade.cache


@pytest.mark.parametrize("method,args,expected", [
    ("hot_analysis_detail", (7,), "analysis:hot:7"),
    ("chain_analysis_detail", (7,), "analysis:chain:7"),
    ("task_analysis_detail", (7,), "analysis:task:7"),
    ("hot_analysis_list", (), "analysis:hot:list:0:50"),
    ("chain_analysis_list", (2, 3), "analysis:chain:list:2:3"),
    ("task_analysis_list", (), "analysis:task:list:0:20"),
    ("trends_summary", (7, "chain"), "analysis:trends:7:chain:10"),
])
def test_analysis_key_leaf_namespaces(method, args, expected):
    assert getattr(cache_keys.AnalysisCacheKeys, method)(*args) == expected


def test_admin_search_trim_partitions_distinct_results_without_changing_public_q():
    keys = facade.ArticleCacheKeys
    assert keys.admin_list(2, 10, False, True, 3, 4, " \t汉字\n") == "articles:a:list:2:10:0:1:3:4:汉字"
    assert keys.admin_list(search=" 汉字 ") == keys.admin_list(search="汉字")
    assert keys.admin_list(search="另一项") != keys.admin_list(search="汉字")
    assert keys.admin_list(search=None) == keys.admin_list(search=" \t ")
    assert keys.admin_list(search="汉字", include_relations=False) != keys.admin_list(search="汉字", include_relations=True)
    assert keys.public_list(q=" 汉字 ") == "articles:p:list:1:20:0: 汉字 "
    assert keys.public_list(q=" 汉字 ") != keys.public_list(q="汉字")
    assert keys.user_detail_by_id(7, 9, False) == "articles:u:detail:id:7:9:0"
    assert keys.user_detail_by_id(7, 9) != keys.user_detail_by_id(7, 10)


def test_article_compact_formatter_remains_a_live_facade_patch_point(monkeypatch):
    formatter = Mock(side_effect=lambda *parts: parts)
    monkeypatch.setattr(facade, "compact_cache_key_generator", formatter)
    assert facade.ArticleCacheKeys.admin_list(2, 10, False, True, 3, 4, " q ") == (
        "articles:a:list", 2, 10, 0, 1, 3, 4, "q",
    )
    assert facade.ArticleCacheKeys.public_list(2, 10, None, " q ") == (
        "articles:p:list", 2, 10, 0, " q ",
    )
    assert formatter.call_count == 2


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio", "trio"])
async def test_query_helper_ignores_named_args_preserves_inputs_and_default_expiry(monkeypatch):
    values, reads, writes, queries = {}, [], [], []

    async def get(key):
        reads.append(key)
        return values.get(key)

    async def set_value(key, value, expiry):
        writes.append((key, value, expiry))
        values[key] = value
        return True

    async def query(*args, **kwargs):
        queries.append((args, kwargs))
        return {"q": kwargs["q"]}

    namespace = SimpleNamespace(cache=SimpleNamespace(get=get, set=set_value),
                                cache_key_generator=cache_keys.cache_key_generator,
                                logger=_logger())
    wrapper = cache_query.query_cache_decorator("query", 31, ["db", "request", "absent"], namespace)(query)
    first_db, second_db, request = object(), object(), object()
    kwargs = {"q": "one", "db": first_db, "request": request}
    first = await wrapper("first positional", **kwargs)
    assert await wrapper("other positional", q="one", db=second_db) is first
    assert await wrapper(q="two", db=second_db) == {"q": "two"}
    assert queries == [(("first positional",), kwargs), ((), {"q": "two", "db": second_db})]
    assert kwargs == {"q": "one", "db": first_db, "request": request}
    assert reads == ["query:one", "query:one", "query:two"]
    assert writes == [("query:one", {"q": "one"}, 31), ("query:two", {"q": "two"}, 31)]

    default_wrapper = facade.cache_decorator("default")(query)
    # The default expiry is verified through the real facade wrapper separately.
    monkeypatch.setattr(facade, "cache", namespace.cache)
    assert await default_wrapper(q="default") == {"q": "default"}
    assert writes[-1] == ("default:default", {"q": "default"}, 300)


@pytest.mark.parametrize("hit", [0, False, "", [], {}])
def test_decorated_query_resolves_late_cache_key_logger_and_keeps_falsy_hits(monkeypatch, hit):
    query = AsyncMock(return_value="should not run")
    wrapper = facade.cache_decorator("patched", 17, ["db"])(query)
    get, set_value, formatter, logger = AsyncMock(return_value=hit), AsyncMock(), Mock(return_value="late:key"), _logger()
    monkeypatch.setattr(facade, "cache", SimpleNamespace(get=get, set=set_value))
    monkeypatch.setattr(facade, "cache_key_generator", formatter)
    monkeypatch.setattr(facade, "logger", logger)
    result = asyncio.run(wrapper("positional", q="汉字", db=object()))
    assert result is hit
    formatter.assert_called_once_with("patched", q="汉字")
    get.assert_awaited_once_with("late:key")
    query.assert_not_awaited()
    set_value.assert_not_awaited()
    logger.debug.assert_called_once_with("缓存命中: late:key")


def test_query_none_is_recomputed_but_falsy_result_is_written(monkeypatch):
    get, set_value, logger = AsyncMock(return_value=None), AsyncMock(), _logger()
    monkeypatch.setattr(facade, "cache", SimpleNamespace(get=get, set=set_value))
    monkeypatch.setattr(facade, "logger", logger)
    query = AsyncMock(side_effect=[None, None, 0])
    wrapper = facade.cache_decorator("none", 23)(query)

    async def run():
        assert await wrapper(q="value") is None
        assert await wrapper(q="value") is None
        set_value.assert_not_awaited()
        assert await wrapper(q="value") == 0

    asyncio.run(run())
    assert query.await_count == get.await_count == 3
    set_value.assert_awaited_once_with("none:value", 0, 23)
    assert logger.debug.call_args_list == [call("缓存未命中: none:value")] * 3


@pytest.mark.parametrize("stage", ["get", "query", "set"])
@pytest.mark.parametrize("error_type", [asyncio.CancelledError, RuntimeError])
def test_query_failures_and_cancellation_propagate_without_later_steps(monkeypatch, stage, error_type):
    error = error_type("synthetic query failure")
    get, query, set_value = AsyncMock(return_value=None), AsyncMock(return_value={"ok": True}), AsyncMock()
    {"get": get, "query": query, "set": set_value}[stage].side_effect = error
    monkeypatch.setattr(facade, "cache", SimpleNamespace(get=get, set=set_value))
    wrapper = facade.cache_decorator("failure")(query)
    with pytest.raises(error_type) as caught:
        asyncio.run(wrapper())
    assert caught.value is error
    assert get.await_count == 1
    assert query.await_count == (stage != "get")
    assert set_value.await_count == (stage == "set")


def test_article_invalidation_removes_all_list_partitions_and_legacy_details(monkeypatch):
    keys = facade.ArticleCacheKeys
    list_keys = {
        keys.public_list(1, 20), keys.public_list(2, 10, 3, " q "),
        keys.admin_list(search="first"), keys.admin_list(search="second"),
        keys.admin_list(2, 10, False, True, 3, 4, " q "),
    }
    details = {keys.public_detail("slug"), keys.article_detail(7), keys.article_by_slug("slug"),
               keys.admin_detail_by_id(7), keys.admin_detail_by_slug("slug"),
               keys.user_detail_by_id(7, 9), keys.user_detail_by_slug("slug", 9)}
    unrelated = {"analysis:hot:7", "articles:config", "session:7"}
    remaining, patterns = list_keys | details | unrelated, []

    async def clear_pattern(pattern):
        patterns.append(pattern)
        matched = {key for key in remaining if fnmatchcase(key, pattern)}
        remaining.difference_update(matched)
        return len(matched)

    logger = _logger()
    monkeypatch.setattr(facade, "cache", SimpleNamespace(clear_pattern=clear_pattern))
    monkeypatch.setattr(facade, "logger", logger)
    assert asyncio.run(facade.clear_article_cache(7, "slug")) is None
    assert remaining == unrelated
    assert patterns == ["articles:*:list:*", "articles:*:detail:*", "articles:detail:*", "articles:slug:*",
                        "articles:detail:7", "articles:*:detail:id:7:*", "articles:slug:slug",
                        "articles:*:detail:slug:slug:*", "articles:p:detail:slug"]
    logger.info.assert_called_once_with(f"清除了 {len(list_keys | details)} 个文章相关缓存")
    assert keys.clear_article(0, "") == patterns[:4]


def test_invalidation_leaf_reads_live_facade_keys_cache_logger_and_all_pattern(monkeypatch):
    clear, logger = AsyncMock(side_effect=[2, 3, 0]), _logger()
    formatter = Mock(return_value=["custom:first", "custom:second"])
    monkeypatch.setattr(facade.ArticleCacheKeys, "clear_article", formatter)
    monkeypatch.setattr(facade, "cache", SimpleNamespace(clear_pattern=clear))
    monkeypatch.setattr(facade, "logger", logger)
    asyncio.run(facade.clear_article_cache(3, "slug"))
    formatter.assert_called_once_with(3, "slug")
    logger.info.assert_called_once_with("清除了 5 个文章相关缓存")
    asyncio.run(facade.clear_all_article_cache())
    assert clear.await_args_list == [call("custom:first"), call("custom:second"), call("articles:*")]
    assert logger.info.call_count == 1


@pytest.mark.parametrize("kind,record_id,expected", [
    (None, 9, ["analysis:*"]),
    ("hot", None, ["analysis:hot:list:*", "analysis:trends:*:hot:*"]),
    ("chain", 0, ["analysis:chain:list:*", "analysis:trends:*:chain:*"]),
    ("task", 8, ["analysis:task:8", "analysis:task:list:*", "analysis:trends:*:task:*"]),
])
def test_analysis_invalidation_leaf_and_facade_preserve_order(monkeypatch, kind, record_id, expected):
    clear, logger = AsyncMock(return_value=1), _logger()
    namespace = SimpleNamespace(cache=SimpleNamespace(clear_pattern=clear), logger=logger)
    asyncio.run(cache_invalidation.clear_analysis_cache(namespace, kind, record_id))
    assert clear.await_args_list == [call(pattern) for pattern in expected]
    clear.reset_mock()
    monkeypatch.setattr(facade, "cache", namespace.cache)
    monkeypatch.setattr(facade, "logger", logger)
    asyncio.run(facade.clear_analysis_cache(kind, record_id))
    assert clear.await_args_list == [call(pattern) for pattern in expected]
    assert logger.info.call_count == 2


@pytest.mark.parametrize("error_type", [asyncio.CancelledError, RuntimeError])
def test_invalidation_failure_stops_before_remaining_patterns(monkeypatch, error_type):
    error, logger = error_type("synthetic invalidation failure"), _logger()
    clear = AsyncMock(side_effect=[2, error])
    monkeypatch.setattr(facade, "cache", SimpleNamespace(clear_pattern=clear))
    monkeypatch.setattr(facade, "logger", logger)
    with pytest.raises(error_type) as caught:
        asyncio.run(facade.clear_article_cache(7, "slug"))
    assert caught.value is error
    assert clear.await_args_list == [call("articles:*:list:*"), call("articles:*:detail:*")]
    logger.info.assert_not_called()


def test_clear_pattern_scans_all_pages_and_deletes_exact_keys_in_bounded_batches(monkeypatch):
    pages = [(17, []), (29, [f"a:{i}" for i in range(650)]), (0, [f"b:{i}" for i in range(450)])]
    all_keys = pages[1][1] + pages[2][1]
    client = SimpleNamespace(scan=AsyncMock(side_effect=pages), delete=AsyncMock(side_effect=[499, None, 100]))
    instance = _fresh_cache()
    monkeypatch.setattr(instance, "get_client", AsyncMock(return_value=client))
    assert asyncio.run(instance.clear_pattern("prefix:*")) == 599
    assert client.scan.await_args_list == [call(cursor=cursor, match="prefix:*", count=1000) for cursor in (0, 17, 29)]
    chunks = [item.args for item in client.delete.await_args_list]
    assert [len(chunk) for chunk in chunks] == [500, 500, 100]
    assert [key for chunk in chunks for key in chunk] == all_keys


@pytest.mark.parametrize("stage", ["scan", "delete"])
@pytest.mark.parametrize("error_type", [RuntimeError, asyncio.CancelledError])
def test_clear_pattern_empty_and_failure_boundaries(monkeypatch, stage, error_type):
    instance = _fresh_cache()
    client = SimpleNamespace(scan=AsyncMock(return_value=(0, [])), delete=AsyncMock(return_value=1))
    monkeypatch.setattr(instance, "get_client", AsyncMock(return_value=client))
    assert asyncio.run(instance.clear_pattern("none:*")) == 0
    client.delete.assert_not_awaited()
    client.scan.reset_mock()
    client.scan.return_value = (0, ["one"])
    error = error_type("synthetic scan/delete failure")
    getattr(client, stage).side_effect = error
    if error_type is asyncio.CancelledError:
        with pytest.raises(asyncio.CancelledError) as caught:
            asyncio.run(instance.clear_pattern("one:*"))
        assert caught.value is error
    else:
        assert asyncio.run(instance.clear_pattern("one:*")) == 0
    assert client.delete.await_count == (stage == "delete")


def test_initialize_cancel_releases_candidate_and_waiting_request_retries(monkeypatch):
    instance, created = _fresh_cache(), []
    monkeypatch.setattr(facade.settings, "REDIS_SENTINEL_ENABLED", False)

    async def run():
        entered, never = asyncio.Event(), asyncio.Event()

        async def blocked_ping():
            entered.set()
            await never.wait()

        failed = SimpleNamespace(ping=blocked_ping, aclose=AsyncMock())
        healthy = SimpleNamespace(ping=AsyncMock(return_value=True), aclose=AsyncMock())
        pending = [failed, healthy]

        def factory(**kwargs):
            candidate = pending.pop(0)
            created.append((candidate, kwargs))
            return candidate

        monkeypatch.setattr(facade, "create_async_redis_client", factory)
        first = asyncio.create_task(instance.get_client())
        waiter = None
        try:
            await asyncio.wait_for(entered.wait(), timeout=1)
            waiter = asyncio.create_task(instance.get_client())
            await asyncio.sleep(0)
            assert len(created) == 1
            assert not waiter.done()
            first.cancel()
            with pytest.raises(asyncio.CancelledError):
                await asyncio.wait_for(first, timeout=1)
            assert await asyncio.wait_for(waiter, timeout=1) is healthy
            failed.aclose.assert_awaited_once_with()
            assert instance._client is healthy
            assert instance._initialized is True
            assert instance._loop is asyncio.get_running_loop()
            assert len(created) == 2
            healthy.aclose.assert_not_awaited()
            await instance.close()
            healthy.aclose.assert_awaited_once_with()
            assert (instance._client, instance._initialized, instance._loop) == (None, False, None)
            assert all(not lock.locked() for lock in instance._initialize_locks.values())
        finally:
            for task in (first, waiter):
                if task is not None and not task.done():
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
            await instance.close()

    asyncio.run(run())


@pytest.mark.parametrize("close_error", [RuntimeError, asyncio.CancelledError])
def test_initialize_preserves_ping_failure_even_when_release_fails_and_can_retry(monkeypatch, close_error):
    instance, error = _fresh_cache(), ConnectionError("synthetic ping failed")
    failed = SimpleNamespace(ping=AsyncMock(side_effect=error), aclose=AsyncMock(side_effect=close_error("synthetic close failed")))
    healthy = SimpleNamespace(ping=AsyncMock(return_value=True), aclose=AsyncMock())
    factory = Mock(side_effect=[failed, healthy])
    monkeypatch.setattr(facade, "create_async_redis_client", factory)
    monkeypatch.setattr(facade.settings, "REDIS_SENTINEL_ENABLED", False)

    async def run():
        with pytest.raises(ConnectionError) as caught:
            await instance.get_client()
        assert caught.value is error
        failed.aclose.assert_awaited_once_with()
        assert (instance._client, instance._initialized, instance._loop) == (None, False, None)
        assert all(not lock.locked() for lock in instance._initialize_locks.values())
        try:
            assert await instance.get_client() is healthy
            assert await instance.get_client() is healthy
            assert factory.call_count == 2
        finally:
            await instance.close()
        healthy.aclose.assert_awaited_once_with()

    asyncio.run(run())


@pytest.mark.parametrize("error_type", [None, RuntimeError, asyncio.CancelledError])
def test_async_sentinel_owner_releases_discovery_after_data_close(monkeypatch, error_type):
    client = redis_client.create_async_sentinel_client(sentinels=[("offline.invalid", 26379), ("offline.invalid", 26380)], master_name="synthetic")
    events, error = [], error_type("synthetic data close") if error_type else None

    async def close_data(self, close_connection_pool=None):
        assert self is client
        events.append(("data", close_connection_pool))
        if error is not None:
            raise error

    discovery = list(client._discovery_clients)
    assert len(discovery) == 2
    assert client.connection_pool.connection_class.__name__ == "SentinelManagedConnection"
    monkeypatch.setattr(redis_client.async_redis.Redis, "aclose", close_data)
    for index, item in enumerate(discovery):
        async def close_discovery(index=index):
            events.append(("discovery", index))
        monkeypatch.setattr(item, "aclose", close_discovery)
    if error is not None:
        with pytest.raises(error_type) as caught:
            asyncio.run(client.aclose(close_connection_pool=True))
        assert caught.value is error
    else:
        asyncio.run(client.aclose(close_connection_pool=True))
    assert events == [("data", True), ("discovery", 0), ("discovery", 1)]


@pytest.mark.parametrize("fail", [False, True])
def test_sync_sentinel_owner_releases_discovery_after_data_close(monkeypatch, fail):
    client = redis_client.create_sync_sentinel_client(sentinels=[("offline.invalid", 26379), ("offline.invalid", 26380)], master_name="synthetic")
    events, error = [], RuntimeError("synthetic data close")

    def close_data(self):
        assert self is client
        events.append("data")
        if fail:
            raise error

    discovery = list(client._discovery_clients)
    assert len(discovery) == 2
    monkeypatch.setattr(redis_client.sync_redis.Redis, "close", close_data)
    for index, item in enumerate(discovery):
        monkeypatch.setattr(item, "close", lambda index=index: events.append(index))
    if fail:
        with pytest.raises(RuntimeError) as caught:
            client.close()
        assert caught.value is error
    else:
        client.close()
    assert events == ["data", 0, 1]
