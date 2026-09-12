import ipaddress
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple, Literal
from fastapi import Request
from redis.exceptions import WatchError

from app.core.config import settings
from app.core.session_family import verify_access_family
from app.utils.cache import cache

_PREFIX = "auth:session"


def _key_user(user_id: int) -> str:
    return f"{_PREFIX}:uid:{int(user_id)}"


def _key_ip(ip: str) -> str:
    return f"{_PREFIX}:ip:{ip}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _split_header(v: str) -> list[str]:
    return [p.strip() for p in str(v or "").split(",") if p.strip()]


def _peer_trusted(request: Optional[Request]) -> bool:
    """转发头只有在连接来源属于可信代理网段时才可被采纳。

    S7 治理：此前 AUTH_TRUST_X_FORWARDED_FOR 对任何直连来源都信任，网络内
    客户端可直连后端并伪造 X-Forwarded-For 篡改 IP 绑定。现改为 fail-closed：
    AUTH_TRUSTED_PROXY_CIDRS 为空时不信任任何转发头（等同关闭信任）。
    """
    raw = getattr(settings, "AUTH_TRUSTED_PROXY_CIDRS", "") or ""
    cidrs = [c.strip() for c in raw.split(",") if c.strip()]
    if not cidrs:
        return False
    host = request.client.host if request and request.client else ""
    if not host:
        return False
    try:
        peer = ipaddress.ip_address(host)
    except ValueError:
        return False
    for cidr in cidrs:
        try:
            if peer in ipaddress.ip_network(cidr, strict=False):
                return True
        except ValueError:
            # 配置错误由 settings 校验拦截；此处保守忽略坏网段
            continue
    return False


def _first_forwarded_ip(header: str, value: str) -> Optional[str]:
    """从单个转发头取值中提取第一个合法 IP；解析失败返回 None。"""
    candidates = []
    if header.lower() == "forwarded":
        # Forwarded: for=1.2.3.4;proto=http;by=...
        for p in _split_header(value.replace(";", ",")):
            if "for=" in p:
                candidates.append(p.split("for=")[-1].strip().strip("\"").strip("[]"))
    else:
        # X-Forwarded-For / X-Real-IP / Remote-Addr
        candidates = _split_header(value)
    for cand in candidates:
        try:
            ipaddress.ip_address(cand)
            return cand
        except ValueError:
            continue
    return None


def _peer_ip(request: Optional[Request]) -> str:
    host = request.client.host if request and request.client else "0.0.0.0"
    try:
        ipaddress.ip_address(host)
        return host
    except ValueError:
        return "0.0.0.0"


def extract_client_ip(request: Request) -> str:
    """
    提取客户端IP：
    - 仅当连接来源（socket peer）属于可信代理网段时才按
      AUTH_IP_HEADER_ORDER 采用转发头；
    - 取 X-Forwarded-For 第一个合法IP；
    - 否则回退真实 peer IP（client.host）。
    """
    if settings.AUTH_TRUST_X_FORWARDED_FOR and _peer_trusted(request):
        for h in _split_header(settings.AUTH_IP_HEADER_ORDER):
            hv = request.headers.get(h) or request.headers.get(h.lower())
            if hv:
                candidate = _first_forwarded_ip(h, hv)
                if candidate is not None:
                    return candidate
    return _peer_ip(request)


def _session_ttl() -> int:
    if settings.AUTH_SESSION_TTL_SECONDS and settings.AUTH_SESSION_TTL_SECONDS > 0:
        return int(settings.AUTH_SESSION_TTL_SECONDS)
    # 优先与访问令牌时长对齐，否则使用学生会话TTL
    return max(int(settings.ACCESS_TOKEN_EXPIRE_MINUTES) * 60, int(settings.STUDENT_SESSION_TTL))


async def get_user_session(user_id: int) -> Optional[Dict[str, Any]]:
    v = await cache.get(_key_user(user_id))
    return v if isinstance(v, dict) else None


async def get_user_session_strict(user_id: int) -> Optional[Dict[str, Any]]:
    """Strict auth read: distinguish missing nonce from unavailable/corrupt Redis.

    Ordinary cache reads intentionally degrade to None; that is unsuitable for
    reporting a revocation as completed. Do not change the global cache policy.
    """
    client = await cache.get_client()
    raw = await client.get(_key_user(user_id))
    if raw is None:
        return None
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise RuntimeError("服务端会话记录格式无效")
    return value


async def get_ip_binding_strict(ip: str) -> Optional[Dict[str, Any]]:
    """Do not silently lose the last pre-migration IP eviction witness."""
    client = await cache.get_client()
    raw = await client.get(_key_ip(ip))
    if raw is None:
        return None
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise RuntimeError("服务端IP绑定格式无效")
    return value


async def set_user_session(user_id: int, data: Dict[str, Any]) -> bool:
    return await cache.set(_key_user(user_id), data, expire_seconds=_session_ttl())


async def set_ip_binding(ip: str, data: Dict[str, Any], *, ttl: Optional[int] = None) -> bool:
    return await cache.set(_key_ip(ip), data, expire_seconds=_session_ttl() if ttl is None else ttl)


async def get_auth_snapshot_strict(keys: list[str]) -> dict[str, tuple[Any, Optional[datetime]]]:
    """Read values and remaining TTL in one Redis transaction during cutover.

    All legacy writers must be stopped. Local time captured BEFORE dispatch
    makes the retained deadline conservative even when command delivery is slow.
    No-expiry/malformed evidence is not converted into a fresh full lease.
    """
    client = await cache.get_client()
    started = datetime.now(timezone.utc)
    async with client.pipeline(transaction=True) as pipe:
        for key in keys:
            pipe.get(key)
            pipe.pttl(key)
        values = await pipe.execute()
    result = {}
    for i, key in enumerate(keys):
        raw, ttl = values[2*i:2*i+2]
        value = json.loads(raw) if raw is not None else None
        deadline = started + timedelta(milliseconds=ttl) if type(ttl) is int and ttl > 0 else None
        result[key] = (value, deadline)
    return result


async def get_ip_binding(ip: str) -> Optional[Dict[str, Any]]:
    v = await cache.get(_key_ip(ip))
    return v if isinstance(v, dict) else None


async def rotate_user_session(
    user_id: int, keep_ip: Optional[str] = None, *, nonce: Optional[str] = None,
) -> Dict[str, Any]:
    """旋转用户会话nonce，踢出旧会话。"""
    nonce = nonce or secrets.token_urlsafe(16)
    data = {"nonce": nonce, "ip": keep_ip or "", "updated_at": _now_iso()}
    if not await set_user_session(user_id, data):
        raise RuntimeError("无法写入服务端会话")
    return data


async def _rotate_current_ip_owner(ip: str, binding: Dict[str, Any]) -> None:
    """Only evict the session still identified by this IP binding, atomically.

    WATCH covers both keys: a moved/replaced session or binding must not be
    invalidated by an earlier login observation. No non-atomic cache fallback.
    """
    old_uid = int(binding.get("user_id", 0))
    expected_nonce = binding.get("nonce")
    if old_uid <= 0 or not expected_nonce:
        return  # Incomplete/stale bindings do not identify a live session.
    get_client = getattr(cache, "get_client", None)
    if get_client is None:
        raise RuntimeError("缓存不支持原子会话更新")
    client = await get_client()
    ip_key, user_key = _key_ip(ip), _key_user(old_uid)
    for _ in range(3):
        try:
            async with client.pipeline(transaction=True) as pipe:
                await pipe.watch(ip_key, user_key)
                raw_binding, raw_session = await pipe.mget(ip_key, user_key)
                current_binding = json.loads(raw_binding) if raw_binding else None
                current_session = json.loads(raw_session) if raw_session else None
                if not isinstance(current_binding, dict) or not isinstance(current_session, dict):
                    return
                if (current_binding.get("user_id") != old_uid
                        or current_binding.get("nonce") != expected_nonce
                        or current_session.get("nonce") != expected_nonce
                        or current_session.get("ip") != ip):
                    return
                data = {"nonce": secrets.token_urlsafe(16), "ip": "", "updated_at": _now_iso()}
                pipe.multi()
                pipe.set(user_key, json.dumps(data, ensure_ascii=False), ex=_session_ttl())
                written = await pipe.execute()
                if written != [True]:
                    raise RuntimeError("无法写入服务端会话")
                return
        except WatchError:
            continue
    raise RuntimeError("会话并发更新，请重试登录")


async def on_successful_login(
    user_id: int, request: Request, *, nonce: Optional[str] = None,
) -> Tuple[str, str]:
    """
    登录成功时：
    - 解析客户端IP
    - 保证“一个用户只有一个IP（最近一次）”与“一个IP只能绑定一个用户”
    - 无论是否开启 IP 唯一性，同一用户每次成功登录都旋转 nonce，确保旧会话失效
    - 返回 (nonce, client_ip)
    """
    ip = extract_client_ip(request)
    # 处理 IP -> 用户 的唯一性
    if settings.AUTH_USER_UNIQUE_PER_IP:
        existing = await get_ip_binding(ip)
        if existing and int(existing.get("user_id", 0)) != int(user_id):
            # 只有 binding 仍指向旧用户当前会话时才踢出，避免陈旧 IP 记录误踢。
            await _rotate_current_ip_owner(ip, existing)
    nonce_data = await rotate_user_session(user_id, keep_ip=ip, **({"nonce": nonce} if nonce else {}))
    if not await set_ip_binding(ip, {"user_id": int(user_id), "nonce": nonce_data["nonce"], "updated_at": _now_iso()}):
        raise RuntimeError("无法写入服务端IP绑定")
    return nonce_data["nonce"], ip


async def verify_request_session_detail(
    user_id: int,
    token_payload: Dict[str, Any],
    request: Optional[Request] = None,
    *, db=None,
) -> Dict[str, Literal[True] | Literal[False] | str]:
    """验证请求中的令牌是否与当前有效会话匹配，并返回失败原因。"""
    token_nonce = str(token_payload.get("sn", ""))
    if not await verify_access_family(user_id, token_payload, db):
        # 持久权威已拒绝。区分“被新登录替换”（持久状态仍 active、但 nonce 已轮换）
        # 与“主动登出/撤销/过期”（状态 inactive 或缺失），避免把替换误报成泛化失效。
        state = await _durable_session_state(user_id, db)
        if (
            state is not None
            and state.active
            and token_nonce
            and state.nonce != token_nonce
        ):
            return {"ok": False, "reason": "replaced_by_new_login"}
        return {"ok": False, "reason": "family_revoked"}
    stored = await get_user_session(user_id)
    if not stored:
        return {"ok": False, "reason": "expired_or_missing"}
    stored_nonce = str(stored.get("nonce", ""))
    if not token_nonce:
        return {"ok": False, "reason": "expired_or_missing"}
    if token_nonce != stored_nonce:
        return {"ok": False, "reason": "replaced_by_new_login"}
    if settings.AUTH_ENFORCE_SAME_IP_PER_REQUEST and request is not None:
        ip = extract_client_ip(request)
        if ip and stored.get("ip") and ip != stored.get("ip"):
            return {"ok": False, "reason": "ip_mismatch"}
    return {"ok": True, "reason": "ok"}


async def _durable_session_state(user_id: int, db=None):
    """Read the durable AuthSessionState row, opening a session when needed."""
    from app.core.session_family import session_state

    if db is not None:
        return await session_state(db, user_id)
    from app.db.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        return await session_state(session, user_id)


async def verify_request_session(user_id: int, token_payload: Dict[str, Any], request: Optional[Request] = None) -> bool:
    """验证请求中的令牌是否与当前有效会话匹配（nonce匹配，必要时IP匹配）"""
    result = await verify_request_session_detail(user_id, token_payload, request)
    return bool(result.get("ok"))
