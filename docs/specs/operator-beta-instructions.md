# APEX Operator Beta Instructions

## What APEX is in this beta

APEX is a **controlled newsroom operating shell** for commercial signal intake, triage, and draft action support.

In this beta, you are not expected to trust every output blindly.
You are expected to:
- review signals
- validate context
- edit drafts
- move work through review deliberately
- report anything that feels broken, misleading, or confusing

## What you can use it for right now

- review live CRE signals
- open a selected signal and inspect the context rail
- generate a first-pass action draft
- edit the draft for real usage
- assign a reviewer
- submit for review
- approve a draft from the correct workflow state
- move an approved draft to ready-to-send

## What to expect

### Strong enough in beta
- live feed population
- repeated ingest without obvious feed duplication
- draft generation
- draft editing and review flow
- draft history visibility
- approval queue visibility

### Still imperfect
- account/property linkage may be partial or fallback-based
- some classifications may be broad rather than precise
- brand recommendation may need operator correction
- auth/identity is still lightweight in this beta

## Recommended operator workflow

### 1. Start in the newsroom
- review the current feed
- prioritize high-signal items first
- select the signal that appears most commercially actionable

### 2. Validate the signal
Before acting on it, check:
- title
- summary
- source
- market
- event type
- linkage status

If the linkage or framing looks weak, do not over-trust the rail. Use operator judgment.

### 3. Generate and edit the draft
- open the action draft rail
- review the generated message carefully
- tighten the language
- remove generic claims
- correct any brand mismatch
- preserve commercial clarity

### 4. Submit for review properly
- assign a reviewer
- move the draft to **Awaiting review**
- do not skip workflow states

### 5. Approve deliberately
A draft should only move forward when:
- the signal is worth acting on
- the framing is commercially credible
- the brand match is correct
- the message reads like something a real operator would send

### 6. Mark ready-to-send only when truly ready
Use **Ready to send** only when the draft has already passed review and no meaningful edits remain.

## What to flag immediately

Report any of the following right away:
- duplicate feed items that appear to be the same event
- a selected signal failing to load details
- draft rail failing to load
- workflow state not updating correctly
- history missing versions you know you saved
- a draft entering the wrong queue state
- bad commercial logic or obviously wrong brand guidance

## Beta discipline

This beta is for truth-finding, not pretending.

If something is:
- confusing
- brittle
- misleading
- too generic
- commercially wrong

flag it.

The goal is not to “be nice to the beta.”
The goal is to make the product sharper.
