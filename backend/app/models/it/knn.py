"""KNN classroom collection: batches, roster and immutable answer revisions."""
from sqlalchemy import (Boolean, CheckConstraint, Column, DateTime, ForeignKey,
                        Integer, JSON, String, UniqueConstraint, func)
from app.db.database import Base


class KnnBatch(Base):
    __tablename__ = "it_knn_batches"
    __table_args__ = (
        CheckConstraint("ends_at > starts_at", name="ck_knn_batch_window"),
        CheckConstraint("state IN ('draft', 'scheduled', 'closed')", name="ck_knn_batch_state"),
    )
    id = Column(String(36), primary_key=True)
    title = Column(String(120), nullable=False)
    created_by = Column(Integer, ForeignKey("sys_users.id", ondelete="SET NULL"), index=True)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    state = Column(String(16), nullable=False, default="draft")
    frozen_data = Column(JSON, nullable=True)
    frozen_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class KnnRosterEntry(Base):
    __tablename__ = "it_knn_roster"
    __table_args__ = (
        UniqueConstraint("batch_id", "student_key", name="uq_knn_roster_student"),
        CheckConstraint("current_revision >= 0", name="ck_knn_roster_revision"),
    )
    id = Column(Integer, primary_key=True)
    batch_id = Column(String(36), ForeignKey("it_knn_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    student_no = Column(String(24), nullable=False)
    student_key = Column(String(24), nullable=False)
    position = Column(Integer, nullable=False)
    current_revision = Column(Integer, nullable=False, default=0)
    refill_allowed = Column(Boolean, nullable=False, default=False)


class KnnSubmission(Base):
    __tablename__ = "it_knn_submissions"
    __table_args__ = (
        UniqueConstraint("roster_id", "revision", name="uq_knn_submission_revision"),
        UniqueConstraint("roster_id", "request_id", name="uq_knn_submission_request"),
        CheckConstraint("revision > 0", name="ck_knn_submission_revision"),
    )
    id = Column(Integer, primary_key=True)
    roster_id = Column(Integer, ForeignKey("it_knn_roster.id", ondelete="CASCADE"), nullable=False, index=True)
    revision = Column(Integer, nullable=False)
    request_id = Column(String(36), nullable=False)
    payload_hash = Column(String(64), nullable=False)
    features = Column(JSON, nullable=False)
    label = Column(String(12), nullable=False)
    display_consent = Column(Boolean, nullable=False, default=False)
    submitted_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
