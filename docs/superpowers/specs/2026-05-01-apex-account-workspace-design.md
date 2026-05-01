# APEX Account Workspace — Design Spec

**Date:** 2026-05-01
**Status:** Approved
**Author:** Reginald Smith / Claude

---

## Overview

The Account Workspace is a standalone property/account browser within APEX OS. It gives operators a single place to see all tracked properties, enrich their records with NOI estimates and notes, and act on the signals linked to each one — without needing to be in the newsroom event flow.

---

## Surface Placement

- Accessed via the existing `?surface=accounts` URL param
- Appears in the main APEX navigation alongside Newsroom, Pipeline, etc.
- Works on desktop and tablet (mobile not in scope for this phase)

---

## Layout — Option 4

Three logical zones rendered as two visible columns:

```
┌─────────────────┬────────────────────────────┐
│                 │  Enrichment panel (top)     │
│  Account list   ├────────────────────────────┤
│  (wide, ~40%)   │  Signals panel (bottom)     │
│                 │                             │
└─────────────────┴────────────────────────────┘
```

- **Left column (~40% width):** scrollable account list with filter/search controls at top
- **Right column (~60% width):** vertically split — enrichment form fills the top half, linked signals fill the bottom half
- Selected account is highlighted in the list; its data populates both right panels
- No account selected on first load — right column shows an empty state prompt

---

## Account List (Left Column)

### Filter & Sort Controls

- **Brand pill filters:** All | Scout | Partners CC | Clean Scapes | ECS | Revival — consistent with the existing APEX shell pill pattern; active pill is filled blue
- **Search box:** text input below pills, filters list by account name (client-side, instant)
- **Sort:** dropdown defaulting to "Score ↓"; options: Score ↓, Score ↑, Signals count, Market A–Z, Name A–Z
- **+ Add account button:** below the sort control, opens an inline form at the top of the list

### Account List Items

Each row shows:
- Property name (bold)
- Market · Brand (subtitle)
- Signal count badge (green pill, e.g. "3 signals") — omitted if 0
- Score badge (colored by tier: red ≥90, orange ≥70, gray otherwise) — omitted if no signals
- Left border color = brand color (Scout blue, Partners CC amber, Clean Scapes green, etc.)
- Source badge: small `AUTO` (green) or `MANUAL` (blue) label

Clicking a row sets `?account=<id>` in the URL and loads that account's detail in the right column.

---

## Enrichment Panel (Right Column, Top)

Displays the selected account's editable fields:

| Field | Type | Notes |
|-------|------|-------|
| Name | text | Required; editable inline |
| Market | text | e.g. "Dallas Uptown", "DFW", "Austin" |
| Property class | select | Class A / Class B / Class C / Industrial / Mixed-use / Other |
| Square footage | integer | Optional |
| NOI estimate | integer (cents) | Displayed as $/yr; nullable |
| Brand assignments | multi-select pills | Which Gore brands serve this property |
| Operator notes | textarea | Free text; saved on blur or explicit save |

- All fields editable inline; save triggers `PATCH /accounts/{id}`
- Auto-created records show an `AUTO` badge next to the name — all fields still editable
- Manual records show a delete button (trash icon); auto records do not
- Inline save feedback: brief "Saved ✓" flash on success; inline error text on failure

---

## Signals Panel (Right Column, Bottom)

Shows events linked to the selected account, joined via `accounts.name = events.property_name`.

Each signal card shows:
- Event title
- Confidence score badge (colored by tier)
- Signal age (e.g. "3 days ago")
- Brand pill
- **"Open draft →"** button — opens the EventModal for that event (same modal used in Phase A)

Sorted by confidence score descending.

Empty state: "No signals linked yet — they'll appear here as APEX ingests matching events."

---

## Data Model

### `accounts` table (new)

```sql
CREATE TABLE accounts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    market      TEXT,
    brand       TEXT,                    -- primary brand assignment
    property_class TEXT,
    sqft        INTEGER,
    noi_cents   INTEGER,                 -- nullable, annual NOI in cents
    notes       TEXT,
    source      TEXT NOT NULL DEFAULT 'manual',  -- 'auto' | 'manual'
    brands      TEXT[],                  -- all assigned brands (array)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (name, market)
);
```

### Score computation

No stored score. At query time: `MAX(events.confidence_score)` joined on `events.property_name = accounts.name`.

---

## API Endpoints (FastAPI)

### `GET /accounts`

Returns all accounts with computed score and signal count.

Query params:
- `brand` — filter by brand (optional)
- `search` — name substring filter (optional)
- `sort` — `score_desc` (default) | `score_asc` | `signals_desc` | `market_asc` | `name_asc`

Response:
```json
[
  {
    "id": "uuid",
    "name": "2100 McKinney Ave",
    "market": "Dallas Uptown",
    "brand": "Scout",
    "brands": ["Scout"],
    "property_class": "Class A",
    "sqft": 450000,
    "noi_cents": 34000000,
    "notes": "",
    "source": "auto",
    "score": 95,
    "signal_count": 3,
    "created_at": "...",
    "updated_at": "..."
  }
]
```

### `POST /accounts`

Create a manual account record.

Body: `{ name, market, brand, brands, property_class, sqft, noi_cents, notes }`

Returns: full account object.

Duplicate check: if `(name, market)` already exists, return 409 with `{ detail: "Account already exists", existing_id: "uuid" }`.

### `PATCH /accounts/{id}`

Partial update. Any subset of editable fields. Returns updated account object.

Returns 404 if account not found.

### `DELETE /accounts/{id}`

Delete a manual account. Returns 204 on success.

Returns 404 if not found. Returns 403 if `source = 'auto'` (auto records cannot be deleted).

---

## Auto-Creation on Ingest

When the ingest pipeline resolves a news event to a property:

1. Extract `property_name` and `market` from the resolved event
2. Run `INSERT INTO accounts (name, market, source, brand) VALUES (...) ON CONFLICT (name, market) DO NOTHING`
3. Auto-creation failure is silent — event saves regardless

This keeps account creation best-effort and non-blocking.

---

## Data Flow Summary

1. **Auto:** Ingest pipeline → resolves property → `INSERT ... ON CONFLICT DO NOTHING` into `accounts` with `source='auto'`
2. **Manual:** Operator clicks `+ Add account` → fills form → `POST /accounts` → record created with `source='manual'`
3. **Enrich:** Operator edits any field inline → `PATCH /accounts/{id}`
4. **Signals:** `GET /accounts` joins `events` on `property_name = accounts.name` → `MAX(confidence_score)` + `COUNT(*)` returned per account
5. **Signal detail:** Clicking "Open draft →" opens Phase A EventModal with `?selected=<event_id>`
6. **Delete:** Only manual records; `DELETE /accounts/{id}`

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Account not found (PATCH/GET) | 404 `{ detail: "Account not found" }` |
| Duplicate manual add (same name+market) | 409 with link to existing record; no duplicate created |
| Empty signals panel | "No signals linked yet" placeholder |
| Failed save (PATCH) | Inline error below the field; no full-page error |
| Auto-creation failure in ingest | Silent — event saves normally |
| Delete attempt on auto record | 403 Forbidden |

---

## Out of Scope (This Phase)

- Contact records on accounts
- Map view
- Export / reporting
- Mobile layout
- Account-to-account merging
- Activity log per account
