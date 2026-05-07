import pytest

from app.mcp.registry import (
    Registry,
    ToolNotFoundError,
    ToolDefinition,
)


@pytest.mark.asyncio
async def test_register_and_dispatch_tool():
    registry = Registry()

    async def echo_tool(ctx, params):
        return {'echoed': params['msg']}

    registry.register_tool(
        ToolDefinition(
            name='echo',
            description='Echoes its input.',
            input_schema={'type': 'object', 'properties': {'msg': {'type': 'string'}}, 'required': ['msg']},
        ),
        echo_tool,
    )
    listed = registry.list_tools()
    assert any(t.name == 'echo' for t in listed)
    result = await registry.dispatch_tool(name='echo', ctx={}, params={'msg': 'hi'})
    assert result == {'echoed': 'hi'}


@pytest.mark.asyncio
async def test_dispatch_unknown_tool_raises():
    registry = Registry()
    with pytest.raises(ToolNotFoundError):
        await registry.dispatch_tool(name='nonexistent', ctx={}, params={})


@pytest.mark.asyncio
async def test_default_registry_has_events_tools():
    from app.mcp.tools import get_default_registry
    registry = get_default_registry()
    names = {t.name for t in registry.list_tools()}
    assert 'list_events' in names
    assert 'get_event' in names
    assert 'search_events_by_brand' in names
