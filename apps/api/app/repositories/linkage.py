import json
import re
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.linkage import LinkageCandidate


SLUG_NON_ALNUM_RE = re.compile(r'[^a-z0-9]+')


SELECT_ACCOUNT_SQL = text(
    """
    select id::text as id
    from accounts
    where slug = :slug
    limit 1
    """
)

INSERT_ACCOUNT_SQL = text(
    """
    insert into accounts (
      name,
      slug,
      company_type,
      primary_brand,
      brand_relevance,
      metadata
    ) values (
      :name,
      :slug,
      cast(:company_type as company_type_enum),
      cast(:primary_brand as brand_enum),
      :brand_relevance,
      cast(:metadata as jsonb)
    )
    returning id::text as id
    """
)

SELECT_PROPERTY_SQL = text(
    """
    select id::text as id
    from properties
    where lower(coalesce(name, '')) = lower(coalesce(:name, ''))
      and lower(coalesce(city, '')) = lower(coalesce(:city, ''))
      and lower(coalesce(state, '')) = lower(coalesce(:state, ''))
    limit 1
    """
)

INSERT_PROPERTY_SQL = text(
    """
    insert into properties (
      name,
      account_id,
      building_type,
      city,
      state,
      metadata
    ) values (
      :name,
      cast(:account_id as uuid),
      cast(:building_type as building_type_enum),
      :city,
      :state,
      cast(:metadata as jsonb)
    )
    returning id::text as id
    """
)

UPDATE_PROPERTY_ACCOUNT_SQL = text(
    """
    update properties
    set account_id = cast(:account_id as uuid),
        updated_at = now()
    where id = cast(:property_id as uuid)
      and account_id is null
    """
)

UPDATE_EVENT_LINKAGE_SQL = text(
    """
    update events
    set account_id = cast(:account_id as uuid),
        property_id = cast(:property_id as uuid),
        metadata = cast(:metadata as jsonb),
        updated_at = now()
    where id = cast(:event_id as uuid)
    """
)


def slugify(value: str) -> str:
    slug = SLUG_NON_ALNUM_RE.sub('-', value.strip().lower()).strip('-')
    return slug or 'unnamed-account'


async def ensure_account(
    session: AsyncSession,
    *,
    name: str,
    company_type: str,
    primary_brand: Optional[str],
    brand_relevance: list[str],
    metadata: dict,
) -> str:
    slug = slugify(name)
    existing = await session.execute(SELECT_ACCOUNT_SQL, {'slug': slug})
    existing_id = existing.scalar_one_or_none()
    if existing_id:
        return existing_id

    result = await session.execute(
        INSERT_ACCOUNT_SQL,
        {
            'name': name,
            'slug': slug,
            'company_type': company_type,
            'primary_brand': primary_brand,
            'brand_relevance': brand_relevance,
            'metadata': json.dumps(metadata),
        },
    )
    return result.scalar_one()


async def ensure_property(
    session: AsyncSession,
    *,
    name: str,
    account_id: Optional[str],
    city: Optional[str],
    state: Optional[str],
    building_type: str,
    metadata: dict,
) -> str:
    existing = await session.execute(
        SELECT_PROPERTY_SQL,
        {
            'name': name,
            'city': city,
            'state': state,
        },
    )
    existing_id = existing.scalar_one_or_none()
    if existing_id:
        if account_id:
            await session.execute(
                UPDATE_PROPERTY_ACCOUNT_SQL,
                {
                    'property_id': existing_id,
                    'account_id': account_id,
                },
            )
        return existing_id

    result = await session.execute(
        INSERT_PROPERTY_SQL,
        {
            'name': name,
            'account_id': account_id,
            'building_type': building_type,
            'city': city,
            'state': state,
            'metadata': json.dumps(metadata),
        },
    )
    return result.scalar_one()


async def apply_event_linkage(
    session: AsyncSession,
    *,
    event_id: str,
    account_id: Optional[str],
    property_id: Optional[str],
    existing_metadata: dict,
    linkage_candidate: LinkageCandidate,
) -> None:
    merged_metadata = {
        **(existing_metadata or {}),
        'linked_account_name': linkage_candidate.account_name,
        'linked_property_name': linkage_candidate.property_name,
        'linked_city': linkage_candidate.city,
        'linked_state': linkage_candidate.state,
        'linkage_confidence': linkage_candidate.confidence,
        'linkage_strategy': linkage_candidate.strategy,
        'linkage_status': 'resolved' if account_id and property_id else 'partial' if account_id or property_id else 'unresolved',
    }
    await session.execute(
        UPDATE_EVENT_LINKAGE_SQL,
        {
            'event_id': event_id,
            'account_id': account_id,
            'property_id': property_id,
            'metadata': json.dumps(merged_metadata),
        },
    )
