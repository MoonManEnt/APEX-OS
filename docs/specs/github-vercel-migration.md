# APEX GitHub + Vercel Migration Plan

## Bottom line

APEX can move to **GitHub + Vercel** now for the frontend layer.

But the full stack does **not** fit on Vercel as-is.

Reason:
- `apps/web` is a Next app and is a good Vercel fit
- `apps/api` is a FastAPI service with Postgres + Redis dependencies and should be deployed separately

So the right migration shape is:
1. move `apex_app` into its own Git repo
2. push that repo to GitHub
3. deploy `apps/web` to Vercel
4. deploy `apps/api` to a backend host such as Railway, Render, or Fly
5. point Vercel frontend env vars at the live API base URL

See also:
- `docs/specs/railway-backend-deploy.md`

## Current packaging issue

`apex_app` was living inside the larger OpenClaw workspace repository.
That is not clean enough for a direct GitHub/Vercel move.

A dedicated repo is the correct structure.

## Recommended target architecture

### GitHub
- one dedicated repo for `apex_app`
- branch protection later if needed
- Vercel connected directly to GitHub

### Vercel
- one Vercel project for `apps/web`
- root directory in Vercel: `apps/web`
- framework preset: Next.js

### Backend host
Use one of:
- Railway
- Render
- Fly.io

Backend service requirements:
- Python runtime
- Postgres connection
- Redis connection
- env support for API keys and session secret

## Required env vars

### Vercel frontend env
At minimum:

```bash
NEXT_PUBLIC_API_BASE_URL=https://<your-api-domain>
NEXT_PUBLIC_WS_URL=wss://<your-api-domain>/ws
```

### Backend env
At minimum:

```bash
DATABASE_URL=...
REDIS_URL=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
SESSION_SECRET=...
DEFAULT_OPERATOR_NAME=Reginald
DEFAULT_OPERATOR_ROLE=principal_operator
```

## GitHub move steps

From inside `apex_app`:

```bash
git init
git add .
git commit -m "Initial APEX beta candidate"
git branch -M main
git remote add origin <github-repo-url>
git push -u origin main
```

## Vercel project steps

1. Create new project in Vercel
2. Import the GitHub repo
3. Set **Root Directory** to `apps/web`
4. Set frontend env vars
5. Deploy

## Important limitation

Do **not** try to pretend the current FastAPI + Postgres + Redis backend is a native single-project Vercel deployment.
That will waste time.

The honest move is:
- Vercel for frontend
- separate host for API

## Recommendation

Proceed in this order:
1. GitHub repo creation
2. Vercel frontend project creation
3. backend host selection + API deployment
4. final env wiring
5. `pnpm beta:validate` against the live deployed API/frontend pair

Current status:
- GitHub repo created and pushed
- Vercel frontend project created and linked
- Railway backend deploy assets prepared in-repo
