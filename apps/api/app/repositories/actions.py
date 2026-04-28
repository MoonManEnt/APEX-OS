import json
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.actions import ActionDraftHistoryItem, ActionDraftHistoryResponse, ActionDraftResponse, ActionReviewQueueItem, ActionReviewQueueResponse


INSERT_ACTION_DRAFT_SQL = text(
    """
    insert into actions (
      event_id,
      primary_brand,
      kind,
      status,
      subject,
      body,
      metadata
    ) values (
      cast(:event_id as uuid),
      cast(:primary_brand as brand_enum),
      'draft_action',
      :status,
      :subject,
      :body,
      cast(:metadata as jsonb)
    )
    returning id::text as id
    """
)

UPDATE_ACTION_DRAFT_SQL = text(
    """
    update actions
    set primary_brand = cast(:primary_brand as brand_enum),
        status = :status,
        subject = :subject,
        body = :body,
        metadata = cast(:metadata as jsonb),
        updated_at = now()
    where id = cast(:action_id as uuid)
    returning id::text as id
    """
)

SELECT_ACTION_DRAFT_SQL = text(
    """
    select
      id::text as id,
      event_id::text as event_id,
      subject,
      body,
      metadata,
      primary_brand::text as primary_brand,
      status,
      updated_at::text as updated_at
    from actions
    where event_id = cast(:event_id as uuid)
      and kind = 'draft_action'
      and (cast(:draft_type as text) is null or metadata->>'draft_type' = cast(:draft_type as text))
    order by updated_at desc, created_at desc
    limit 1
    """
)

SELECT_ACTION_DRAFT_HISTORY_SQL = text(
    """
    select
      id::text as id,
      event_id::text as event_id,
      subject,
      body,
      metadata,
      status,
      updated_at::text as updated_at
    from actions
    where event_id = cast(:event_id as uuid)
      and kind = 'draft_action'
    order by updated_at desc, created_at desc
    limit 10
    """
)

SELECT_ACTION_REVIEW_QUEUE_SQL = text(
    """
    with ranked_actions as (
      select
        id::text as id,
        event_id::text as event_id,
        subject,
        metadata,
        primary_brand::text as primary_brand,
        status,
        updated_at::text as updated_at,
        row_number() over (
          partition by event_id, coalesce(metadata->>'draft_type', 'primary_outreach')
          order by updated_at desc, created_at desc
        ) as version_rank
      from actions
      where kind = 'draft_action'
    )
    select
      id,
      event_id,
      subject,
      metadata,
      primary_brand,
      status,
      updated_at
    from ranked_actions
    where version_rank = 1
      and status in ('awaiting_review', 'changes_requested', 'approved')
    order by updated_at desc
    limit 25
    """
)


def _to_response(row) -> ActionDraftResponse:
    metadata = row['metadata'] or {}
    return ActionDraftResponse(
        event_id=row['event_id'],
        title=row['subject'],
        body=row['body'],
        audience=metadata.get('audience', 'Unknown audience'),
        recommended_brand=row.get('primary_brand') or 'clean_scapes',
        why_it_matters=metadata.get('why_it_matters', ''),
        signal_posture=metadata.get('signal_posture', ''),
        model_name=metadata.get('model_name', 'stored-draft'),
        used_fallback=metadata.get('used_fallback', True),
        context_notes=metadata.get('context_notes', []),
        metadata={
            'action_id': row['id'],
            'operator_name': metadata.get('operator_name'),
            'assigned_reviewer_name': metadata.get('assigned_reviewer_name'),
            'reviewed_by_name': metadata.get('reviewed_by_name'),
        },
        updated_at=row.get('updated_at'),
        draft_type=metadata.get('draft_type', 'primary_outreach'),
        draft_status=row.get('status') or metadata.get('draft_status', 'generated'),
        edited_by_operator=metadata.get('edited_by_operator', False),
    )


async def persist_action_draft(session: AsyncSession, draft: ActionDraftResponse) -> ActionDraftResponse:
    existing = await get_action_draft(session, draft.event_id, draft_type=draft.draft_type)
    extra_metadata = draft.metadata or {}
    metadata = json.dumps(
        {
            'audience': draft.audience,
            'why_it_matters': draft.why_it_matters,
            'signal_posture': draft.signal_posture,
            'model_name': draft.model_name,
            'used_fallback': draft.used_fallback,
            'context_notes': draft.context_notes,
            'draft_type': draft.draft_type,
            'draft_status': draft.draft_status,
            'edited_by_operator': draft.edited_by_operator,
            'operator_name': extra_metadata.get('operator_name'),
            'assigned_reviewer_name': extra_metadata.get('assigned_reviewer_name'),
            'reviewed_by_name': extra_metadata.get('reviewed_by_name'),
            'previous_action_id': existing.metadata.get('action_id') if existing and existing.metadata else None,
        }
    )

    if existing and existing.metadata.get('action_id') and not draft.edited_by_operator:
        result = await session.execute(
            UPDATE_ACTION_DRAFT_SQL,
            {
                'action_id': existing.metadata['action_id'],
                'primary_brand': draft.recommended_brand or 'clean_scapes',
                'status': draft.draft_status,
                'subject': draft.title,
                'body': draft.body,
                'metadata': metadata,
            },
        )
        action_id = result.scalar_one()
    else:
        result = await session.execute(
            INSERT_ACTION_DRAFT_SQL,
            {
                'event_id': draft.event_id,
                'primary_brand': draft.recommended_brand or 'clean_scapes',
                'status': draft.draft_status,
                'subject': draft.title,
                'body': draft.body,
                'metadata': metadata,
            },
        )
        action_id = result.scalar_one()

    saved = ActionDraftResponse(**draft.model_dump())
    saved.metadata = {
        'action_id': action_id,
        'operator_name': extra_metadata.get('operator_name'),
        'assigned_reviewer_name': extra_metadata.get('assigned_reviewer_name'),
        'reviewed_by_name': extra_metadata.get('reviewed_by_name'),
    }
    return saved


async def get_action_draft(session: AsyncSession, event_id: str, draft_type: Optional[str] = None) -> Optional[ActionDraftResponse]:
    result = await session.execute(SELECT_ACTION_DRAFT_SQL, {'event_id': event_id, 'draft_type': draft_type})
    row = result.mappings().first()
    if row is None:
        return None
    return _to_response(row)


async def get_action_draft_history(session: AsyncSession, event_id: str) -> ActionDraftHistoryResponse:
    result = await session.execute(SELECT_ACTION_DRAFT_HISTORY_SQL, {'event_id': event_id})
    rows = result.mappings().all()
    items = []
    for row in rows:
      metadata = row['metadata'] or {}
      items.append(
          ActionDraftHistoryItem(
              action_id=row['id'],
              title=row['subject'],
              body=row['body'],
              model_name=metadata.get('model_name', 'stored-draft'),
              used_fallback=metadata.get('used_fallback', True),
              updated_at=row.get('updated_at'),
              draft_type=metadata.get('draft_type', 'primary_outreach'),
              draft_status=row.get('status') or metadata.get('draft_status', 'generated'),
              edited_by_operator=metadata.get('edited_by_operator', False),
          )
      )
    return ActionDraftHistoryResponse(event_id=event_id, items=items)


async def get_action_review_queue(session: AsyncSession) -> ActionReviewQueueResponse:
    result = await session.execute(SELECT_ACTION_REVIEW_QUEUE_SQL)
    rows = result.mappings().all()
    items = []
    for row in rows:
        metadata = row['metadata'] or {}
        items.append(
            ActionReviewQueueItem(
                action_id=row['id'],
                event_id=row['event_id'],
                title=row['subject'],
                recommended_brand=row.get('primary_brand') or 'clean_scapes',
                draft_type=metadata.get('draft_type', 'primary_outreach'),
                draft_status=row.get('status') or metadata.get('draft_status', 'generated'),
                updated_at=row.get('updated_at'),
                operator_name=metadata.get('operator_name'),
                assigned_reviewer_name=metadata.get('assigned_reviewer_name'),
                reviewed_by_name=metadata.get('reviewed_by_name'),
            )
        )
    return ActionReviewQueueResponse(items=items)
