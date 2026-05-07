from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import text

from app.core.db import get_db_session
from app.mcp.tools import get_default_registry


async def _ctx():
    async for s in get_db_session():
        return {
            'session': s,
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
async def test_propose_paperclip_task_create_returns_proposal_id():
    registry = get_default_registry()
    ctx = await _ctx()
    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()):
        result = await registry.dispatch_tool(
            name='propose_paperclip_task_create',
            ctx=ctx,
            params={'lane': 'inbox', 'title': 'Follow up', 'description': 'Test'},
        )
    assert 'proposal_id' in result
    await _cleanup(ctx['session'], result['proposal_id'])


@pytest.mark.asyncio
async def test_propose_paperclip_task_status_returns_proposal_id():
    registry = get_default_registry()
    ctx = await _ctx()
    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()):
        result = await registry.dispatch_tool(
            name='propose_paperclip_task_status',
            ctx=ctx,
            params={'task_id': 'task-1', 'status': 'done'},
        )
    assert 'proposal_id' in result
    await _cleanup(ctx['session'], result['proposal_id'])


@pytest.mark.asyncio
async def test_propose_paperclip_task_comment_returns_proposal_id():
    registry = get_default_registry()
    ctx = await _ctx()
    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()):
        result = await registry.dispatch_tool(
            name='propose_paperclip_task_comment',
            ctx=ctx,
            params={'task_id': 'task-1', 'body': 'Looks good'},
        )
    assert 'proposal_id' in result
    await _cleanup(ctx['session'], result['proposal_id'])
