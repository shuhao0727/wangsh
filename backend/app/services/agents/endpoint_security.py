"""
端点安全防护（SSRF 防护）。

从 model_discovery.py 抽出：模型发现/规范化入口对 API 端点的 SSRF 校验逻辑。
拒绝非 http(s) 协议、以及解析到内网/环回/链路本地/保留/云元数据
（169.254.169.254）的端点；仅 OLLAMA 服务商显式放行本机 11434。

另有一条**独立**的显式受信内部端点白名单（AGENT_TRUSTED_INTERNAL_ENDPOINTS）：
命中白名单是短路放行，不修改任何内网判定规则；未命中的目标继续按原规则全拒。

与调用方解耦：本模块不依赖任何服务商 schema，仅暴露校验函数与异常。
"""

import asyncio
import ipaddress
import socket
from typing import List, Optional, Tuple
from urllib.parse import urlparse

from loguru import logger

# 条目声明与解析/匹配逻辑放在 app.core.config._services：Settings 构造期就要校验配置
# （fail-fast），而配置层不能反向导入 app.services（会经 app.models 形成循环导入）。
# 这里复用同一份实现，保证"启动期校验的规则"与"运行时匹配的规则"绝不漂移。
from app.core.config._services import (
    TrustedEndpoint,
    matches_trusted_endpoint,
    parse_trusted_endpoints,
)


class EndpointNotAllowedError(ValueError):
    """SSRF 防护拒绝的端点。

    继承 ValueError：API 层现有的 `except ValueError -> 400` 分支无需改动即可
    把 SSRF 拦截映射为 400；服务层再单独 re-raise 它，避免被吞成 success=False。
    """


# 显式放行的本机端点：仅 OLLAMA 服务商的本机 11434。
# 理由：OLLAMA 本身就是"本地运行"的服务商（supported-providers 默认端点即
# http://localhost:11434），且模型发现接口全部 admin-only——SSRF 攻击面只有
# 管理员，管理员本就有权访问本机服务，此处放行不扩大外部威胁面。
_LOCAL_OLLAMA_HOSTS = ("localhost", "127.0.0.1", "::1")
_LOCAL_OLLAMA_PORT = 11434


def allows_local_ollama(host: str, port: Optional[int]) -> bool:
    """是否命中显式放行的本机 OLLAMA 端点（host ∈ {localhost, 127.0.0.1, ::1} 且 port == 11434）。"""
    return host in _LOCAL_OLLAMA_HOSTS and port == _LOCAL_OLLAMA_PORT


# ==================== 显式受信内部端点白名单 ====================
# TrustedEndpoint / parse_trusted_endpoints / matches_trusted_endpoint 在文件头部从
# app.core.config._services 导入（那里实现，供 Settings 启动期校验复用）。

_trusted_cache: Optional[Tuple[TrustedEndpoint, ...]] = None
_trusted_cache_raw: Optional[str] = None


def _trusted() -> Tuple[TrustedEndpoint, ...]:
    """读取当前生效的白名单（按原始配置字符串缓存；配置变更或测试 monkeypatch 后自动重解析）。"""
    global _trusted_cache, _trusted_cache_raw
    from app.core.config import settings  # 延迟导入：避免 config → services 的初始化顺序耦合

    raw = settings.AGENT_TRUSTED_INTERNAL_ENDPOINTS or ""
    if _trusted_cache is None or _trusted_cache_raw != raw:
        _trusted_cache = parse_trusted_endpoints(raw)
        _trusted_cache_raw = raw
        if _trusted_cache:
            logger.info(
                "[endpoint-security] 已启用受信内部端点白名单：{}",
                ", ".join(e.describe() for e in _trusted_cache),
            )
    return _trusted_cache


def reset_trusted_endpoint_cache() -> None:
    """清空白名单解析缓存（测试用；生产无需调用）。"""
    global _trusted_cache, _trusted_cache_raw
    _trusted_cache = None
    _trusted_cache_raw = None


def _parse_endpoint(api_endpoint: str) -> Tuple[str, str, Optional[int]]:
    """解析并校验 URL 基本结构，返回 (scheme, host, port)。"""
    parsed = urlparse(api_endpoint)
    if parsed.scheme not in ("http", "https"):
        raise EndpointNotAllowedError("仅支持 http/https 的 API 端点")
    host = parsed.hostname
    if not host:
        raise EndpointNotAllowedError("API 端点缺少主机名")
    try:
        port = parsed.port
    except ValueError:
        raise EndpointNotAllowedError("API 端点端口非法")
    return parsed.scheme, host, port


def _is_disallowed_ip(ip: ipaddress._BaseAddress) -> bool:
    # 归一化 IPv4-mapped IPv6（::ffff:127.0.0.1 这类写法可绕过纯 IPv6 判定）
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    # 私网/环回/链路本地（含云元数据 169.254.169.254）/保留/组播/未指定，全部拒绝
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _dedupe_addresses(infos: List[Tuple]) -> List[ipaddress._BaseAddress]:
    """从 getaddrinfo 结果中提取去重后的 IP 列表（A + AAAA 全量）。"""
    seen: set = set()
    out: List[ipaddress._BaseAddress] = []
    for info in infos:
        raw = info[4][0]
        try:
            ip = ipaddress.ip_address(raw)
        except ValueError:
            continue
        key = int(ip)
        if key not in seen:
            seen.add(key)
            out.append(ip)
    return out


def _resolve_host_addresses_sync(host: str) -> List[ipaddress._BaseAddress]:
    """同步解析主机全部地址（getaddrinfo，A + AAAA）；字面 IP 直接返回。"""
    try:
        return [ipaddress.ip_address(host)]
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except OSError:
        return []
    return _dedupe_addresses(infos)


async def _resolve_host_addresses_async(host: str) -> List[ipaddress._BaseAddress]:
    """异步解析主机全部地址（loop.getaddrinfo，不阻塞事件循环）；字面 IP 直接返回。"""
    try:
        return [ipaddress.ip_address(host)]
    except ValueError:
        pass
    loop = asyncio.get_running_loop()
    try:
        infos = await loop.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except OSError:
        return []
    return _dedupe_addresses(infos)


def _assert_host_safe(host: str, resolved: List[ipaddress._BaseAddress]) -> None:
    # 解析不到任何地址（域名不存在 / 无 A/AAAA 记录）：按不安全处理（谨慎）
    if not resolved:
        raise EndpointNotAllowedError("无法解析的 API 端点主机")
    # 逐一校验全部解析结果：任一条落在内网/环回/链路本地/保留地址即拒绝。
    # 与只取第一条 A 记录相比，可拦截"多记录域名混入内网地址"与 IPv6-only 主机
    # 被误判为无法解析的情况（能解析出合法公网 AAAA 即算通过）。
    for ip in resolved:
        if _is_disallowed_ip(ip):
            raise EndpointNotAllowedError("禁止访问内网/环回/保留地址端点")


def _assert_safe_endpoint(
    api_endpoint: str,
    *,
    allow_local_ollama: bool = False,
    allow_trusted_internal: bool = False,
) -> None:
    """
    SSRF 防护（同步版，供同步调用方/测试使用）：拒绝非 http(s) 协议、以及解析到
    内网/环回/链路本地/保留/云元数据（169.254.169.254）的端点。

    显式放行：`allow_local_ollama=True` 且 host ∈ {localhost, 127.0.0.1, ::1}、
    port == 11434 时直接放行（仅 OLLAMA 服务商传入该参数）。这些端点用于连接管理员
    配置的本机 Ollama；模型发现接口 admin-only，SSRF 攻击面只有管理员。

    显式放行 2：`allow_trusted_internal=True` 且 URL 精确命中
    `AGENT_TRUSTED_INTERNAL_ENDPOINTS` 白名单条目时短路放行，**不做 DNS 解析**。
    这是"命中即放行"的短路，不是放宽内网判定：未命中白名单的目标仍按原规则全拒。

    残余 TOCTOU 风险：地址校验与后续 httpx 连接之间，DNS 仍可被 rebinding 切换到
    内网地址，本防护无法完全消除该窗口。缓解：端点 admin-only（管理员本就可访问
    内网/本机），且公网攻击者无法控制校验之后的连接目标。

    白名单残余风险：host 为域名时不做 DNS 校验（这正是放行目的）。若内网 DNS 被篡改，
    该域名可指向任意地址。缓解：白名单只能由部署配置写入（无任何 API 可改），
    内网 DNS 由编排控制，建议只放一条并在变更时评审。
    """
    # 白名单短路：必须在任何解析/DNS 之前，且只命中四元组精确匹配的目标
    if allow_trusted_internal:
        entries = _trusted()
        if matches_trusted_endpoint(api_endpoint, entries):
            logger.info(
                "[endpoint-security] 命中受信内部端点白名单，跳过内网判定：{}",
                api_endpoint,
            )
            return
    _scheme, host, port = _parse_endpoint(api_endpoint)
    if allow_local_ollama and allows_local_ollama(host, port):
        return
    _assert_host_safe(host, _resolve_host_addresses_sync(host))


async def _assert_safe_endpoint_async(
    api_endpoint: str,
    *,
    allow_local_ollama: bool = False,
    allow_trusted_internal: bool = False,
) -> None:
    """
    SSRF 防护（异步版）：语义与同步版完全一致，但用 `loop.getaddrinfo` 解析，
    不阻塞事件循环（同步版走 `socket.getaddrinfo`，在 async 路径调用会卡住事件循环）。
    """
    if allow_trusted_internal:
        entries = _trusted()
        if matches_trusted_endpoint(api_endpoint, entries):
            logger.info(
                "[endpoint-security] 命中受信内部端点白名单，跳过内网判定：{}",
                api_endpoint,
            )
            return
    _scheme, host, port = _parse_endpoint(api_endpoint)
    if allow_local_ollama and allows_local_ollama(host, port):
        return
    _assert_host_safe(host, await _resolve_host_addresses_async(host))
