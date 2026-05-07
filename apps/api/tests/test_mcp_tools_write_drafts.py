from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import text

from app.core.db import AsyncSessionLocal
from app.mcp.tools import get_default_registry


@asynccontextmanager
async def _ctx():
    async with AsyncSessionLocal() as session:
        yield {
            'session': session,
            'operator_id': 'op-1',
            'agent_id': 'tester',
            'agent_label': 'Tester',
        }


async def _cleanup(session, proposal_id: str) -> None:
    await session.execute(
        text('delete from proposed_actions where id = cast(:id as uuid)'),
        {'id': proposal_id},
    )
    await session.commit()


@pytest.mark.asyncio
async def test_propose_draft_create_returns_proposal_id():
    registry = get_default_registry()
    async with _ctx() as ctx:
        with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()):
            result = await registry.dispatch_tool(
                name='propose_draft_create',
                ctx=ctx,
                params={
                    'event_id': '00000000-0000-0000-0000-000000000001',
                    'draft_type': 'cold_outreach',
                    'subject': 'Hello',
                    'body': 'Body text',
                },
            )
        assert 'proposal_id' in result
        assert 'expires_at' in result
        assert result['summary']
        await _cleanup(ctx['session'], result['proposal_id'])


@pytest.mark.asyncio
async def test_propose_draft_edit_with_idempotency():
    registry = get_default_registry()
    rid = '33333333-3333-3333-3333-333333333333'
    async with _ctx() as ctx:
        with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()):
            first = await registry.dispatch_tool(
                name='propose_draft_edit',
                ctx=ctx,
                params={
                    'event_id': '00000000-0000-0000-0000-000000000001',
                    'draft_type': 'cold_outreach',
                    'subject': 'Edit',
                    'body': 'Edited body',
                    'request_id': rid,
                },
            )
            second = await registry.dispatch_tool(
                name='propose_draft_edit',
                ctx=ctx,
                params={
                    'event_id': '00000000-0000-0000-0000-000000000001',
                    'draft_type': 'cold_outreach',
                    'subject': 'Different',
                    'body': 'Different body',
                    'request_id': rid,
                },
            )
        assert first['proposal_id'] == second['proposal_id']
        await _cleanup(ctx['session'], first['proposal_id'])
