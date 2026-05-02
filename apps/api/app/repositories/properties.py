from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.properties import (
    PropertyCreateRequest,
    PropertyDetail,
    PropertyListItem,
    PropertyUpdateRequest,
    SignalItem,
)

_VALID_BUILDING_TYPES = frozenset({
    'office', 'multifamily', 'retail', 'industrial',
    'data_center', 'mixed_use', 'hospitality', 'medical', 'other',
})

_SORT_CLAUSES = {
    'score_desc': 'max(e.confidence_score) DESC NULLS LAST, p.created_at DESC',
    'score_asc': 'max(e.confidence_score) ASC NULLS LAST, p.created_at DESC',
    'signal_count': 'count(e.id) DESC, p.created_at DESC',
    'market_asc': 'p.market ASC NULLS LAST, p.name ASC',
    'name_asc': 'p.name ASC',
}

_LIST_PROPERTIES_SQL_TEMPLATE = """
    SELECT
        p.id::text,
        p.name,
        p.market,
        p.building_type::text AS building_type,
        p.sqft,
        p.noi_cents,
        p.notes,
        p.source,
        coalesce(p.brands, '{{}}') AS brands,
        max(e.confidence_score) AS score,
        count(e.id)::int AS signal_count,
        p.created_at::text,
        p.updated_at::text
    FROM properties p
    LEFT JOIN events e ON e.property_id = p.id
    WHERE
        (cast(:brand AS text) IS NULL OR cast(:brand AS text) = ANY(p.brands))
        AND (cast(:search AS text) IS NULL OR lower(p.name) LIKE lower(cast(:search AS text)))
    GROUP BY p.id
    ORDER BY {order_by}
"""

GET_PROPERTY_SQL = text("""
    SELECT
        p.id::text,
        p.name,
        p.market,
        p.building_type::text AS building_type,
        p.sqft,
        p.noi_cents,
        p.notes,
        p.source,
        coalesce(p.brands, '{}') AS brands,
        p.created_at::text,
        p.updated_at::text
    FROM properties p
    WHERE p.id = cast(:property_id AS uuid)
    LIMIT 1
""")

GET_PROPERTY_SIGNALS_SQL = text("""
    SELECT
        e.id::text,
        e.title,
        e.confidence_score,
        e.primary_brand::text AS primary_brand,
        e.market,
        e.event_at::text AS event_at
    FROM events e
    WHERE e.property_id = cast(:property_id AS uuid)
    ORDER BY e.confidence_score DESC
    LIMIT 20
""")

INSERT_PROPERTY_SQL = text("""
    INSERT INTO properties (name, market, building_type, sqft, noi_cents, notes, source, brands)
    VALUES (
        :name,
        :market,
        cast(:building_type AS building_type_enum),
        :sqft,
        :noi_cents,
        :notes,
        'manual',
        cast(:brands AS text[])
    )
    RETURNING
        id::text,
        name,
        market,
        building_type::text AS building_type,
        sqft,
        noi_cents,
        notes,
        source,
        coalesce(brands, '{}') AS brands,
        created_at::text,
        updated_at::text
""")

CHECK_DUPLICATE_SQL = text("""
    SELECT id::text FROM properties
    WHERE lower(name) = lower(:name) AND market IS NOT DISTINCT FROM :market
    LIMIT 1
""")

CHECK_SOURCE_SQL = text("""
    SELECT source FROM properties WHERE id = cast(:property_id AS uuid) LIMIT 1
""")

DELETE_PROPERTY_SQL = text("""
    DELETE FROM properties
    WHERE id = cast(:property_id AS uuid) AND source = 'manual'
""")

_PATCHABLE = frozenset({'name', 'market', 'sqft', 'noi_cents', 'notes'})


async def list_properties(
    session: AsyncSession,
    *,
    brand: Optional[str] = None,
    search: Optional[str] = None,
    sort: Optional[str] = None,
) -> list[PropertyListItem]:
    brand_param = None if not brand or brand == 'all' else brand
    search_param = f'%{search}%' if search else None
    order_by = _SORT_CLAUSES.get(sort or 'score_desc', _SORT_CLAUSES['score_desc'])
    sql = text(_LIST_PROPERTIES_SQL_TEMPLATE.format(order_by=order_by))
    result = await session.execute(sql, {'brand': brand_param, 'search': search_param})
    return [PropertyListItem(**row) for row in result.mappings().all()]


async def get_property(session: AsyncSession, property_id: str) -> Optional[PropertyDetail]:
    result = await session.execute(GET_PROPERTY_SQL, {'property_id': property_id})
    row = result.mappings().first()
    if row is None:
        return None
    signals_result = await session.execute(
        GET_PROPERTY_SIGNALS_SQL, {'property_id': property_id}
    )
    signals = [SignalItem(**s) for s in signals_result.mappings().all()]
    return PropertyDetail(
        linked_signals=signals,
        score=max((s.confidence_score for s in signals), default=None),
        signal_count=len(signals),
        **row,
    )


async def check_duplicate(
    session: AsyncSession, name: str, market: Optional[str]
) -> Optional[str]:
    result = await session.execute(CHECK_DUPLICATE_SQL, {'name': name, 'market': market})
    row = result.mappings().first()
    return row['id'] if row else None


async def create_property(
    session: AsyncSession, req: PropertyCreateRequest
) -> PropertyListItem:
    building_type = req.building_type if req.building_type in _VALID_BUILDING_TYPES else 'other'
    result = await session.execute(
        INSERT_PROPERTY_SQL,
        {
            'name': req.name,
            'market': req.market,
            'building_type': building_type,
            'sqft': req.sqft,
            'noi_cents': req.noi_cents,
            'notes': req.notes,
            'brands': req.brands,
        },
    )
    row = result.mappings().first()
    await session.commit()
    return PropertyListItem(score=None, signal_count=0, **row)


async def update_property(
    session: AsyncSession, property_id: str, req: PropertyUpdateRequest
) -> Optional[PropertyDetail]:
    updates = req.model_dump(exclude_none=True)
    if not updates:
        return await get_property(session, property_id)

    set_parts: list[str] = []
    params: dict = {'property_id': property_id}

    for key, val in updates.items():
        if key == 'building_type':
            btype = val if val in _VALID_BUILDING_TYPES else 'other'
            set_parts.append('building_type = cast(:building_type AS building_type_enum)')
            params['building_type'] = btype
        elif key == 'brands':
            set_parts.append('brands = cast(:brands AS text[])')
            params['brands'] = val
        elif key in _PATCHABLE:
            set_parts.append(f'{key} = :{key}')
            params[key] = val

    if not set_parts:
        return await get_property(session, property_id)

    sql = text(
        f'UPDATE properties SET {", ".join(set_parts)}, updated_at = now() '
        f'WHERE id = cast(:property_id AS uuid) RETURNING id::text'
    )
    result = await session.execute(sql, params)
    if result.mappings().first() is None:
        return None
    await session.commit()
    return await get_property(session, property_id)


async def delete_property(
    session: AsyncSession, property_id: str
) -> str:
    """Returns 'not_found', 'auto', or 'deleted'."""
    source_result = await session.execute(CHECK_SOURCE_SQL, {'property_id': property_id})
    row = source_result.mappings().first()
    if row is None:
        return 'not_found'
    if row['source'] == 'auto':
        return 'auto'
    await session.execute(DELETE_PROPERTY_SQL, {'property_id': property_id})
    await session.commit()
    return 'deleted'
