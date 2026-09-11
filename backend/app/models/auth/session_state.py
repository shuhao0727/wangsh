"""Keep revoked rows: their nonce fence also covers pre-family access JWTs."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from app.db.database import Base


class AuthSessionState(Base):
    __tablename__ = "auth_session_states"

    user_id = Column(Integer, ForeignKey("sys_users.id", ondelete="CASCADE"), primary_key=True)
    nonce = Column(String(128), nullable=False)
    ip = Column(String(64), nullable=False)
    active = Column(Boolean, nullable=False)
    # IP occupation expires; the revocation nonce/tombstone never does.
    ip_expires_at = Column(DateTime(timezone=True), nullable=True)


class AuthAuthority(Base):
    """Singleton deployment gate. Migration starts CLOSED; never auto-open."""
    __tablename__ = "auth_authority"

    id = Column(Integer, primary_key=True)
    ready = Column(Boolean, nullable=False)
