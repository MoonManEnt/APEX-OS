"""APEX OS — FastAPI entry point."""

# TODO(WS-1): Wire ingestion worker startup (ingestion.fetch queue consumer)
# TODO(WS-1): Wire classification worker startup (classification.run queue consumer)
# TODO(WS-2): Implement GET /events with brand/market/event_type/score filters
# TODO(WS-2): Implement GET /events/{id}
# TODO(WS-2): Add WebSocket /ws endpoint for feed.publish push

import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.core.settings import settings
from app.models.actions import ActionDraftRequest, ActionDraftResponse, ActionDraftUpdateRequest, ActionReviewQueueResponse
from app.models.audit import AuditListResponse
from app.models.events import EventFilters, EventListResponse
from app.models.paperclip_tasks import (
    PaperclipTaskCommentRequest,
    PaperclipTaskCreateRequest,
    PaperclipTaskStatusRequest,
)
from app.models.properties import PropertyCreateRequest, PropertyDetail, PropertyListItem, PropertyUpdateRequest
from app.models.session import OperatorSession
from app.repositories.actions import get_action_draft as get_action_draft_repository
from app.repositories.actions import get_action_draft_history as get_action_draft_history_repository
from app.repositories.actions import get_action_review_queue as get_action_review_queue_repository
from app.repositories.actions import persist_action_draft
from app.repositories.events import get_event as get_event_repository
from app.repositories.events import list_events as list_events_repository
from app.repositories.proposals import get_proposal as get_proposal_repository
from app.mcp.proposals import (
    ProposalAlreadyResolvedError,
    ProposalNotFoundError,
    approve_proposal as approve_proposal_service,
    list_proposals_view,
    reject_proposal as reject_proposal_service,
)
from app.mcp.tools.proposals import _executor_for_session
from app.mcp.transport_http import router as mcp_router
from app.models.proposals import ApprovalSource, ProposalStatus
from app.repositories.properties import (
    check_duplicate as check_property_duplicate,
    create_property as create_property_repository,
    delete_property as delete_property_repository,
    get_property as get_property_repository,
    list_properties as list_properties_repository,
    update_property as update_property_repository,
)
from app.services.actions import generate_action_draft
from app.services.bootstrap import ingest_google_news_cre, seed_sample_event
from app.services.feed import feed_manager
from app.services.paperclip import load_paperclip_context
from app.services.audit import list_audit, record_audit
from app.services.paperclip_tasks import (
    add_task_comment,
    create_or_update_sync_task,
    list_paperclip_lanes,
    list_tasks,
    update_task_status,
)
from app.services.session import get_operator_session, require_permission

app = FastAPI(
    title="APEX OS API",
    description="Source ingestion, event classification, and feed service",
    version="0.1.0",
)

_cors_origins = [o.strip() for o in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',') if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins or ['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(mcp_router)

DRAFT_TRANSITIONS: dict[Optional[str], set[str]] = {
    None: {'edited', 'awaiting_review'},
    'generated': {'edited', 'awaiting_review'},
    'edited': {'edited', 'awaiting_review'},
    'awaiting_review': {'awaiting_review', 'changes_requested', 'approved'},
    'changes_requested': {'edited', 'awaiting_review'},
    'approved': {'approved', 'ready_to_send', 'changes_requested'},
    'ready_to_send': {'ready_to_send'},
}


def validate_draft_transition(
    *,
    previous_status: Optional[str],
    next_status: str,
    operator: OperatorSession,
    operator_name: str,
    event_id: str,
    draft_type: str,
    entity_id: str,
    assigned_reviewer_name: Optional[str],
) -> None:
    allowed = DRAFT_TRANSITIONS.get(previous_status, set())
    if next_status in allowed:
        return

    record_audit(
        actor=operator_name,
        entity_type='draft_action',
        entity_id=entity_id,
        event_id=event_id,
        action='draft_transition_denied',
        summary=f'Draft transition from {previous_status or "none"} to {next_status} is not allowed.',
        metadata={
            'draft_type': draft_type,
            'previous_status': previous_status,
            'attempted_status': next_status,
            'operator_name': operator_name,
            'operator_role': operator.role,
            'assigned_reviewer_name': assigned_reviewer_name,
            'reason': 'invalid_transition',
        },
    )
    raise HTTPException(status_code=409, detail=f'Invalid draft transition: {previous_status or "none"} -> {next_status}')


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "apex-api",
        "databaseConfigured": bool(settings.database_url),
        "redisConfigured": bool(settings.redis_url),
    }


@app.get("/events", response_model=EventListResponse)
async def list_events(
    brand: Optional[str] = Query(default=None),
    market: Optional[str] = Query(default=None),
    event_type: Optional[str] = Query(default=None),
    min_score: Optional[int] = Query(default=None, ge=0, le=100),
    since: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
) -> EventListResponse:
    if since is not None:
        try:
            datetime.fromisoformat(since.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid since timestamp")
    filters = EventFilters(
        brand=brand,
        market=market,
        event_type=event_type,
        min_score=min_score,
        since=since,
    )
    events = await list_events_repository(
        session,
        brand=filters.brand,
        market=filters.market,
        event_type=filters.event_type,
        min_score=filters.min_score,
        since=filters.since,
    )
    return EventListResponse(events=events)


@app.get("/events/{event_id}")
async def get_event(event_id: str, session: AsyncSession = Depends(get_db_session)) -> dict:
    event = await get_event_repository(session, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail='Event not found')
    return event.model_dump()


@app.post('/bootstrap/sample-event')
async def bootstrap_sample_event(session: AsyncSession = Depends(get_db_session)) -> dict:
    seeded = await seed_sample_event(session)
    record_audit(
        actor='apex-system',
        entity_type='system_ingest',
        entity_id=seeded['event_id'],
        event_id=seeded['event_id'],
        action='sample_event_seeded',
        summary='Seeded sample event into APEX.',
        metadata={
            'raw_scrape_id': seeded.get('raw_scrape_id'),
            'account_id': seeded.get('account_id'),
            'property_id': seeded.get('property_id'),
            'source': 'manual.seed',
        },
    )
    await feed_manager.broadcast({'type': 'feed.seeded', 'eventId': seeded['event_id'], 'primaryBrand': seeded.get('classification', {}).get('primary_brand')})
    return seeded


@app.post('/ingest/google-news-cre')
async def ingest_google_news(
    query: str = Query(default='commercial real estate Dallas'),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    result = await ingest_google_news_cre(session, query)
    record_audit(
        actor='apex-system',
        entity_type='system_ingest',
        entity_id=f'google-news:{query}',
        action='google_news_ingested',
        summary=f'Ingested Google News CRE query: {query}.',
        metadata={
            'query': query,
            'count': result['count'],
            'event_ids': [item.get('event_id') for item in result.get('events', [])],
        },
    )
    ingested_brands = list({
        item.get('primary_brand')
        for item in result.get('events', [])
        if item.get('primary_brand')
    })
    await feed_manager.broadcast({'type': 'feed.ingested', 'count': result['count'], 'primaryBrands': ingested_brands})
    return result


@app.get('/actions/draft/{event_id}')
async def get_saved_action_draft(
    event_id: str,
    draft_type: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    draft = await get_action_draft_repository(session, event_id, draft_type=draft_type)
    if draft is None:
        raise HTTPException(status_code=404, detail='Draft not found')
    return draft.model_dump()


@app.get('/actions/draft/{event_id}/history')
async def get_saved_action_draft_history(
    event_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    history = await get_action_draft_history_repository(session, event_id)
    return history.model_dump()


@app.get('/actions/review-queue', response_model=ActionReviewQueueResponse)
async def get_action_review_queue(
    session: AsyncSession = Depends(get_db_session),
) -> ActionReviewQueueResponse:
    return await get_action_review_queue_repository(session)


@app.get('/session/current', response_model=OperatorSession)
async def get_current_session(operator: OperatorSession = Depends(get_operator_session)) -> OperatorSession:
    return operator


@app.get('/paperclip/context')
async def get_paperclip_context() -> dict:
    return load_paperclip_context().model_dump()


@app.get('/paperclip/lanes')
async def get_paperclip_lanes() -> dict:
    return {'items': list_paperclip_lanes()}


@app.get('/paperclip/tasks')
async def get_paperclip_tasks(event_id: Optional[str] = Query(default=None)) -> dict:
    return list_tasks(event_id=event_id).model_dump()


@app.post('/paperclip/tasks')
async def sync_paperclip_task(
    request: PaperclipTaskCreateRequest,
    operator: OperatorSession = Depends(get_operator_session),
) -> dict:
    require_permission(operator, 'paperclip:write')
    if not request.operator_name:
        request.operator_name = operator.operator_name
    return create_or_update_sync_task(request).model_dump()


@app.post('/paperclip/tasks/{task_id}/status')
async def set_paperclip_task_status(
    task_id: str,
    request: PaperclipTaskStatusRequest,
    operator: OperatorSession = Depends(get_operator_session),
) -> dict:
    require_permission(operator, 'paperclip:write')
    task = update_task_status(task_id, request.status, operator_name=request.operator_name or operator.operator_name)
    if task is None:
        raise HTTPException(status_code=404, detail='Paperclip task not found')
    return task.model_dump()


@app.post('/paperclip/tasks/{task_id}/comment')
async def comment_paperclip_task(
    task_id: str,
    request: PaperclipTaskCommentRequest,
    operator: OperatorSession = Depends(get_operator_session),
) -> dict:
    require_permission(operator, 'paperclip:write')
    task = add_task_comment(task_id, request.body, operator_name=request.operator_name or operator.operator_name)
    if task is None:
        raise HTTPException(status_code=404, detail='Paperclip task not found')
    return task.model_dump()


@app.post('/actions/draft')
async def draft_action(
    request: ActionDraftRequest,
    force: bool = Query(default=False),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    existing = await get_action_draft_repository(session, request.event_id, draft_type=request.draft_type)
    if existing is not None and not force:
        record_audit(
            actor='apex-system',
            entity_type='draft_action',
            entity_id=existing.metadata.get('action_id', request.event_id),
            event_id=request.event_id,
            action='draft_reused',
            summary='Returned existing draft without regenerating.',
            metadata={'draft_type': request.draft_type, 'draft_status': existing.draft_status},
        )
        return existing.model_dump()

    draft = await generate_action_draft(request)
    saved = await persist_action_draft(session, draft)
    await session.commit()
    record_audit(
        actor='apex-system',
        entity_type='draft_action',
        entity_id=saved.metadata.get('action_id', request.event_id),
        event_id=request.event_id,
        action='draft_generated',
        summary='Generated new action draft.',
        metadata={'draft_type': request.draft_type, 'draft_status': saved.draft_status, 'model_name': saved.model_name},
    )
    return saved.model_dump()


@app.put('/actions/draft/{event_id}')
async def update_action_draft(
    event_id: str,
    request: ActionDraftUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    operator: OperatorSession = Depends(get_operator_session),
) -> dict:
    existing = await get_action_draft_repository(session, event_id, draft_type=request.draft_type)
    previous_status = existing.draft_status if existing is not None else None
    operator_name = request.operator_name or operator.operator_name
    existing_metadata = existing.metadata if existing is not None else {}
    entity_id = existing.metadata.get('action_id', event_id) if existing is not None else event_id
    assigned_reviewer_name = request.assigned_reviewer_name or existing_metadata.get('assigned_reviewer_name')
    reviewed_by_name = existing_metadata.get('reviewed_by_name')

    validate_draft_transition(
        previous_status=previous_status,
        next_status=request.draft_status,
        operator=operator,
        operator_name=operator_name,
        event_id=event_id,
        draft_type=request.draft_type,
        entity_id=entity_id,
        assigned_reviewer_name=assigned_reviewer_name,
    )

    if request.draft_status == 'awaiting_review' and not assigned_reviewer_name:
        record_audit(
            actor=operator_name,
            entity_type='draft_action',
            entity_id=entity_id,
            event_id=event_id,
            action='draft_transition_denied',
            summary='Draft cannot enter awaiting_review without an assigned reviewer.',
            metadata={
                'draft_type': request.draft_type,
                'attempted_status': request.draft_status,
                'operator_name': operator_name,
                'operator_role': operator.role,
                'reason': 'missing_assigned_reviewer',
            },
        )
        raise HTTPException(status_code=409, detail='Assigned reviewer required before submitting for review')

    if request.draft_status in {'approved', 'ready_to_send'}:
        required_permission = 'draft:approve' if request.draft_status == 'approved' else 'draft:ready'
        if required_permission not in operator.permissions:
            record_audit(
                actor=operator_name,
                entity_type='draft_action',
                entity_id=entity_id,
                event_id=event_id,
                action='draft_transition_denied',
                summary=f'Draft transition to {request.draft_status} denied for role {operator.role}.',
                metadata={
                    'draft_type': request.draft_type,
                    'attempted_status': request.draft_status,
                    'operator_name': operator_name,
                    'operator_role': operator.role,
                    'required_permission': required_permission,
                    'reason': 'missing_permission',
                },
            )
        require_permission(operator, required_permission)
    if request.draft_status == 'changes_requested':
        if 'draft:approve' not in operator.permissions:
            record_audit(
                actor=operator_name,
                entity_type='draft_action',
                entity_id=entity_id,
                event_id=event_id,
                action='draft_transition_denied',
                summary=f'Draft transition to {request.draft_status} denied for role {operator.role}.',
                metadata={
                    'draft_type': request.draft_type,
                    'attempted_status': request.draft_status,
                    'operator_name': operator_name,
                    'operator_role': operator.role,
                    'required_permission': 'draft:approve',
                    'reason': 'missing_permission',
                },
            )
        require_permission(operator, 'draft:approve')
    if request.draft_status in {'approved', 'changes_requested'}:
        reviewed_by_name = operator_name
    payload = ActionDraftResponse(
        event_id=event_id,
        title=request.title,
        body=request.body,
        audience=request.audience,
        recommended_brand=request.recommended_brand,
        why_it_matters=request.why_it_matters,
        signal_posture=request.signal_posture,
        model_name='operator-edited',
        used_fallback=False,
        context_notes=request.context_notes,
        metadata={
            'operator_name': operator_name,
            'assigned_reviewer_name': assigned_reviewer_name,
            'reviewed_by_name': reviewed_by_name,
        },
        draft_type=request.draft_type,
        draft_status=request.draft_status,
        edited_by_operator=True,
    )
    saved = await persist_action_draft(session, payload)
    await session.commit()
    record_audit(
        actor=operator_name,
        entity_type='draft_action',
        entity_id=saved.metadata.get('action_id', event_id),
        event_id=event_id,
        action='draft_updated',
        summary=f'Draft updated and marked {request.draft_status}.',
        metadata={
            'draft_type': request.draft_type,
            'draft_status': request.draft_status,
            'operator_name': operator_name,
            'assigned_reviewer_name': assigned_reviewer_name,
            'reviewed_by_name': reviewed_by_name,
        },
    )
    if previous_status != request.draft_status:
        transition_action = 'draft_status_changed'
        if request.draft_status == 'approved':
            transition_action = 'draft_approved'
        elif request.draft_status == 'awaiting_review':
            transition_action = 'draft_submitted_for_review'
        elif request.draft_status == 'changes_requested':
            transition_action = 'draft_changes_requested'
        elif request.draft_status == 'ready_to_send':
            transition_action = 'draft_ready_to_send'
        record_audit(
            actor=operator_name,
            entity_type='draft_action',
            entity_id=saved.metadata.get('action_id', event_id),
            event_id=event_id,
            action=transition_action,
            summary=f'Draft status changed from {previous_status or "none"} to {request.draft_status}.',
            metadata={
                'draft_type': request.draft_type,
                'previous_status': previous_status,
                'new_status': request.draft_status,
                'operator_name': operator_name,
                'operator_role': operator.role,
                'assigned_reviewer_name': assigned_reviewer_name,
                'reviewed_by_name': reviewed_by_name,
            },
        )
    if existing_metadata.get('assigned_reviewer_name') != assigned_reviewer_name and assigned_reviewer_name:
        record_audit(
            actor=operator_name,
            entity_type='draft_action',
            entity_id=saved.metadata.get('action_id', event_id),
            event_id=event_id,
            action='draft_reviewer_assigned',
            summary=f'Draft assigned to reviewer {assigned_reviewer_name}.',
            metadata={
                'draft_type': request.draft_type,
                'operator_name': operator_name,
                'assigned_reviewer_name': assigned_reviewer_name,
            },
        )
    return saved.model_dump()


@app.get('/audit', response_model=AuditListResponse)
async def get_audit(event_id: Optional[str] = Query(default=None), entity_type: Optional[str] = Query(default=None)) -> AuditListResponse:
    return list_audit(event_id=event_id, entity_type=entity_type)


@app.websocket('/ws')
async def feed_socket(websocket: WebSocket) -> None:
    await feed_manager.connect(websocket)
    try:
        await websocket.send_json({'type': 'feed.connected', 'status': 'ok'})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        feed_manager.disconnect(websocket)


@app.get('/properties', response_model=list[PropertyListItem])
async def list_properties(
    brand: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    sort: Optional[str] = Query(default='score_desc'),
    session: AsyncSession = Depends(get_db_session),
) -> list[PropertyListItem]:
    return await list_properties_repository(session, brand=brand, search=search, sort=sort)


@app.get('/properties/{property_id}', response_model=PropertyDetail)
async def get_property(
    property_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
) -> PropertyDetail:
    prop = await get_property_repository(session, str(property_id))
    if prop is None:
        raise HTTPException(status_code=404, detail='Property not found')
    return prop


@app.post('/properties', response_model=PropertyListItem)
async def create_property(
    req: PropertyCreateRequest,
    session: AsyncSession = Depends(get_db_session),
) -> PropertyListItem:
    existing_id = await check_property_duplicate(session, req.name, req.market)
    if existing_id:
        raise HTTPException(
            status_code=409,
            detail={'message': 'Property already exists', 'existing_id': existing_id},
        )
    return await create_property_repository(session, req)


@app.patch('/properties/{property_id}', response_model=PropertyDetail)
async def patch_property(
    property_id: uuid.UUID,
    req: PropertyUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
) -> PropertyDetail:
    updated = await update_property_repository(session, str(property_id), req)
    if updated is None:
        raise HTTPException(status_code=404, detail='Property not found')
    return updated


@app.delete('/properties/{property_id}', status_code=204)
async def delete_property(
    property_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    result = await delete_property_repository(session, property_id)
    if result == 'not_found':
        raise HTTPException(status_code=404, detail='Property not found')
    if result == 'auto':
        raise HTTPException(status_code=403, detail='Cannot delete auto-created property')


@app.get('/proposals')
async def list_proposals_route(
    status: Optional[str] = Query(default=None),
    agent_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    status_enum = ProposalStatus(status) if status else None
    proposals = await list_proposals_view(
        session, status=status_enum, agent_id=agent_id, limit=limit
    )
    return {'proposals': [p.model_dump() for p in proposals]}


@app.get('/proposals/{proposal_id}')
async def get_proposal_route(
    proposal_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    p = await get_proposal_repository(session, proposal_id)
    if p is None:
        raise HTTPException(status_code=404, detail='proposal not found')
    return p.model_dump()


@app.post('/proposals/{proposal_id}/approve')
async def approve_proposal_route(
    proposal_id: str,
    payload: dict | None = None,
    operator: OperatorSession = Depends(get_operator_session),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    note = (payload or {}).get('approver_note')
    try:
        approved = await approve_proposal_service(
            session,
            proposal_id=proposal_id,
            approver_id=operator.operator_id,
            source=ApprovalSource.UI,
            approver_note=note,
            executor=_executor_for_session(session),
        )
    except ProposalNotFoundError:
        raise HTTPException(status_code=404, detail='proposal not found')
    except ProposalAlreadyResolvedError as e:
        raise HTTPException(
            status_code=409,
            detail={'error': 'already_resolved', 'current_status': e.current_status.value},
        )
    return approved.model_dump()


@app.post('/proposals/{proposal_id}/reject')
async def reject_proposal_route(
    proposal_id: str,
    payload: dict,
    operator: OperatorSession = Depends(get_operator_session),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    reason = payload.get('reason')
    if not reason:
        raise HTTPException(status_code=400, detail='reason is required')
    try:
        rejected = await reject_proposal_service(
            session,
            proposal_id=proposal_id,
            approver_id=operator.operator_id,
            reason=reason,
        )
    except ProposalNotFoundError:
        raise HTTPException(status_code=404, detail='proposal not found')
    except ProposalAlreadyResolvedError as e:
        raise HTTPException(
            status_code=409,
            detail={'error': 'already_resolved', 'current_status': e.current_status.value},
        )
    return rejected.model_dump()
