from typing import Any

from app.mcp.registry import Registry, ToolDefinition
from app.repositories.events import get_event as get_event_repo
from app.repositories.events import list_events as list_events_repo


def register(registry: Registry) -> None:
    registry.register_tool(
        ToolDefinition(
            name='list_events',
            description='List recent newsroom events with optional brand/market/since filters.',
            input_schema={
                'type': 'object',
                'properties': {
                    'brand': {'type': 'string'},
                    'market': {'type': 'string'},
                    'since': {'type': 'string', 'description': 'ISO 8601 timestamp'},
                    'min_score': {'type': 'integer', 'minimum': 0, 'maximum': 100},
                },
            },
        ),
        _list_events,
    )
    registry.register_tool(
        ToolDefinition(
            name='get_event',
            description='Fetch a single event by id, including linked actions.',
            input_schema={
                'type': 'object',
                'properties': {'event_id': {'type': 'string'}},
                'required': ['event_id'],
            },
        ),
        _get_event,
    )
    registry.register_tool(
        ToolDefinition(
            name='search_events_by_brand',
            description='Convenience: list recent events filtered by primary brand.',
            input_schema={
                'type': 'object',
                'properties': {'brand': {'type': 'string'}, 'limit': {'type': 'integer'}},
                'required': ['brand'],
            },
        ),
        _search_by_brand,
    )


async def _list_events(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    events = await list_events_repo(
        session,
        brand=params.get('brand'),
        market=params.get('market'),
        event_type=params.get('event_type'),
        min_score=params.get('min_score'),
        since=params.get('since'),
    )
    return {'events': [e.model_dump() for e in events]}


async def _get_event(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    event = await get_event_repo(session, params['event_id'])
    if event is None:
        return {'error': 'not_found', 'event_id': params['event_id']}
    return event.model_dump()


async def _search_by_brand(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    events = await list_events_repo(session, brand=params['brand'])
    limit = int(params.get('limit') or 25)
    return {'events': [e.model_dump() for e in events[:limit]]}
