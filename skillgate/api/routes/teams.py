"""Team management API — invite, seats, member management."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from skillgate.api.auth_context import AuthContext, get_auth_context, require_api_key_scope
from skillgate.api.db import get_session
from skillgate.api.entitlement import resolve_user_entitlement
from skillgate.api.models import Team, TeamMember, User
from skillgate.core.entitlement.gates import check_seat_limit
from skillgate.core.entitlement.models import Capability, Entitlement
from skillgate.core.errors import EntitlementError

router = APIRouter(prefix="/teams", tags=["teams"])


async def _resolve_request_entitlement(user: User, session: AsyncSession) -> Entitlement:
    return await resolve_user_entitlement(user, session)


def _enforce_team_capability(entitlement: Entitlement) -> None:
    if not entitlement.has_capability(Capability.CI_BLOCKING):
        raise HTTPException(
            status_code=403,
            detail="Team seat management requires Team or Enterprise tier.",
        )


class TeamCreateRequest(BaseModel):
    """Request to create a team."""

    name: str = Field(min_length=1, max_length=64)
    max_seats: int = Field(default=5, ge=1, le=100)


class TeamResponse(BaseModel):
    """Team details response."""

    team_id: str
    name: str
    max_seats: int
    used_seats: int
    created_at: str


class MemberInviteRequest(BaseModel):
    """Request to invite a team member."""

    email: str = Field(min_length=5)
    role: str = Field(default="member")


class MemberResponse(BaseModel):
    """Team member response."""

    member_id: str
    email: str
    role: str
    invited_at: str


class TeamMembersResponse(BaseModel):
    """Response with team members list."""

    team_id: str
    members: list[MemberResponse]


@router.post("")
async def create_team(
    req: TeamCreateRequest,
    auth_ctx: AuthContext = Depends(get_auth_context),  # noqa: B008
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> TeamResponse:
    """Create a new team."""
    user, _ = require_api_key_scope(auth_ctx, "team:write")
    entitlement = await _resolve_request_entitlement(user, session)
    _enforce_team_capability(entitlement)
    if entitlement.limits.max_seats > 0 and req.max_seats > entitlement.limits.max_seats:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Requested seats ({req.max_seats}) exceed contract limit "
                f"({entitlement.limits.max_seats})."
            ),
        )

    team_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    team = Team(
        id=team_id,
        owner_user_id=user.id,
        name=req.name,
        max_seats=req.max_seats,
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    session.add(team)
    await session.commit()
    return TeamResponse(
        team_id=team_id,
        name=req.name,
        max_seats=req.max_seats,
        used_seats=0,
        created_at=now,
    )


@router.get("/{team_id}")
async def get_team(
    team_id: str,
    auth_ctx: AuthContext = Depends(get_auth_context),  # noqa: B008
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> TeamResponse:
    """Get team details."""
    user, _ = require_api_key_scope(auth_ctx, "team:read")
    team = await session.scalar(
        select(Team).where(Team.id == team_id, Team.owner_user_id == user.id)
    )
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    used_seats = await session.scalar(
        select(func.count()).select_from(TeamMember).where(TeamMember.team_id == team_id)
    )
    return TeamResponse(
        team_id=team.id,
        name=team.name,
        max_seats=team.max_seats,
        used_seats=int(used_seats or 0),
        created_at=team.created_at.replace(tzinfo=timezone.utc).isoformat(),
    )


@router.post("/{team_id}/members")
async def invite_member(
    team_id: str,
    req: MemberInviteRequest,
    auth_ctx: AuthContext = Depends(get_auth_context),  # noqa: B008
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> MemberResponse:
    """Invite a member to the team."""
    user, _ = require_api_key_scope(auth_ctx, "team:write")
    entitlement = await _resolve_request_entitlement(user, session)
    _enforce_team_capability(entitlement)

    team = await session.scalar(
        select(Team).where(Team.id == team_id, Team.owner_user_id == user.id)
    )
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    seats_used = await session.scalar(
        select(func.count()).select_from(TeamMember).where(TeamMember.team_id == team_id)
    )
    max_seats = int(team.max_seats)
    used = int(seats_used or 0)

    effective_contract_max = (
        entitlement.limits.max_seats if entitlement.limits.max_seats > 0 else max_seats
    )
    effective_max = min(max_seats, effective_contract_max)
    if used >= effective_max:
        raise HTTPException(status_code=400, detail="Team is at maximum contract capacity")
    try:
        check_seat_limit(
            entitlement.model_copy(
                update={
                    "limits": entitlement.limits.model_copy(update={"max_seats": effective_max})
                }
            ),
            used + 1,
        )
    except EntitlementError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    existing = await session.scalar(
        select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.email == req.email)
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Member already invited")

    member_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    member = TeamMember(
        id=member_id,
        team_id=team_id,
        email=req.email,
        role=req.role,
        status="invited",
        invited_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    session.add(member)
    await session.commit()

    return MemberResponse(
        member_id=member_id,
        email=req.email,
        role=req.role,
        invited_at=now,
    )


@router.get("/{team_id}/members")
async def list_members(
    team_id: str,
    auth_ctx: AuthContext = Depends(get_auth_context),  # noqa: B008
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> TeamMembersResponse:
    """List team members."""
    user, _ = require_api_key_scope(auth_ctx, "team:read")
    team = await session.scalar(
        select(Team).where(Team.id == team_id, Team.owner_user_id == user.id)
    )
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    members = await session.scalars(select(TeamMember).where(TeamMember.team_id == team_id))
    return TeamMembersResponse(
        team_id=team_id,
        members=[
            MemberResponse(
                member_id=m.id,
                email=m.email,
                role=m.role,
                invited_at=m.invited_at.replace(tzinfo=timezone.utc).isoformat(),
            )
            for m in members.all()
        ],
    )


@router.delete("/{team_id}/members/{member_id}")
async def remove_member(
    team_id: str,
    member_id: str,
    auth_ctx: AuthContext = Depends(get_auth_context),  # noqa: B008
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> dict[str, str]:
    """Remove a member from the team."""
    user, _ = require_api_key_scope(auth_ctx, "team:write")
    team = await session.scalar(
        select(Team).where(Team.id == team_id, Team.owner_user_id == user.id)
    )
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    member = await session.scalar(
        select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.id == member_id)
    )
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")

    await session.delete(member)
    await session.commit()
    return {"status": "removed", "member_id": member_id}
