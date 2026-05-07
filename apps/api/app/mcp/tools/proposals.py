from typing import Any, Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.mcp.proposals import (
    ProposalAlreadyResolvedError,
    ProposalNotFoundError,
    approve_proposal as svc_approve,
    list_proposals_view,
    reject_proposal as svc_reject,
)
from app.mcp.registry import Registry, ToolDefinition
from app.models.actions import ActionDraftResponse
from app.models.paperclip_tasks import (
    PaperclipTaskCreateRequest,
)
from app.models.proposals import ApprovalSource, ProposalStatus
from app.repositories.actions import persist_action_draft
from app.repositories.proposals import get_proposal as get_proposal_repo
from app.services.paperclip_tasks import (
    add_task_comment,
    create_or_update_sync_task,
    update_task_status,
)


def register(registry: Registry) -> None:
    registry.register_tool(
        ToolDefinition(
            name='list_proposals',
            description='List proposals filtered by status / agent.',
            input_schema={
                'type': 'object',
                'properties': {
                    'status': {'type': 'string'},
                    'agent_id': {'type': 'string'},
                    'limit': {'type': 'integer'},
                },
            },
        ),
        _list_proposals,
    )
    registry.register_tool(
        ToolDefinition(
            name='get_proposal',
            description='Fetch a single proposal by id.',
            input_schema={
                'type': 'object',
                'properties': {'proposal_id': {'type': 'string'}},
                'required': ['proposal_id'],
            },
        ),
        _get_proposal,
    )
    registry.register_tool(
        ToolDefinition(
            name='approve_proposal',
            description='Approve a pending proposal and execute its underlying action.',
            input_schema={
                'type': 'object',
                'properties': {
                    'proposal_id': {'type': 'string'},
                    'approver_note': {'type': 'string'},
                },
                'required': ['proposal_id'],
            },
        ),
        _approve_proposal,
    )
    registry.register_tool(
        ToolDefinition(
            name='reject_proposal',
            description='Reject a pending proposal.',
            input_schema={
                'type': 'object',
                'properties': {
                    'proposal_id': {'type': 'string'},
                    'reason': {'type': 'string'},
                },
                'required': ['proposal_id', 'reason'],
            },
        ),
        _reject_proposal,
    )


async def _list_proposals(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    status_str = params.get('status')
    status = ProposalStatus(status_str) if status_str else None
    proposals = await list_proposals_view(
        session,
        status=status,
        agent_id=params.get('agent_id'),
        limit=int(params.get('limit') or 50),
    )
    return {'proposals': [p.model_dump() for p in proposals]}


async def _get_proposal(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    p = await get_proposal_repo(session, params['proposal_id'])
    if p is None:
        return {'error': 'not_found', 'proposal_id': params['proposal_id']}
    return p.model_dump()


async def _approve_proposal(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    try:
        executor = _executor_for_session(session)
        approved = await svc_approve(
            session,
            proposal_id=params['proposal_id'],
            approver_id=ctx['operator_id'],
            source=ApprovalSource.MCP,
            approver_note=params.get('approver_note'),
            executor=executor,
        )
    except ProposalNotFoundError:
        return {'error': 'not_found', 'proposal_id': params['proposal_id']}
    except ProposalAlreadyResolvedError as e:
        return {
            'error': 'already_resolved',
            'proposal_id': e.proposal_id,
            'current_status': e.current_status.value,
        }
    return approved.model_dump()


async def _reject_proposal(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    try:
        rejected = await svc_reject(
            session,
            proposal_id=params['proposal_id'],
            approver_id=ctx['operator_id'],
            reason=params['reason'],
        )
    except ProposalNotFoundError:
        return {'error': 'not_found', 'proposal_id': params['proposal_id']}
    except ProposalAlreadyResolvedError as e:
        return {
            'error': 'already_resolved',
            'proposal_id': e.proposal_id,
            'current_status': e.current_status.value,
        }
    return rejected.model_dump()


# --- Executor: maps an approved proposal's tool_name + payload to the real APEX action.

def _executor_for_session(session: AsyncSession) -> Callable[[dict], Awaitable[dict]]:
    async def execute(payload_with_tool: dict) -> dict:
        return await _route_execution(session, payload_with_tool)
    return execute


async def _route_execution(session: AsyncSession, payload: dict) -> dict:
    """Routes the approved proposal payload to the underlying APEX action.

    The dispatch key is `payload['__tool_name__']`, set by the proposals service
    when invoking the executor.
    """
    tool_name = payload.get('__tool_name__')
    p = {k: v for k, v in payload.items() if k != '__tool_name__'}
    if tool_name == 'propose_draft_create':
        return await _exec_draft_create(session, p)
    if tool_name == 'propose_draft_edit':
        return await _exec_draft_edit(session, p)
    if tool_name == 'propose_draft_transition':
        return await _exec_draft_transition(session, p)
    if tool_name == 'propose_paperclip_task_create':
        return _exec_paperclip_create(p)
    if tool_name == 'propose_paperclip_task_status':
        return _exec_paperclip_status(p)
    if tool_name == 'propose_paperclip_task_comment':
        return _exec_paperclip_comment(p)
    return {'error': 'no_executor', 'tool_name': tool_name}


def _draft_response_from_payload(p: dict, *, draft_status: str = 'edited') -> ActionDraftResponse:
    return ActionDraftResponse(
        event_id=p['event_id'],
        title=p.get('subject') or '',
        body=p.get('body') or '',
        audience=p.get('audience') or 'operator',
        recommended_brand=p.get('recommended_brand') or 'unspecified',
        why_it_matters=p.get('why_it_matters') or '',
        signal_posture=p.get('signal_posture') or '',
        model_name=p.get('model_name') or 'mcp-proposal',
        used_fallback=False,
        context_notes=p.get('context_notes') or [],
        metadata=p.get('metadata') or {},
        draft_type=p.get('draft_type', 'primary_outreach'),
        draft_status=draft_status,
        edited_by_operator=False,
    )


async def _exec_draft_create(session: AsyncSession, p: dict) -> dict:
    draft = _draft_response_from_payload(p, draft_status='generated')
    persisted = await persist_action_draft(session, draft)
    return {'persisted': persisted.model_dump()}


async def _exec_draft_edit(session: AsyncSession, p: dict) -> dict:
    draft = _draft_response_from_payload(p, draft_status='edited')
    persisted = await persist_action_draft(session, draft)
    return {'persisted': persisted.model_dump()}


async def _exec_draft_transition(session: AsyncSession, p: dict) -> dict:
    return {
        'transitioned': True,
        'event_id': p['event_id'],
        'draft_type': p.get('draft_type'),
        'next_status': p['next_status'],
    }


def _exec_paperclip_create(p: dict) -> dict:
    request = PaperclipTaskCreateRequest(
        title=p['title'],
        event_id=p.get('event_id', ''),
        lane=p['lane'],
        summary=p.get('description') or '',
    )
    task = create_or_update_sync_task(request)
    return {'task': task.model_dump() if hasattr(task, 'model_dump') else task}


def _exec_paperclip_status(p: dict) -> dict:
    task = update_task_status(p['task_id'], p['status'])
    if task is None:
        return {'error': 'task_not_found', 'task_id': p['task_id']}
    return {'task': task.model_dump() if hasattr(task, 'model_dump') else task}


def _exec_paperclip_comment(p: dict) -> dict:
    task = add_task_comment(p['task_id'], p['body'])
    if task is None:
        return {'error': 'task_not_found', 'task_id': p['task_id']}
    return task.model_dump() if hasattr(task, 'model_dump') else task
