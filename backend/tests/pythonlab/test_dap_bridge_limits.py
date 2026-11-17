import asyncio

import pytest

from app.api.pythonlab.constants import (
    WS_MAX_DAP_BUFFER_BYTES,
    WS_MAX_DAP_BUFFER_MESSAGES,
)
from app.api.pythonlab.ws.bridge import DapSessionBridge


class FakeBridge(DapSessionBridge):
    def __init__(self):
        super().__init__(
            session_id="dbg_test",
            session_key="key",
            meta={},
            host_candidates=[],
            port=1,
            limits={},
            attached_ttl=1,
            ws_log=lambda *args, **kwargs: None,
            cache_backend=object(),
            celery_backend=object(),
        )
        self.outputs = []
        self.closed = []

    async def start(self):
        return None

    async def _send_output(self, text):
        self.outputs.append(text)

    async def _close_known_websocket(self, code=1000, reason=""):
        self.closed.append((code, reason))


def test_dap_buffer_accumulates_until_limit():
    bridge = FakeBridge()
    asyncio.run(bridge.handle_client_text('{"type":"event","event":"x"}'))

    assert len(bridge.buffer) == 1
    assert bridge.buffer_bytes > 0


def test_dap_buffer_message_limit_closes_connection():
    bridge = FakeBridge()
    bridge.buffer = [{"type": "event"} for _ in range(WS_MAX_DAP_BUFFER_MESSAGES)]

    with pytest.raises(RuntimeError):
        asyncio.run(bridge.handle_client_text('{"type":"event","event":"x"}'))

    assert bridge.closed == [(1009, "dap_buffer_limit")]
    assert bridge.outputs


def test_dap_buffer_byte_limit_closes_connection():
    bridge = FakeBridge()
    bridge.buffer_bytes = WS_MAX_DAP_BUFFER_BYTES

    with pytest.raises(RuntimeError):
        asyncio.run(bridge.handle_client_text('{"type":"event","event":"x"}'))

    assert bridge.closed == [(1009, "dap_buffer_limit")]
