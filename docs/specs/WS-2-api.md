# WS-2 — Core Intelligence API

## Goal

Expose the first usable feed surface for the newsroom UI.

## Endpoints

### `GET /health`
Returns service status and whether core config is present.

### `GET /events`
Query params:
- `brand`
- `market`
- `event_type`
- `min_score`

Current state:
- filter contract wired
- repository placeholder wired
- DB-backed implementation pending

### `GET /events/{event_id}`
Placeholder route exists.

## Immediate next tasks

1. add async DB session dependency
2. implement event query SQL / ORM logic
3. add pagination contract
4. return normalized `EventListItem` results from DB
5. add WebSocket `/ws` stub for `feed.publish`
