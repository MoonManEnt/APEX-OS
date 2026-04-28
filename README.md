# APEX OS — Monorepo Scaffold

Intelligence platform for the VPG newsroom. First production slice: **ingest → classify → persist → serve feed**

## Structure

```
apex_app/
  apps/
    web/        # Next.js newsroom UI
    api/        # FastAPI service + ingestion/classification workers
  packages/
    db/         # schema, migrations, seed helpers
    config/     # shared env contracts / constants
    types/      # shared TS types from API contracts
  docs/
    specs/      # implementation-facing specs
```

## Local Bring-Up

See `docs/specs/local-bringup.md` for the full first-proof sequence.

```bash
# 1. Copy env
cp .env.example .env

# 2. Start infra
docker compose up -d

# 3. Prepare API once
cd apps/api && python3 -m venv .venv && source .venv/bin/activate && pip install -e . && python -m app.init_db

# 4. Start API from repo root (fixed 8000, stale-listener guard)
cd ../..
pnpm dev:api

# 5. Start web from repo root (fixed 3000, stale-listener guard)
pnpm dev:web

# 6. Open a stable preview tunnel once web is healthy
pnpm preview:web

# 7. Run the runtime healthcheck
APEX_PREVIEW_URL=https://d59ab35d26c783.lhr.life pnpm healthcheck

# 8. Run the controlled-beta validation pass
pnpm beta:validate
```

See these beta docs for launch and usage:
- `docs/specs/controlled-beta-launch.md`
- `docs/specs/operator-beta-instructions.md`
- `docs/specs/internal-beta-launch-checklist.md`
- `docs/specs/github-vercel-migration.md`

## Nuxt Replatform Track

A parallel Nuxt + Nuxt UI scaffold now exists at `apps/web-nuxt`.

```bash
pnpm dev:web-nuxt
pnpm build:web-nuxt
pnpm type-check:web-nuxt
```

See `docs/specs/apex-nuxt-scaffold.md` for the current scope and migration posture.

## Workstreams

- **WS-1** — Data Foundation: event/scrape/classification schema, seed brands, ingestion worker shell
- **WS-2** — Core Intelligence API: `GET /events`, filters, WebSocket stub
- **WS-3** — Newsroom Shell: three-column layout, feed list, filter sidebar

## Queue Contracts

| Queue | Purpose |
|---|---|
| `ingestion.fetch` | Trigger source fetch |
| `classification.run` | Classify raw scrape |
| `feed.publish` | Push classified event to feed |
| `action.generate` | Draft action from event |

## Engineering Guardrails

1. Property is the anchor object — no CRM-first drift
2. No autonomous outbound send
3. No CoStar-dependent assumptions in Phase 1
4. Core ingest/feed loop ships before premium integrations
