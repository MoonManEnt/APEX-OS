# @apex/config — Shared Configuration Package

Environment contracts, company/brand constants, queue names, and service URLs.

## Ownership

- Environment variable contracts (validated at startup)
- Company and brand constants (5 Gore brands)
- Queue/topic names: `ingestion.fetch`, `classification.run`, `feed.publish`, `action.generate`
- Service URLs for inter-service communication

## TODOs

- [ ] TODO(WS-1): Create `brands.ts` with 5 Gore brand constants and IDs
- [ ] TODO(WS-1): Create `queues.ts` exporting queue name constants
- [ ] TODO(WS-1): Create `env.ts` with Zod-validated environment schema
- [ ] TODO(CONFIG): Add service URL constants for local, staging, prod
