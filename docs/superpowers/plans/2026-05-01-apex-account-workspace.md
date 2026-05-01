# APEX Account Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone property browser (Account Workspace) with a 3-zone layout — wide account list on the left, enrichment form + signals panel stacked on the right — backed by the existing `properties` Postgres table extended with new fields.

**Architecture:** The backend extends the `properties` table via a migration SQL file, adds 4 REST endpoints to FastAPI, and follows the existing raw-SQL + Pydantic pattern throughout. The frontend replaces the stub `case 'account':` block in `page.tsx` with a new `AccountWorkspace` server component; inline field saves use Server Actions; the Add Account form is a focused `'use client'` component.

**Tech Stack:** FastAPI + asyncpg + SQLAlchemy async text queries; Next.js 15 App Router server components + Server Actions + `'use client'` for the add form; pytest + pytest-asyncio + httpx for backend tests.

---

## File Map

| Action | File |
|--------|------|
| CREATE | `apps/api/db/schema/accounts_workspace_migration.sql` |
| MODIFY | `apps/api/app/init_db.py` |
| CREATE | `apps/api/app/models/properties.py` |
| CREATE | `apps/api/app/repositories/properties.py` |
| MODIFY | `apps/api/app/main.py` |
| CREATE | `apps/api/tests/__init__.py` |
| CREATE | `apps/api/tests/test_properties.py` |
| CREATE | `apps/web/app/account-workspace.tsx` |
| CREATE | `apps/web/app/account-add-form.tsx` |
| MODIFY | `apps/web/app/page.tsx` |

---

### Task 1: DB Migration — ALTER TABLE properties

**Files:**
- Create: `apps/api/db/schema/accounts_workspace_migration.sql`
- Modify: `apps/api/app/init_db.py`

- [ ] **Step 1: Write the migration SQL**

Create `apps/api/db/schema/accounts_workspace_migration.sql`:

```sql
-- Account Workspace: add fields to properties for operator enrichment
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS market TEXT,
  ADD COLUMN IF NOT EXISTS sqft INTEGER,
  ADD COLUMN IF NOT EXISTS noi_cents INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS brands TEXT[] NOT NULL DEFAULT '{}';
```

- [ ] **Step 2: Update init_db.py to run the migration**

Replace the full contents of `apps/api/app/init_db.py` with:

```python
import asyncio
from pathlib import Path

from sqlalchemy import text

from app.core.db import engine


SCHEMA_PATH = Path(__file__).resolve().parents[1] / 'db' / 'schema' / 'phase1_schema.sql'
SEED_PATH = Path(__file__).resolve().parents[1] / 'db' / 'seeds' / 'brands.sql'
MIGRATION_PATH = Path(__file__).resolve().parents[1] / 'db' / 'schema' / 'accounts_workspace_migration.sql'


async def _schema_exists(conn) -> bool:
    result = await conn.execute(
        text("SELECT 1 FROM pg_type WHERE typname = 'brand_enum' LIMIT 1")
    )
    return result.scalar() is not None


async def _migration_applied(conn) -> bool:
    result = await conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'properties' AND column_name = 'source' LIMIT 1"
        )
    )
    return result.scalar() is not None


async def init_db() -> None:
    schema_sql = SCHEMA_PATH.read_text()
    seed_sql = SEED_PATH.read_text()
    migration_sql = MIGRATION_PATH.read_text()

    async with engine.begin() as conn:
        if not await _schema_exists(conn):
            for statement in [s.strip() for s in schema_sql.split(';') if s.strip()]:
                await conn.execute(text(statement))
            for statement in [s.strip() for s in seed_sql.split(';') if s.strip()]:
                await conn.execute(text(statement))

        if not await _migration_applied(conn):
            for statement in [s.strip() for s in migration_sql.split(';') if s.strip()]:
                await conn.execute(text(statement))


if __name__ == '__main__':
    asyncio.run(init_db())
```

- [ ] **Step 3: Run the migration against the local dev DB**

```bash
cd /Users/reginaldsmith/APEX-OS/apps/api
source .venv/bin/activate
python -m app.init_db
```

Expected: No errors. If the schema already exists, the migration block runs; if the migration was already applied, nothing happens.

- [ ] **Step 4: Verify the columns exist**

```bash
DOCKER_HOST="unix://$HOME/.docker/run/docker.sock" /Applications/Docker.app/Contents/Resources/bin/docker exec apex-postgres psql -U apex -d apex -c "\d properties"
```

Expected: Output includes `market`, `sqft`, `noi_cents`, `notes`, `source`, `brands` columns.

- [ ] **Step 5: Commit**

```bash
git add apps/api/db/schema/accounts_workspace_migration.sql apps/api/app/init_db.py
git commit -m "feat: add account workspace fields to properties table"
```

---

### Task 2: Pydantic Models for Properties

**Files:**
- Create: `apps/api/app/models/properties.py`

- [ ] **Step 1: Write the models**

Create `apps/api/app/models/properties.py`:

```python
from typing import Optional

from pydantic import BaseModel, Field


class SignalItem(BaseModel):
    id: str
    title: str
    confidence_score: float = 0.0
    primary_brand: Optional[str] = None
    market: Optional[str] = None
    event_at: Optional[str] = None


class PropertyListItem(BaseModel):
    id: str
    name: Optional[str] = None
    market: Optional[str] = None
    building_type: str = 'other'
    sqft: Optional[int] = None
    noi_cents: Optional[int] = None
    notes: Optional[str] = None
    source: str = 'auto'
    brands: list[str] = Field(default_factory=list)
    score: Optional[float] = None
    signal_count: int = 0
    created_at: str
    updated_at: str


class PropertyDetail(PropertyListItem):
    linked_signals: list[SignalItem] = Field(default_factory=list)


class PropertyCreateRequest(BaseModel):
    name: str
    market: Optional[str] = None
    building_type: str = 'other'
    sqft: Optional[int] = None
    noi_cents: Optional[int] = None
    notes: Optional[str] = None
    brands: list[str] = Field(default_factory=list)


class PropertyUpdateRequest(BaseModel):
    name: Optional[str] = None
    market: Optional[str] = None
    building_type: Optional[str] = None
    sqft: Optional[int] = None
    noi_cents: Optional[int] = None
    notes: Optional[str] = None
    brands: Optional[list[str]] = None
```

- [ ] **Step 2: Verify it imports cleanly**

```bash
cd /Users/reginaldsmith/APEX-OS/apps/api
source .venv/bin/activate
python -c "from app.models.properties import PropertyListItem, PropertyDetail, PropertyCreateRequest, PropertyUpdateRequest; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/models/properties.py
git commit -m "feat: pydantic models for account workspace properties"
```

---

### Task 3: Properties Repository

**Files:**
- Create: `apps/api/app/repositories/properties.py`

- [ ] **Step 1: Write the failing test first**

Create `apps/api/tests/__init__.py` (empty):

```python
```

Create `apps/api/tests/test_properties.py`:

```python
import pytest
import httpx
from app.main import app


@pytest.mark.asyncio
async def test_list_properties_returns_list():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        resp = await client.get('/properties')
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_create_and_retrieve_property():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        create_resp = await client.post('/properties', json={
            'name': 'Test Property Plan',
            'market': 'Dallas',
            'building_type': 'office',
            'sqft': 10000,
            'noi_cents': 5000000,
            'notes': 'plan test',
            'brands': ['scout_security'],
        })
        assert create_resp.status_code == 200
        created = create_resp.json()
        assert created['id']
        assert created['source'] == 'manual'

        list_resp = await client.get('/properties')
        ids = [p['id'] for p in list_resp.json()]
        assert created['id'] in ids

        # cleanup
        del_resp = await client.delete(f'/properties/{created["id"]}')
        assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_patch_property():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        create_resp = await client.post('/properties', json={'name': 'Patch Test Plan'})
        prop_id = create_resp.json()['id']

        patch_resp = await client.patch(f'/properties/{prop_id}', json={'notes': 'updated note'})
        assert patch_resp.status_code == 200
        assert patch_resp.json()['notes'] == 'updated note'

        # cleanup
        await client.delete(f'/properties/{prop_id}')


@pytest.mark.asyncio
async def test_delete_auto_property_is_forbidden():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        # Create a property and manually set source='auto' via direct SQL is not possible here,
        # so test with a non-existent ID returns 404
        resp = await client.delete('/properties/00000000-0000-0000-0000-000000000000')
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_duplicate_property_returns_409():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        payload = {'name': 'Dupe Test Plan', 'market': 'Austin'}
        first = await client.post('/properties', json=payload)
        assert first.status_code == 200
        prop_id = first.json()['id']

        second = await client.post('/properties', json=payload)
        assert second.status_code == 409
        assert 'existing_id' in second.json()

        # cleanup
        await client.delete(f'/properties/{prop_id}')
```

- [ ] **Step 2: Run tests — expect all to fail (endpoints don't exist yet)**

```bash
cd /Users/reginaldsmith/APEX-OS/apps/api
source .venv/bin/activate
python -m pytest tests/test_properties.py -v 2>&1 | head -40
```

Expected: All 5 tests FAIL with `404 Not Found` or similar (endpoints don't exist).

- [ ] **Step 3: Write the repository**

Create `apps/api/app/repositories/properties.py`:

```python
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

LIST_PROPERTIES_SQL = text("""
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
    ORDER BY
        max(e.confidence_score) DESC NULLS LAST,
        p.created_at DESC
""")

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
) -> list[PropertyListItem]:
    brand_param = None if not brand or brand == 'all' else brand
    search_param = f'%{search}%' if search else None
    result = await session.execute(
        LIST_PROPERTIES_SQL, {'brand': brand_param, 'search': search_param}
    )
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
    await session.commit()
    row = result.mappings().first()
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
```

- [ ] **Step 4: Commit repository (tests still fail — endpoints not wired)**

```bash
git add apps/api/app/repositories/properties.py apps/api/app/models/properties.py apps/api/tests/__init__.py apps/api/tests/test_properties.py
git commit -m "feat: properties repository and models for account workspace"
```

---

### Task 4: API Endpoints

**Files:**
- Modify: `apps/api/app/main.py`

- [ ] **Step 1: Add imports to main.py**

Open `apps/api/app/main.py`. After the existing `from app.repositories.events import ...` block (around line 32), add:

```python
from app.models.properties import PropertyCreateRequest, PropertyDetail, PropertyListItem, PropertyUpdateRequest
from app.repositories.properties import (
    check_duplicate as check_property_duplicate,
    create_property as create_property_repository,
    delete_property as delete_property_repository,
    get_property as get_property_repository,
    list_properties as list_properties_repository,
    update_property as update_property_repository,
)
```

- [ ] **Step 2: Add the 4 endpoints to main.py**

Add these 4 route functions at the bottom of `apps/api/app/main.py`, just before the end of the file:

```python
@app.get('/properties', response_model=list[PropertyListItem])
async def list_properties(
    brand: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
) -> list[PropertyListItem]:
    return await list_properties_repository(session, brand=brand, search=search)


@app.get('/properties/{property_id}', response_model=PropertyDetail)
async def get_property(
    property_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> PropertyDetail:
    prop = await get_property_repository(session, property_id)
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
    property_id: str,
    req: PropertyUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
) -> PropertyDetail:
    updated = await update_property_repository(session, property_id, req)
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
```

- [ ] **Step 3: Run tests — expect them to pass now**

```bash
cd /Users/reginaldsmith/APEX-OS/apps/api
source .venv/bin/activate
python -m pytest tests/test_properties.py -v
```

Expected:
```
tests/test_properties.py::test_list_properties_returns_list PASSED
tests/test_properties.py::test_create_and_retrieve_property PASSED
tests/test_properties.py::test_patch_property PASSED
tests/test_properties.py::test_delete_auto_property_is_forbidden PASSED
tests/test_properties.py::test_duplicate_property_returns_409 PASSED

5 passed
```

If tests fail due to missing `asyncio_mode`, add this to `apps/api/pyproject.toml` under `[tool.pytest.ini_options]`:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

- [ ] **Step 4: Smoke-test with curl against the running API**

Verify uvicorn is running on port 8000, then:

```bash
curl -s http://localhost:8000/properties | python3 -m json.tool | head -20
curl -s -X POST http://localhost:8000/properties \
  -H 'Content-Type: application/json' \
  -d '{"name":"Smoke Test Property","market":"Dallas","brands":["scout_security"]}' \
  | python3 -m json.tool
```

Expected: First returns `[]` or a list. Second returns the created property object with `"source": "manual"`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/main.py apps/api/pyproject.toml
git commit -m "feat: GET/POST/PATCH/DELETE /properties endpoints"
```

---

### Task 5: AccountWorkspace Server Component

**Files:**
- Create: `apps/web/app/account-workspace.tsx`

- [ ] **Step 1: Write the component**

Create `apps/web/app/account-workspace.tsx`:

```tsx
import type React from 'react'
import { revalidatePath } from 'next/cache'

export type PropertyItem = {
  id: string
  name: string | null
  market: string | null
  building_type: string
  sqft: number | null
  noi_cents: number | null
  notes: string | null
  source: string
  brands: string[]
  score: number | null
  signal_count: number
}

export type SignalItem = {
  id: string
  title: string
  confidence_score: number
  primary_brand: string | null
  market: string | null
  event_at: string | null
}

export type PropertyDetail = PropertyItem & {
  linked_signals: SignalItem[]
}

const BRAND_LABELS: Record<string, string> = {
  clean_scapes: 'Clean Scapes',
  partners_cc: 'Partners CC',
  scout_security: 'Scout Security',
  ecs_texas: 'ECS of Texas',
  revival_restoration: 'Revival',
}

const BRAND_COLORS: Record<string, string> = {
  clean_scapes: '#639922',
  partners_cc: '#5f5e5a',
  scout_security: '#185FA5',
  ecs_texas: '#1d9e75',
  revival_restoration: '#7f77dd',
}

const BUILDING_TYPE_LABELS: Record<string, string> = {
  office: 'Office',
  multifamily: 'Multifamily',
  retail: 'Retail',
  industrial: 'Industrial',
  data_center: 'Data Center',
  mixed_use: 'Mixed Use',
  hospitality: 'Hospitality',
  medical: 'Medical',
  other: 'Other',
}

function scoreColor(score: number | null): string {
  if (score === null) return '#6b7280'
  if (score >= 90) return '#991b1b'
  if (score >= 70) return '#92400e'
  return '#374151'
}

function formatNoi(cents: number | null): string {
  if (cents === null) return '—'
  const dollars = Math.round(cents / 100)
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M/yr`
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K/yr`
  return `$${dollars}/yr`
}

function buildHref(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) sp.set(k, v)
  }
  return `?${sp.toString()}`
}

export function AccountWorkspace({
  properties,
  selectedProperty,
  currentBrand,
  currentAccount,
  currentSearch,
  currentSort,
}: {
  properties: PropertyItem[]
  selectedProperty: PropertyDetail | null
  currentBrand: string
  currentAccount: string | undefined
  currentSearch: string | undefined
  currentSort: string
}) {
  async function saveField(formData: FormData) {
    'use server'
    const propertyId = formData.get('property_id') as string
    const field = formData.get('field') as string
    const value = formData.get('value') as string
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'
    const body: Record<string, unknown> = {}
    if (field === 'noi_cents') {
      const dollars = parseFloat(value.replace(/[^0-9.]/g, ''))
      body[field] = isNaN(dollars) ? null : Math.round(dollars * 100)
    } else if (field === 'sqft') {
      body[field] = parseInt(value.replace(/[^0-9]/g, ''), 10) || null
    } else {
      body[field] = value || null
    }
    await fetch(`${baseUrl}/properties/${propertyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    revalidatePath('/')
  }

  async function deleteProperty(formData: FormData) {
    'use server'
    const propertyId = formData.get('property_id') as string
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'
    await fetch(`${baseUrl}/properties/${propertyId}`, { method: 'DELETE' })
    revalidatePath('/')
  }

  const NAV_BRANDS = ['all', 'scout_security', 'partners_cc', 'clean_scapes', 'ecs_texas', 'revival_restoration']

  const pill: React.CSSProperties = {
    display: 'inline-block',
    padding: '0.2rem 0.6rem',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none',
  }

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 7rem)', overflow: 'hidden' }}>

      {/* LEFT COLUMN — account list (~40%) */}
      <div style={{ width: '38%', flexShrink: 0, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Brand pill filters */}
        <div style={{ padding: '0.75rem 0.9rem', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {NAV_BRANDS.map((brand) => {
            const active = currentBrand === brand
            const label = brand === 'all' ? 'All' : (BRAND_LABELS[brand] ?? brand)
            return (
              <a
                key={brand}
                href={buildHref({ surface: 'account', brand, account: currentAccount })}
                style={{
                  ...pill,
                  background: active ? '#185FA5' : '#fff',
                  color: active ? '#fff' : '#374151',
                  border: active ? 'none' : '1px solid #d1d5db',
                }}
              >
                {label}
              </a>
            )
          })}
        </div>

        {/* Search + sort + add row */}
        <div style={{ padding: '0.5rem 0.9rem', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <form method="get" style={{ display: 'contents' }}>
            <input type="hidden" name="surface" value="account" />
            <input type="hidden" name="brand" value={currentBrand} />
            <input
              name="accountSearch"
              defaultValue={currentSearch ?? ''}
              placeholder="Search..."
              style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 6, padding: '0.3rem 0.6rem', fontSize: '0.78rem', outline: 'none' }}
            />
            <select
              name="accountSort"
              defaultValue={currentSort}
              style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '0.3rem 0.4rem', fontSize: '0.74rem', outline: 'none' }}
            >
              <option value="score_desc">Score ↓</option>
              <option value="score_asc">Score ↑</option>
              <option value="signals_desc">Signals</option>
              <option value="market_asc">Market A–Z</option>
              <option value="name_asc">Name A–Z</option>
            </select>
            <button type="submit" style={{ display: 'none' }} />
          </form>
          <a
            href={buildHref({ surface: 'account', brand: currentBrand, account: '__add__' })}
            style={{ ...pill, background: '#185FA5', color: '#fff', padding: '0.3rem 0.65rem', whiteSpace: 'nowrap' }}
          >
            + Add
          </a>
        </div>

        {/* Property list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
          {properties.length === 0 ? (
            <div style={{ padding: '1.5rem', color: '#6b7280', fontSize: '0.84rem' }}>
              No properties yet. Add one or wait for signals to auto-populate.
            </div>
          ) : null}
          {properties.map((prop) => {
            const isSelected = selectedProperty?.id === prop.id
            const brandColor = prop.brands[0] ? (BRAND_COLORS[prop.brands[0]] ?? '#6b7280') : '#e5e7eb'
            return (
              <a
                key={prop.id}
                href={buildHref({ surface: 'account', brand: currentBrand, account: prop.id })}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{
                  padding: '0.65rem 0.9rem',
                  background: isSelected ? '#eff6ff' : 'transparent',
                  borderLeft: `3px solid ${isSelected ? '#185FA5' : brandColor}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {prop.name ?? 'Unnamed'}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.74rem' }}>
                      {[prop.market, BUILDING_TYPE_LABELS[prop.building_type]].filter(Boolean).join(' · ')}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                      {prop.source === 'auto' ? (
                        <span style={{ ...pill, background: '#dcfce7', color: '#166534', padding: '0.05rem 0.35rem', fontSize: '0.64rem' }}>AUTO</span>
                      ) : (
                        <span style={{ ...pill, background: '#eff6ff', color: '#1d4ed8', padding: '0.05rem 0.35rem', fontSize: '0.64rem' }}>MANUAL</span>
                      )}
                      {prop.signal_count > 0 ? (
                        <span style={{ ...pill, background: '#dcfce7', color: '#166534', padding: '0.05rem 0.35rem', fontSize: '0.64rem' }}>
                          {prop.signal_count} signal{prop.signal_count !== 1 ? 's' : ''}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {prop.score !== null ? (
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: scoreColor(prop.score), flexShrink: 0 }}>
                      {Math.round(prop.score)}
                    </div>
                  ) : null}
                </div>
              </a>
            )
          })}
        </div>
      </div>

      {/* RIGHT COLUMN — enrichment (top) + signals (bottom) */}
      {selectedProperty ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* ENRICHMENT PANEL (top ~55%) */}
          <div style={{ flex: '0 0 55%', overflowY: 'auto', padding: '1rem 1.2rem', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  {selectedProperty.name ?? 'Unnamed property'}
                  {' '}
                  <span style={{ ...pill, background: selectedProperty.source === 'auto' ? '#dcfce7' : '#eff6ff', color: selectedProperty.source === 'auto' ? '#166534' : '#1d4ed8', fontSize: '0.64rem' }}>
                    {selectedProperty.source.toUpperCase()}
                  </span>
                </h2>
                <div style={{ color: '#6b7280', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                  {[selectedProperty.market, BUILDING_TYPE_LABELS[selectedProperty.building_type]].filter(Boolean).join(' · ')}
                </div>
              </div>
              {selectedProperty.source === 'manual' ? (
                <form action={deleteProperty}>
                  <input type="hidden" name="property_id" value={selectedProperty.id} />
                  <button
                    type="submit"
                    style={{ background: 'none', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 6, padding: '0.25rem 0.6rem', fontSize: '0.74rem', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </form>
              ) : null}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.75rem' }}>
              {/* Market */}
              <form action={saveField} style={{ display: 'contents' }}>
                <input type="hidden" name="property_id" value={selectedProperty.id} />
                <input type="hidden" name="field" value="market" />
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem 0.7rem' }}>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Market</div>
                  <input
                    name="value"
                    defaultValue={selectedProperty.market ?? ''}
                    placeholder="e.g. Dallas Uptown"
                    style={{ border: 'none', background: 'transparent', fontSize: '0.84rem', fontWeight: 600, width: '100%', outline: 'none' }}
                  />
                  <button type="submit" style={{ display: 'none' }} />
                </div>
              </form>

              {/* Building type */}
              <form action={saveField} style={{ display: 'contents' }}>
                <input type="hidden" name="property_id" value={selectedProperty.id} />
                <input type="hidden" name="field" value="building_type" />
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem 0.7rem' }}>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Type</div>
                  <select
                    name="value"
                    defaultValue={selectedProperty.building_type}
                    style={{ border: 'none', background: 'transparent', fontSize: '0.84rem', fontWeight: 600, width: '100%', outline: 'none' }}
                  >
                    {Object.entries(BUILDING_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <button type="submit" style={{ display: 'none' }} />
                </div>
              </form>

              {/* Sqft */}
              <form action={saveField} style={{ display: 'contents' }}>
                <input type="hidden" name="property_id" value={selectedProperty.id} />
                <input type="hidden" name="field" value="sqft" />
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem 0.7rem' }}>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Sqft</div>
                  <input
                    name="value"
                    defaultValue={selectedProperty.sqft?.toLocaleString() ?? ''}
                    placeholder="e.g. 450000"
                    style={{ border: 'none', background: 'transparent', fontSize: '0.84rem', fontWeight: 600, width: '100%', outline: 'none' }}
                  />
                  <button type="submit" style={{ display: 'none' }} />
                </div>
              </form>

              {/* NOI */}
              <form action={saveField} style={{ display: 'contents' }}>
                <input type="hidden" name="property_id" value={selectedProperty.id} />
                <input type="hidden" name="field" value="noi_cents" />
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem 0.7rem' }}>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.2rem' }}>NOI / yr</div>
                  <input
                    name="value"
                    defaultValue={selectedProperty.noi_cents !== null ? String(selectedProperty.noi_cents / 100) : ''}
                    placeholder="e.g. 340000"
                    style={{ border: 'none', background: 'transparent', fontSize: '0.84rem', fontWeight: 600, color: '#166534', width: '100%', outline: 'none' }}
                  />
                  <button type="submit" style={{ display: 'none' }} />
                </div>
              </form>
            </div>

            {/* Notes */}
            <form action={saveField} style={{ marginBottom: '0.75rem' }}>
              <input type="hidden" name="property_id" value={selectedProperty.id} />
              <input type="hidden" name="field" value="notes" />
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem 0.7rem' }}>
                <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Notes</div>
                <textarea
                  name="value"
                  defaultValue={selectedProperty.notes ?? ''}
                  placeholder="Add operator notes..."
                  rows={2}
                  style={{ border: 'none', background: 'transparent', fontSize: '0.84rem', width: '100%', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              <button
                type="submit"
                style={{ marginTop: '0.35rem', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Save
              </button>
            </form>

            {/* Brand assignments */}
            {selectedProperty.brands.length > 0 ? (
              <div>
                <div style={{ fontSize: '0.74rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem' }}>Brands</div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {selectedProperty.brands.map((b) => (
                    <span
                      key={b}
                      style={{ ...pill, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}
                    >
                      {BRAND_LABELS[b] ?? b}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* SIGNALS PANEL (bottom ~45%) */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.85rem 1.2rem' }}>
            <div style={{ fontSize: '0.74rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
              Linked signals ({selectedProperty.linked_signals.length})
            </div>
            {selectedProperty.linked_signals.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: '0.84rem', fontStyle: 'italic' }}>
                No signals linked yet — they&apos;ll appear here as APEX ingests matching events.
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selectedProperty.linked_signals.map((signal) => {
                const brandColor = signal.primary_brand ? (BRAND_COLORS[signal.primary_brand] ?? '#6b7280') : '#6b7280'
                return (
                  <div
                    key={signal.id}
                    style={{ background: '#fff', border: '1px solid #e5e7eb', borderLeft: `3px solid ${brandColor}`, borderRadius: 6, padding: '0.65rem 0.8rem' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem', flex: 1, paddingRight: '0.5rem' }}>{signal.title}</div>
                      <span style={{ ...pill, background: scoreColor(signal.confidence_score) === '#991b1b' ? '#fef2f2' : scoreColor(signal.confidence_score) === '#92400e' ? '#fff7ed' : '#f9fafb', color: scoreColor(signal.confidence_score), fontSize: '0.72rem', flexShrink: 0 }}>
                        {Math.round(signal.confidence_score)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: '#6b7280', fontSize: '0.74rem' }}>
                        {[signal.primary_brand ? (BRAND_LABELS[signal.primary_brand] ?? signal.primary_brand) : null, signal.market].filter(Boolean).join(' · ')}
                      </div>
                      <a
                        href={`?surface=newsroom&selected=${signal.id}`}
                        style={{ ...pill, background: '#185FA5', color: '#fff', fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                      >
                        Open draft →
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
          Select a property to view details
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/reginaldsmith/APEX-OS/apps/web
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: No errors from `account-workspace.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/account-workspace.tsx
git commit -m "feat: AccountWorkspace server component with enrichment + signals panels"
```

---

### Task 6: AccountAddForm Client Component

**Files:**
- Create: `apps/web/app/account-add-form.tsx`

- [ ] **Step 1: Write the component**

Create `apps/web/app/account-add-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const BUILDING_TYPE_LABELS: Record<string, string> = {
  office: 'Office',
  multifamily: 'Multifamily',
  retail: 'Retail',
  industrial: 'Industrial',
  data_center: 'Data Center',
  mixed_use: 'Mixed Use',
  hospitality: 'Hospitality',
  medical: 'Medical',
  other: 'Other',
}

export function AccountAddForm({ cancelHref, surface, brand }: { cancelHref: string; surface: string; brand: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [market, setMarket] = useState('')
  const [buildingType, setBuildingType] = useState('other')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'
    const resp = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        market: market.trim() || null,
        building_type: buildingType,
        brands: brand !== 'all' ? [brand] : [],
      }),
    })
    setLoading(false)
    if (!resp.ok) {
      if (resp.status === 409) {
        const body = await resp.json()
        const existingId = body?.detail?.existing_id ?? body?.existing_id
        router.push(`?surface=${surface}&brand=${brand}&account=${existingId}`)
        return
      }
      setError('Failed to create property. Try again.')
      return
    }
    const created = await resp.json()
    router.push(`?surface=${surface}&brand=${brand}&account=${created.id}`)
    router.refresh()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '0.5rem 0.7rem',
    fontSize: '0.84rem',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: '1rem 1.2rem' }}>
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700 }}>Add account</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div>
          <label style={{ fontSize: '0.74rem', color: '#6b7280', display: 'block', marginBottom: '0.2rem' }}>Property name *</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 2100 McKinney Ave"
            required
          />
        </div>
        <div>
          <label style={{ fontSize: '0.74rem', color: '#6b7280', display: 'block', marginBottom: '0.2rem' }}>Market</label>
          <input
            style={inputStyle}
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            placeholder="e.g. Dallas Uptown"
          />
        </div>
        <div>
          <label style={{ fontSize: '0.74rem', color: '#6b7280', display: 'block', marginBottom: '0.2rem' }}>Property type</label>
          <select
            style={inputStyle}
            value={buildingType}
            onChange={(e) => setBuildingType(e.target.value)}
          >
            {Object.entries(BUILDING_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        {error ? <div style={{ color: '#991b1b', fontSize: '0.8rem' }}>{error}</div> : null}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 6, padding: '0.45rem 1rem', fontWeight: 700, fontSize: '0.84rem', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Adding...' : 'Add account'}
          </button>
          <a
            href={cancelHref}
            style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, padding: '0.45rem 1rem', fontWeight: 700, fontSize: '0.84rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/reginaldsmith/APEX-OS/apps/web
pnpm tsc --noEmit 2>&1 | grep "account-add-form"
```

Expected: No output (no errors).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/account-add-form.tsx
git commit -m "feat: AccountAddForm client component"
```

---

### Task 7: Wire AccountWorkspace into page.tsx

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Add `account`, `accountSearch`, and `accountSort` to the HomePageProps searchParams type**

In `apps/web/app/page.tsx`, find the `HomePageProps` type (around line 148). Change:

```typescript
type HomePageProps = {
  searchParams?: Promise<{
    brand?: string;
    eventType?: string;
    market?: string;
    selected?: string;
    draftType?: string;
    draftStatus?: string;
    surface?: string;
    contact?: string;
  }>;
};
```

To:

```typescript
type HomePageProps = {
  searchParams?: Promise<{
    brand?: string;
    eventType?: string;
    market?: string;
    selected?: string;
    draftType?: string;
    draftStatus?: string;
    surface?: string;
    contact?: string;
    account?: string;
    accountSearch?: string;
    accountSort?: string;
  }>;
};
```

- [ ] **Step 2: Add `account`, `accountSearch`, `accountSort` to the filters object**

Find the `filters` object (around line 600):

```typescript
  const filters = {
    surface: resolved.surface ?? 'command',
    brand: resolved.brand ?? 'all',
    eventType: resolved.eventType,
    market: resolved.market ?? 'ALL',
    selected: resolved.selected,
    draftType: resolved.draftType,
    draftStatus: resolved.draftStatus,
    contact: resolved.contact ?? CONTACTS[0].id,
  };
```

Change to:

```typescript
  const filters = {
    surface: resolved.surface ?? 'command',
    brand: resolved.brand ?? 'all',
    eventType: resolved.eventType,
    market: resolved.market ?? 'ALL',
    selected: resolved.selected,
    draftType: resolved.draftType,
    draftStatus: resolved.draftStatus,
    contact: resolved.contact ?? CONTACTS[0].id,
    account: resolved.account,
    accountSearch: resolved.accountSearch,
    accountSort: resolved.accountSort ?? 'score_desc',
  };
```

- [ ] **Step 3: Add the two fetch helper functions and import types from account-workspace.tsx**

Find the line `import { EventModal } from './event-modal'` at the top of `apps/web/app/page.tsx`. Change it to:

```typescript
import { AccountWorkspace, type PropertyItem, type PropertyDetail } from './account-workspace'
import { AccountAddForm } from './account-add-form'
import { EventModal } from './event-modal'
```

Then find the `getAudit` function (around line 514) and add these two functions immediately after it (before the `export default async function HomePage`):

```typescript
async function getProperties(opts: { brand?: string; search?: string; sort?: string }): Promise<PropertyItem[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
  const params = new URLSearchParams();
  if (opts.brand && opts.brand !== 'all') params.set('brand', opts.brand);
  if (opts.search) params.set('search', opts.search);
  try {
    const resp = await fetch(`${baseUrl}/properties?${params}`, { cache: 'no-store' });
    if (!resp.ok) return [];
    return resp.json();
  } catch {
    return [];
  }
}

async function getPropertyDetail(propertyId: string): Promise<PropertyDetail | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
  try {
    const resp = await fetch(`${baseUrl}/properties/${propertyId}`, { cache: 'no-store' });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Add the data fetches inside HomePage**

Find the line `const auditEntries = await getAudit(selectedEvent?.id);` (around line 629). Add these lines immediately after it:

```typescript
  const isAccountSurface = filters.surface === 'account';
  const properties = isAccountSurface
    ? await getProperties({ brand: filters.brand, search: filters.accountSearch, sort: filters.accountSort })
    : [];
  const selectedProperty = isAccountSurface && filters.account && filters.account !== '__add__'
    ? await getPropertyDetail(filters.account)
    : isAccountSurface && properties.length > 0 && !filters.account
    ? await getPropertyDetail(properties[0].id)
    : null;
```

- [ ] **Step 5: Replace the case 'account': block**

Find the `case 'account':` block (around lines 1155–1196):

```typescript
      case 'account':
        return (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <SectionHeader title={selectedEventDetail?.property_name ?? selectedEvent?.title ?? 'Account workspace'} subtitle="Property intelligence, relationship logic, and commercial opportunity in one place." actions={<><Button label="Mind map" /><Button label="Generate proposal" primary /></>} />
            ...
          </div>
        );
```

Replace the entire `case 'account':` block (from `case 'account':` through the closing `);`) with:

```typescript
      case 'account':
        if (filters.account === '__add__') {
          return (
            <AccountAddForm
              cancelHref={buildHref(filters, { account: undefined })}
              surface="account"
              brand={filters.brand}
            />
          );
        }
        return (
          <AccountWorkspace
            properties={properties}
            selectedProperty={selectedProperty}
            currentBrand={filters.brand}
            currentAccount={filters.account}
            currentSearch={filters.accountSearch}
            currentSort={filters.accountSort ?? 'score_desc'}
          />
        );
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/reginaldsmith/APEX-OS/apps/web
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: wire AccountWorkspace into page.tsx account surface"
```

---

### Task 8: Integration Test

**Files:**
- No new files

- [ ] **Step 1: Start the dev API (if not running)**

```bash
cd /Users/reginaldsmith/APEX-OS/apps/api
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000 &
```

- [ ] **Step 2: Run the migration**

```bash
python -m app.init_db
```

Expected: No errors.

- [ ] **Step 3: Run all backend tests**

```bash
python -m pytest tests/test_properties.py -v
```

Expected: 5 tests pass.

- [ ] **Step 4: Start the web dev server (if not running)**

```bash
cd /Users/reginaldsmith/APEX-OS/apps/web
pnpm dev
```

- [ ] **Step 5: Manual browser walkthrough**

Open http://localhost:3000/?surface=account

Verify:
1. Left column shows brand pill filters (All, Scout, Partners CC, etc.)
2. "No properties yet" placeholder if DB is empty, OR auto-created properties if events exist
3. Click "+ Add account" → Add form renders with name/market/type fields
4. Fill in a name + market and submit → redirects to new property's detail view
5. Right column shows enrichment panel (top) and signals panel (bottom)
6. Edit the Market field and click Save → field updates after reload
7. NOI field accepts numbers and formats as dollars after save
8. If the property has linked signals (events linked via property_id), they appear in the signals panel with "Open draft →" links
9. Delete button only visible on MANUAL records; clicking it removes the record

- [ ] **Step 6: Final commit**

```bash
cd /Users/reginaldsmith/APEX-OS
git add -A
git commit -m "feat: Account Workspace Phase B complete — property browser, enrichment, signals"
```
