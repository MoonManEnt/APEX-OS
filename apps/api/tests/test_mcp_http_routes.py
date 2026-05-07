from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from sqlalchemy import text

from app.core.db import AsyncSessionLocal
from app.main import app


async def _cleanup(session, proposal_id: str) -> None:
    await session.execute(
        text('delete from proposed_actions where id = cast(:id as uuid)'),
        {'id': proposal_id},
    )
    await session.commit()


@pytest.mark.asyncio
async def test_list_proposals_endpoint_returns_list():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://t') as client:
        resp = await client.get('/proposals')
    assert resp.status_code == 200
    assert 'proposals' in resp.json()


@pytest.mark.asyncio
async def test_get_proposal_unknown_returns_404():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://t') as client:
        resp = await client.get('/proposals/00000000-0000-0000-0000-000000000099')
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_approve_endpoint_executes():
    from app.mcp.tools import get_default_registry
    registry = get_default_registry()
    async with AsyncSessionLocal() as session:
        ctx = {
            'session': session,
            'operator_id': 'op-1',
            'agent_id': 'http-test',
            'agent_label': 'HTTP',
        }
        fake_task = MagicMock()
        fake_task.model_dump = MagicMock(return_value={'ok': True})
        with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()), \
             patch('app.mcp.tools.proposals.add_task_comment', new=MagicMock(return_value=fake_task)):
            created = await registry.dispatch_tool(
                name='propose_paperclip_task_comment',
                ctx=ctx,
                params={'task_id': 'route-1', 'body': 'route test'},
            )
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://t') as client:
                resp = await client.post(f'/proposals/{created["proposal_id"]}/approve', json={})
        assert resp.status_code == 200
        body = resp.json()
        assert body['status'] == 'approved'
        await _cleanup(session, created['proposal_id'])
