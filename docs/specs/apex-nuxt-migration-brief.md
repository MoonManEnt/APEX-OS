# APEX Frontend Recommendation — Nuxt + Nuxt UI

## Bottom line

**Current decision: Option 1.**

Stay on the current Next stack through beta hardening, then revisit a deliberate Nuxt + Nuxt UI replatform from a stronger position.

Nuxt is likely the **better long-term frontend home** for APEX.

Not because Next is unusable.
Because APEX is evolving into a **unified operating environment** with product-shell depth, installability, governed flows, and system-level UI behavior — and Nuxt + Nuxt UI appears better aligned to that destination.

## Why this recommendation is serious

Based on current Nuxt positioning and Nuxt UI documentation:

- **Nuxt** presents itself as a full-stack Vue framework with SSR, file-based routing, auto-imports, API routes, Vite, and Nitro.
- **Nuxt UI** provides 125+ accessible production-ready components, SSR compatibility, Tailwind-based theming, TypeScript support, dark mode, i18n support, and a Figma kit.

For APEX specifically, that matters because the product is not just a marketing site or simple dashboard. It is becoming:

- a command center
- a newsroom
- a governed review system
- a relationship/mind-map surface
- a proposal/sentry operating shell
- an installable app

That kind of product benefits from a cleaner application system and stronger component discipline.

## Why Nuxt may be better for APEX

### 1. Better fit for an app-shell product
APEX wants to feel like an operating system, not a page tree. Nuxt is a strong fit for cohesive application-shell architecture.

### 2. Nuxt UI is closer to the target interaction language
Nuxt UI gives a more credible base for:
- dense enterprise surfaces
- consistent inputs, drawers, overlays, tables, command patterns
- theming discipline
- accessibility discipline

### 3. Cleaner long-term frontend maintainability
The current Next build is working, but much of the shell is living in a single large page implementation. Nuxt replatforming would be a chance to rebuild the frontend as durable product infrastructure rather than continued shell accumulation.

### 4. Better future packaging story
Nuxt does not itself solve App Store packaging, but a Nuxt/Vue frontend can still be packaged through Capacitor/Tauri paths. That keeps the installable-app roadmap alive without locking us to the current shell architecture.

## Why not switch immediately this second

A migration right now has a real cost.

We have already built meaningful product progress in the current APEX implementation:
- shell coverage
- Paperclip tandem spine
- audit spine
- operator identity/governance scaffolding
- approval queue/workflow
- runtime stabilization
- linkage truth surfacing
- installable PWA foundation

Switching now means some of that frontend work becomes transitional rather than durable.

## Decision framing

### Option A — Finish beta hardening on Next, then migrate frontend to Nuxt
Best if the immediate goal is:
- usable beta sooner
- preserve current momentum
- reduce near-term frontend reset cost

### Option B — Replatform now to Nuxt + Nuxt UI
Best if the immediate goal is:
- long-term frontend correctness
- stronger design system foundation
- avoiding further investment in a frontend you already suspect is not the final home

## My recommendation

**Preferred path: Option A with an intentional Nuxt replatform plan.**

That means:
1. finish the current beta hardening arc on the existing stack
2. freeze frontend scope creep
3. write the Nuxt target architecture
4. rebuild the frontend shell in Nuxt + Nuxt UI as a deliberate next phase

## Conditions that would justify switching now

Switch now if any of these are true:
- you already know the current frontend should not survive into real product stage
- visual/system polish is now the main bottleneck, not backend truth
- you want the shell rebuilt as maintainable UI infrastructure before more logic is layered in
- you are comfortable paying a short-term velocity hit for a cleaner long-term foundation

## Proposed Nuxt replatform scope

### Phase 1
- create Nuxt app shell
- implement global navigation and brand context
- port command center, newsroom, account workspace
- port audit, Paperclip, review queue rails
- wire API consumption against existing FastAPI backend

### Phase 2
- port proposals, sentry, spatial map, mind map, integrations
- convert large current page logic into composables + isolated components
- introduce design tokens/theme structure through Nuxt UI

### Phase 3
- package installability layers
- PWA refinement
- Capacitor/Tauri packaging path if desired

## Architectural stance

If the question is:
- **“Can Next finish this beta?”** → yes.
- **“Is Next obviously the best long-term frontend home for APEX?”** → no.
- **“Is Nuxt + Nuxt UI a credible better long-term fit?”** → yes, likely.

## Recommendation in one line

**Keep the current build moving just long enough to finish the beta hardening spine, but treat Nuxt + Nuxt UI as the probable long-term frontend destination for APEX.**
