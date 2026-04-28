# APEX Internal Beta Launch Checklist

## Purpose

Use this before opening APEX to any controlled beta operator cohort.

Owner standard: if a check is not true, do not wave it through as “probably fine.”

## 1. Environment
- [ ] Docker services start cleanly
- [ ] API virtualenv exists
- [ ] API dependencies install cleanly
- [ ] database initialization succeeds
- [ ] web dependencies install cleanly
- [ ] required env values are present

## 2. Runtime bring-up
- [ ] `pnpm dev:api` boots without manual patching
- [ ] `pnpm dev:web` boots without manual patching
- [ ] optional preview tunnel works when needed

## 3. Validation gates
- [ ] `pnpm healthcheck` passes
- [ ] `pnpm beta:validate` passes
- [ ] at least one live ingest query returns results
- [ ] repeat ingest does not create obvious duplicate event rows

## 4. Product workflow checks
- [ ] newsroom feed renders
- [ ] selected signal rail loads
- [ ] action draft rail loads
- [ ] draft edit saves successfully
- [ ] assigned reviewer is required for review submission
- [ ] invalid workflow jumps are denied
- [ ] draft history reflects saved versions
- [ ] review queue reflects latest relevant draft states
- [ ] audit entries exist for major workflow transitions

## 5. Operator readiness
- [ ] operator instructions are shared
- [ ] reviewer/owner roles are clear
- [ ] operator cohort is intentionally small
- [ ] beta feedback path is defined
- [ ] one person owns daily beta hygiene review

## 6. Daily beta hygiene
- [ ] check ingest quality
- [ ] check queue quality
- [ ] check for duplicate/noisy signals
- [ ] check draft quality complaints
- [ ] log major issues before the next session

## 7. Do not overclaim
Do not describe this beta as:
- production hardened
- fully secure
- auth complete
- enterprise ready

Describe it as:
- controlled live beta
- monitored operator pilot
- newsroom and action workflow beta

## 8. Launch call
Ship the controlled beta only when:
- validation passes
- workflow is operational
- operator cohort is defined
- owner is ready to monitor and collect feedback
