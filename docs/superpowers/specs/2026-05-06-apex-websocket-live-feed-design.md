# APEX — WebSocket Live Feed (Phase C, Part 1)

**Date:** 2026-05-06
**Status:** Approved for implementation
**Scope:** Phase C — Live feed resilience

---

## Context

The APEX newsroom currently calls `router.refresh()` on every WebSocket message, giving a live-ish feed. However, there is no polling fallback when the socket is unavailable, no catch-up on reconnect, no filtering of incoming events against the active brand filter, and no "N new items" banner. This spec adds all four.

---

## Design Decisions

| Decision | Choice |
|----------|--------|
| New event appearance | Auto-refresh for 1–2 items; "N new items" banner for 3+ |
| Filter behavior | Client-side — only increment counter if `primary_brand` matches current `?brand=` param |
| Reconnection | Show "reconnecting…" indicator; fire catch-up `GET /events?since=` on restore |
| Fallback | Poll `GET /events?since=<last_seen_ts>` every 15s when WebSocket is offline |
| New files | None — extend `live-feed-status.tsx` only |
| New API surface | `since` query param on `GET /events` |

---

## Architecture

Three moving parts:

**`apps/web/app/live-feed-status.tsx`** (modify)
The only client component that changes. Owns WebSocket lifecycle, polling fallback, pendingCount banner, and catch-up fetch. No new files needed.

**`apps/api/app/main.py`** (minor modify)
Add `since: Optional[str] = Query(default=None)` to `GET /events`.

**`apps/api/app/repositories/events.py`** (minor modify)
Add `since` filter to the events list query — `WHERE created_at > :since` when param is present.

---

## Components

### `live-feed-status.tsx` additions

**`pendingCount` state**
Incremented on each incoming WS message or polling hit that passes the brand filter check. When `> 0`, renders a "N new items" pill. Auto-fires `router.refresh()` for 1–2 items (after 800ms debounce); waits for operator click for 3+. Resets to 0 after each refresh.

**Polling fallback**
When socket transitions to `'offline'`, start a `setInterval` at 15 seconds calling `GET /events?since=<last_seen_ts>`. Stop the interval when the socket reconnects.

**Catch-up on reconnect**
In `socket.onopen`, immediately fire `GET /events?since=<last_seen_ts>` before returning to WebSocket-only mode.

**Client-side brand filter**
Before incrementing `pendingCount`, check `primary_brand` on the incoming event against the current `?brand=` URL param (read via `useSearchParams`). Skip if brand is set and doesn't match. Pass-through if `brand` is `'all'` or absent.

**`last_seen_ts` ref**
A `useRef<string | null>` initialised from a `latestEventTs` prop (the `created_at` of the first event in the server-rendered list). After each `router.refresh()`, Next.js re-renders `page.tsx` server-side and passes the updated prop, which a `useEffect` syncs into the ref.

### `page.tsx` (minor modify)
Pass `latestEventTs={events[0]?.created_at ?? null}` to `<LiveFeedStatus />`. `LiveFeedStatus` accepts `latestEventTs: string | null` and syncs it into `last_seen_ts` ref via `useEffect`.

---

## Data Flow

```
WebSocket connected (normal path):
  /ws message → parse primary_brand →
    matches current filter?
      yes → increment pendingCount
        pendingCount ≤ 2 → auto router.refresh() after 800ms
        pendingCount > 2 → show "N new items" pill, wait for click
      no → ignore

WebSocket drops (fallback path):
  status → 'offline' → start 15s polling interval
  poll → GET /events?since=<last_seen_ts> →
    new events found → filter check → same banner logic
    no new events → continue interval
  socket reconnects → onopen →
    immediate GET /events?since=<last_seen_ts> (catch-up) →
    stop polling interval →
    status → 'live'

Banner click / auto-fire:
  router.refresh() →
    server re-fetches events →
    new events prepend to feed top →
    pendingCount reset to 0 →
    last_seen_ts synced from latestEventTs prop via useEffect
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| WebSocket never connects at page load | After 3s in `'connecting'`, transition to `'offline'` and start polling immediately |
| Polling returns non-200 | Swallow silently, continue interval |
| Polling returns malformed JSON | `Array.isArray` guard — skip update, continue interval |
| Catch-up fetch fails on reconnect | Log to console, proceed to WebSocket-only mode |
| `since` param missing or empty | `GET /events` returns all events (no regression) |

---

## API Change: `GET /events?since=`

**Param:** `since: Optional[str]` — ISO 8601 timestamp string (`created_at` column)

**Behavior:**
- If `since` is present and valid: `WHERE created_at > :since ORDER BY created_at DESC`
- If `since` is absent or empty: existing behavior (no filter change)
- If `since` is unparseable: return 400 with `{"detail": "Invalid since timestamp"}`

---

## Testing

### Backend (`apps/api/tests/test_events.py`)
- `GET /events?since=<past_timestamp>` returns only events newer than that timestamp
- `GET /events?since=<future_timestamp>` returns empty list
- `GET /events` (no `since`) returns all events — no regression

### Frontend (manual)
- Seed event via `POST /bootstrap/sample-event` → "1 new item" pill appears within ~1s
- Kill API → status transitions to amber "Reconnecting feed" within 3s, polling begins
- Restore API, seed event → catch-up fires, banner appears, `router.refresh()` loads event
- Active brand filter = Scout → seed a Partners event → banner does NOT appear
- Active brand filter = Scout → seed a Scout event → banner appears

---

## Files

| File | Action |
|------|--------|
| `apps/web/app/live-feed-status.tsx` | Modify — polling fallback, catch-up, pendingCount banner, brand filter |
| `apps/web/app/page.tsx` | Modify — pass `latestEventTs` prop to `<LiveFeedStatus />` |
| `apps/api/app/main.py` | Modify — add `since` query param to `GET /events` |
| `apps/api/app/repositories/events.py` | Modify — add `since` filter to list query |
| `apps/api/tests/test_events.py` | Modify — add 3 tests for `since` param |
