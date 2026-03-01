"""SQLAlchemy models for hosted auth, billing, and team features."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utc_now() -> datetime:
    """Naive UTC timestamp for DB columns stored as TIMESTAMP WITHOUT TIME ZONE."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    """Declarative base class for API persistence models."""


class User(Base):
    """Application user account."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lockout_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Supabase correlation: set when SKILLGATE_AUTH_PROVIDER=supabase; NULL in local mode.
    supabase_user_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True, unique=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now, onupdate=_utc_now, nullable=False
    )

    api_keys: Mapped[list[APIKey]] = relationship(back_populates="user")
    subscriptions: Mapped[list[Subscription]] = relationship(back_populates="user")
    sessions: Mapped[list[UserSession]] = relationship(back_populates="user")


class APIKey(Base):
    """Generated API key metadata with one-way hash storage."""

    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    key_prefix: Mapped[str] = mapped_column(String(24), index=True)
    key_hash: Mapped[str] = mapped_column(String(128), unique=True)
    scopes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped[User] = relationship(back_populates="api_keys")


class Subscription(Base):
    """Stripe-backed subscription state for a user."""

    __tablename__ = "subscriptions"
    __table_args__ = (UniqueConstraint("stripe_subscription_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True, unique=True
    )
    stripe_subscription_id: Mapped[str] = mapped_column(String(64), index=True)
    stripe_customer_id: Mapped[str] = mapped_column(String(64), index=True)
    tier: Mapped[str] = mapped_column(String(24), default="pro", nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="active", nullable=False)
    billing_interval: Mapped[str] = mapped_column(String(12), default="monthly", nullable=False)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_stripe_event_created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_stripe_event_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now, onupdate=_utc_now, nullable=False
    )

    user: Mapped[User] = relationship(back_populates="subscriptions")


class Team(Base):
    """Team account owned by a user."""

    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    max_seats: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)


class TeamMember(Base):
    """Membership records for team seats."""

    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "email"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    email: Mapped[str] = mapped_column(String(320), index=True)
    role: Mapped[str] = mapped_column(String(24), default="member", nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="invited", nullable=False)
    invited_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)
    joined_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class StripeEvent(Base):
    """Idempotency store for Stripe webhook processing."""

    __tablename__ = "stripe_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="processing", nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    dead_lettered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ScanRecord(Base):
    """Persisted scan report tied to the submitting user."""

    __tablename__ = "scan_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    report_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)


class UserSession(Base):
    """Long-lived session row used for refresh-token rotation and revocation."""

    __tablename__ = "user_sessions"
    __table_args__ = (UniqueConstraint("refresh_token_hash"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    refresh_token_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    parent_session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    rotated_to_session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)

    user: Mapped[User] = relationship(back_populates="sessions")


class PasswordResetToken(Base):
    """Single-use password reset token."""

    __tablename__ = "password_reset_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)


class EmailVerificationToken(Base):
    """Single-use email verification token."""

    __tablename__ = "email_verification_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)


class OAuthIdentity(Base):
    """Mapping from OAuth provider account to local user."""

    __tablename__ = "oauth_identities"
    __table_args__ = (UniqueConstraint("provider", "provider_user_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_user_id: Mapped[str] = mapped_column(String(190), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now, onupdate=_utc_now, nullable=False
    )


class AuthRateLimit(Base):
    """Persistent rate-limit buckets for auth/payment abuse controls."""

    __tablename__ = "auth_rate_limits"
    __table_args__ = (UniqueConstraint("scope", "bucket_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    scope: Mapped[str] = mapped_column(String(64), nullable=False)
    bucket_key: Mapped[str] = mapped_column(String(190), nullable=False)
    count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    window_started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    blocked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now, onupdate=_utc_now, nullable=False
    )


class EntitlementUsageLedger(Base):
    """Authoritative per-day usage counters for entitlement enforcement."""

    __tablename__ = "entitlement_usage_ledger"
    __table_args__ = (UniqueConstraint("subject_key", "mode", "usage_date"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    subject_key: Mapped[str] = mapped_column(String(64), index=True)
    mode: Mapped[str] = mapped_column(String(24), nullable=False)
    usage_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    tier: Mapped[str] = mapped_column(String(24), nullable=False)
    used_scans: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    scan_limit: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now, onupdate=_utc_now, nullable=False
    )


class EntitlementDecisionLog(Base):
    """Audit log for entitlement allow/deny decisions."""

    __tablename__ = "entitlement_decision_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    subject_key: Mapped[str] = mapped_column(String(64), index=True)
    mode: Mapped[str] = mapped_column(String(24), nullable=False)
    tier: Mapped[str] = mapped_column(String(24), nullable=False)
    allowed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(120), nullable=True)
    used_scans: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    scan_limit: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    drift: Mapped[int | None] = mapped_column(Integer, nullable=True)
    provenance: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)
