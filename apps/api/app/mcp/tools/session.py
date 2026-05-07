from typing import Any

from app.mcp.registry import Registry, ToolDefinition


def register(registry: Registry) -> None:
    registry.register_tool(
        ToolDefinition(
            name='get_session_context',
            description='Return the calling agent + operator context for reasoning.',
            input_schema={'type': 'object', 'properties': {}},
        ),
        _get_context,
    )


async def _get_context(ctx: dict, params: dict) -> Any:
    return {
        'operator_id': ctx.get('operator_id'),
        'operator_name': ctx.get('operator_name'),
        'role': ctx.get('role'),
        'permissions': ctx.get('permissions', []),
        'agent_id': ctx.get('agent_id'),
        'agent_label': ctx.get('agent_label'),
    }
