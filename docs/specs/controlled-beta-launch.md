# APEX Controlled Beta Launch Runbook

## Launch stance

APEX is ready for a **controlled live beta**:
- small trusted operator group
- known workflows
- monitored usage
- no broad production claims

This is the right label when the platform is operationally credible but still tightening auth, linkage depth, and edge-case polish.

## Preflight

### Infrastructure
- `docker compose up -d`
- API virtualenv exists and dependencies install cleanly
- database initialized with `python -m app.init_db`
- web dependencies installed with `pnpm install`

### Runtime bring-up
- `pnpm dev:api`
- `pnpm dev:web`
- optional: `pnpm preview:web`

### Validation gates
Run both before inviting operators:

```bash
pnpm healthcheck
pnpm beta:validate
```

`pnpm healthcheck` proves the core draft workflow.

`pnpm beta:validate` extends that with:
- live Google News ingest
- repeat-ingest dedupe validation
- post-ingest review queue availability

## Operator beta checklist

Before each operator session:
1. Confirm API is healthy.
2. Confirm web is reachable.
3. Run `pnpm beta:validate`.
4. Open the newsroom.
5. Confirm at least one fresh signal is visible.
6. Confirm a selected signal can generate a draft.
7. Confirm the draft can be saved into review.
8. Confirm the approval queue reflects the latest state.

## Recommended beta script

### 1. Seed + ingest
- seed one sample event
- ingest one live Dallas CRE query
- confirm the feed shows both seed and live-source items

### 2. Triage
- open one live signal
- verify selected signal details load
- verify degraded API states are visible if anything fails

### 3. Draft workflow
- generate a draft
- edit the draft
- assign a reviewer
- submit for review
- approve a draft only from valid prior state
- optionally move approved draft to ready-to-send

### 4. Review system truth
- confirm draft history shows version progression
- confirm review queue shows latest version per draft lane
- confirm audit entries exist for approval transitions and denied invalid moves

## What is strong enough now
- local bring-up wrappers
- newsroom shell
- seed ingest
- live Google News ingest
- repeat-ingest dedupe behavior
- governed draft state transitions
- versioned draft history
- review queue latest-version filtering
- repeatable beta validation script

## What still requires operator caution
- auth is scaffold-level, not production-grade
- property/account linkage still contains fallback logic
- classification quality is fallback-heavy when Anthropic is not configured
- approval workflow has stronger governance now, but still needs real user feedback
- beta should stay small until real usage feedback hardens the rails

## Launch recommendation

Use APEX with:
- a small internal or founder-adjacent operator cohort
- explicit feedback collection after each session
- one owner responsible for reviewing ingest quality, draft quality, and queue hygiene daily

Supporting docs:
- `docs/specs/operator-beta-instructions.md`
- `docs/specs/internal-beta-launch-checklist.md`

Do **not** present this as finished production software yet.
Present it as a **controlled live beta of the APEX newsroom operating shell**.
