from __future__ import annotations

from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _fernet() -> Fernet:
    key = (settings.AGENT_API_KEY_ENCRYPTION_KEY or "").strip()
    if not key:
        raise RuntimeError("AGENT_API_KEY_ENCRYPTION_KEY 未配置")
    return Fernet(key.encode("utf-8"))


def encrypt_api_key(api_key: str) -> str:
    token = _fernet().encrypt(api_key.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_api_key(token: str) -> str:
    data = _fernet().decrypt(token.encode("utf-8"))
    return data.decode("utf-8")


def try_decrypt_api_key(token: Optional[str]) -> Optional[str]:
    if not token:
        return None
    try:
        return decrypt_api_key(token)
    except (InvalidToken, RuntimeError):
        return None


def last4(api_key: Optional[str]) -> Optional[str]:
    if not api_key:
        return None
    s = str(api_key)
    if len(s) <= 4:
        return s
    return s[-4:]

