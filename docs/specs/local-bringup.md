# APEX Local Bring-Up

## Goal

Get the first APEX proof slice running locally:
1. Postgres + Redis up
2. schema initialized
3. API running
4. sample event seeded
5. newsroom shell renders the event

## Steps

### 1. Start local infra
```bash
cd apex_app
docker compose up -d
```

### 2. Create Python env + install API deps
```bash
cd apex_app/apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

### 3. Initialize DB schema + brand seeds
```bash
cd /Users/reginaldsmith/.openclaw/workspace/apex_app/apps/api
source .venv/bin/activate
python -m app.init_db
```

### 4. Run API
```bash
cd /Users/reginaldsmith/.openclaw/workspace/apex_app
pnpm dev:api
```

This wrapper keeps API startup pinned to port 8000 and fails loudly if something unmanaged is already holding the port.

### 5. Seed sample event
```bash
curl -X POST http://127.0.0.1:8000/bootstrap/sample-event
```

### 6. Run web app
```bash
cd /Users/reginaldsmith/.openclaw/workspace/apex_app
pnpm install
pnpm dev:web
```

This wrapper keeps web startup pinned to port 3000 and clears stale managed Next listeners before boot.

### 7. Open preview tunnel
```bash
cd /Users/reginaldsmith/.openclaw/workspace/apex_app
pnpm preview:web
```

This wrapper verifies the local web app is really responding before it opens the SSH-based preview tunnel.

### 8. Run runtime healthcheck
```bash
cd /Users/reginaldsmith/.openclaw/workspace/apex_app
APEX_PREVIEW_URL=https://d59ab35d26c783.lhr.life pnpm healthcheck
```

This verifies API health, web route response, WebSocket endpoint reachability, and the draft workflow spine.

### 9. Run controlled-beta validation
```bash
cd /Users/reginaldsmith/.openclaw/workspace/apex_app
pnpm beta:validate
```

This extends the healthcheck with live Google News ingest, repeat-ingest dedupe validation, and review queue verification.

Then open the web app and verify the sample event appears.

## Proof condition

The proof slice is successful when:
- POST `/bootstrap/sample-event` returns an event id
- GET `/events` returns at least one row
- the newsroom shell renders the event title, summary, brand, and score
