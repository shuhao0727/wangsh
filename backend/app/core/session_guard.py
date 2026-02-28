import ipaddress
import secrets
from datetime import datetime
from typing import Any, Dict, Optional, Tuple
from fastapi import Request

from app.core.config import settings
from app.utils.cache import cache

_PREFIX = "auth:session"


def _key_user(user_id: int) -> str:
    return f"{_PREFIX}:uid:{int(user_id)}"


def _key_ip(ip: str) -> str:
    return f"{_PREFIX}:ip:{ip}"


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _split_header(v: str) -> list[str]:
    return [p.strip() for p in str(v or "").split(",") if p.strip()]


def extract_client_ip(request: Request) -> str:
    """
    提取客户端IP：
    - 优先按 AUTH_TRUST_X_FORWARDED_FOR 和 AUTH_IP_HEADER_ORDER
    - 取 X-Forwarded-For 第一个合法IP
    - 否则取 client.host
    """
    header_order = _split_header(settings.AUTH_IP_HEADER_ORDER)
    if settings.AUTH_TRUST_X_FORWARDED_FOR:
        for h in header_order:
            hv = request.headers.get(h) or request.headers.get(h.lower())
            if not hv:
                continue
            # Forwarded: for=1.2.3.4;proto=http;by=...
            if h.lower() == "forwarded":
                # 极简解析
                parts = _split_header(hv.replace(";", ","))
                for p in parts:
                    if "for=" in p:
                        cand = p.split("for=")[-1].strip().strip("\"").strip("[]")
                        try:
                            ipaddress.ip_address(cand)
                            return cand
                        except Exception:
                            continue
            else:
                # X-Forwarded-For / X-Real-IP / Remote-Addr
                for cand_raw in _split_header(hv):
                    cand = cand_raw.strip().strip("\"").strip("[]")
                    try:
                        ipaddress.ip_address(cand)
                        return cand
                    except Exception:
                        continue
    # fallback to peer
    host = request.client.host if request and request.client else "0.0.0.0"
    try:
        ipaddress.ip_address(host)
        return host
    except Exception:
        return "0.0.0.0"


def _session_ttl() -> int:
    if settings.AUTH_SESSION_TTL_SECONDS and settings.AUTH_SESSION_TTL_SECONDS > 0:
        return int(settings.AUTH_SESSION_TTL_SECONDS)
    # 优先与访问令牌时长对齐，否则使用学生会话TTL
    return max(int(settings.ACCESS_TOKEN_EXPIRE_MINUTES) * 60, int(settings.STUDENT_SESSION_TTL))


async def get_user_session(user_id: int) -> Optional[Dict[str, Any]]:
    v = await cache.get(_key_user(user_id))
    return v if isinstance(v, dict) else None


async def set_user_session(user_id: int, data: Dict[str, Any]) -> bool:
    return await cache.set(_key_user(user_id), data, expire_seconds=_session_ttl())


async def set_ip_binding(ip: str, data: Dict[str, Any]) -> bool:
    return await cache.set(_key_ip(ip), data, expire_seconds=_session_ttl())


async def get_ip_binding(ip: str) -> Optional[Dict[str, Any]]:
    v = await cache.get(_key_ip(ip))
    return v if isinstance(v, dict) else None


async def rotate_user_session(user_id: int, keep_ip: Optional[str] = None) -> Dict[str, Any]:
    """旋转用户会话nonce，踢出旧会话。"""
    nonce = secrets.token_urlsafe(16)
    data = {"nonce": nonce, "ip": keep_ip or "", "updated_at": _now_iso()}
    await set_user_session(user_id, data)
    return data


async def on_successful_login(user_id: int, request: Request) -> Tuple[str, str]:
    """
    登录成功时：
    - 解析客户端IP
    - 保证“一个用户只有一个IP（最近一次）”与“一个IP只能绑定一个用户”
    - 返回 (nonce, client_ip)
    """
    ip = extract_client_ip(request)
    # 处理 IP -> 用户 的唯一性
    if settings.AUTH_USER_UNIQUE_PER_IP:
        existing = await get_ip_binding(ip)
        if existing and int(existing.get("user_id", 0)) != int(user_id):
            # 踢掉该IP上的旧用户
            old_uid = int(existing.get("user_id", 0))
            await rotate_user_session(old_uid)  # 旧用户下次请求即失效
    # 处理 用户 -> IP 的唯一性
    nonce_data = await rotate_user_session(user_id, keep_ip=ip) if settings.AUTH_IP_UNIQUE_PER_USER else await get_user_session(user_id) or await rotate_user_session(user_id, keep_ip=ip)
    await set_ip_binding(ip, {"user_id": int(user_id), "nonce": nonce_data["nonce"], "updated_at": _now_iso()})
    return nonce_data["nonce"], ip


async def verify_request_session(user_id: int, token_payload: Dict[str, Any], request: Optional[Request] = None) -> bool:
    """验证请求中的令牌是否与当前有效会话匹配（nonce匹配，必要时IP匹配）"""
    stored = await get_user_session(user_id)
    if not stored:
        return False
    token_nonce = str(token_payload.get("sn", ""))
    if not token_nonce or token_nonce != str(stored.get("nonce", "")):
        return False
    if settings.AUTH_ENFORCE_SAME_IP_PER_REQUEST and request is not None:
        ip = extract_client_ip(request)
        if ip and stored.get("ip"):
            return ip == stored.get("ip")
    return True

