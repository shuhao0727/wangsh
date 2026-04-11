"""
DAP 连接和消息处理函数
"""

import asyncio
import json
from typing import Any, Dict


async def _read_dap_message(reader: asyncio.StreamReader) -> Dict[str, Any]:
    """读取 DAP 消息"""
    headers: Dict[str, str] = {}
    while True:
        line = await reader.readline()
        if not line:
            raise EOFError("dap header eof")
        s = line.decode("utf-8", errors="replace").strip()
        if s == "":
            break
        if ":" in s:
            k, v = s.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    n = int(headers.get("content-length") or "0")
    if n <= 0:
        raise ValueError("dap content-length missing")
    body = await reader.readexactly(n)
    return json.loads(body.decode("utf-8", errors="replace"))


async def _write_dap_message(writer: asyncio.StreamWriter, msg: Dict[str, Any]) -> None:
    """写入 DAP 消息"""
    raw = json.dumps(msg, ensure_ascii=False).encode("utf-8")
    header = f"Content-Length: {len(raw)}\r\n\r\n".encode("utf-8")
    writer.write(header)
    writer.write(raw)
    await writer.drain()