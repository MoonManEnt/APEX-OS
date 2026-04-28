# APEX Railway Backend Deploy

## Purpose

Deploy `apps/api` as the live backend for the Vercel-hosted APEX frontend.

## Why Railway

The API needs:
- Python runtime
- Postgres
- Redis
- environment variable management

Railway is the cleanest fast path for this current APEX beta stack.

## Deploy target

- Service root: `apps/api`
- Runtime: Dockerfile-based deploy
- Start command: handled by `apps/api/Dockerfile`

## What the Dockerfile does

The backend image now:
- uses Python 3.12
- installs the APEX API package
- runs `python -m app.init_db`
- starts `uvicorn` on Railway's assigned `PORT`

## Required Railway services

Create or attach:
- Postgres
- Redis
- API service from this repo

## Required backend env vars

Set these in Railway:

```bash
DATABASE_URL=<railway postgres connection string>
REDIS_URL=<railway redis connection string>
ANTHROPIC_API_KEY=<optional but strongly recommended>
OPENAI_API_KEY=<optional>
SESSION_SECRET=<strong secret>
DEFAULT_OPERATOR_NAME=Reginald
DEFAULT_OPERATOR_ROLE=principal_operator
```

## Deploy sequence

1. Create Railway project
2. Add Postgres service
3. Add Redis service
4. Add API service from GitHub repo `MoonManEnt/APEX-OS`
5. Set service root to `apps/api`
6. Confirm Railway detects and uses `apps/api/Dockerfile`
7. Add required env vars
8. Deploy
9. Confirm `/health` responds successfully

## After Railway gives you the API URL

Set these in the Vercel frontend project:

```bash
NEXT_PUBLIC_API_BASE_URL=https://<railway-api-domain>
NEXT_PUBLIC_WS_URL=wss://<railway-api-domain>/ws
```

Then redeploy the frontend.

## Final validation

After both sides are live:
1. run the frontend on Vercel
2. hit the Railway API `/health`
3. run the beta workflow manually
4. rerun validation logic against the deployed pair

## Important caution

The Dockerfile currently runs `python -m app.init_db` at container start.
That is acceptable for the current controlled beta phase because schema setup is lightweight.

As the platform matures, replace this with explicit migrations instead of startup init behavior.
