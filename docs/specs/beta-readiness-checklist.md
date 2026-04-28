# APEX Beta Readiness Checklist

## Beta goal
Ship a credible newsroom slice that a small operator group can use end to end:

- ingest public CRE signals
- classify and persist them
- review the live feed in web
- generate/edit action drafts
- watch live feed refresh through websocket updates

## Must-pass checks

### Platform bring-up
- `docker compose up -d` succeeds
- API boots locally without manual patching
- Web boots locally without manual patching
- Database init works on a fresh machine

### API
- `GET /health` returns ok
- `GET /events` returns persisted feed items
- `GET /events/{id}` returns event detail
- `POST /bootstrap/sample-event` persists and broadcasts a seed event
- `POST /ingest/google-news-cre` ingests real source items
- `POST /actions/draft` returns a usable operator draft
- `PUT /actions/draft/{event_id}` persists operator edits
- `GET /actions/draft/{event_id}/history` returns version history
- `/ws` accepts live connections and broadcasts `feed.seeded` / `feed.ingested`

### Web newsroom
- build passes in production mode
- top feed renders with or without API data
- filters preserve the rest of the operator context
- action rail loads a draft for the selected event
- operator edits save successfully
- websocket connection refreshes the newsroom when new events arrive
- draft status badges reflect edited / approved / ready-to-send states

## Remaining controlled-beta cautions
- property/account linkage still leans on fallback resolution in important cases
- real auth and operator identity are still scaffold-level
- stronger action-draft prompt tuning and guardrails still matter
- classification quality depends heavily on fallback behavior when Anthropic is not configured
- broader operator feedback is still needed before widening the beta

## Suggested beta script
1. Start infra and initialize the database.
2. Boot the API and web app.
3. Run `pnpm healthcheck`.
4. Run `pnpm beta:validate`.
5. Confirm the newsroom updates and shows new items.
6. Open an event, edit the draft, save it, and confirm history.
7. Mark one draft approved and one ready to send through valid transitions.
8. Capture feedback from the first operator cohort before expanding scope.
