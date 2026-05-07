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
    registry.register_tool(
        ToolDefinition(
            name='propose_draft_create',
            description='Propose creating a new draft. Returns a proposal_id requiring approval.',
            input_schema={
                'type': 'object',
                'properties': {
                    'event_id': {'type': 'string'},
                    'draft_type': {'type': 'string'},
                    'subject': {'type': 'string'},
                    'body': {'type': 'string'},
                    'request_id': {'type': 'string'},
                },
                'required': ['event_id', 'draft_type', 'body'],
            },
        ),
        _propose_draft_create,
    )
    registry.register_tool(
        ToolDefinition(
            name='propose_draft_edit',
            description='Propose editing an existing draft.',
            input_schema={
                'type': 'object',
                'properties': {
                    'event_id': {'type': 'string'},
                    'draft_type': {'type': 'string'},
                    'subject': {'type': 'string'},
                    'body': {'type': 'string'},
                    'request_id': {'type': 'string'},
                },
                'required': ['event_id', 'draft_type', 'body'],
            },
        ),
        _propose_draft_edit,
    )
    registry.register_tool(
        ToolDefinition(
            name='propose_draft_transition',
            description='Propose transitioning a draft status (e.g., approved, ready_to_send).',
            input_schema={
                'type': 'object',
                'properties': {
                    'event_id': {'type': 'string'},
                    'draft_type': {'type': 'string'},
                    'next_status': {'type': 'string'},
                    'request_id': {'type': 'string'},
                },
                'required': ['event_id', 'draft_type', 'next_status'],
            },
        ),
        _propose_draft_transition,
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


from app.mcp.proposals import create_proposal


def _summary_for_draft(verb: str, params: dict) -> str:
    subject = params.get('subject') or '(no subject)'
    return f'{verb} {params.get("draft_type", "draft")} for event {params.get("event_id")}: {subject}'


async def _propose_write(ctx: dict, params: dict, *, tool_name: str, summary: str) -> dict:
    # Note: this handler always queues a proposal. Sentry-mode auto-execution
    # is layered on in Task 9 once the executor router exists.
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


async def _propose_draft_create(ctx: dict, params: dict):
    return await _propose_write(
        ctx, params,
        tool_name='propose_draft_create',
        summary=_summary_for_draft('Create', params),
    )


async def _propose_draft_edit(ctx: dict, params: dict):
    return await _propose_write(
        ctx, params,
        tool_name='propose_draft_edit',
        summary=_summary_for_draft('Edit', params),
    )


async def _propose_draft_transition(ctx: dict, params: dict):
    return await _propose_write(
        ctx, params,
        tool_name='propose_draft_transition',
        summary=f'Transition {params.get("draft_type", "draft")} for event {params.get("event_id")} → {params.get("next_status")}',
    )
