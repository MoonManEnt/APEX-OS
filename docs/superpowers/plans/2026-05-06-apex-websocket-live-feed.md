# WebSocket Live Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Before starting:** Set up an isolated worktree using `superpowers:using-git-worktrees`. Branch name: `feature/ws-live-feed`. Worktree path: `.worktrees/ws-live-feed`.

**Goal:** Make the APEX newsroom update in real-time — WebSocket primary, 15-second REST polling fallback, "N new items" banner, catch-up on reconnect, brand-filter awareness.

**Architecture:** `live-feed-status.tsx` (already exists as a `'use client'` component) is extended to own the WebSocket lifecycle, polling fallback, and pending-count banner. `page.tsx` passes `latestEventTs` and `currentBrand` props down to it. The API gets a `since` query param on `GET /events` so the fallback and catch-up fetches only pull new events.

**Tech Stack:** Next.js 15 App Router (`'use client'`, `useEffect`, `useRef`, `router.refresh()`), FastAPI + SQLAlchemy async text queries, pytest-asyncio, httpx ASGI transport.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/api/app/models/events.py` | Modify | Add `created_at: Optional[str]` to `EventListItem` |
| `apps/api/app/repositories/events.py` | Modify | Add `created_at` to SELECT, add `since` WHERE filter |
| `apps/api/app/main.py` | Modify | Add `since` Query param to `GET /events`; add `primaryBrand`/`primaryBrands` to WS broadcasts |
| `apps/api/tests/test_events.py` | Create | 3 tests for `since` param behaviour |
| `apps/api/pyproject.toml` | Modify | Add `[tool.pytest.ini_options]` asyncio config |
| `apps/web/app/live-feed-status.tsx` | Modify | Polling fallback, catch-up, pendingCount banner, brand filter |
| `apps/web/app/page.tsx` | Modify | Pass `latestEventTs` and `currentBrand` props to `<LiveFeedStatus />` |

---

## Task 1: Backend — `since` param and `created_at` in events response

**Files:**
- Modify: `apps/api/app/models/events.py:13-29`
- Modify: `apps/api/app/repositories/events.py:1-85`
- Modify: `apps/api/app/main.py:118-139`

- [ ] **Step 1: Add `created_at` to `EventListItem`**

Open `apps/api/app/models/events.py`. Change `EventListItem` to:

```python
class EventListItem(BaseModel):
    id: str
    title: str
    summary: Optional[str] = None
    event_type: str = Field(default='other')
    market: Optional[str] = None
    urgency_score: int = 0
    relevance_score: int = 0
    confidence_score: float = 0.0
    primary_brand: Optional[str] = None
    brand_relevance: list[str] = Field(default_factory=list)
    badges: list[str] = Field(default_factory=list)
    source_url: Optional[str] = None
    event_at: Optional[str] = None
    latest_draft_type: Optional[str] = None
    latest_draft_status: Optional[str] = None
    latest_draft_updated_at: Optional[str] = None
    created_at: Optional[str] = None
```

- [ ] **Step 2: Add `created_at` to the SQL SELECT and `since` filter to WHERE**

Open `apps/api/app/repositories/events.py`. Replace the entire `LIST_EVENTS_SQL` constant (lines 9–72) with:

```python
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
      latest_draft_updated_at,
      created_at::text as created_at
    from ranked
    where dedupe_rank = 1
      and (cast(:brand as text) is null or primary_brand::text = cast(:brand as text) or cast(:brand as text) = any(cast(brand_relevance as text[])))
      and (cast(:market as text) is null or market = cast(:market as text))
      and (cast(:event_type as text) is null or event_type::text = cast(:event_type as text))
      and (cast(:min_score as integer) is null or relevance_score >= cast(:min_score as integer))
      and (cast(:since as timestamptz) is null or created_at > cast(:since as timestamptz))
    order by created_at desc
    limit 100
    """
)
```

- [ ] **Step 3: Add `since` to `list_events` function signature and execute call**

In `apps/api/app/repositories/events.py`, replace the `list_events` function:

```python
async def list_events(
    session: AsyncSession,
    *,
    brand: Optional[str] = None,
    market: Optional[str] = None,
    event_type: Optional[str] = None,
    min_score: Optional[int] = None,
    since: Optional[str] = None,
) -> list[EventListItem]:
    result = await session.execute(
        LIST_EVENTS_SQL,
        {
            'brand': brand,
            'market': market,
            'event_type': event_type,
            'min_score': min_score,
            'since': since,
        },
    )
    rows = result.mappings().all()
    return [EventListItem(**row) for row in rows]
```

- [ ] **Step 4: Add `since` Query param to `GET /events` in `main.py`**

In `apps/api/app/main.py`, replace the `list_events` route (lines 118–139):

```python
@app.get("/events", response_model=EventListResponse)
async def list_events(
    brand: Optional[str] = Query(default=None),
    market: Optional[str] = Query(default=None),
    event_type: Optional[str] = Query(default=None),
    min_score: Optional[int] = Query(default=None, ge=0, le=100),
    since: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
) -> EventListResponse:
    filters = EventFilters(
        brand=brand,
        market=market,
        event_type=event_type,
        min_score=min_score,
    )
    events = await list_events_repository(
        session,
        brand=filters.brand,
        market=filters.market,
        event_type=filters.event_type,
        min_score=filters.min_score,
        since=since,
    )
    return EventListResponse(events=events)
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/models/events.py apps/api/app/repositories/events.py apps/api/app/main.py
git commit -m "feat: add since param to GET /events and created_at to EventListItem"
```

---

## Task 2: Backend — `primary_brand` in WebSocket broadcast payloads

**Files:**
- Modify: `apps/api/app/main.py:167,189`

- [ ] **Step 1: Add `primaryBrand` to the `feed.seeded` broadcast**

In `apps/api/app/main.py`, replace line 167:

```python
    await feed_manager.broadcast({
        'type': 'feed.seeded',
        'eventId': seeded['event_id'],
        'primaryBrand': seeded.get('classification', {}).get('primary_brand'),
    })
```

- [ ] **Step 2: Add `primaryBrands` to the `feed.ingested` broadcast**

In `apps/api/app/main.py`, replace line 189:

```python
    ingested_brands = list({
        item.get('primary_brand')
        for item in result.get('events', [])
        if item.get('primary_brand')
    })
    await feed_manager.broadcast({
        'type': 'feed.ingested',
        'count': result['count'],
        'primaryBrands': ingested_brands,
    })
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/main.py
git commit -m "feat: include primaryBrand/primaryBrands in WebSocket broadcast payloads"
```

---

## Task 3: Backend — tests for `since` param

**Files:**
- Create: `apps/api/tests/__init__.py`
- Create: `apps/api/tests/test_events.py`
- Modify: `apps/api/pyproject.toml`

- [ ] **Step 1: Add pytest asyncio config to `pyproject.toml`**

Add to the end of `apps/api/pyproject.toml`:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "session"
asyncio_default_test_loop_scope = "session"
```

- [ ] **Step 2: Create `tests/__init__.py`**

```bash
mkdir -p apps/api/tests
touch apps/api/tests/__init__.py
```

- [ ] **Step 3: Write failing tests**

Create `apps/api/tests/test_events.py`:

```python
import pytest
import httpx
from app.main import app


@pytest.mark.asyncio
async def test_list_events_returns_list():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        resp = await client.get('/events')
    assert resp.status_code == 200
    assert 'events' in resp.json()
    assert isinstance(resp.json()['events'], list)


@pytest.mark.asyncio
async def test_since_future_timestamp_returns_empty():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        resp = await client.get('/events?since=2099-01-01T00:00:00Z')
    assert resp.status_code == 200
    assert resp.json()['events'] == []


@pytest.mark.asyncio
async def test_since_past_timestamp_returns_events():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        resp = await client.get('/events?since=2000-01-01T00:00:00Z')
    assert resp.status_code == 200
    data = resp.json()
    assert 'events' in data
    # Same result as no-filter call — all events are newer than year 2000
    no_filter = await client.get('/events')
    assert len(data['events']) == len(no_filter.json()['events'])
```

- [ ] **Step 4: Run tests to verify they fail (no DB yet)**

```bash
cd apps/api && .venv/bin/pytest tests/test_events.py -v
```

Expected: tests fail or skip (depends on whether local DB is running). If DB is running, `test_since_future_timestamp_returns_empty` and `test_list_events_returns_list` should pass immediately since we already implemented the logic in Task 1. `test_since_past_timestamp_returns_events` passes if there are any events in the DB.

- [ ] **Step 5: Run all tests to confirm no regressions**

```bash
cd apps/api && .venv/bin/pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/tests/ apps/api/pyproject.toml
git commit -m "test: add events tests for since param and base list behaviour"
```

---

## Task 4: Frontend — upgrade `live-feed-status.tsx`

**Files:**
- Modify: `apps/web/app/live-feed-status.tsx` (full replacement)

- [ ] **Step 1: Replace the component**

Replace the entire contents of `apps/web/app/live-feed-status.tsx` with:

```typescript
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type FeedMessage = {
  type?: string;
  count?: number;
  eventId?: string;
  primaryBrand?: string;
  primaryBrands?: string[];
};

type Props = {
  latestEventTs: string | null;
  currentBrand?: string;
};

export function LiveFeedStatus({ latestEventTs, currentBrand }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<'connecting' | 'live' | 'reconnecting' | 'offline'>('connecting');
  const [lastMessage, setLastMessage] = useState<FeedMessage | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const lastSeenTs = useRef<string | null>(latestEventTs);

  // Sync prop → ref after each router.refresh()
  useEffect(() => {
    if (latestEventTs) lastSeenTs.current = latestEventTs;
  }, [latestEventTs]);

  const wsUrl = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
    return apiBase.replace(/^http/, 'ws') + '/ws';
  }, []);

  const matchesBrand = (brand: string | undefined): boolean => {
    if (!currentBrand || currentBrand === 'all') return true;
    return brand === currentBrand;
  };

  const matchesBrands = (brands: string[] | undefined): boolean => {
    if (!currentBrand || currentBrand === 'all') return true;
    return (brands ?? []).includes(currentBrand);
  };

  // Auto-refresh when pendingCount is 1 or 2
  useEffect(() => {
    if (pendingCount === 0 || pendingCount > 2) return;
    const timer = setTimeout(() => {
      router.refresh();
      setPendingCount(0);
    }, 800);
    return () => clearTimeout(timer);
  }, [pendingCount, router]);

  // Polling fallback when offline
  useEffect(() => {
    if (status !== 'offline') return;
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
    const poll = async () => {
      try {
        const url = lastSeenTs.current
          ? `${apiBase}/events?since=${encodeURIComponent(lastSeenTs.current)}`
          : `${apiBase}/events`;
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) return;
        const data = await resp.json() as { events?: unknown[] };
        const events = Array.isArray(data.events) ? data.events : [];
        if (events.length > 0) setPendingCount((c) => c + events.length);
      } catch { /* swallow */ }
    };
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

    const catchUp = async () => {
      if (!lastSeenTs.current) return;
      try {
        const resp = await fetch(
          `${apiBase}/events?since=${encodeURIComponent(lastSeenTs.current)}`,
          { cache: 'no-store' }
        );
        if (!resp.ok) return;
        const data = await resp.json() as { events?: unknown[] };
        const missed = Array.isArray(data.events) ? data.events.length : 0;
        if (missed > 0) setPendingCount((c) => c + missed);
      } catch { /* swallow */ }
    };

    const connect = () => {
      setStatus((current) => (current === 'live' ? 'reconnecting' : 'connecting'));
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        if (!active) return;
        setStatus('live');
        catchUp();
      };

      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const message = JSON.parse(event.data) as FeedMessage;
          setLastMessage(message);
          if (message.type === 'feed.seeded') {
            if (matchesBrand(message.primaryBrand)) {
              setPendingCount((c) => c + 1);
            }
          } else if (message.type === 'feed.ingested') {
            if (matchesBrands(message.primaryBrands)) {
              setPendingCount((c) => c + (message.count ?? 1));
            }
          }
        } catch { /* ignore malformed payloads */ }
      };

      socket.onclose = () => {
        if (!active) return;
        setStatus('offline');
        reconnectTimer = setTimeout(connect, 2500);
      };

      socket.onerror = () => {
        if (!active) return;
        setStatus('offline');
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [wsUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const tone = status === 'live' ? '#166534' : status === 'connecting' || status === 'reconnecting' ? '#92400e' : '#991b1b';
  const bg = status === 'live' ? '#dcfce7' : status === 'connecting' || status === 'reconnecting' ? '#fef3c7' : '#fee2e2';
  const label = status === 'live' ? 'Live feed connected' : status === 'reconnecting' ? 'Reconnecting feed' : status === 'connecting' ? 'Connecting feed' : 'Feed offline — polling';

  return (
    <div style={{ marginTop: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 12, padding: '0.85rem', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: bg, color: tone, borderRadius: 999, padding: '0.35rem 0.7rem', fontSize: '0.8rem', fontWeight: 700 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone, display: 'inline-block' }} />
          {label}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {pendingCount > 2 && (
            <button
              type="button"
              onClick={() => { router.refresh(); setPendingCount(0); }}
              style={{ border: '1px solid #185FA5', background: '#eff6ff', color: '#185FA5', borderRadius: 10, padding: '0.45rem 0.7rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
            >
              {pendingCount} new {pendingCount === 1 ? 'item' : 'items'} — load
            </button>
          )}
          <button
            type="button"
            onClick={() => { router.refresh(); setPendingCount(0); }}
            style={{ border: '1px solid #d1d5db', background: '#fff', color: '#111827', borderRadius: 10, padding: '0.45rem 0.7rem', cursor: 'pointer', fontWeight: 600 }}
          >
            Refresh newsroom
          </button>
        </div>
      </div>
      <div style={{ marginTop: '0.6rem', color: '#6b7280', fontSize: '0.82rem' }}>
        {lastMessage?.type ? `Last feed event: ${lastMessage.type}${lastMessage.count ? ` · ${lastMessage.count} ingested` : ''}${lastMessage.eventId ? ` · ${lastMessage.eventId}` : ''}` : 'Waiting for feed activity.'}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/live-feed-status.tsx
git commit -m "feat: live feed status — polling fallback, catch-up, pending count banner, brand filter"
```

---

## Task 5: Frontend — wire props in `page.tsx` + integration test

**Files:**
- Modify: `apps/web/app/page.tsx` (two `<LiveFeedStatus />` usages)

- [ ] **Step 1: Pass `latestEventTs` and `currentBrand` props to both `<LiveFeedStatus />` usages**

In `apps/web/app/page.tsx`, find the two `<LiveFeedStatus />` usages (lines ~1014 and ~1096) and replace both with:

```tsx
<LiveFeedStatus latestEventTs={events[0]?.created_at ?? null} currentBrand={filters.brand} />
```

Both usages are identical — the `events` array and `filters.brand` are in scope at both call sites.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: pass latestEventTs and currentBrand to LiveFeedStatus"
```

- [ ] **Step 4: Manual integration test — new event banner**

Start the API and web app locally. Open the newsroom at `http://localhost:3000/?surface=newsroom`. In a separate terminal:

```bash
curl -X POST 'http://localhost:8000/bootstrap/sample-event'
```

Expected: within ~1s the "Live feed connected" status shows "1 new item" (or auto-refreshes if the count is ≤ 2 and the filter matches). The feed updates without a manual page reload.

- [ ] **Step 5: Manual integration test — brand filter**

Set the newsroom to a specific brand (e.g. `?surface=newsroom&brand=scout_security`). Seed a sample event (which defaults to `clean_scapes` brand). Expected: no banner appears, feed does not change.

- [ ] **Step 6: Manual integration test — offline fallback**

Stop the API. Expected: status transitions to "Feed offline — polling" within ~3s. Start the API, seed an event. Expected: within 15s the polling interval fires and the pending count banner appears.

- [ ] **Step 7: Commit final**

```bash
git add -A
git commit -m "test: manual integration test checklist for WS live feed"
```

---

## Self-Review

**Spec coverage:**
- ✅ Auto-prepend + banner hybrid → Task 4 (auto-refresh ≤ 2, banner > 2)
- ✅ Client-side brand filter → Task 4 (`matchesBrand` / `matchesBrands`)
- ✅ Reconnecting indicator → Task 4 (`'Feed offline — polling'` label)
- ✅ Catch-up on reconnect → Task 4 (`catchUp()` in `socket.onopen`)
- ✅ Polling fallback → Task 4 (15s interval on `'offline'`)
- ✅ `since` param on `GET /events` → Task 1
- ✅ `primary_brand` in WS broadcasts → Task 2
- ✅ 3 backend tests for `since` → Task 3
- ✅ `latestEventTs` prop via `page.tsx` → Task 5
- ✅ 5 manual test scenarios → Task 5

**Type consistency:** `latestEventTs` is `string | null` in both `page.tsx` (from `events[0]?.created_at ?? null`) and the `LiveFeedStatus` props. `currentBrand` is `string | undefined` from `filters.brand` (matches optional prop). `EventListItem.created_at` is `Optional[str]` — matches TypeScript `string | null | undefined` via optional chaining.
