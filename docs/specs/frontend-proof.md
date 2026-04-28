# APEX Frontend Proof Step

## Goal

Render the seeded sample event in the newsroom shell.

## Preconditions

- Docker containers running (`postgres`, `redis`)
- API running on `http://127.0.0.1:8000`
- `POST /bootstrap/sample-event` returns 200
- `GET /events` returns at least one event

## Commands

From the repo root:

```bash
cd ~/.openclaw/workspace/apex_app
pnpm install
cp .env.example .env
cd apps/web
pnpm dev
```

## Verify

Open the local web URL printed by Next.js (typically `http://localhost:3000`).

You should see:
- APEX OS — Newsroom header
- one seeded event card
- title
- summary
- primary brand
- relevance score

## If the page is empty

1. verify the API still returns data:
```bash
curl http://127.0.0.1:8000/events
```

2. verify `.env` contains:
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```
