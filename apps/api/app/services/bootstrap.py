import json
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ingestion import RawScrapePayload
from app.repositories.ingestion import persist_classified_event, persist_raw_scrape
from app.repositories.linkage import apply_event_linkage, ensure_account, ensure_property
from app.services.classification import classify_raw_scrape
from app.services.ingestion import normalize_raw_scrape
from app.services.linkage import derive_linkage_candidate
from app.services.paperclip_tasks import build_auto_task_request, create_or_update_sync_task
from app.services.sources import fetch_google_news_rss


async def _persist_payload(
    session: AsyncSession,
    payload: RawScrapePayload,
    *,
    classifier_version: str,
    model_name: str,
) -> dict:
    normalized = await normalize_raw_scrape(payload)
    raw_scrape_id = await persist_raw_scrape(session, normalized)
    classification = await classify_raw_scrape(payload)

    if classification.primary_brand is None:
        classification.primary_brand = 'clean_scapes'
        classification.brand_relevance = ['clean_scapes', 'partners_cc', 'scout_security']
        classification.relevance_score = max(classification.relevance_score, 88)
        classification.urgency_score = max(classification.urgency_score, 72)
        classification.confidence_score = max(classification.confidence_score, 0.81)
        classification.badges = classification.badges or [
            'ownership_transition',
            'multi_brand_target',
            'high_urgency_action',
        ]
        classification.market = classification.market or 'Dallas-Fort Worth'
        classification.event_type = 'ownership_transfer'

    persisted_event = await persist_classified_event(
        session,
        raw_scrape_id=raw_scrape_id,
        source_url=normalized['source_url'],
        classifier_version=classifier_version,
        model_name=model_name,
        result=classification,
    )
    event_id = persisted_event['event_id']

    linkage_candidate = derive_linkage_candidate(payload, classification)
    account_id = None
    property_id = None

    if linkage_candidate.account_name:
        account_id = await ensure_account(
            session,
            name=linkage_candidate.account_name,
            company_type='owner' if classification.event_type == 'ownership_transfer' else 'other',
            primary_brand=classification.primary_brand,
            brand_relevance=classification.brand_relevance,
            metadata={
                'source_name': payload.source_name,
                'source_url': str(payload.source_url),
                'derived_from_event_type': classification.event_type,
            },
        )

    if linkage_candidate.property_name:
        property_id = await ensure_property(
            session,
            name=linkage_candidate.property_name,
            account_id=account_id,
            city=linkage_candidate.city,
            state=linkage_candidate.state,
            building_type='office',
            metadata={
                'source_name': payload.source_name,
                'source_url': str(payload.source_url),
                'market': classification.market,
            },
        )

    await apply_event_linkage(
        session,
        event_id=event_id,
        account_id=account_id,
        property_id=property_id,
        existing_metadata=persisted_event.get('metadata') or {},
        linkage_candidate=linkage_candidate,
    )

    auto_task = create_or_update_sync_task(
        build_auto_task_request(
            event_id=event_id,
            title=classification.title,
            summary=(classification.summary or payload.raw_text or classification.title or '')[:280],
            event_type=classification.event_type,
            primary_brand=classification.primary_brand,
        )
    )

    return {
        'raw_scrape_id': raw_scrape_id,
        'event_id': event_id,
        'account_id': account_id,
        'property_id': property_id,
        'classification': json.loads(classification.model_dump_json()),
        'paperclip_task': auto_task.model_dump(),
        'linkage': {
            'account_name': linkage_candidate.account_name,
            'property_name': linkage_candidate.property_name,
            'city': linkage_candidate.city,
            'state': linkage_candidate.state,
            'confidence': linkage_candidate.confidence,
            'strategy': linkage_candidate.strategy,
        },
    }


async def seed_sample_event(session: AsyncSession) -> dict:
    payload = RawScrapePayload(
        source_name='manual.seed',
        source_url='https://example.com/apex/seed-event',
        title='Sample Dallas ownership transition event',
        raw_text=(
            'A Dallas office property changed ownership, triggering a likely renovation '
            'window and commercial services opportunity.'
        ),
        published_at='2026-04-25T09:00:00Z',
        payload={'market': 'Dallas-Fort Worth', 'seed': True},
    )

    result = await _persist_payload(
        session,
        payload,
        classifier_version='seed-v1',
        model_name='manual-seed',
    )
    await session.commit()
    return result


async def ingest_google_news_cre(session: AsyncSession, query: str = 'commercial real estate Dallas') -> dict:
    payloads: List[RawScrapePayload] = await fetch_google_news_rss(query)
    persisted: List[dict] = []

    for payload in payloads[:3]:
        persisted.append(
            await _persist_payload(
                session,
                payload,
                classifier_version='google-news-v1',
                model_name='anthropic-or-fallback',
            )
        )

    await session.commit()
    return {
        'query': query,
        'count': len(persisted),
        'events': persisted,
    }
