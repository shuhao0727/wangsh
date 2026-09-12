"""
认证服务
简化的认证功能
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt
from jwt.exceptions import PyJWTError
from sqlalchemy.exc import MultipleResultsFound

from app.core.config import settings
from app.core.session_family import (
    new_family_refresh, refresh_family, lock_auth_mutation, session_state,
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    # 使用utils.security中的verify_password函数，确保一致性
    from app.utils.security import verify_password as utils_verify_password
    return utils_verify_password(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """生成密码哈希"""
    from app.utils.security import get_password_hash as utils_get_password_hash
    return utils_get_password_hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """创建访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """验证 JWT 令牌"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except PyJWTError:
        return None


async def authenticate_user(
    db, identifier: str, credential: str, user_type: str = "admin"
) -> Optional[Dict[str, Any]]:
    """
    统一用户认证 — 所有角色均使用 姓名(identifier) + 学号/密码(credential)

    identifier 用于定位用户（full_name / student_id / username，均为公开标识符）
    credential 优先匹配 student_id；有 hashed_password 的账号也可使用密码，
    保持项目统一的“姓名 + 学号”登录契约并兼容历史密码账号。
    """
    from sqlalchemy import select, or_
    from app.models import User
    from app.utils.security import verify_password

    query = select(User).where(
        or_(User.full_name == identifier, User.student_id == identifier, User.username == identifier),
        User.is_deleted.is_(False),
        User.is_active.is_(True)
    )
    result = await db.execute(query)
    candidates = result.scalars().all()
    matching_users = [
        user
        for user in candidates
        if (user.student_id and user.student_id == credential)
        or (user.hashed_password and verify_password(credential, user.hashed_password))
    ]
    if len(matching_users) != 1:
        return None
    user = matching_users[0]

    # 返回用户信息
    return {
        "id": user.id,
        "role_code": user.role_code,
        "username": user.username,
        "student_id": user.student_id,
        "full_name": user.full_name,
        "class_name": user.class_name,
        "study_year": user.study_year,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "updated_at": user.updated_at
    }


async def authenticate_user_auto(
    db, identifier: str, credential: str
) -> Optional[Dict[str, Any]]:
    """统一认证 — 所有角色使用 姓名+学号"""
    return await authenticate_user(db, identifier, credential)


async def resolve_legacy_subject(db, subject):
    """Resolve only one live legacy identity; ambiguity is not proof of ownership.

    This does not bind mutable subjects to their original token owner. ID/token
    migration is a separate contract; never choose a first or preferred match.
    """
    from sqlalchemy import select, or_
    from app.models import User

    if not isinstance(subject, str) or not subject:
        return None
    result = await db.execute(select(User).where(
        or_(User.username == subject, User.full_name == subject, User.student_id == subject),
        User.is_deleted.is_(False),
        User.is_active.is_(True),
    ))
    try:
        return result.scalar_one_or_none()
    except MultipleResultsFound:
        return None


async def get_current_user(token: str, db=None) -> Optional[Dict[str, Any]]:
    """
    Internal legacy identity lookup after JWT verification, not session authentication.

    Does not validate nonce/IP or bind a mutable subject to its original owner.
    Request authentication must use core.deps session-verifying dependencies.
    """
    payload = verify_token(token)
    if payload is None:
        return None

    subject = payload.get("sub")  # JWT中的subject
    role_code = payload.get("role_code")  # 从令牌中获取角色代码
    
    if not isinstance(subject, str) or not subject:
        return None
    
    # A supplied DB is authoritative; missing/ambiguous users are not claims-only identities.
    if db is not None:
        user = await resolve_legacy_subject(db, subject)
        
        if user:
            return {
                "id": user.id,
                "role_code": user.role_code,
                "username": user.username,
                "student_id": user.student_id,
                "full_name": user.full_name,
                "class_name": user.class_name,
                "study_year": user.study_year,
                "is_active": user.is_active,
                "created_at": user.created_at,
                "updated_at": user.updated_at
            }
        return None
    
    # 没有数据库连接时，返回令牌中的基本用户信息
    return {
        "id": 0,
        "role_code": role_code or "guest",
        "username": subject,
        "full_name": payload.get("name", ""),
        "is_active": True,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }


# ==================== 刷新令牌功能 ====================

async def create_refresh_token(db, user_id: int) -> str:
    """
    创建刷新令牌并保存到数据库
    
    Args:
        db: 数据库会话
        user_id: 用户ID
    
    Returns:
        刷新令牌字符串
    """
    from app.models import RefreshToken
    import secrets
    
    # 生成安全的随机令牌
    token = secrets.token_urlsafe(64)
    
    # 计算过期时间（默认30天）
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    # 创建刷新令牌记录
    refresh_token = RefreshToken(
        user_id=user_id,
        token=token,
        expires_at=expires_at,
        is_revoked=False
    )
    
    db.add(refresh_token)
    await db.commit()
    
    return token


async def lock_user_for_login(db, user_id: int) -> bool:
    """串行化同一账号的登录流程，保证 nonce 与 refresh token 顺序一致。"""
    from sqlalchemy import select
    from app.models import User

    await lock_auth_mutation(db)
    result = await db.execute(
        select(User.id)
        .where(
            User.id == user_id,
            User.is_active.is_(True),
            User.is_deleted.is_(False),
        )
        .with_for_update()
    )
    return result.scalar_one_or_none() is not None


async def issue_login_refresh_token(
    db,
    user_id: int,
    *,
    user_locked: bool = False,
    commit: bool = True,
) -> str:
    """在用户行锁保护下撤销旧 refresh token，并原子签发唯一新 token。"""
    from sqlalchemy import update
    from app.models import RefreshToken
    import secrets

    try:
        if not user_locked and not await lock_user_for_login(db, user_id):
            raise ValueError("用户不存在或不可登录")

        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .values(is_revoked=True)
        )

        token = new_family_refresh()
        db.add(
            RefreshToken(
                user_id=user_id,
                token=token,
                expires_at=datetime.now(timezone.utc)
                + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
                is_revoked=False,
            )
        )
        if commit:
            await db.commit()
        return token
    except Exception:
        await db.rollback()
        raise


async def verify_refresh_token(db, token: str) -> Optional[Dict[str, Any]]:
    """
    验证刷新令牌有效性
    
    Args:
        db: 数据库会话
        token: 刷新令牌
    
    Returns:
        用户ID字典或None
    """
    from sqlalchemy import select, and_
    from app.models import RefreshToken, User
    
    # 查询有效的刷新令牌
    query = select(RefreshToken).where(
        and_(
            RefreshToken.token == token,
            RefreshToken.expires_at > datetime.now(timezone.utc),
            RefreshToken.is_revoked == False
        )
    )
    
    result = await db.execute(query)
    refresh_token_record = result.scalar_one_or_none()
    
    if not refresh_token_record:
        return None
    
    # 获取关联的用户信息
    user_query = select(User).where(
        User.id == refresh_token_record.user_id,
        User.is_active.is_(True),
        User.is_deleted.is_(False),
    )
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()
    
    if not user or not user.is_active or user.is_deleted:
        return None
    
    return {
        "user_id": user.id,
        "role_code": user.role_code,
        "username": user.username,
        "student_id": user.student_id,
        "full_name": user.full_name,
        "class_name": user.class_name,
        "study_year": user.study_year
    }


async def rotate_refresh_token(
    db,
    token: str,
    *,
    commit: bool = True,
) -> Optional[Dict[str, Any]]:
    """原子消费旧刷新令牌并签发新令牌，防止并发重放。"""
    from sqlalchemy import and_, select
    from app.models import RefreshToken, User
    import secrets

    try:
        await lock_auth_mutation(db)
        family = refresh_family(token)
        # 先只读取 user_id，再按与登录一致的顺序获取“用户行 -> token 行”锁。
        # 锁后必须重新校验 token，避免登录在等待期间已经将其撤销。
        owner_query = select(RefreshToken.user_id).where(
            and_(
                RefreshToken.token == token,
                RefreshToken.expires_at > datetime.now(timezone.utc),
                RefreshToken.is_revoked.is_(False),
            )
        )
        owner_result = await db.execute(owner_query)
        user_id = owner_result.scalar_one_or_none()
        if user_id is None:
            await db.rollback()
            return None

        user_query = (
            select(User)
            .where(
                User.id == user_id,
                User.is_active.is_(True),
                User.is_deleted.is_(False),
            )
            .with_for_update()
        )
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()
        if not user or not user.is_active or user.is_deleted:
            await db.rollback()
            return None

        state = await session_state(db, user_id)
        if state is None or not state.active or (family and state.nonce != family):
            await db.rollback()
            return None

        token_query = (
            select(RefreshToken)
            .where(
                and_(
                    RefreshToken.token == token,
                    RefreshToken.user_id == user_id,
                    RefreshToken.expires_at > datetime.now(timezone.utc),
                    RefreshToken.is_revoked.is_(False),
                )
            )
            .with_for_update()
        )
        result = await db.execute(token_query)
        refresh_token_record = result.scalar_one_or_none()
        if not refresh_token_record:
            await db.rollback()
            return None

        new_token = new_family_refresh(family) if family else secrets.token_urlsafe(64)
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        refresh_token_record.is_revoked = True
        db.add(
            RefreshToken(
                user_id=user.id,
                token=new_token,
                expires_at=expires_at,
                is_revoked=False,
            )
        )
        if commit:
            await db.commit()

        return {
            "user_id": user.id,
            "role_code": user.role_code,
            "username": user.username,
            "student_id": user.student_id,
            "full_name": user.full_name,
            "class_name": user.class_name,
            "study_year": user.study_year,
            "refresh_token": new_token,
            "session_family": family,
        }
    except Exception:
        await db.rollback()
        raise


async def lock_refresh_token_owner_for_logout(db, token: str) -> Optional[int]:
    """仅以仍有效的 refresh 授权退出；返回时持有用户行和 token 行锁。"""
    from sqlalchemy import select
    from app.models import RefreshToken

    def valid_token_query():
        return select(RefreshToken.user_id).where(
            RefreshToken.token == token,
            RefreshToken.expires_at > datetime.now(timezone.utc),
            RefreshToken.is_revoked.is_(False),
        )

    # 与 login/refresh 一致：先只读归属，再锁用户，最后锁 token 并重验。
    # 不能仅凭第一次查询得到的 user_id 撤销：等待用户锁时可能已经重登。
    owner_result = await db.execute(valid_token_query())
    user_id = owner_result.scalar_one_or_none()
    if user_id is None or not await lock_user_for_login(db, user_id):
        await db.rollback()
        return None

    token_result = await db.execute(
        valid_token_query()
        .where(RefreshToken.user_id == user_id)
        .with_for_update()
    )
    if token_result.scalar_one_or_none() is None:
        await db.rollback()
        return None
    return user_id


async def revoke_all_user_refresh_tokens(
    db,
    user_id: int,
    *,
    commit: bool = True,
) -> bool:
    """
    撤销用户的所有刷新令牌
    
    Args:
        db: 数据库会话
        user_id: 用户ID
    
    Returns:
        是否成功撤销
    """
    from sqlalchemy import update
    from app.models import RefreshToken
    
    # 更新所有该用户的令牌为已撤销
    stmt = update(RefreshToken).where(
        RefreshToken.user_id == user_id
    ).values(is_revoked=True)
    
    await db.execute(stmt)
    if commit:
        await db.commit()
    
    return True


class AuthCutoverEvidenceError(ValueError):
    """Safe operator diagnostic: only unproven integer user ids, never tokens."""
    def __init__(self, user_ids):
        self.user_ids = sorted(user_ids)
        super().__init__("Unproven legacy users require explicit reauthentication approval: "
                         + ",".join(map(str, self.user_ids)))


async def _collect_cutover_sessions(db, users, live_uids, reauthenticate_user_ids):
    """Baseline per-user cache evidence; live users without proof become uncertain."""
    from app.core.session_guard import get_auth_snapshot_strict, _key_user
    from app.core.session_family import valid_family_nonce

    sessions: dict[int, dict] = {}
    deadlines: dict[int, object] = {}
    uncertain: set[int] = set()
    snapshot = await get_auth_snapshot_strict([_key_user(user.id) for user in users]) if users else {}
    for user in users:
        if not user.is_active or user.is_deleted or user.id in reauthenticate_user_ids:
            continue
        cached, deadline = snapshot[_key_user(user.id)]
        if (isinstance(cached, dict) and valid_family_nonce(cached.get("nonce"))
                and isinstance(cached.get("ip"), str) and 0 < len(cached["ip"]) <= 64
                and deadline is not None):
            sessions[user.id] = cached
            deadlines[user.id] = deadline
        elif user.id in live_uids or cached is not None:
            uncertain.add(user.id)
    return sessions, deadlines, uncertain


async def _prune_ip_contested_sessions(db, sessions, deadlines, uncertain) -> None:
    """With per-IP uniqueness, only the binding-proven owner keeps its session."""
    from app.core.session_guard import get_auth_snapshot_strict, _key_ip
    from app.core.session_family import valid_family_nonce

    groups: dict[str, list[int]] = {}
    for uid, cached in sessions.items():
        groups.setdefault(cached["ip"], []).append(uid)
    if not groups:
        return
    bindings = await get_auth_snapshot_strict([_key_ip(ip) for ip in groups])
    for ip, uids in groups.items():
        binding, deadline = bindings[_key_ip(ip)]
        if binding is None and len(uids) == 1:
            # User snapshot proves sole owner even if IP key was lost.
            # Retain only that existing remaining lease, never reset TTL.
            continue
        winner = _binding_proven_winner(binding, uids, sessions, deadline, valid_family_nonce)
        if winner is not None:
            deadlines[winner] = min(deadlines[winner], deadline)
            for uid in uids:
                if uid != winner:
                    sessions.pop(uid)
        else:
            uncertain.update(uids)


def _binding_proven_winner(binding, uids, sessions, deadline, valid_nonce) -> Optional[int]:
    """Return the sole owner whose session nonce matches a valid IP binding."""
    winner = binding.get("user_id") if isinstance(binding, dict) else None
    if not (type(winner) is int and winner > 0 and winner in uids):
        return None
    if (valid_nonce(binding.get("nonce")) and binding["nonce"] == sessions[winner]["nonce"]
            and deadline is not None):
        return winner
    return None


def _materialize_cutover_state(db, users, live, sessions, deadlines, gate) -> None:
    """Write durable session rows, revoke unproven refresh tokens, open the gate."""
    import secrets
    from app.models import AuthSessionState

    for user in users:
        cached = sessions.get(user.id)
        db.add(AuthSessionState(
            user_id=user.id,
            nonce=cached["nonce"] if cached else secrets.token_urlsafe(16),
            ip=cached["ip"] if cached else "", active=cached is not None,
            ip_expires_at=deadlines[user.id] if cached else None,
        ))
    for token in live:
        cached = sessions.get(token.user_id)
        try:
            family = refresh_family(token.token)
        except ValueError:
            family = "invalid"
        if not cached or (family and family != cached["nonce"]):
            token.is_revoked = True
    gate.ready = True


async def bootstrap_durable_auth_authority(
    db, *, legacy_writers_stopped: bool = False,
    reauthenticate_user_ids: frozenset[int] = frozenset(),
    dry_run: bool = False,
) -> dict[str, int]:
    """Explicit one-time cutover; NEVER call from requests or application startup.

    Stop old authentication writers and drain in-flight requests first. Preserve
    legacy credentials only where the per-user cache proves the current nonce/IP.
    Missing/conflicting evidence with live refresh requires explicit per-user
    reauthentication approval; no implicit bulk logout. The whole baseline and
    ready gate commit together. Caller must not mix unrelated pending DB writes.
    """
    import secrets
    from sqlalchemy import select, text
    from app.models import AuthAuthority, AuthSessionState, RefreshToken, User

    if not legacy_writers_stopped:
        raise ValueError("Stop and drain all legacy authentication writers before cutover")
    if any(type(uid) is not int or uid <= 0 for uid in reauthenticate_user_ids):
        raise ValueError("Reauthentication approval requires exact positive integer user ids")
    if db.in_transaction():
        raise ValueError("Cutover requires a fresh dedicated transaction")
    try:
        gate = await _cutover_gate_and_fence(db, User, RefreshToken)
        if gate is None:
            raise RuntimeError("Apply the AUTH authority migration first")
        if gate.ready:
            await db.rollback()
            return {"already_ready": 1, "preserved": 0, "reauthenticate": 0}
        users = (await db.execute(select(User).order_by(User.id))).scalars().all()
        if not reauthenticate_user_ids <= {user.id for user in users}:
            raise ValueError("Reauthentication approval contains unknown user ids")
        live = (await db.execute(select(RefreshToken).where(
            RefreshToken.is_revoked.is_(False),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        ))).scalars().all()
        live_uids = {token.user_id for token in live}
        sessions, deadlines, uncertain = await _collect_cutover_sessions(
            db, users, live_uids, reauthenticate_user_ids)
        if settings.AUTH_USER_UNIQUE_PER_IP:
            await _prune_ip_contested_sessions(db, sessions, deadlines, uncertain)
        if uncertain:
            raise AuthCutoverEvidenceError(uncertain)
        _materialize_cutover_state(db, users, live, sessions, deadlines, gate)
        result = {"already_ready": 0, "preserved": len(sessions),
                  "reauthenticate": len(live_uids - sessions.keys())}
        await db.flush()
        if dry_run:
            await db.rollback()
        else:
            await db.commit()
        return result
    except BaseException:
        await db.rollback()
        raise


async def _cutover_gate_and_fence(db, User, RefreshToken):
    """Lock the closed authority row and fence legacy writers on PostgreSQL."""
    from sqlalchemy import select, text
    from app.models import AuthAuthority, AuthSessionState

    await lock_auth_mutation(db, require_ready=False)
    gate = await db.scalar(select(AuthAuthority).where(AuthAuthority.id == 1).with_for_update())
    if gate is None or gate.ready:
        return gate
    if await db.scalar(select(AuthSessionState.user_id).limit(1)) is not None:
        raise RuntimeError("Closed authority has existing evidence; refusing to overwrite it")
    if db.get_bind().dialect.name == "postgresql":
        # Unlike the advisory lock, these also fence non-AUTH account/token
        # writers while reading the baseline. Operational Redis freeze and
        # draining OLD replicas are still mandatory, not inferred here.
        quote = db.get_bind().dialect.identifier_preparer.quote
        names = ", ".join(quote(m.__table__.name) for m in (User, RefreshToken))
        await db.execute(text(f"LOCK TABLE {names} IN SHARE ROW EXCLUSIVE MODE"))
    return gate
