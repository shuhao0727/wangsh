import asyncio

_loop: asyncio.AbstractEventLoop | None = None


def run(coro):
    global _loop
    if _loop is None or _loop.is_closed():
        _loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_loop)
    return _loop.run_until_complete(coro)
