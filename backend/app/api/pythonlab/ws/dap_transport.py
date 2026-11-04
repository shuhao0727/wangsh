"""Docker sessions use their owned internal stream; legacy/non-Docker TCP stays bounded."""
import asyncio
from typing import Optional


async def open_owned_dap(session_id, meta):
    from app.core.sandbox.docker import DockerProvider
    return await DockerProvider().open_dap(session_id, meta)


async def connect_dap(bridge, open_connection):
    if bridge.meta.get('docker_container_id') or bridge.meta.get('sandbox_owner_token'):
        reader, writer = await open_owned_dap(bridge.session_id, bridge.meta)
        bridge.ws_log('dap_docker_connected')
        return reader, writer
    startup = not bridge.first_inbound_event.is_set()
    max_rounds = 12 if startup else 2
    last_error: Optional[Exception] = None
    last_host: Optional[str] = None
    for round_index in range(max_rounds):
        for host in bridge.host_candidates:
            try:
                reader, writer = await asyncio.wait_for(open_connection(host, bridge.port), timeout=5)
                bridge.ws_log('dap_tcp_connected', host=host, port=bridge.port)
                return reader, writer
            except Exception as exc:
                last_error, last_host = exc, host
        if not startup or round_index == max_rounds - 1 or not bridge._is_retryable_connect_error(last_error):
            break
        bridge.ws_log('dap_tcp_connect_retry', host=last_host, port=bridge.port,
                      attempt=round_index + 1, max_attempts=max_rounds,
                      error=f'{type(last_error).__name__}: {last_error}')
        await asyncio.sleep(min(1, .15 + .1 * round_index))
    await bridge._send_output(f'Failed to connect to DAP backend ({bridge.host_candidates}:{bridge.port}): {last_error}\n')
    raise last_error if last_error else RuntimeError('dap connect failed')
