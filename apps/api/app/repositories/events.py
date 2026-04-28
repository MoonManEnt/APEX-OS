from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.events import EventDetail, EventListItem


LIST_EVENTS_SQL = text(
    """
    with latest_actions as (
      select distinct on (event_id)
        event_id,
        metadata->>'draft_type' as latest_draft_type,
        status as latest_draft_status,
        updated_at::text as latest_draft_updated_at
      from actions
      where kind = 'draft_action'
      order by event_id, updated_at desc, created_at desc
    ),
    ranked as (
      select
        e.id::text,
        e.title,
        e.summary,
        e.event_type::text as event_type,
        e.market,
        e.urgency_score,
        e.relevance_score,
        e.confidence_score,
        e.primary_brand::text as primary_brand,
        coalesce(e.brand_relevance::text[], '{}') as brand_relevance,
        coalesce(e.badges, '{}') as badges,
        e.source_url,
        e.event_at::text as event_at,
        la.latest_draft_type,
        la.latest_draft_status,
        la.latest_draft_updated_at,
        row_number() over (
          partition by lower(e.title), coalesce(e.source_url, '')
          order by e.created_at desc
        ) as dedupe_rank,
        e.created_at
      from events e
      left join latest_actions la on la.event_id = e.id
    )
    select
      id,
      title,
      summary,
      event_type,
      market,
      urgency_score,
      relevance_score,
      confidence_score,
      primary_brand,
      brand_relevance,
      badges,
      source_url,
      event_at,
      latest_draft_type,
      latest_draft_status,
      latest_draft_updated_at
    from ranked
    where dedupe_rank = 1
      and (cast(:brand as text) is null or primary_brand::text = cast(:brand as text) or cast(:brand as text) = any(cast(brand_relevance as text[])))
      and (cast(:market as text) is null or market = cast(:market as text))
      and (cast(:event_type as text) is null or event_type::text = cast(:event_type as text))
      and (cast(:min_score as integer) is null or relevance_score >= cast(:min_score as integer))
    order by created_at desc
    limit 100
    """
)

GET_EVENT_SQL = text(
    """
    select
      e.id::text,
      e.raw_scrape_id::text as raw_scrape_id,
      e.property_id::text as property_id,
      p.name as property_name,
      e.account_id::text as account_id,
      a.name as account_name,
      e.title,
      e.summary,
      e.event_type::text as event_type,
      e.market,
      e.urgency_score,
      e.relevance_score,
      e.confidence_score,
      e.primary_brand::text as primary_brand,
      coalesce(e.brand_relevance::text[], '{}') as brand_relevance,
      coalesce(e.badges, '{}') as badges,
      e.source_url,
      e.event_at::text as event_at,
      e.metadata
    from events e
    left join properties p on p.id = e.property_id
    left join accounts a on a.id = e.account_id
    where e.id = cast(:event_id as uuid)
    limit 1
    """
)


async def list_events(
    session: AsyncSession,
    *,
    brand: Optional[str] = None,
    market: Optional[str] = None,
    event_type: Optional[str] = None,
    min_score: Optional[int] = None,
) -> list[EventListItem]:
    result = await session.execute(
        LIST_EVENTS_SQL,
        {
            'brand': brand,
            'market': market,
            'event_type': event_type,
            'min_score': min_score,
        },
    )
    rows = result.mappings().all()
    return [EventListItem(**row) for row in rows]


async def get_event(session: AsyncSession, event_id: str) -> Optional[EventDetail]:
    result = await session.execute(GET_EVENT_SQL, {'event_id': event_id})
    row = result.mappings().first()
    if row is None:
        return None
    return EventDetail(**row)
