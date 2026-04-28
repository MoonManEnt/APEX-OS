# @apex/types — Shared TypeScript Types

Shared request/response types, event/feed DTOs, filter and badge types generated or curated from API contracts.

## Ownership

- `EventDTO` — classified event shape consumed by the feed
- `RawScrapeDTO` — raw ingestion payload
- `ClassificationDTO` — classification result shape
- `FeedFilterParams` — brand, market, event type, score range
- `ActionDraftDTO` — action draft shape
- `BadgeType` — event badge/severity enum

## TODOs

- [ ] TODO(WS-1): Define `EventDTO` from classification schema
- [ ] TODO(WS-2): Define `FeedFilterParams` aligned to GET /events query params
- [ ] TODO(WS-2): Define `WebSocketMessage` union type for feed push
- [ ] TODO(WS-3): Define `BadgeType` enum for newsroom UI rendering
