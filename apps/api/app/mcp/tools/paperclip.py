from typing import Any, Optional

from app.mcp.registry import Registry, ToolDefinition
from app.services.paperclip_tasks import (
    list_paperclip_lanes as svc_list_lanes,
    list_tasks as svc_list_tasks,
)


def register(registry: Registry) -> None:
    registry.register_tool(
        ToolDefinition(
            name='list_paperclip_lanes',
            description='List configured paperclip lanes.',
            input_schema={'type': 'object', 'properties': {}},
        ),
        _list_lanes,
    )
    registry.register_tool(
        ToolDefinition(
            name='list_paperclip_tasks',
            description='List paperclip tasks, optionally filtered by event_id and status.',
            input_schema={
                'type': 'object',
                'properties': {
                    'event_id': {'type': 'string'},
                    'status': {'type': 'string'},
                },
            },
        ),
        _list_tasks,
    )
    registry.register_tool(
        ToolDefinition(
            name='get_paperclip_task',
            description='Fetch a single paperclip task by id.',
            input_schema={
                'type': 'object',
                'properties': {'task_id': {'type': 'string'}},
                'required': ['task_id'],
            },
        ),
        _get_task,
    )
    registry.register_tool(
        ToolDefinition(
            name='propose_paperclip_task_create',
            description='Propose creating a paperclip task. Requires approval.',
            input_schema={
                'type': 'object',
                'properties': {
                    'lane': {'type': 'string'},
                    'title': {'type': 'string'},
                    'description': {'type': 'string'},
                    'request_id': {'type': 'string'},
                },
                'required': ['lane', 'title'],
            },
        ),
        _propose_task_create,
    )
    registry.register_tool(
        ToolDefinition(
            name='propose_paperclip_task_status',
            description='Propose changing a paperclip task status.',
            input_schema={
                'type': 'object',
                'properties': {
                    'task_id': {'type': 'string'},
                    'status': {'type': 'string'},
                    'request_id': {'type': 'string'},
                },
                'required': ['task_id', 'status'],
            },
        ),
        _propose_task_status,
    )
    registry.register_tool(
        ToolDefinition(
            name='propose_paperclip_task_comment',
            description='Propose adding a comment to a paperclip task.',
            input_schema={
                'type': 'object',
                'properties': {
                    'task_id': {'type': 'string'},
                    'body': {'type': 'string'},
                    'request_id': {'type': 'string'},
                },
                'required': ['task_id', 'body'],
            },
        ),
        _propose_task_comment,
    )


async def _list_lanes(ctx: dict, params: dict) -> Any:
    lanes = svc_list_lanes()
    return {'lanes': lanes}


async def _list_tasks(ctx: dict, params: dict) -> Any:
    response = svc_list_tasks(event_id=params.get('event_id'))
    items = response.items if hasattr(response, 'items') else []
    status_filter = params.get('status')
    if status_filter:
        items = [t for t in items if getattr(t, 'status', None) == status_filter]
    return {'tasks': [t.model_dump() if hasattr(t, 'model_dump') else t for t in items]}


async def _get_task(ctx: dict, params: dict) -> Any:
    response = svc_list_tasks()
    items = response.items if hasattr(response, 'items') else []
    for t in items:
        tid = t.id if hasattr(t, 'id') else t.get('id')
        if tid == params['task_id']:
            return t.model_dump() if hasattr(t, 'model_dump') else t
    return {'error': 'not_found', 'task_id': params['task_id']}


from app.mcp.proposals import create_proposal


async def _propose_task_create(ctx: dict, params: dict):
    summary = f'Create paperclip task in lane {params["lane"]}: {params["title"]}'
    return await _record(ctx, params, tool_name='propose_paperclip_task_create', summary=summary)


async def _propose_task_status(ctx: dict, params: dict):
    summary = f'Set paperclip task {params["task_id"]} status → {params["status"]}'
    return await _record(ctx, params, tool_name='propose_paperclip_task_status', summary=summary)


async def _propose_task_comment(ctx: dict, params: dict):
    snippet = (params.get('body') or '')[:60]
    summary = f'Comment on paperclip task {params["task_id"]}: {snippet}'
    return await _record(ctx, params, tool_name='propose_paperclip_task_comment', summary=summary)


async def _record(ctx: dict, params: dict, *, tool_name: str, summary: str):
    result = await create_proposal(
        ctx['session'],
        agent_id=ctx['agent_id'],
        agent_label=ctx.get('agent_label'),
        operator_id=ctx['operator_id'],
        tool_name=tool_name,
        payload=params,
        summary=summary,
        request_id=params.get('request_id'),
    )
    return {
        'proposal_id': result.proposal.id,
        'expires_at': result.proposal.expires_at,
        'summary': result.proposal.summary,
        'status': result.proposal.status.value,
        'created': result.created,
    }
