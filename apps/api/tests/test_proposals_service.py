from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import text

from app.core.db import get_db_session
from app.mcp.proposals import create_proposal, approve_proposal, reject_proposal
from app.models.proposals import ApprovalSource, ProposalStatus


async def _session():
    async for s in get_db_session():
        return s


async def _cleanup(session, proposal_id: str) -> None:
    await session.execute(
        text('delete from proposed_actions where id = cast(:id as uuid)'),
        {'id': proposal_id},
    )
    await session.commit()


@pytest.mark.asyncio
async def test_create_proposal_emits_broadcast():
    session = await _session()
    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()) as mock_bcast:
        result = await create_proposal(
            session,
            agent_id='svc-test',
            agent_label='Service Test',
            operator_id='op-1',
            tool_name='propose_test',
            payload={'k': 'v'},
            summary='svc test',
            request_id=None,
            expires_in_seconds=1800,
        )
        assert result.proposal.status == ProposalStatus.PENDING
        mock_bcast.assert_awaited_once()
        msg = mock_bcast.call_args.args[0]
        assert msg['type'] == 'proposal.created'
        assert msg['proposal_id'] == result.proposal.id
    await _cleanup(session, result.proposal.id)


@pytest.mark.asyncio
async def test_approve_proposal_executes_and_broadcasts():
    session = await _session()
    executed = {'value': 0}

    async def fake_executor(payload):
        executed['value'] = payload['n'] + 1
        return {'next': executed['value']}

    create_result = await create_proposal(
        session,
        agent_id='svc-test',
        agent_label='Svc',
        operator_id='op-1',
        tool_name='propose_test',
        payload={'n': 5},
        summary='approve test',
        request_id=None,
        expires_in_seconds=1800,
    )

    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()) as mock_bcast:
        outcome = await approve_proposal(
            session,
            proposal_id=create_result.proposal.id,
            approver_id='op-1',
            source=ApprovalSource.UI,
            approver_note='ok',
            executor=fake_executor,
        )
        assert outcome.status == ProposalStatus.APPROVED
        assert outcome.execution_result == {'next': 6}
        mock_bcast.assert_awaited()
        assert mock_bcast.call_args.args[0]['type'] == 'proposal.resolved'

    await _cleanup(session, create_result.proposal.id)


@pytest.mark.asyncio
async def test_approve_already_resolved_returns_idempotent_result():
    session = await _session()

    async def fake_executor(payload):
        return {'done': True}

    create_result = await create_proposal(
        session,
        agent_id='svc-test',
        agent_label='Svc',
        operator_id='op-1',
        tool_name='propose_test',
        payload={},
        summary='double approve',
        request_id=None,
        expires_in_seconds=1800,
    )
    await approve_proposal(
        session,
        proposal_id=create_result.proposal.id,
        approver_id='op-1',
        source=ApprovalSource.UI,
        executor=fake_executor,
    )
    second = await approve_proposal(
        session,
        proposal_id=create_result.proposal.id,
        approver_id='op-1',
        source=ApprovalSource.UI,
        executor=fake_executor,
    )
    assert second.status == ProposalStatus.APPROVED
    assert second.execution_result == {'done': True}
    await _cleanup(session, create_result.proposal.id)


@pytest.mark.asyncio
async def test_reject_proposal_skips_execution():
    session = await _session()

    async def fake_executor(payload):
        raise AssertionError('executor must not run on reject')

    create_result = await create_proposal(
        session,
        agent_id='svc-test',
        agent_label='Svc',
        operator_id='op-1',
        tool_name='propose_test',
        payload={},
        summary='reject test',
        request_id=None,
        expires_in_seconds=1800,
    )
    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()):
        outcome = await reject_proposal(
            session,
            proposal_id=create_result.proposal.id,
            approver_id='op-1',
            reason='nope',
        )
    assert outcome.status == ProposalStatus.REJECTED
    assert outcome.rejection_reason == 'nope'
    await _cleanup(session, create_result.proposal.id)


@pytest.mark.asyncio
async def test_create_proposal_idempotency_returns_existing():
    session = await _session()
    rid = '22222222-2222-2222-2222-222222222222'
    first = await create_proposal(
        session,
        agent_id='idem-svc',
        agent_label='Idem',
        operator_id='op-1',
        tool_name='propose_test',
        payload={'k': 1},
        summary='first',
        request_id=rid,
        expires_in_seconds=1800,
    )
    second = await create_proposal(
        session,
        agent_id='idem-svc',
        agent_label='Idem',
        operator_id='op-1',
        tool_name='propose_test',
        payload={'k': 2},
        summary='second',
        request_id=rid,
        expires_in_seconds=1800,
    )
    assert first.proposal.id == second.proposal.id
    assert second.created is False
    await _cleanup(session, first.proposal.id)
