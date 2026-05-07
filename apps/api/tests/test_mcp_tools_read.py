import pytest

from app.core.db import get_db_session
from app.mcp.tools import get_default_registry


async def _ctx():
    async for s in get_db_session():
        return {'session': s, 'operator_id': 'op-1', 'agent_id': 'tester'}


@pytest.mark.asyncio
async def test_list_events_returns_dict_with_events_key():
    registry = get_default_registry()
    ctx = await _ctx()
    result = await registry.dispatch_tool(name='list_events', ctx=ctx, params={})
    assert 'events' in result
    assert isinstance(result['events'], list)


@pytest.mark.asyncio
async def test_list_accounts_returns_list():
    registry = get_default_registry()
    ctx = await _ctx()
    result = await registry.dispatch_tool(name='list_accounts', ctx=ctx, params={})
    assert 'accounts' in result
    assert isinstance(result['accounts'], list)


@pytest.mark.asyncio
async def test_list_review_queue_returns_list():
    registry = get_default_registry()
    ctx = await _ctx()
    result = await registry.dispatch_tool(name='list_review_queue', ctx=ctx, params={})
    assert 'items' in result


@pytest.mark.asyncio
async def test_list_paperclip_lanes_returns_list():
    registry = get_default_registry()
    ctx = await _ctx()
    result = await registry.dispatch_tool(name='list_paperclip_lanes', ctx=ctx, params={})
    assert 'lanes' in result


@pytest.mark.asyncio
async def test_get_session_context_returns_operator_info():
    registry = get_default_registry()
    ctx = await _ctx()
    result = await registry.dispatch_tool(name='get_session_context', ctx=ctx, params={})
    assert result['operator_id'] == 'op-1'
    assert result['agent_id'] == 'tester'
