from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.proposals import (
    ApprovalSource,
    ProposalCreate,
    ProposalStatus,
    ProposedAction,
)
from app.repositories.proposals import (
    find_by_idempotency,
    get_proposal,
    insert_proposal,
    list_proposals as list_proposals_repo,
    mark_executed,
    mark_status,
    sweep_expired,
)
from app.services.feed import (
    MSG_PROPOSAL_CREATED,
    MSG_PROPOSAL_RESOLVED,
    feed_manager,
)


@dataclass
class CreateProposalResult:
    proposal: ProposedAction
    created: bool   # True if a new row was inserted; False if returned via idempotency


class ProposalNotFoundError(LookupError):
    def __init__(self, proposal_id: str) -> None:
        super().__init__(f'Proposal not found: {proposal_id}')
        self.proposal_id = proposal_id


class ProposalAlreadyResolvedError(RuntimeError):
    def __init__(self, proposal_id: str, current_status: ProposalStatus) -> None:
        super().__init__(f'Proposal {proposal_id} already resolved as {current_status}')
        self.proposal_id = proposal_id
        self.current_status = current_status


async def create_proposal(
    session: AsyncSession,
    *,
    agent_id: str,
    agent_label: Optional[str],
    operator_id: str,
    tool_name: str,
    payload: dict[str, Any],
    summary: str,
    request_id: Optional[str],
    expires_in_seconds: int = 1800,
) -> CreateProposalResult:
    if request_id is not None:
        existing = await find_by_idempotency(
            session, agent_id=agent_id, request_id=request_id
        )
        if existing is not None:
            return CreateProposalResult(proposal=existing, created=False)

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds)
    proposal = await insert_proposal(
        session,
        ProposalCreate(
            agent_id=agent_id,
            agent_label=agent_label,
            operator_id=operator_id,
            tool_name=tool_name,
            payload=payload,
            summary=summary,
            request_id=request_id,
            expires_at=expires_at,
        ),
    )

    await feed_manager.broadcast({
        'type': MSG_PROPOSAL_CREATED,
        'proposal_id': proposal.id,
        'tool_name': tool_name,
        'agent_label': agent_label or agent_id,
        'summary': summary,
    })

    return CreateProposalResult(proposal=proposal, created=True)


async def _expire_if_due(session: AsyncSession, proposal: ProposedAction) -> ProposedAction:
    if proposal.status != ProposalStatus.PENDING:
        return proposal
    expires = datetime.fromisoformat(proposal.expires_at.replace('Z', '+00:00'))
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        await mark_status(session, proposal_id=proposal.id, status=ProposalStatus.EXPIRED)
        await feed_manager.broadcast({
            'type': MSG_PROPOSAL_RESOLVED,
            'proposal_id': proposal.id,
            'status': ProposalStatus.EXPIRED.value,
        })
        return await get_proposal(session, proposal.id) or proposal
    return proposal


async def approve_proposal(
    session: AsyncSession,
    *,
    proposal_id: str,
    approver_id: str,
    source: ApprovalSource,
    approver_note: Optional[str] = None,
    executor: Callable[[dict[str, Any]], Awaitable[dict[str, Any]]],
) -> ProposedAction:
    proposal = await get_proposal(session, proposal_id)
    if proposal is None:
        raise ProposalNotFoundError(proposal_id)
    proposal = await _expire_if_due(session, proposal)

    if proposal.status == ProposalStatus.APPROVED:
        return proposal  # idempotent
    if proposal.status in (ProposalStatus.REJECTED, ProposalStatus.EXPIRED):
        raise ProposalAlreadyResolvedError(proposal.id, proposal.status)

    await mark_status(
        session,
        proposal_id=proposal.id,
        status=ProposalStatus.APPROVED,
        approval_source=source.value,
        approved_by=approver_id,
        approver_note=approver_note,
    )
    enriched_payload = {**proposal.payload, '__tool_name__': proposal.tool_name}
    result = await executor(enriched_payload)
    await mark_executed(session, proposal_id=proposal.id, execution_result=result)

    await feed_manager.broadcast({
        'type': MSG_PROPOSAL_RESOLVED,
        'proposal_id': proposal.id,
        'status': ProposalStatus.APPROVED.value,
    })

    return await get_proposal(session, proposal.id)


async def reject_proposal(
    session: AsyncSession,
    *,
    proposal_id: str,
    approver_id: str,
    reason: str,
) -> ProposedAction:
    proposal = await get_proposal(session, proposal_id)
    if proposal is None:
        raise ProposalNotFoundError(proposal_id)
    proposal = await _expire_if_due(session, proposal)

    if proposal.status == ProposalStatus.REJECTED:
        return proposal
    if proposal.status in (ProposalStatus.APPROVED, ProposalStatus.EXPIRED):
        raise ProposalAlreadyResolvedError(proposal.id, proposal.status)

    await mark_status(
        session,
        proposal_id=proposal.id,
        status=ProposalStatus.REJECTED,
        approved_by=approver_id,
        rejection_reason=reason,
    )
    await feed_manager.broadcast({
        'type': MSG_PROPOSAL_RESOLVED,
        'proposal_id': proposal.id,
        'status': ProposalStatus.REJECTED.value,
    })
    return await get_proposal(session, proposal.id)


async def list_proposals_view(
    session: AsyncSession,
    *,
    status: Optional[ProposalStatus] = None,
    agent_id: Optional[str] = None,
    limit: int = 50,
) -> list[ProposedAction]:
    await sweep_expired(session)
    return await list_proposals_repo(
        session, status=status, agent_id=agent_id, limit=limit
    )
