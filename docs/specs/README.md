# docs/specs — Implementation-Facing Specifications

Engineering specs for each workstream. Add a spec file per slice before implementation begins.

## Workstreams

| WS | Name | Slice Goal |
|---|---|---|
| WS-1 | Data Foundation | Event schema, ingestion worker shell, classifier shell, seed brands |
| WS-2 | Core Intelligence API | `GET /events`, filters, health, WebSocket push stub |
| WS-3 | Newsroom Shell | Three-column layout, feed list, filter sidebar, action placeholder |

## Pipeline: ingest → classify → persist → serve feed

```
Source fetch (ingestion.fetch)
  → raw_scrape stored
  → classification.run queued
  → classified event persisted
  → feed.publish queued
  → WebSocket push to UI
```

## TODOs

- [ ] TODO(SPEC): Add WS-1-data-foundation.md with schema DDL and worker interface
- [ ] TODO(SPEC): Add WS-2-api.md with OpenAPI contract for /events endpoints
- [ ] TODO(SPEC): Add WS-3-newsroom.md with layout wireframe notes and component tree
