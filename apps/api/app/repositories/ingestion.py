import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ingestion import ClassificationResult


INSERT_RAW_SCRAPE_SQL = text(
    """
    insert into raw_scrapes (
      source_name,
      source_url,
      source_hash,
      published_at,
      title,
      raw_text,
      payload,
      parse_status
    ) values (
      :source_name,
      :source_url,
      :source_hash,
      cast(:published_at as timestamptz),
      :title,
      :raw_text,
      cast(:payload as jsonb),
      'normalized'
    )
    on conflict (source_hash) do update
      set raw_text = excluded.raw_text,
          payload = excluded.payload,
          title = excluded.title,
          published_at = excluded.published_at
    returning id::text as id
    """
)

SELECT_EVENT_BY_RAW_SCRAPE_SQL = text(
    """
    select id::text as id, metadata
    from events
    where raw_scrape_id = cast(:raw_scrape_id as uuid)
    limit 1
    """
)

INSERT_EVENT_SQL = text(
    """
    insert into events (
      raw_scrape_id,
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
      metadata
    ) values (
      cast(:raw_scrape_id as uuid),
      :title,
      :summary,
      cast(:event_type as event_type_enum),
      :market,
      :urgency_score,
      :relevance_score,
      :confidence_score,
      cast(:primary_brand as brand_enum),
      :brand_relevance,
      :badges,
      :source_url,
      cast(:metadata as jsonb)
    )
    returning id::text as id, metadata
    """
)

UPDATE_EVENT_SQL = text(
    """
    update events
    set title = :title,
        summary = :summary,
        event_type = cast(:event_type as event_type_enum),
        market = :market,
        urgency_score = :urgency_score,
        relevance_score = :relevance_score,
        confidence_score = :confidence_score,
        primary_brand = cast(:primary_brand as brand_enum),
        brand_relevance = :brand_relevance,
        badges = :badges,
        source_url = :source_url,
        metadata = cast(:metadata as jsonb),
        updated_at = now()
    where id = cast(:event_id as uuid)
    returning id::text as id, metadata
    """
)

INSERT_EVENT_CLASSIFICATION_SQL = text(
    """
    insert into event_classifications (
      event_id,
      classifier_version,
      model_name,
      rationale,
      extracted_entities
    ) values (
      cast(:event_id as uuid),
      :classifier_version,
      :model_name,
      :rationale,
      cast(:extracted_entities as jsonb)
    )
    returning id::text as id
    """
)


async def persist_raw_scrape(session: AsyncSession, normalized_payload: dict) -> str:
    result = await session.execute(
        INSERT_RAW_SCRAPE_SQL,
        {
            **normalized_payload,
            'payload': json.dumps(normalized_payload['payload']),
        },
    )
    return result.scalar_one()


async def persist_classified_event(
    session: AsyncSession,
    *,
    raw_scrape_id: str,
    source_url: str,
    classifier_version: str,
    model_name: str,
    result: ClassificationResult,
) -> dict:
    existing_result = await session.execute(
        SELECT_EVENT_BY_RAW_SCRAPE_SQL,
        {'raw_scrape_id': raw_scrape_id},
    )
    existing_row = existing_result.mappings().first()
    metadata = (existing_row.get('metadata') if existing_row else None) or {}
    merged_metadata = {
        **metadata,
        'linkage_status': metadata.get('linkage_status', 'pending'),
        'dedupe_key': raw_scrape_id,
        'last_classifier_version': classifier_version,
        'canonical_source_url': source_url,
    }

    event_payload = {
        'title': result.title,
        'summary': result.summary,
        'event_type': result.event_type,
        'market': result.market,
        'urgency_score': result.urgency_score,
        'relevance_score': result.relevance_score,
        'confidence_score': result.confidence_score,
        'primary_brand': result.primary_brand,
        'brand_relevance': result.brand_relevance,
        'badges': result.badges,
        'source_url': source_url,
        'metadata': json.dumps(merged_metadata),
    }

    if existing_row:
        event_result = await session.execute(
            UPDATE_EVENT_SQL,
            {
                'event_id': existing_row['id'],
                **event_payload,
            },
        )
    else:
        event_result = await session.execute(
            INSERT_EVENT_SQL,
            {
                'raw_scrape_id': raw_scrape_id,
                **event_payload,
            },
        )

    event_row = event_result.mappings().one()
    event_id = event_row['id']

    await session.execute(
        INSERT_EVENT_CLASSIFICATION_SQL,
        {
            'event_id': event_id,
            'classifier_version': classifier_version,
            'model_name': model_name,
            'rationale': result.rationale,
            'extracted_entities': json.dumps(result.extracted_entities),
        },
    )
    return {'event_id': event_id, 'metadata': event_row.get('metadata') or {}, 'existing': bool(existing_row)}
