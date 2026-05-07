from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import text

from app.core.db import AsyncSessionLocal
from app.mcp.tools import get_default_registry


def _build_ctx(session):
    return {
        'session': session,
        'operator_id': 'op-1',
        'operator_name': 'Op One',
        'role': 'principal_operator',
        'permissions': ['draft:edit', 'draft:approve', 'draft:ready', 'paperclip:write'],
        'agent_id': 'lifecycle-tester',
        'agent_label': 'Lifecycle Tester',
    }


async def _cleanup(session, proposal_id: str) -> None:
    await session.execute(
        text('delete from proposed_actions where id = cast(:id as uuid)'),
        {'id': proposal_id},
    )
    await session.commit()


@pytest.mark.asyncio
async def test_list_proposals_returns_pending():
    registry = get_default_registry()
    async with AsyncSessionLocal() as session:
        ctx = _build_ctx(session)
        with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()):
            created = await registry.dispatch_tool(
                name='propose_paperclip_task_comment',
                ctx=ctx,
                params={'task_id': 'tlf-1', 'body': 'lifecycle test'},
            )
            listed = await registry.dispatch_tool(
                name='list_proposals',
                ctx=ctx,
                params={'status': 'pending', 'agent_id': 'lifecycle-tester'},
            )
        assert any(p['id'] == created['proposal_id'] for p in listed['proposals'])
        await _cleanup(session, created['proposal_id'])


@pytest.mark.asyncio
async def test_approve_unknown_proposal_returns_error():
    registry = get_default_registry()
    async with AsyncSessionLocal() as session:
        ctx = _build_ctx(session)
        result = await registry.dispatch_tool(
            name='approve_proposal',
            ctx=ctx,
            params={'proposal_id': '00000000-0000-0000-0000-000000000099'},
        )
        assert result.get('error') == 'not_found'


@pytest.mark.asyncio
async def test_approve_paperclip_comment_executes():
    registry = get_default_registry()
    async with AsyncSessionLocal() as session:
        ctx = _build_ctx(session)
        fake_task = MagicMock()
        fake_task.model_dump = MagicMock(return_value={'ok': True})

        with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()), \
             patch('app.mcp.tools.proposals.add_task_comment', new=MagicMock(return_value=fake_task)) as mock_add:
            created = await registry.dispatch_tool(
                name='propose_paperclip_task_comment',
                ctx=ctx,
                params={'task_id': 'tlf-2', 'body': 'execute me'},
            )
            approved = await registry.dispatch_tool(
                name='approve_proposal',
                ctx=ctx,
                params={'proposal_id': created['proposal_id']},
            )
        assert approved['status'] == 'approved', f'unexpected response: {approved}'
        assert approved['execution_result'] == {'ok': True}
        mock_add.assert_called_once()
        await _cleanup(session, created['proposal_id'])


@pytest.mark.asyncio
async def test_reject_proposal_records_reason():
    registry = get_default_registry()
    async with AsyncSessionLocal() as session:
        ctx = _build_ctx(session)
        with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()):
            created = await registry.dispatch_tool(
                name='propose_paperclip_task_comment',
                ctx=ctx,
                params={'task_id': 'tlf-3', 'body': 'reject me'},
            )
            rejected = await registry.dispatch_tool(
                name='reject_proposal',
                ctx=ctx,
                params={'proposal_id': created['proposal_id'], 'reason': 'not now'},
            )
        assert rejected['status'] == 'rejected'
        assert rejected['rejection_reason'] == 'not now'
        await _cleanup(session, created['proposal_id'])


@pytest.mark.asyncio
async def test_sentry_mode_auto_executes_write(monkeypatch):
    monkeypatch.setenv('APEX_MCP_SENTRY_TOOLS', 'propose_paperclip_task_comment')
    registry = get_default_registry()
    async with AsyncSessionLocal() as session:
        ctx = _build_ctx(session)
        fake_task = MagicMock()
        fake_task.model_dump = MagicMock(return_value={'ok': True})

        with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()), \
             patch('app.mcp.tools.proposals.add_task_comment', new=MagicMock(return_value=fake_task)):
            result = await registry.dispatch_tool(
                name='propose_paperclip_task_comment',
                ctx=ctx,
                params={'task_id': 'sentry-1', 'body': 'sentry'},
            )
        assert result['status'] == 'approved'
        assert result.get('sentry_executed') is True
        assert result['execution_result'] == {'ok': True}
        await _cleanup(session, result['id'])
