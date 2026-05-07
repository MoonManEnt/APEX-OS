import json
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from app.core.db import get_db_session
from app.models.proposals import ProposalCreate, ProposalStatus
from app.repositories.proposals import (
    insert_proposal,
    get_proposal,
    list_proposals,
    mark_status,
    mark_executed,
    find_by_idempotency,
)


async def _session():
    async for s in get_db_session():
        return s


@pytest.mark.asyncio
async def test_insert_and_get_proposal_roundtrip():
    session = await _session()
    payload = ProposalCreate(
        agent_id='test-agent',
        agent_label='Test Agent',
        operator_id='op-1',
        tool_name='propose_test',
        payload={'k': 'v'},
        summary='test proposal',
        request_id=None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    inserted = await insert_proposal(session, payload)
    assert inserted.status == ProposalStatus.PENDING
    fetched = await get_proposal(session, inserted.id)
    assert fetched is not None
    assert fetched.id == inserted.id
    assert fetched.summary == 'test proposal'
    assert fetched.payload == {'k': 'v'}
    # cleanup
    await session.execute(text("delete from proposed_actions where id = cast(:id as uuid)"), {'id': inserted.id})
    await session.commit()


@pytest.mark.asyncio
async def test_idempotency_returns_existing():
    session = await _session()
    rid = '11111111-1111-1111-1111-111111111111'
    payload = ProposalCreate(
        agent_id='idem-agent',
        operator_id='op-1',
        tool_name='propose_test',
        payload={},
        summary='idem test',
        request_id=rid,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    first = await insert_proposal(session, payload)
    existing = await find_by_idempotency(session, agent_id='idem-agent', request_id=rid)
    assert existing is not None
    assert existing.id == first.id
    # cleanup
    await session.execute(text("delete from proposed_actions where id = cast(:id as uuid)"), {'id': first.id})
    await session.commit()


@pytest.mark.asyncio
async def test_mark_status_and_executed():
    session = await _session()
    payload = ProposalCreate(
        agent_id='mark-agent',
        operator_id='op-1',
        tool_name='propose_test',
        payload={},
        summary='mark test',
        request_id=None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    inserted = await insert_proposal(session, payload)
    await mark_status(
        session,
        proposal_id=inserted.id,
        status=ProposalStatus.APPROVED,
        approval_source='ui',
        approved_by='op-1',
        approver_note='looks good',
    )
    await mark_executed(session, proposal_id=inserted.id, execution_result={'ok': True})
    after = await get_proposal(session, inserted.id)
    assert after.status == ProposalStatus.APPROVED
    assert after.execution_result == {'ok': True}
    # cleanup
    await session.execute(text("delete from proposed_actions where id = cast(:id as uuid)"), {'id': inserted.id})
    await session.commit()


@pytest.mark.asyncio
async def test_list_proposals_filters_by_status():
    session = await _session()
    payload = ProposalCreate(
        agent_id='list-agent',
        operator_id='op-1',
        tool_name='propose_test',
        payload={},
        summary='list test',
        request_id=None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    inserted = await insert_proposal(session, payload)
    pending = await list_proposals(session, status=ProposalStatus.PENDING, agent_id='list-agent', limit=10)
    assert any(p.id == inserted.id for p in pending)
    # cleanup
    await session.execute(text("delete from proposed_actions where id = cast(:id as uuid)"), {'id': inserted.id})
    await session.commit()
