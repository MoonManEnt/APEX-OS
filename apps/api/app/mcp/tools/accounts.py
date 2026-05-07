from typing import Any

from app.mcp.registry import Registry, ToolDefinition
from app.repositories.properties import get_property as get_property_repo
from app.repositories.properties import list_properties as list_properties_repo


def register(registry: Registry) -> None:
    registry.register_tool(
        ToolDefinition(
            name='list_accounts',
            description='List APEX accounts/properties with optional brand/search/sort filters.',
            input_schema={
                'type': 'object',
                'properties': {
                    'brand': {'type': 'string'},
                    'search': {'type': 'string'},
                    'sort': {'type': 'string', 'enum': ['score_desc', 'score_asc', 'signal_count', 'market_asc', 'name_asc']},
                },
            },
        ),
        _list_accounts,
    )
    registry.register_tool(
        ToolDefinition(
            name='get_account',
            description='Fetch a single account/property with linked signals.',
            input_schema={
                'type': 'object',
                'properties': {'account_id': {'type': 'string'}},
                'required': ['account_id'],
            },
        ),
        _get_account,
    )
    registry.register_tool(
        ToolDefinition(
            name='list_account_signals',
            description='List signals attached to an account.',
            input_schema={
                'type': 'object',
                'properties': {'account_id': {'type': 'string'}},
                'required': ['account_id'],
            },
        ),
        _list_account_signals,
    )


async def _list_accounts(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    items = await list_properties_repo(
        session,
        brand=params.get('brand'),
        search=params.get('search'),
        sort=params.get('sort'),
    )
    return {'accounts': [p.model_dump() for p in items]}


async def _get_account(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    detail = await get_property_repo(session, params['account_id'])
    if detail is None:
        return {'error': 'not_found', 'account_id': params['account_id']}
    return detail.model_dump()


async def _list_account_signals(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    detail = await get_property_repo(session, params['account_id'])
    if detail is None:
        return {'error': 'not_found', 'account_id': params['account_id']}
    return {'signals': [s.model_dump() for s in detail.linked_signals]}
