# APEX Nuxt Scaffold

## Purpose

This is the parallel Nuxt + Nuxt UI frontend scaffold for APEX.

It exists to evaluate the likely long-term frontend direction **without destroying the current Next-based beta track**.

## Location

- `apps/web-nuxt`

## Current state

The scaffold currently provides:
- Nuxt app bootstrapped in the monorepo
- Nuxt UI installed and configured
- Tailwind + Nuxt UI CSS wiring
- runtime config for the existing FastAPI backend
- first connected page that fetches:
  - `/health`
  - `/events`
- first operating-shell layout pass:
  - navigation shell
  - newsroom rail
  - migration posture rail

## Run commands

From repo root:

```bash
pnpm dev:web-nuxt
pnpm build:web-nuxt
pnpm type-check:web-nuxt
```

Default port:
- `3001`

Expected backend:
- `NUXT_PUBLIC_APEX_API_BASE_URL=http://127.0.0.1:8000`

## Why this matters

This scaffold proves four things:
1. Nuxt can coexist with the current APEX monorepo
2. Nuxt UI can support the APEX shell direction
3. existing FastAPI APIs can be reused without backend rework
4. replatforming can happen in a controlled, parallel way

## Recommended next port order

1. global shell + brand context
2. newsroom + selected signal rail
3. account workspace
4. audit / Paperclip / review queue rails
5. proposals / sentry / spatial / mind map surfaces

## Strategic note

The current Next app remains the active beta track.
The Nuxt scaffold is the likely long-term frontend migration path if the replatform decision holds.
