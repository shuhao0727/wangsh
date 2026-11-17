"""Bounded client-message buffer for the DAP bridge."""

from typing import Any, Dict

from app.api.pythonlab.constants import (
    WS_MAX_DAP_BUFFER_BYTES,
    WS_MAX_DAP_BUFFER_MESSAGES,
)


class DapClientBufferMixin:
    async def _buffer_client_message(self, msg: Dict[str, Any], msg_bytes: int) -> None:
        """在首个 DAP response 前缓存客户端消息，并限制总量。"""
        if (self.buffer_bytes + msg_bytes > WS_MAX_DAP_BUFFER_BYTES
                or len(self.buffer) >= WS_MAX_DAP_BUFFER_MESSAGES):
            await self._send_output("DAP 缓冲超过上限，连接已断开\n")
            await self._close_known_websocket(code=1009, reason="dap_buffer_limit")
            raise RuntimeError("dap buffer limit")
        self.buffer.append(msg)
        self.buffer_bytes += msg_bytes
        self.ws_log(
            "ws_buffer_append",
            buffer_size=len(self.buffer),
            buffer_bytes=self.buffer_bytes,
            command=str(msg.get("command") or ""),
        )
        self.buffer_event.set()
