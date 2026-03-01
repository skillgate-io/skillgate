"""Stripe payment integration — Checkout Sessions, subscriptions, webhooks."""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Callable
from contextlib import suppress
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import TypeVar
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from skillgate.api.auth_context import AuthContext, get_auth_context, require_api_key_scope
from skillgate.api.db import get_session
from skillgate.api.models import StripeEvent, Subscription, User
from skillgate.api.rate_limit import enforce_rate_limit
from skillgate.api.resilience import CircuitBreaker, run_blocking_with_resilience
from skillgate.api.security import hash_password
from skillgate.api.telemetry import get_meter, get_tracer

TStripe = TypeVar("TStripe")

router = APIRouter(prefix="/payments", tags=["payments"])
logger = logging.getLogger(__name__)
MAX_WEBHOOK_RETRIES = 5
EXTERNAL_CALL_TIMEOUT_SECONDS = 8.0
CHECKOUT_IP_LIMIT = 25
CHECKOUT_EMAIL_LIMIT = 12
RATE_WINDOW_SECONDS = 300
RATE_BLOCK_SECONDS = 900
STRIPE_CALL_BREAKER = CircuitBreaker(failure_threshold=5, recovery_seconds=45)

meter = get_meter("skillgate.api.payments")
tracer = get_tracer("skillgate.api.payments")
checkout_attempts_counter = meter.create_counter("payments_checkout_attempts")
checkout_failures_counter = meter.create_counter("payments_checkout_failures")
webhook_events_counter = meter.create_counter("payments_webhook_events")
webhook_failures_counter = meter.create_counter("payments_webhook_failures")
webhook_lag_histogram = meter.create_histogram("payments_webhook_lag_seconds")
rate_limit_counter = meter.create_counter("payments_rate_limited")

# Stripe price IDs with billing interval support (Sprint 7.2: Task 17.44)
# Industry standard: monthly (default) + yearly with ~17% discount (2 months free)
PRICE_IDS: dict[tuple[str, str], str] = {
    ("pro", "monthly"): os.environ.get("STRIPE_PRICE_PRO_MONTHLY", "price_pro_monthly"),
    ("pro", "yearly"): os.environ.get("STRIPE_PRICE_PRO_YEARLY", "price_pro_yearly"),
    ("team", "monthly"): os.environ.get("STRIPE_PRICE_TEAM_MONTHLY", "price_team_monthly"),
    ("team", "yearly"): os.environ.get("STRIPE_PRICE_TEAM_YEARLY", "price_team_yearly"),
    ("enterprise", "monthly"): os.environ.get(
        "STRIPE_PRICE_ENT_MONTHLY", "price_enterprise_monthly"
    ),
    ("enterprise", "yearly"): os.environ.get("STRIPE_PRICE_ENT_YEARLY", "price_enterprise_yearly"),
}

# Legacy env var support (fallback for existing deployments)
if not os.environ.get("STRIPE_PRICE_PRO_MONTHLY") and os.environ.get("STRIPE_PRICE_PRO"):
    PRICE_IDS[("pro", "monthly")] = os.environ["STRIPE_PRICE_PRO"]
if not os.environ.get("STRIPE_PRICE_TEAM_MONTHLY") and os.environ.get("STRIPE_PRICE_TEAM"):
    PRICE_IDS[("team", "monthly")] = os.environ["STRIPE_PRICE_TEAM"]
if not os.environ.get("STRIPE_PRICE_ENT_MONTHLY") and os.environ.get("STRIPE_PRICE_ENT"):
    PRICE_IDS[("enterprise", "monthly")] = os.environ["STRIPE_PRICE_ENT"]


class CheckoutRequest(BaseModel):
    """Request to create a Stripe Checkout Session."""

    tier: str = Field(description="Target tier: pro, team, or enterprise")
    billing_interval: str = Field(
        default="monthly",
        description="Billing interval: monthly or yearly (yearly = ~17% discount)",
    )
    customer_email: str | None = Field(
        default=None, description="Pre-fill customer email in Checkout"
    )
    success_url: str = Field(default="https://skillgate.io/success")
    cancel_url: str = Field(default="https://skillgate.io/cancel")


class CheckoutResponse(BaseModel):
    """Response with Stripe-hosted Checkout URL."""

    checkout_url: str
    session_id: str


class CustomerPortalResponse(BaseModel):
    """Response with Stripe Customer Portal URL."""

    portal_url: str


class SubscriptionResponse(BaseModel):
    """Response with subscription details."""

    subscription_id: str
    tier: str
    billing_interval: str
    status: str
    current_period_end: str | None = None


class WebhookResponse(BaseModel):
    """Response from webhook processing."""

    received: bool


class StripeEventRecord(BaseModel):
    """Webhook event record summary."""

    event_id: str
    event_type: str
    status: str
    attempt_count: int
    next_retry_at: str | None = None
    dead_lettered: bool
    error_message: str | None = None


class DeadLetterResponse(BaseModel):
    """Dead-letter event listing response."""

    events: list[StripeEventRecord]


class ReplayResponse(BaseModel):
    """Replay execution response."""

    event_id: str
    status: str


class ReconcileResponse(BaseModel):
    """Subscription reconciliation response."""

    scanned: int
    changed: int


class PortalSyncRequest(BaseModel):
    """Customer portal sync payload."""

    customer_id: str
    limit: int = Field(default=20, ge=1, le=100)


def _event_record_from_model(row: StripeEvent) -> StripeEventRecord:
    next_retry = row.next_retry_at
    return StripeEventRecord(
        event_id=row.id,
        event_type=row.event_type,
        status=row.status,
        attempt_count=row.attempt_count,
        next_retry_at=next_retry.isoformat() if next_retry is not None else None,
        dead_lettered=row.dead_lettered,
        error_message=row.error_message,
    )


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_stripe_key() -> str:
    """Get Stripe secret key from environment."""
    key = os.environ.get("STRIPE_SECRET_KEY", "")
    if not key:
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured. Set STRIPE_SECRET_KEY.",
        )
    return key


def _event_lag_seconds(created_at: object) -> int | None:
    """Return Stripe event ingest lag in seconds for observability."""
    if not isinstance(created_at, int):
        return None
    now_ts = int(datetime.now(timezone.utc).timestamp())
    return max(0, now_ts - created_at)


def _tier_and_interval_from_price(price_id: str | None) -> tuple[str, str]:
    """Map Stripe price id to SkillGate tier and billing interval."""
    if not price_id:
        return ("pro", "monthly")
    for (tier, interval), configured_id in PRICE_IDS.items():
        if configured_id == price_id:
            return (tier, interval)
    return ("pro", "monthly")


def _tier_from_price(price_id: str | None) -> str:
    """Legacy: extract tier only (for backward compatibility)."""
    tier, _ = _tier_and_interval_from_price(price_id)
    return tier


def _extract_period_end(value: object) -> datetime | None:
    """Convert Stripe unix timestamp to naive UTC datetime."""
    if isinstance(value, int):
        return datetime.fromtimestamp(value, tz=timezone.utc).replace(tzinfo=None)
    return None


def _tier_and_interval_from_subscription_object(obj: dict[str, object]) -> tuple[str, str]:
    """Extract tier and billing interval from subscription item price."""
    items = obj.get("items")
    if isinstance(items, dict):
        data = items.get("data")
        if isinstance(data, list) and data:
            first = data[0]
            if isinstance(first, dict):
                price = first.get("price")
                if isinstance(price, dict):
                    price_id = price.get("id")
                    if isinstance(price_id, str):
                        return _tier_and_interval_from_price(price_id)
    return ("pro", "monthly")


def _tier_from_subscription_object(obj: dict[str, object]) -> str:
    """Legacy: extract tier only (for backward compatibility)."""
    tier, _ = _tier_and_interval_from_subscription_object(obj)
    return tier


def _event_time(created_at: object) -> datetime | None:
    if not isinstance(created_at, int):
        return None
    return datetime.fromtimestamp(created_at, tz=timezone.utc).replace(tzinfo=None)


def _is_stale_event(subscription: Subscription, event_time: datetime | None, event_id: str) -> bool:
    if event_time is None:
        return False
    if subscription.last_stripe_event_created_at is None:
        return False
    if event_time < subscription.last_stripe_event_created_at:
        return True
    return (
        event_time == subscription.last_stripe_event_created_at
        and subscription.last_stripe_event_id is not None
        and event_id <= subscription.last_stripe_event_id
    )


def _touch_subscription_event(
    subscription: Subscription,
    event_time: datetime | None,
    event_id: str,
) -> None:
    if event_time is None:
        return
    subscription.last_stripe_event_created_at = event_time
    subscription.last_stripe_event_id = event_id


def _admin_key() -> str:
    return os.environ.get("SKILLGATE_ADMIN_KEY", "")


def _client_ip(request: Request) -> str:
    """Get client IP with trusted proxy support.

    Only trust x-forwarded-for if request comes from known proxy.
    Otherwise use direct socket IP to prevent spoofing.
    """
    # In production, check if request is from trusted proxy
    # For now, we use socket IP which cannot be spoofed
    client = request.client
    if client is None:
        return "unknown"
    return client.host


async def _stripe_call(name: str, fn: Callable[[], TStripe]) -> TStripe:
    with tracer.start_as_current_span(f"stripe.{name}") as span:
        span.set_attribute("stripe.call", name)
        try:
            return await run_blocking_with_resilience(
                breaker=STRIPE_CALL_BREAKER,
                timeout_seconds=EXTERNAL_CALL_TIMEOUT_SECONDS,
                fn=fn,
            )
        except TimeoutError as exc:
            span.set_attribute("stripe.error", "timeout")
            raise HTTPException(status_code=504, detail="Stripe request timed out") from exc
        except RuntimeError as exc:
            if "circuit is open" in str(exc).lower():
                span.set_attribute("stripe.error", "circuit_open")
                raise HTTPException(
                    status_code=503,
                    detail="Stripe temporarily unavailable, retry shortly",
                ) from exc
            raise


def _require_admin(access_key: str) -> None:
    configured = _admin_key()
    if not configured:
        raise HTTPException(status_code=503, detail="Admin key not configured")
    if access_key != configured:
        raise HTTPException(status_code=403, detail="Invalid admin key")


async def _find_or_create_user(
    email: str | None,
    stripe_customer_id: str | None,
    session: AsyncSession,
) -> User | None:
    """Find existing user account or create a placeholder from billing identity."""
    if email:
        existing_user = await session.scalar(select(User).where(User.email == email))
        if existing_user is not None:
            if stripe_customer_id and existing_user.stripe_customer_id != stripe_customer_id:
                existing_user.stripe_customer_id = stripe_customer_id
                await session.commit()
            return existing_user

        generated_password = f"stripe:{stripe_customer_id or uuid4()}"
        user = User(
            id=str(uuid4()),
            email=email,
            password_hash=hash_password(generated_password),
            email_verified=True,
            stripe_customer_id=stripe_customer_id,
        )
        session.add(user)
        await session.commit()
        return user

    if stripe_customer_id:
        existing_by_customer = await session.scalar(
            select(User).where(User.stripe_customer_id == stripe_customer_id)
        )
        return existing_by_customer
    return None


async def _handle_checkout_completed(
    obj: dict[str, object],
    session: AsyncSession,
    *,
    event_id: str,
    event_time: datetime | None,
) -> None:
    """Provision account access on checkout completion."""
    customer_id = obj.get("customer")
    subscription_id = obj.get("subscription")
    customer_email = obj.get("customer_email")
    details = obj.get("customer_details")
    if isinstance(details, dict) and not customer_email:
        customer_email = details.get("email")

    user = await _find_or_create_user(
        customer_email if isinstance(customer_email, str) else None,
        customer_id if isinstance(customer_id, str) else None,
        session,
    )
    if user is None or not isinstance(subscription_id, str) or not isinstance(customer_id, str):
        return

    price_id: str | None = None
    metadata = obj.get("metadata")
    if isinstance(metadata, dict):
        raw_price = metadata.get("price_id")
        if isinstance(raw_price, str):
            price_id = raw_price
    tier, billing_interval = _tier_and_interval_from_price(price_id)

    existing = await session.scalar(
        select(Subscription).where(Subscription.stripe_subscription_id == subscription_id)
    )
    if existing is None:
        record = Subscription(
            id=str(uuid4()),
            user_id=user.id,
            stripe_subscription_id=subscription_id,
            stripe_customer_id=customer_id,
            status="active",
            tier=tier,
            billing_interval=billing_interval,
        )
        _touch_subscription_event(record, event_time, event_id)
        session.add(record)
    else:
        if _is_stale_event(existing, event_time, event_id):
            return
        existing.status = "active"
        existing.tier = tier
        existing.billing_interval = billing_interval
        existing.user_id = user.id
        existing.stripe_customer_id = customer_id
        _touch_subscription_event(existing, event_time, event_id)
    await session.commit()


async def _handle_subscription_changed(
    obj: dict[str, object],
    session: AsyncSession,
    *,
    deleted: bool,
    event_id: str,
    event_time: datetime | None,
) -> None:
    """Update subscription state from Stripe subscription events."""
    subscription_id = obj.get("id")
    customer_id = obj.get("customer")
    if not isinstance(subscription_id, str):
        return

    record = await session.scalar(
        select(Subscription).where(Subscription.stripe_subscription_id == subscription_id)
    )
    tier, billing_interval = _tier_and_interval_from_subscription_object(obj)
    period_end = _extract_period_end(obj.get("current_period_end"))
    cancel_at_period_end = bool(obj.get("cancel_at_period_end", False))

    if record is None:
        if not isinstance(customer_id, str):
            return
        user = await session.scalar(select(User).where(User.stripe_customer_id == customer_id))
        if user is None:
            return
        record = Subscription(
            id=str(uuid4()),
            user_id=user.id,
            stripe_subscription_id=subscription_id,
            stripe_customer_id=customer_id,
            status="canceled" if deleted else "active",
            tier=tier,
            billing_interval=billing_interval,
            current_period_end=period_end,
            cancel_at_period_end=cancel_at_period_end,
        )
        _touch_subscription_event(record, event_time, event_id)
        session.add(record)
    else:
        if _is_stale_event(record, event_time, event_id):
            return
        status = obj.get("status")
        record.status = "canceled" if deleted else (status if isinstance(status, str) else "active")
        record.tier = tier
        record.billing_interval = billing_interval
        record.current_period_end = period_end
        record.cancel_at_period_end = cancel_at_period_end
        if isinstance(customer_id, str):
            record.stripe_customer_id = customer_id
        _touch_subscription_event(record, event_time, event_id)
    await session.commit()


async def _handle_charge_refunded(
    obj: dict[str, object],
    session: AsyncSession,
    *,
    event_id: str,
    event_time: datetime | None,
) -> None:
    """Map Stripe refund events onto subscription billing state."""
    customer_id = obj.get("customer")
    amount_refunded = obj.get("amount_refunded")
    amount_total = obj.get("amount")
    if not isinstance(customer_id, str):
        return
    rows = await session.scalars(
        select(Subscription).where(Subscription.stripe_customer_id == customer_id)
    )
    subscriptions = rows.all()
    if not subscriptions:
        return
    partial = (
        isinstance(amount_refunded, int)
        and isinstance(amount_total, int)
        and amount_refunded < amount_total
    )
    for record in subscriptions:
        if _is_stale_event(record, event_time, event_id):
            continue
        record.status = "partially_refunded" if partial else "refunded"
        _touch_subscription_event(record, event_time, event_id)
    await session.commit()


async def _handle_charge_dispute(
    obj: dict[str, object],
    session: AsyncSession,
    *,
    event_id: str,
    event_time: datetime | None,
) -> None:
    """Mark subscriptions as under dispute for downstream access policies."""
    customer_id = obj.get("customer")
    if not isinstance(customer_id, str):
        return
    rows = await session.scalars(
        select(Subscription).where(Subscription.stripe_customer_id == customer_id)
    )
    for record in rows.all():
        if _is_stale_event(record, event_time, event_id):
            continue
        record.status = "in_dispute"
        _touch_subscription_event(record, event_time, event_id)
    await session.commit()


async def _handle_dispute_closed(
    obj: dict[str, object],
    session: AsyncSession,
    *,
    event_id: str,
    event_time: datetime | None,
) -> None:
    """Resolve dispute outcome and converge subscription status."""
    customer_id = obj.get("customer")
    dispute_status = obj.get("status")
    if not isinstance(customer_id, str):
        return
    rows = await session.scalars(
        select(Subscription).where(Subscription.stripe_customer_id == customer_id)
    )
    for record in rows.all():
        if _is_stale_event(record, event_time, event_id):
            continue
        if dispute_status == "won":
            record.status = "active"
        else:
            record.status = "chargeback"
        _touch_subscription_event(record, event_time, event_id)
    await session.commit()


async def _handle_refund_updated(
    obj: dict[str, object],
    session: AsyncSession,
    *,
    event_id: str,
    event_time: datetime | None,
) -> None:
    """Compensate subscription status when a refund fails or is canceled."""
    customer_id = obj.get("customer")
    refund_status = obj.get("status")
    if not isinstance(refund_status, str) or refund_status not in {"failed", "canceled"}:
        return
    if not isinstance(customer_id, str):
        return
    rows = await session.scalars(
        select(Subscription).where(Subscription.stripe_customer_id == customer_id)
    )
    for record in rows.all():
        if _is_stale_event(record, event_time, event_id):
            continue
        if record.status in {"refunded", "partially_refunded"}:
            record.status = "active"
            _touch_subscription_event(record, event_time, event_id)
    await session.commit()


async def _handle_invoice_event(
    obj: dict[str, object],
    session: AsyncSession,
    *,
    event_id: str,
    event_time: datetime | None,
    failed: bool,
) -> None:
    """Track invoice outcomes including proration and trial transitions."""
    subscription_id = obj.get("subscription")
    customer_id = obj.get("customer")
    billing_reason = obj.get("billing_reason")
    if not isinstance(subscription_id, str):
        return

    record = await session.scalar(
        select(Subscription).where(Subscription.stripe_subscription_id == subscription_id)
    )
    if record is None and isinstance(customer_id, str):
        record = await session.scalar(
            select(Subscription).where(Subscription.stripe_customer_id == customer_id)
        )
    if record is None:
        return
    if _is_stale_event(record, event_time, event_id):
        return

    if failed:
        record.status = "past_due"
    elif billing_reason == "subscription_update":
        record.status = "proration_pending"
    elif record.status in {"past_due", "incomplete", "in_dispute", "chargeback"}:
        record.status = "active"
    _touch_subscription_event(record, event_time, event_id)
    await session.commit()


async def _process_event(
    event_payload: dict[str, object],
    session: AsyncSession,
    *,
    request_id: str,
) -> None:
    event_id = str(event_payload.get("id", ""))
    event_type_obj = event_payload.get("type")
    if not isinstance(event_type_obj, str):
        raise ValueError("Invalid Stripe event type")
    event_type = event_type_obj

    event_time = _event_time(event_payload.get("created"))
    data = event_payload.get("data")
    if not isinstance(data, dict):
        raise ValueError("Invalid Stripe event payload")
    obj = data.get("object")
    if not isinstance(obj, dict):
        raise ValueError("Invalid Stripe event payload object")

    obj_id = obj.get("id")
    logger.info(
        "stripe.webhook.processing event_id=%s type=%s object_id=%s request_id=%s",
        event_id,
        event_type,
        obj_id if isinstance(obj_id, str) else "unknown",
        request_id,
    )
    webhook_events_counter.add(1, {"event_type": event_type, "result": "processing"})

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(obj, session, event_id=event_id, event_time=event_time)
    elif event_type == "customer.subscription.updated":
        await _handle_subscription_changed(
            obj,
            session,
            deleted=False,
            event_id=event_id,
            event_time=event_time,
        )
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_changed(
            obj,
            session,
            deleted=True,
            event_id=event_id,
            event_time=event_time,
        )
    elif event_type == "charge.refunded":
        await _handle_charge_refunded(obj, session, event_id=event_id, event_time=event_time)
    elif event_type == "charge.dispute.created":
        await _handle_charge_dispute(obj, session, event_id=event_id, event_time=event_time)
    elif event_type == "charge.dispute.closed":
        await _handle_dispute_closed(obj, session, event_id=event_id, event_time=event_time)
    elif event_type == "charge.refund.updated":
        await _handle_refund_updated(obj, session, event_id=event_id, event_time=event_time)
    elif event_type == "invoice.payment_failed":
        await _handle_invoice_event(
            obj,
            session,
            event_id=event_id,
            event_time=event_time,
            failed=True,
        )
    elif event_type in {"invoice.paid", "invoice.payment_succeeded"}:
        await _handle_invoice_event(
            obj,
            session,
            event_id=event_id,
            event_time=event_time,
            failed=False,
        )
    elif event_type == "customer.subscription.resumed":
        await _handle_subscription_changed(
            obj,
            session,
            deleted=False,
            event_id=event_id,
            event_time=event_time,
        )
    webhook_events_counter.add(1, {"event_type": event_type, "result": "processed"})


async def _record_failure(stripe_event: StripeEvent, reason: str, session: AsyncSession) -> None:
    stripe_event.attempt_count += 1
    stripe_event.status = "failed"
    stripe_event.error_message = reason[:1000]
    stripe_event.processed_at = _now()
    if stripe_event.attempt_count >= MAX_WEBHOOK_RETRIES:
        stripe_event.dead_lettered = True
        stripe_event.next_retry_at = None
        stripe_event.status = "dead_letter"
    else:
        backoff_minutes = min(60, 2 ** max(0, stripe_event.attempt_count - 1))
        stripe_event.next_retry_at = _now() + timedelta(minutes=backoff_minutes)
    await session.commit()


async def _process_with_reliability(
    *,
    stripe_event: StripeEvent,
    event_payload: dict[str, object],
    session: AsyncSession,
    request_id: str,
) -> bool:
    try:
        await _process_event(event_payload, session, request_id=request_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "stripe.webhook.failed event_id=%s request_id=%s",
            stripe_event.id,
            request_id,
        )
        webhook_failures_counter.add(1, {"event_type": stripe_event.event_type})
        await _record_failure(stripe_event, str(exc), session)
        return False

    stripe_event.status = "processed"
    stripe_event.error_message = None
    stripe_event.dead_lettered = False
    stripe_event.next_retry_at = None
    stripe_event.processed_at = _now()
    await session.commit()
    return True


@router.post("/checkout")
async def create_checkout(
    request: Request,
    req: CheckoutRequest,
    idempotency_key: str = Header(default="", alias="Idempotency-Key"),
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> CheckoutResponse:
    """Create a Stripe-hosted Checkout Session for subscription."""
    import stripe

    checkout_attempts_counter.add(1, {"tier": req.tier})
    try:
        await enforce_rate_limit(
            session=session,
            scope="payments_checkout_ip",
            bucket_key=_client_ip(request),
            limit=CHECKOUT_IP_LIMIT,
            window_seconds=RATE_WINDOW_SECONDS,
            block_seconds=RATE_BLOCK_SECONDS,
        )
        if req.customer_email:
            await enforce_rate_limit(
                session=session,
                scope="payments_checkout_email",
                bucket_key=req.customer_email.lower(),
                limit=CHECKOUT_EMAIL_LIMIT,
                window_seconds=RATE_WINDOW_SECONDS,
                block_seconds=RATE_BLOCK_SECONDS,
            )
    except HTTPException as exc:
        if exc.status_code == 429:
            rate_limit_counter.add(1, {"endpoint": "checkout"})
            checkout_failures_counter.add(1, {"tier": req.tier, "reason": "rate_limited"})
        raise

    stripe.api_key = _get_stripe_key()

    # Validate tier and billing interval (Task 17.43: entitlement mapping)
    if req.billing_interval not in {"monthly", "yearly"}:
        checkout_failures_counter.add(1, {"tier": req.tier, "reason": "invalid_interval"})
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid billing_interval: {req.billing_interval}. Must be 'monthly' or 'yearly'."
            ),
        )

    price_key = (req.tier, req.billing_interval)
    if price_key not in PRICE_IDS:
        checkout_failures_counter.add(1, {"tier": req.tier, "reason": "invalid_tier"})
        raise HTTPException(status_code=400, detail=f"Invalid tier: {req.tier}")

    session_params: dict[str, object] = {
        "line_items": [{"price": PRICE_IDS[price_key], "quantity": 1}],
        "mode": "subscription",
        "success_url": req.success_url + "?session_id={CHECKOUT_SESSION_ID}",
        "cancel_url": req.cancel_url,
        "allow_promotion_codes": True,
    }

    if req.customer_email:
        session_params["customer_email"] = req.customer_email

    create_kwargs: dict[str, object] = dict(session_params)
    if idempotency_key:
        create_kwargs["idempotency_key"] = idempotency_key
    try:
        session_obj = await _stripe_call(
            "checkout_create",
            lambda: stripe.checkout.Session.create(**create_kwargs),  # type: ignore[arg-type]
        )
    except HTTPException:
        checkout_failures_counter.add(1, {"tier": req.tier, "reason": "stripe_unavailable"})
        raise

    session_id = getattr(session_obj, "id", "")
    checkout_url = getattr(session_obj, "url", "") or ""
    if not isinstance(session_id, str) or not session_id:
        checkout_failures_counter.add(1, {"tier": req.tier, "reason": "invalid_response"})
        raise HTTPException(status_code=502, detail="Invalid response from Stripe checkout")
    if not isinstance(checkout_url, str) or not checkout_url:
        checkout_failures_counter.add(1, {"tier": req.tier, "reason": "missing_url"})
        raise HTTPException(status_code=502, detail="Stripe checkout URL is unavailable")

    return CheckoutResponse(checkout_url=checkout_url, session_id=session_id)


@router.post("/portal")
async def create_customer_portal(
    auth_ctx: AuthContext = Depends(get_auth_context),  # noqa: B008
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> CustomerPortalResponse:
    """Create a Stripe Customer Portal session for self-service management.

    SECURITY FIX 16.31: Now requires authentication and resolves customer_id
    from authenticated user's account. Prevents IDOR attacks.
    """
    import stripe

    user, _ = require_api_key_scope(auth_ctx, "billing:read")
    # SECURITY FIX 16.31: Get customer_id from user's account, not from request
    if not user.stripe_customer_id:
        raise HTTPException(
            status_code=404, detail="No billing account found. Please subscribe first."
        )

    # Type narrowing: stripe_customer_id is guaranteed to be str here
    customer_id: str = user.stripe_customer_id

    stripe.api_key = _get_stripe_key()
    try:
        portal_session = await _stripe_call(
            "portal_create",
            lambda: stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url="https://skillgate.io/dashboard",
            ),
        )
    except HTTPException:
        checkout_failures_counter.add(1, {"tier": "portal", "reason": "stripe_unavailable"})
        raise
    portal_url = getattr(portal_session, "url", "")
    if not isinstance(portal_url, str) or not portal_url:
        raise HTTPException(status_code=502, detail="Stripe portal URL unavailable")
    return CustomerPortalResponse(portal_url=portal_url)


@router.get("/subscription/{subscription_id}")
async def get_subscription(
    subscription_id: str,
    auth_ctx: AuthContext = Depends(get_auth_context),  # noqa: B008
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> SubscriptionResponse:
    """Get subscription details.

    SECURITY FIX 16.31: Now requires authentication and ownership verification.
    User can only access their own subscriptions.
    """
    user, _ = require_api_key_scope(auth_ctx, "billing:read")
    # SECURITY FIX 16.31: Verify subscription belongs to authenticated user
    db_subscription = await session.scalar(
        select(Subscription).where(
            Subscription.stripe_subscription_id == subscription_id, Subscription.user_id == user.id
        )
    )
    if not db_subscription:
        raise HTTPException(status_code=404, detail="Subscription not found or access denied")

    import stripe

    stripe.api_key = _get_stripe_key()

    try:
        sub = await _stripe_call(
            "subscription_get",
            lambda: stripe.Subscription.retrieve(subscription_id),
        )
    except stripe.InvalidRequestError as exc:
        raise HTTPException(status_code=404, detail="Subscription not found") from exc

    tier, billing_interval = ("unknown", "monthly")
    if isinstance(sub, dict):
        items = sub.get("items")
        data = items.get("data") if isinstance(items, dict) else None
        first = data[0] if isinstance(data, list) and data else None
        price = first.get("price") if isinstance(first, dict) else None
        price_id_value = price.get("id") if isinstance(price, dict) else None
        sub_id_obj = sub.get("id")
        sub_status_obj = sub.get("status")
        period_end = sub.get("current_period_end")
    else:
        items = getattr(sub, "items", None)
        data = getattr(items, "data", None) if items is not None else None
        first = data[0] if isinstance(data, list) and data else None
        price = getattr(first, "price", None) if first is not None else None
        price_id_value = getattr(price, "id", None) if price is not None else None
        sub_id_obj = getattr(sub, "id", "")
        sub_status_obj = getattr(sub, "status", "")
        period_end = getattr(sub, "current_period_end", None)

    # Extract tier and billing interval from price ID
    if isinstance(price_id_value, str):
        tier, billing_interval = _tier_and_interval_from_price(price_id_value)

    sub_id = sub_id_obj
    sub_status = sub_status_obj
    period_end_str = str(period_end) if period_end is not None else None
    if not isinstance(sub_id, str) or not sub_id:
        raise HTTPException(status_code=502, detail="Invalid subscription payload from Stripe")
    if not isinstance(sub_status, str) or not sub_status:
        raise HTTPException(status_code=502, detail="Invalid subscription status from Stripe")

    return SubscriptionResponse(
        subscription_id=sub_id,
        tier=tier,
        billing_interval=billing_interval,
        status=sub_status,
        current_period_end=period_end_str,
    )


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(alias="Stripe-Signature", default=""),
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> WebhookResponse:
    """Handle Stripe webhook events with idempotency + DLQ semantics."""
    request_id = getattr(request.state, "request_id", "unknown")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    if not webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    payload = await request.body()
    payload_hash = sha256(payload).hexdigest()

    import stripe

    try:
        event_payload_obj = stripe.Webhook.construct_event(  # type: ignore[no-untyped-call]
            payload.decode("utf-8"), stripe_signature, webhook_secret
        )
    except (ValueError, stripe.SignatureVerificationError) as exc:
        logger.warning("Webhook signature verification failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid signature") from exc
    if not isinstance(event_payload_obj, dict):
        raise HTTPException(status_code=400, detail="Invalid Stripe event payload")
    event_payload: dict[str, object] = event_payload_obj

    event_id = str(event_payload.get("id", ""))
    if not event_id:
        raise HTTPException(status_code=400, detail="Missing event id")

    event_type = str(event_payload.get("type", "unknown"))
    lag_seconds = _event_lag_seconds(event_payload.get("created"))
    logger.info(
        "stripe.webhook.received event_id=%s event_type=%s lag_seconds=%s request_id=%s",
        event_id,
        event_type,
        lag_seconds if lag_seconds is not None else "unknown",
        request_id,
    )
    if lag_seconds is not None:
        webhook_lag_histogram.record(lag_seconds, {"event_type": event_type})

    existing = await session.get(StripeEvent, event_id)
    if existing is not None:
        if existing.status == "processed":
            return WebhookResponse(received=True)
        if existing.dead_lettered:
            logger.warning("stripe.webhook.dead_letter event_id=%s", event_id)
            return WebhookResponse(received=True)
        if existing.next_retry_at and existing.next_retry_at > _now():
            return WebhookResponse(received=True)
        existing.payload_hash = payload_hash
        existing.payload_json = json.dumps(event_payload, separators=(",", ":"), sort_keys=True)
        await session.commit()
        await _process_with_reliability(
            stripe_event=existing,
            event_payload=event_payload,
            session=session,
            request_id=request_id,
        )
        return WebhookResponse(received=True)

    stripe_event = StripeEvent(
        id=event_id,
        event_type=event_type,
        payload_hash=payload_hash,
        payload_json=json.dumps(event_payload, separators=(",", ":"), sort_keys=True),
        status="processing",
    )
    session.add(stripe_event)
    await session.commit()

    await _process_with_reliability(
        stripe_event=stripe_event,
        event_payload=event_payload,
        session=session,
        request_id=request_id,
    )
    return WebhookResponse(received=True)


@router.get("/webhook/dead-letter", response_model=DeadLetterResponse)
async def list_dead_letter_events(
    admin_key: str = Header(default="", alias="X-Admin-Key"),
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> DeadLetterResponse:
    """List webhook events moved into dead-letter state."""
    _require_admin(admin_key)
    rows = await session.scalars(
        select(StripeEvent)
        .where(StripeEvent.dead_lettered.is_(True))
        .order_by(StripeEvent.created_at.desc())
        .limit(limit)
    )
    events = [_event_record_from_model(row) for row in rows.all()]
    return DeadLetterResponse(events=events)


@router.post("/webhook/replay/{event_id}", response_model=ReplayResponse)
async def replay_webhook_event(
    event_id: str,
    admin_key: str = Header(default="", alias="X-Admin-Key"),
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> ReplayResponse:
    """Replay a previously stored Stripe event."""
    _require_admin(admin_key)

    stripe_event = await session.get(StripeEvent, event_id)
    if stripe_event is None:
        raise HTTPException(status_code=404, detail="Stripe event not found")

    try:
        event_payload = json.loads(stripe_event.payload_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Stored event payload is invalid") from exc

    stripe_event.dead_lettered = False
    stripe_event.status = "processing"
    stripe_event.next_retry_at = None
    await session.commit()

    await _process_with_reliability(
        stripe_event=stripe_event,
        event_payload=event_payload,
        session=session,
        request_id="admin-replay",
    )
    return ReplayResponse(event_id=event_id, status=stripe_event.status)


@router.post("/webhook/retry-failed", response_model=DeadLetterResponse)
async def retry_failed_events(
    admin_key: str = Header(default="", alias="X-Admin-Key"),
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> DeadLetterResponse:
    """Attempt retries for failed events with elapsed retry windows."""
    _require_admin(admin_key)
    now = _now()
    rows = await session.scalars(
        select(StripeEvent)
        .where(
            StripeEvent.status.in_(["failed", "dead_letter"]),
            StripeEvent.dead_lettered.is_(False),
            (StripeEvent.next_retry_at.is_(None) | (StripeEvent.next_retry_at <= now)),
        )
        .order_by(StripeEvent.created_at.asc())
        .limit(limit)
    )
    processed: list[StripeEventRecord] = []
    for row in rows.all():
        try:
            payload = json.loads(row.payload_json)
        except json.JSONDecodeError:
            await _record_failure(row, "Invalid stored payload", session)
            continue
        row.status = "processing"
        row.next_retry_at = None
        await session.commit()
        with suppress(HTTPException):
            await _process_with_reliability(
                stripe_event=row,
                event_payload=payload,
                session=session,
                request_id="admin-retry",
            )
        processed.append(_event_record_from_model(row))
    return DeadLetterResponse(events=processed)


@router.post("/reconcile/subscriptions", response_model=ReconcileResponse)
async def reconcile_subscriptions(
    admin_key: str = Header(default="", alias="X-Admin-Key"),
    limit: int = Query(default=200, ge=1, le=1000),
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> ReconcileResponse:
    """Reconcile local subscription state against Stripe source of truth."""
    _require_admin(admin_key)

    import stripe

    stripe.api_key = _get_stripe_key()

    rows = await session.scalars(
        select(Subscription).order_by(Subscription.updated_at.desc()).limit(limit)
    )
    scanned = 0
    changed = 0
    for row in rows.all():
        scanned += 1
        try:
            subscription_id = row.stripe_subscription_id

            def _retrieve_subscription(subscription_id: str = subscription_id) -> object:
                return stripe.Subscription.retrieve(subscription_id)

            remote = await _stripe_call(
                "subscription_reconcile",
                _retrieve_subscription,
            )
        except Exception:  # noqa: BLE001
            continue

        if not isinstance(remote, dict):
            continue
        remote_tier, remote_interval = _tier_and_interval_from_subscription_object(remote)
        remote_period_end = _extract_period_end(remote.get("current_period_end"))
        remote_status = remote.get("status")
        normalized_status = remote_status if isinstance(remote_status, str) else row.status

        if (
            row.tier != remote_tier
            or row.billing_interval != remote_interval
            or row.status != normalized_status
            or row.current_period_end != remote_period_end
        ):
            row.tier = remote_tier
            row.billing_interval = remote_interval
            row.status = normalized_status
            row.current_period_end = remote_period_end
            changed += 1

    await session.commit()
    return ReconcileResponse(scanned=scanned, changed=changed)


@router.post("/portal/sync", response_model=ReconcileResponse)
async def sync_from_customer_portal(
    req: PortalSyncRequest,
    admin_key: str = Header(default="", alias="X-Admin-Key"),
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> ReconcileResponse:
    """Sync local state from Stripe customer subscriptions after portal actions."""
    _require_admin(admin_key)

    import stripe

    stripe.api_key = _get_stripe_key()
    try:
        remote = await _stripe_call(
            "subscriptions_list",
            lambda: stripe.Subscription.list(customer=req.customer_id, limit=req.limit),
        )
    except HTTPException:
        raise

    data = remote.get("data", []) if isinstance(remote, dict) else getattr(remote, "data", [])
    if not isinstance(data, list):
        data = []

    scanned = 0
    changed = 0
    for item in data:
        if not isinstance(item, dict):
            continue
        sub_id = item.get("id")
        if not isinstance(sub_id, str):
            continue
        scanned += 1
        row = await session.scalar(
            select(Subscription).where(Subscription.stripe_subscription_id == sub_id)
        )
        if row is None:
            continue
        tier, billing_interval = _tier_and_interval_from_subscription_object(item)
        status_obj = item.get("status")
        period_end = _extract_period_end(item.get("current_period_end"))
        status = status_obj if isinstance(status_obj, str) else row.status
        if (
            row.tier != tier
            or row.billing_interval != billing_interval
            or row.status != status
            or row.current_period_end != period_end
        ):
            row.tier = tier
            row.billing_interval = billing_interval
            row.status = status
            row.current_period_end = period_end
            changed += 1

    await session.commit()
    return ReconcileResponse(scanned=scanned, changed=changed)
