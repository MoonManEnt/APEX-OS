# WS-3 — Newsroom Shell

## Goal

Render the first live APEX newsroom surface against the API.

## Initial contract

The web shell should:
- fetch `GET /events`
- render a simple event list
- show title, summary, primary brand, relevance score
- keep the three-column future shape visible even if only one column is active now

## Immediate next tasks

1. fetch from `NEXT_PUBLIC_API_BASE_URL/events`
2. render loading/empty/error states
3. add placeholder left filter rail
4. add placeholder right action rail
5. later: attach WebSocket to `/ws`
