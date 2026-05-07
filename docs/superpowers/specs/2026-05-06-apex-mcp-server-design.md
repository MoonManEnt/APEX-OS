# APEX — MCP Server (Phase C, Part 2)

**Date:** 2026-05-06
**Status:** Approved for implementation
**Scope:** Phase C — agent-ready data and action surface

---

## Context

APEX exposes its CRE intelligence over an HTTP API. AI agents (Claude, Paperclip-orchestrated bots, future channel adapters for Telegram/WhatsApp/etc.) need a standard way to read live newsroom/account/draft state and propose actions on the operator's behalf — without rebuilding APEX-specific clients for every new agent.

This spec adds an MCP (Model Context Protocol) server inside `apps/api` that exposes ~14–16 tools and a small resource set across the existing APEX domains. Writes are gated by a proposal lifecycle so a human (or an explicitly enabled "Sentry mode") approves every mutation before it lands. The same registry serves a local stdio transport (Claude Desktop) and a remote HTTP/SSE transport (Paperclip and other hosted clients), so the agent surface is identical regardless of how the agent connects.

This phase deliberately ships on the existing stub `OperatorSession` — real auth lands as Phase C Part 4.

---

## Design Decisions

| Decision | Choice |
|---|---|
| Read/write surface | 13 read tools + 6 write (proposal-gated) tools + 4 lifecycle tools + 5 resources. Reads cover events, accounts, drafts, paperclip lanes/tasks, session context. Writes cover drafts, draft transitions, paperclip task create/status/comment. |
| Approval gate | Hybrid: every write returns a `proposal_id`; APEX UI surfaces pending proposals via WebSocket; channel agents (Paperclip/Telegram/etc.) approve via the `approve_proposal` MCP tool |
| Sentry mode | Per-tool flag, OFF by default; when ON, proposal is auto-approved at creation but the row is still recorded for audit |
| Transports | Local stdio + remote HTTPS/SSE, both first-class, sharing one registry |
| Auth (this phase) | Stub `get_operator_session` via headers; remote HTTP additionally requires `X-MCP-Agent-Id` header for proposal attribution |
| Multi-agent compatibility | MCP is the protocol; any compliant client (Claude, Paperclip, custom) plugs in identically |
| Channel adapters | Out of scope — Telegram/WhatsApp/etc. live in Paperclip's plugin layer, not in APEX |
| New API surface | One package `apps/api/app/mcp/`, one new entry point `apps/api/mcp_stdio.py`, one new route `/mcp/sse`, one new table `proposed_actions` |

---

## Architecture

A new `apps/api/app/mcp/` package owns the entire MCP surface: a single tool/resource registry, the proposal lifecycle, and the Sentry-mode scaffold. Two thin entry points consume the registry and speak the MCP protocol over their respective transports:

- **`apps/api/mcp_stdio.py`** — standalone Python script using the official `mcp` SDK. Claude Desktop spawns it as a subprocess; reads/writes JSON-RPC over stdin/stdout. Connects to the same Postgres APEX uses.
- **`/mcp/sse`** — FastAPI route mounted on the existing app. Agents that live elsewhere (Paperclip, hosted Claude, future channel adapters) connect over HTTPS Server-Sent Events. Same registry, same database session, same repositories.

Both entry points authenticate via the existing stub `get_operator_session` (header-based). Remote HTTP additionally requires an `X-MCP-Agent-Id` header so we can attribute proposals to "claude-via-paperclip" vs "telegram-bot-1" even before real identity exists.

Writes never mutate APEX directly. Every write tool inserts a row into a new `proposed_actions` table and returns `{ proposal_id, expires_at, summary }`. The existing WebSocket (`feed_manager`) broadcasts a new `proposal.created` message so the APEX UI surfaces pending approvals alongside live events. A separate `approve_proposal` / `reject_proposal` tool — callable from any transport, or from APEX UI — drives execution. Sentry mode is a per-tool config flag, OFF by default; when ON, the proposal is auto-approved and executed immediately, but the row still lands in the table for audit.

Multi-agent is free: MCP is a protocol, so any compliant client plugs in identically. Channel adapters (Telegram, WhatsApp) live upstream of MCP — they're Paperclip's job, not APEX's.

---

## Components

### Inside `apps/api/app/mcp/` (new package)

| Module | Responsibility |
|---|---|
| `registry.py` | Single source of truth: registers all tools and resources. Exposes `list_tools()`, `list_resources()`, `dispatch(tool_name, params)`. Both transports import from here. |
| `tools/events.py` | Read-only: `list_events`, `get_event`, `search_events_by_brand`. Wraps existing `repositories.events`. |
| `tools/accounts.py` | Read-only: `list_accounts`, `get_account`, `list_account_signals`. Wraps `repositories.properties`. |
| `tools/drafts.py` | Read: `list_drafts`, `get_draft`, `list_review_queue`. Write (proposal-gated): `propose_draft_create`, `propose_draft_edit`, `propose_draft_transition`. |
| `tools/paperclip.py` | Read: `list_paperclip_lanes`, `list_paperclip_tasks`, `get_paperclip_task`. Write (proposal-gated): `propose_paperclip_task_create`, `propose_paperclip_task_status`, `propose_paperclip_task_comment`. |
| `tools/proposals.py` | Lifecycle: `list_proposals`, `get_proposal`, `approve_proposal`, `reject_proposal`. |
| `tools/session.py` | Read: `get_session_context` — exposes current operator + permissions for agent reasoning. |
| `proposals.py` | Service layer — create/approve/reject/expire flow; calls `repositories.proposals` + executes the underlying repository action on approval; emits `proposal.created` and `proposal.resolved` WS messages. |
| `sentry.py` | `is_sentry_active(tool_name) -> bool`. Reads `APEX_MCP_SENTRY_TOOLS` env var (comma-separated tool names). Default: empty → always False. DB-backed config deferred to a later phase. |
| `resources.py` | URI schema `apex://events`, `apex://events/{id}`, `apex://accounts`, `apex://drafts/queue`, `apex://paperclip/lanes`. Read-only views for agents to subscribe to. |

### New top-level modules

| File | Responsibility |
|---|---|
| `apps/api/mcp_stdio.py` | Stdio entry point. Imports `registry`, wires it to the `mcp` SDK's `Server` class, starts the stdio loop. |
| `apps/api/app/repositories/proposals.py` | DB layer for `proposed_actions` table: insert, fetch, update status. |
| `apps/api/app/models/proposals.py` | Pydantic: `ProposedAction`, `ProposalCreate`, `ProposalDecision`, `ProposalStatus` enum. |
| `apps/api/migrations/<n>_create_proposed_actions.sql` | Schema migration. |

### Existing files modified

- `apps/api/app/main.py` — mount `/mcp/sse` route from new MCP HTTP transport adapter.
- `apps/api/app/services/feed.py` — add `proposal.created` and `proposal.resolved` message types (constants + docs).
- `apps/api/pyproject.toml` — add `mcp` SDK dependency.
- `apps/web/app/page.tsx` — surface a small "Pending proposals" indicator wired to the existing WebSocket.

Each module under `tools/` is small and focused (one APEX domain per file), so the registry stays a flat dispatch table and individual tools stay independently testable.

---

## Data Flow

### Read tool flow (no approval needed)

```
agent → MCP transport (stdio or SSE) → registry.dispatch('list_events', params)
  → tools/events.list_events(session, params)
  → repositories.events.list_events(...)  [reuses existing code]
  → response → MCP transport → agent
```

### Write tool flow (proposal-gated)

```
agent → MCP → registry.dispatch('propose_draft_edit', params)
  → tools/drafts.propose_draft_edit(session, params)
  → proposals.create_proposal(
       agent_id=session.agent_id,           # X-MCP-Agent-Id header
       operator_id=session.operator_id,     # stub OperatorSession
       tool_name='draft_edit',
       payload=params,
       summary=human-readable snippet,
       expires_at=now() + 30min,
     )
  → INSERT proposed_actions (status='pending')
  → feed_manager.broadcast({type:'proposal.created', proposal_id, summary, agent_label})
  → response: { proposal_id, expires_at, summary }  → agent
```

### Approval flow — three entry points, one execution path

```
Path A — APEX UI: operator clicks "Approve" on the WS-pushed banner
  → POST /proposals/{id}/approve  (existing-style HTTP route)

Path B — Channel agent: Paperclip/Telegram/WhatsApp routes the cue
  → MCP tool: approve_proposal(proposal_id, approver_note?)

Path C — Sentry mode: proposal was auto-approved at creation time
  (no human in the loop, but row still recorded)

All three converge on:
  → proposals.approve(proposal_id, approver_id, source='ui'|'mcp'|'sentry')
  → SELECT proposed_actions WHERE id = ? AND status = 'pending'
     [reject if not found, expired, or already resolved]
  → BEGIN TX
     → UPDATE proposed_actions SET status='approved', approved_by, approved_at, approval_source
     → execute(payload)  → calls existing repository action
        e.g. repositories.actions.persist_action_draft(...)
     → record_audit(actor=approver, action='proposal_approved', ...)
     → UPDATE proposed_actions SET executed_at, execution_result
  → COMMIT
  → feed_manager.broadcast({type:'proposal.resolved', proposal_id, status:'approved'})
  → response → caller
```

### Rejection, expiry, and Sentry shortcuts

- **Rejection**: same shape as approval but skips the execute step; status → `rejected`, reason recorded, WS broadcast `proposal.resolved` with `status:'rejected'`.
- **Expiry sweep**: lazy on-read — every call to `approve_proposal`, `reject_proposal`, `get_proposal`, and `list_proposals` first updates any pending row past its `expires_at` to `status='expired'` and emits a `proposal.resolved` WS broadcast for each. No background worker needed in this phase.
- **Sentry mode short-circuit**: when `sentry.is_sentry_active(tool_name)` returns True, `create_proposal` immediately calls `proposals.approve(..., source='sentry')` and returns the execution result instead of `proposal_id`. The proposal row exists either way — the only difference is whether a human gates it.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Tool called with unknown name | MCP protocol-level `MethodNotFound` error returned by the SDK. |
| Tool called with invalid params | Pydantic validation in the tool function raises; caught by registry, returned as MCP `InvalidParams` with field-level detail. |
| Read tool: repository raises (DB down, etc.) | Wrapped as MCP tool error with `internal_error` code; full traceback logged server-side; agent sees a generic message. |
| Write tool: proposal insert fails | Transaction rolled back; MCP tool returns `internal_error`; no WS broadcast; agent can retry. |
| `approve_proposal(id)` — proposal not found | Tool returns `{ error: 'not_found', proposal_id }`; HTTP 404 on the route variant. |
| `approve_proposal(id)` — already resolved (approved/rejected/expired) | Tool returns `{ error: 'already_resolved', current_status }`; HTTP 409 on the route. Idempotent: re-approving an already-approved proposal returns success-shaped response with the original execution result. |
| `approve_proposal(id)` — past `expires_at` | Lazy-mark as `expired` first, then return `{ error: 'expired', expired_at }`; HTTP 410. |
| `approve_proposal(id)` — execute step fails mid-transaction | Whole tx rolls back: proposal stays `pending`, no audit row, WS broadcasts nothing. Returns `internal_error` with a correlation ID. Operator can retry approval; if it keeps failing, they reject with reason. |
| Stdio transport: SDK protocol error | Logged to stderr; subprocess exits cleanly so Claude Desktop can restart it. |
| HTTP/SSE transport: connection drops mid-tool | Tool runs to completion server-side (proposal still recorded); agent reconnects and can poll `get_proposal(id)` if it has the ID, or `list_proposals(agent_id=self)` to find recent activity. |
| HTTP/SSE: missing `X-MCP-Agent-Id` header | Reject with HTTP 401 + `{ detail: 'X-MCP-Agent-Id required for remote MCP transport' }`. Stdio transport bypasses this (local trusted process). |
| HTTP/SSE: rate limiting / concurrency | Out of scope for Phase C Part 2. Add in Phase D when remote transport gets battle-tested. |
| Sentry mode: execute fails | Same as approval-execute failure — tx rollback, proposal stays `pending`, WS broadcast suppressed; agent gets `internal_error`. Sentry doesn't paper over real failures. |
| Bad `since` / pagination params on read tools | Reuses existing route validation (existing routes return 400 for bad timestamps). |
| Resource subscription dropped | SSE client reconnects; resources are read-on-demand, no replay needed. |

**Idempotency for writes**: write tools accept an optional `request_id` (UUID from the agent). If a proposal with the same `agent_id + request_id` already exists, return that `proposal_id` rather than creating a duplicate. Prevents retry storms when an agent loses its connection mid-call.

**Observability**: every tool call writes an `audit` row with `actor=agent_label`, `action=tool:<tool_name>`, `metadata={params, result_summary, proposal_id?}`. This is the single canonical log — nothing extra to thread.

---

## Schema — `proposed_actions` table

```sql
create table proposed_actions (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,               -- X-MCP-Agent-Id ('claude-desktop', 'paperclip:co-1', 'telegram:user-42')
  agent_label text,                     -- human-readable display name
  operator_id text not null,            -- stub OperatorSession.operator_id at proposal time
  tool_name text not null,              -- e.g. 'propose_draft_edit'
  payload jsonb not null,               -- tool params (the action to execute on approval)
  summary text not null,                -- human-readable, shown in approval UI / channel cue
  status text not null default 'pending'   -- pending | approved | rejected | expired
    check (status in ('pending','approved','rejected','expired')),
  approval_source text                  -- ui | mcp | sentry  (null while pending)
    check (approval_source in ('ui','mcp','sentry')),
  approved_by text,                     -- operator_id of approver
  approver_note text,
  rejection_reason text,
  request_id uuid,                      -- agent-provided idempotency key
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  executed_at timestamptz,
  execution_result jsonb,               -- result of the underlying repository call
  unique (agent_id, request_id)         -- enforces idempotency
);

create index proposed_actions_status_created_at_idx on proposed_actions (status, created_at desc);
create index proposed_actions_operator_id_idx on proposed_actions (operator_id);
```

---

## API Surface — new routes on FastAPI

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/mcp/sse` | MCP SSE handshake + tool dispatch (remote transport). Requires `X-MCP-Agent-Id`. |
| `GET` | `/proposals` | List pending/recent proposals (for APEX UI). Existing `OperatorSession` auth. |
| `GET` | `/proposals/{id}` | Single proposal detail. |
| `POST` | `/proposals/{id}/approve` | APEX UI approval path (Path A from Data Flow). |
| `POST` | `/proposals/{id}/reject` | APEX UI rejection path. |

The MCP tools `approve_proposal` / `reject_proposal` and these HTTP routes share the same service-layer function (`proposals.approve` / `proposals.reject`), so the three approval paths converge.

---

## Tool & Resource Catalog (this phase)

**Read tools (8):**
- `list_events(brand?, market?, since?, limit?)`
- `get_event(event_id)`
- `search_events_by_brand(brand, limit?)`
- `list_accounts(brand?, search?, sort?)`
- `get_account(account_id)`
- `list_account_signals(account_id)`
- `list_drafts(status?, event_id?)`
- `get_draft(event_id, draft_type)`
- `list_review_queue()`
- `list_paperclip_lanes()`
- `list_paperclip_tasks(lane?, status?)`
- `get_paperclip_task(task_id)`
- `get_session_context()`

**Write tools (gated, 6):**
- `propose_draft_create(event_id, draft_type, content, request_id?)`
- `propose_draft_edit(event_id, draft_type, content, request_id?)`
- `propose_draft_transition(event_id, draft_type, next_status, request_id?)`
- `propose_paperclip_task_create(lane, title, description?, request_id?)`
- `propose_paperclip_task_status(task_id, status, request_id?)`
- `propose_paperclip_task_comment(task_id, body, request_id?)`

**Lifecycle tools (4):**
- `list_proposals(status?, agent_id?, limit?)`
- `get_proposal(proposal_id)`
- `approve_proposal(proposal_id, approver_note?)`
- `reject_proposal(proposal_id, reason)`

**Resources (5):**
- `apex://events` — newsroom feed
- `apex://events/{id}` — event detail
- `apex://accounts` — accounts list
- `apex://drafts/queue` — pending review queue
- `apex://paperclip/lanes` — paperclip lane summary

Total: 13 read tools + 6 write (proposal-gated) tools + 4 lifecycle tools + 5 resources.

---

## Testing

### Backend unit tests (`apps/api/tests/test_mcp_*.py`)

| Test file | Coverage |
|---|---|
| `test_mcp_registry.py` | Registry registers all expected tools; `dispatch()` routes to the right tool function; unknown tool name raises the expected error type. |
| `test_mcp_proposals.py` | `create_proposal` inserts row + emits WS broadcast; `approve` happy path executes payload + writes audit; `approve` on non-existent / already-resolved / expired all return the documented errors; idempotency: same `agent_id + request_id` returns existing `proposal_id`; rejection records reason and skips execute. |
| `test_mcp_sentry.py` | When sentry flag is OFF (default), write tool returns `proposal_id`; when ON, write tool auto-approves and returns execution result; proposal row exists in both cases for audit. |
| `test_mcp_tools_drafts.py` | `propose_draft_edit` creates proposal with the right payload shape; on approval, executes via existing `persist_action_draft` repository (with mock to verify call args). |
| `test_mcp_tools_paperclip.py` | Same shape for paperclip task create/status/comment proposals. |
| `test_mcp_read_tools.py` | All read tools return shapes matching their MCP schema; brand/since/search filters pass through correctly. |

### HTTP transport integration (`apps/api/tests/test_mcp_http.py`)

- `POST /mcp/sse` initial handshake returns the SDK-defined session establishment response.
- Missing `X-MCP-Agent-Id` returns 401.
- Tool list call returns the same set of tools as the registry.
- Full happy-path: connect → list_tools → propose_draft_edit → 200 with `proposal_id` → `approve_proposal` → see audit row + executed draft.

### Stdio transport smoke test (`apps/api/tests/test_mcp_stdio.py`)

- Spawn `mcp_stdio.py` as a subprocess. Send a JSON-RPC `tools/list` over stdin, assert response on stdout matches the registry. (One test — full stdio testing happens in manual Claude Desktop verification.)

### Manual integration tests

1. **Claude Desktop end-to-end** — Add APEX MCP to Claude Desktop config (`mcp_stdio.py` as command). Open Claude. Ask "What's in my newsroom?" → Claude calls `list_events` → returns recent items. Ask "Draft an outreach for event X" → Claude calls `propose_draft_create` → APEX UI shows pending proposal banner via WS → click approve → draft appears in review queue.
2. **Paperclip integration probe** — Add APEX as a remote MCP server to a Paperclip company. Run a heartbeat that calls `list_review_queue` → confirm Paperclip sees pending drafts.
3. **Approval-from-channel simulation** — `curl` the SSE endpoint as if from a Telegram bot: `propose_paperclip_task_create` → receive `proposal_id` → `approve_proposal(id)` from a different curl session → confirm task created + audit logged with `approval_source='mcp'`.
4. **Sentry mode flip** — Enable sentry for `propose_paperclip_task_comment` only. Call it via stdio. Confirm comment lands immediately, proposal row exists with `approval_source='sentry'`, and `propose_draft_edit` (still gated) still queues for human approval.
5. **Expiry sweep** — Create a proposal with 30s expiry. Wait. Confirm `approve_proposal(id)` returns `expired` and the row is marked.

---

## Files

| File | Action |
|---|---|
| `apps/api/app/mcp/__init__.py` | Create |
| `apps/api/app/mcp/registry.py` | Create — tool/resource registry |
| `apps/api/app/mcp/proposals.py` | Create — proposal lifecycle service |
| `apps/api/app/mcp/sentry.py` | Create — Sentry-mode flag scaffold |
| `apps/api/app/mcp/resources.py` | Create — `apex://` URI schema |
| `apps/api/app/mcp/tools/events.py` | Create — read tools |
| `apps/api/app/mcp/tools/accounts.py` | Create — read tools |
| `apps/api/app/mcp/tools/drafts.py` | Create — read + propose tools |
| `apps/api/app/mcp/tools/paperclip.py` | Create — read + propose tools |
| `apps/api/app/mcp/tools/proposals.py` | Create — lifecycle tools |
| `apps/api/app/mcp/tools/session.py` | Create — read tool |
| `apps/api/app/mcp/transport_http.py` | Create — `/mcp/sse` route adapter |
| `apps/api/mcp_stdio.py` | Create — stdio entry point |
| `apps/api/app/repositories/proposals.py` | Create — DB layer |
| `apps/api/app/models/proposals.py` | Create — Pydantic models |
| `apps/api/migrations/<n>_create_proposed_actions.sql` | Create — schema migration |
| `apps/api/app/main.py` | Modify — mount `/mcp/sse`, add `/proposals/*` routes |
| `apps/api/app/services/feed.py` | Modify — add `proposal.created` / `proposal.resolved` message constants |
| `apps/api/pyproject.toml` | Modify — add `mcp` SDK dependency |
| `apps/web/app/page.tsx` | Modify — surface a small "Pending proposals" indicator |
| `apps/api/tests/test_mcp_registry.py` | Create |
| `apps/api/tests/test_mcp_proposals.py` | Create |
| `apps/api/tests/test_mcp_sentry.py` | Create |
| `apps/api/tests/test_mcp_tools_drafts.py` | Create |
| `apps/api/tests/test_mcp_tools_paperclip.py` | Create |
| `apps/api/tests/test_mcp_read_tools.py` | Create |
| `apps/api/tests/test_mcp_http.py` | Create |
| `apps/api/tests/test_mcp_stdio.py` | Create |
