from typing import Any

from app.mcp.registry import Registry, ToolDefinition
from app.repositories.actions import (
    get_action_draft as get_draft_repo,
    get_action_draft_history as get_draft_history_repo,
    get_action_review_queue as get_review_queue_repo,
)


def register(registry: Registry) -> None:
    registry.register_tool(
        ToolDefinition(
            name='get_draft',
            description='Fetch the most recent draft for an event by draft type.',
            input_schema={
                'type': 'object',
                'properties': {
                    'event_id': {'type': 'string'},
                    'draft_type': {'type': 'string'},
                },
                'required': ['event_id'],
            },
        ),
        _get_draft,
    )
    registry.register_tool(
        ToolDefinition(
            name='list_drafts',
            description='List the draft history for an event.',
            input_schema={
                'type': 'object',
                'properties': {'event_id': {'type': 'string'}},
                'required': ['event_id'],
            },
        ),
        _list_drafts,
    )
    registry.register_tool(
        ToolDefinition(
            name='list_review_queue',
            description='List drafts awaiting review.',
            input_schema={'type': 'object', 'properties': {}},
        ),
        _list_review_queue,
    )


async def _get_draft(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    draft = await get_draft_repo(session, params['event_id'], params.get('draft_type'))
    if draft is None:
        return {'error': 'not_found', 'event_id': params['event_id']}
    return draft.model_dump()


async def _list_drafts(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    history = await get_draft_history_repo(session, params['event_id'])
    return history.model_dump()


async def _list_review_queue(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    queue = await get_review_queue_repo(session)
    return {'items': [item.model_dump() for item in queue.items]}
