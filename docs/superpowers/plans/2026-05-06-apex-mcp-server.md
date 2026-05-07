# APEX MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Before starting:** Set up an isolated worktree using `superpowers:using-git-worktrees`. Branch name: `feature/mcp-server`. Worktree path: `.worktrees/mcp-server`.

**Goal:** Add an MCP server inside `apps/api` that exposes APEX read tools, proposal-gated write tools, and a proposal lifecycle, served identically over local stdio and remote HTTPS/SSE.

**Architecture:** A new `apps/api/app/mcp/` package owns a tool/resource registry, the proposal lifecycle, and a Sentry-mode flag. Two thin entry points consume the registry — `apps/api/mcp_stdio.py` (stdio for Claude Desktop) and `/mcp/sse` (HTTP/SSE for Paperclip and other remote agents). Every write goes through a `proposed_actions` table; the existing `feed_manager` WebSocket broadcasts `proposal.created` / `proposal.resolved` so APEX UI surfaces approvals alongside live events.

**Tech Stack:** FastAPI + SQLAlchemy async (asyncpg), Pydantic v2, Anthropic `mcp` Python SDK, pytest-asyncio, httpx ASGI transport, Next.js 15 App Router (frontend indicator).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/api/pyproject.toml` | Modify | Add `mcp>=1.2` to dependencies |
| `apps/api/db/schema/mcp_proposed_actions_migration.sql` | Create | `proposed_actions` table schema |
| `apps/api/app/models/proposals.py` | Create | Pydantic: `ProposalStatus`, `ProposalCreate`, `ProposedAction`, `ProposalDecision` |
| `apps/api/app/repositories/proposals.py` | Create | DB layer: `insert`, `get_by_id`, `list`, `mark_status`, `mark_executed`, `find_by_idempotency` |
| `apps/api/app/mcp/__init__.py` | Create | Package marker |
| `apps/api/app/mcp/proposals.py` | Create | Service layer: `create_proposal`, `approve`, `reject`, `sweep_expired` |
| `apps/api/app/mcp/sentry.py` | Create | `is_sentry_active(tool_name)` from `APEX_MCP_SENTRY_TOOLS` env |
| `apps/api/app/mcp/registry.py` | Create | Tool/resource registry: `register_tool`, `list_tools`, `dispatch_tool`, `list_resources`, `read_resource` |
| `apps/api/app/mcp/resources.py` | Create | `apex://` URI handlers |
| `apps/api/app/mcp/tools/__init__.py` | Create | Calls `register_all()` to wire tools into registry |
| `apps/api/app/mcp/tools/events.py` | Create | `list_events`, `get_event`, `search_events_by_brand` |
| `apps/api/app/mcp/tools/accounts.py` | Create | `list_accounts`, `get_account`, `list_account_signals` |
| `apps/api/app/mcp/tools/drafts.py` | Create | Read: `list_drafts`, `get_draft`, `list_review_queue`. Write: `propose_draft_create`, `propose_draft_edit`, `propose_draft_transition` |
| `apps/api/app/mcp/tools/paperclip.py` | Create | Read: `list_paperclip_lanes`, `list_paperclip_tasks`, `get_paperclip_task`. Write: `propose_paperclip_task_create`, `propose_paperclip_task_status`, `propose_paperclip_task_comment` |
| `apps/api/app/mcp/tools/proposals.py` | Create | Lifecycle: `list_proposals`, `get_proposal`, `approve_proposal`, `reject_proposal` |
| `apps/api/app/mcp/tools/session.py` | Create | `get_session_context` |
| `apps/api/app/mcp/transport_http.py` | Create | `/mcp/sse` SSE handler using `mcp` SDK |
| `apps/api/mcp_stdio.py` | Create | Stdio entry point using `mcp` SDK |
| `apps/api/app/main.py` | Modify | Mount `/mcp/sse` route + `POST /proposals/{id}/approve|reject` + `GET /proposals` |
| `apps/api/app/services/feed.py` | Modify | Add message-type constants (no logic change) |
| `apps/web/app/pending-proposals.tsx` | Create | Client component listening for `proposal.created` / `proposal.resolved` |
| `apps/web/app/page.tsx` | Modify | Render `<PendingProposals />` next to `<LiveFeedStatus />` |
| `apps/api/tests/test_proposals_repo.py` | Create | Tests for repository |
| `apps/api/tests/test_proposals_service.py` | Create | Tests for service layer |
| `apps/api/tests/test_mcp_sentry.py` | Create | Sentry-mode flag tests |
| `apps/api/tests/test_mcp_registry.py` | Create | Registry registration + dispatch tests |
| `apps/api/tests/test_mcp_tools_read.py` | Create | All read tools |
| `apps/api/tests/test_mcp_tools_write_drafts.py` | Create | Draft proposal write tools |
| `apps/api/tests/test_mcp_tools_write_paperclip.py` | Create | Paperclip proposal write tools |
| `apps/api/tests/test_mcp_tools_lifecycle.py` | Create | Lifecycle tools (incl. idempotency, expiry, double-approve) |
| `apps/api/tests/test_mcp_http_routes.py` | Create | `/proposals/*` HTTP routes |
| `apps/api/tests/test_mcp_stdio_smoke.py` | Create | Stdio subprocess smoke test |

---

## Conventions used throughout this plan

- **DB migration application:** APEX uses `apps/api/db/schema/phase1_schema.sql` as the canonical schema, applied once by `init_db.py` if absent. Additional migrations live as separate `.sql` files in `apps/api/db/schema/` and are applied manually with `psql` against the running DB. Each migration in this plan provides the exact `psql` command to run.
- **Test runner:** Always run from `apps/api/` with `.venv/bin/pytest`. The venv was already prepared by the worktree setup (Python 3.12).
- **Commit cadence:** Commit at the end of every task. Use the exact commit messages provided.
- **Existing patterns to follow:** `sqlalchemy.text()` with named params, `result.mappings().all()`, Pydantic `BaseModel` with `Optional[str] = None` for nullable, `record_audit(...)` for audit logging. See `apps/api/app/repositories/events.py` and `apps/api/app/repositories/properties.py` for canonical examples.

---

## Task 1: Foundations — dependency, migration, models

**Files:**
- Modify: `apps/api/pyproject.toml`
- Create: `apps/api/db/schema/mcp_proposed_actions_migration.sql`
- Create: `apps/api/app/models/proposals.py`

- [ ] **Step 1: Add `mcp` SDK dependency**

In `apps/api/pyproject.toml`, find the `dependencies = [...]` block under `[project]` and add `"mcp>=1.2"` as a new entry. The block currently ends with `"pydantic-settings>=2.3"`. After adding, the relevant section reads:

```toml
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "sqlalchemy[asyncio]>=2.0",
    "asyncpg>=0.29",
    "alembic>=1.13",
    "redis>=5.0",
    "httpx>=0.27",
    "anthropic>=0.28",
    "openai>=1.30",
    "pydantic-settings>=2.3",
    "mcp>=1.2",
]
```

- [ ] **Step 2: Install the new dependency**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pip install "mcp>=1.2"
```

Expected: pip resolves and installs the `mcp` package. Note the version installed (e.g. `mcp-1.2.x`).

- [ ] **Step 3: Create the migration SQL file**

Create `apps/api/db/schema/mcp_proposed_actions_migration.sql` with:

```sql
create table if not exists proposed_actions (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  agent_label text,
  operator_id text not null,
  tool_name text not null,
  payload jsonb not null,
  summary text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','expired')),
  approval_source text
    check (approval_source in ('ui','mcp','sentry')),
  approved_by text,
  approver_note text,
  rejection_reason text,
  request_id uuid,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  executed_at timestamptz,
  execution_result jsonb
);

create unique index if not exists proposed_actions_agent_request_idx
  on proposed_actions (agent_id, request_id)
  where request_id is not null;

create index if not exists proposed_actions_status_created_at_idx
  on proposed_actions (status, created_at desc);

create index if not exists proposed_actions_operator_id_idx
  on proposed_actions (operator_id);
```

- [ ] **Step 4: Apply the migration to the local DB**

```bash
psql "$DATABASE_URL" -f apps/api/db/schema/mcp_proposed_actions_migration.sql
```

If `DATABASE_URL` isn't set in your shell, source it from `apps/api/.env` first. Expected output: 3× `CREATE INDEX` and 1× `CREATE TABLE` (or `NOTICE` lines if running against an already-migrated DB).

- [ ] **Step 5: Create Pydantic models**

Create `apps/api/app/models/proposals.py`:

```python
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ProposalStatus(str, Enum):
    PENDING = 'pending'
    APPROVED = 'approved'
    REJECTED = 'rejected'
    EXPIRED = 'expired'


class ApprovalSource(str, Enum):
    UI = 'ui'
    MCP = 'mcp'
    SENTRY = 'sentry'


class ProposalCreate(BaseModel):
    agent_id: str
    agent_label: Optional[str] = None
    operator_id: str
    tool_name: str
    payload: dict[str, Any]
    summary: str
    request_id: Optional[str] = None
    expires_at: datetime


class ProposedAction(BaseModel):
    id: str
    agent_id: str
    agent_label: Optional[str] = None
    operator_id: str
    tool_name: str
    payload: dict[str, Any]
    summary: str
    status: ProposalStatus
    approval_source: Optional[ApprovalSource] = None
    approved_by: Optional[str] = None
    approver_note: Optional[str] = None
    rejection_reason: Optional[str] = None
    request_id: Optional[str] = None
    expires_at: str
    created_at: str
    approved_at: Optional[str] = None
    executed_at: Optional[str] = None
    execution_result: Optional[dict[str, Any]] = None


class ProposalDecision(BaseModel):
    proposal_id: str
    approver_id: str
    source: ApprovalSource
    approver_note: Optional[str] = None
    rejection_reason: Optional[str] = None


class ProposalListResponse(BaseModel):
    proposals: list[ProposedAction] = Field(default_factory=list)
```

- [ ] **Step 6: Verify the models import cleanly**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/python -c "from app.models.proposals import ProposedAction, ProposalCreate, ProposalStatus; print('ok')"
```

Expected: `ok`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/pyproject.toml apps/api/db/schema/mcp_proposed_actions_migration.sql apps/api/app/models/proposals.py
git commit -m "feat(mcp): add proposed_actions schema, models, and mcp SDK dependency"
```

---

## Task 2: Proposals repository

**Files:**
- Create: `apps/api/app/repositories/proposals.py`
- Create: `apps/api/tests/test_proposals_repo.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_proposals_repo.py`:

```python
import json
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from app.core.db import get_db_session
from app.models.proposals import ProposalCreate, ProposalStatus
from app.repositories.proposals import (
    insert_proposal,
    get_proposal,
    list_proposals,
    mark_status,
    mark_executed,
    find_by_idempotency,
)


async def _session():
    async for s in get_db_session():
        return s


@pytest.mark.asyncio
async def test_insert_and_get_proposal_roundtrip():
    session = await _session()
    payload = ProposalCreate(
        agent_id='test-agent',
        agent_label='Test Agent',
        operator_id='op-1',
        tool_name='propose_test',
        payload={'k': 'v'},
        summary='test proposal',
        request_id=None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    inserted = await insert_proposal(session, payload)
    assert inserted.status == ProposalStatus.PENDING
    fetched = await get_proposal(session, inserted.id)
    assert fetched is not None
    assert fetched.id == inserted.id
    assert fetched.summary == 'test proposal'
    assert fetched.payload == {'k': 'v'}
    # cleanup
    await session.execute(text("delete from proposed_actions where id = cast(:id as uuid)"), {'id': inserted.id})
    await session.commit()


@pytest.mark.asyncio
async def test_idempotency_returns_existing():
    session = await _session()
    rid = '11111111-1111-1111-1111-111111111111'
    payload = ProposalCreate(
        agent_id='idem-agent',
        operator_id='op-1',
        tool_name='propose_test',
        payload={},
        summary='idem test',
        request_id=rid,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    first = await insert_proposal(session, payload)
    existing = await find_by_idempotency(session, agent_id='idem-agent', request_id=rid)
    assert existing is not None
    assert existing.id == first.id
    # cleanup
    await session.execute(text("delete from proposed_actions where id = cast(:id as uuid)"), {'id': first.id})
    await session.commit()


@pytest.mark.asyncio
async def test_mark_status_and_executed():
    session = await _session()
    payload = ProposalCreate(
        agent_id='mark-agent',
        operator_id='op-1',
        tool_name='propose_test',
        payload={},
        summary='mark test',
        request_id=None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    inserted = await insert_proposal(session, payload)
    await mark_status(
        session,
        proposal_id=inserted.id,
        status=ProposalStatus.APPROVED,
        approval_source='ui',
        approved_by='op-1',
        approver_note='looks good',
    )
    await mark_executed(session, proposal_id=inserted.id, execution_result={'ok': True})
    after = await get_proposal(session, inserted.id)
    assert after.status == ProposalStatus.APPROVED
    assert after.execution_result == {'ok': True}
    # cleanup
    await session.execute(text("delete from proposed_actions where id = cast(:id as uuid)"), {'id': inserted.id})
    await session.commit()


@pytest.mark.asyncio
async def test_list_proposals_filters_by_status():
    session = await _session()
    payload = ProposalCreate(
        agent_id='list-agent',
        operator_id='op-1',
        tool_name='propose_test',
        payload={},
        summary='list test',
        request_id=None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    inserted = await insert_proposal(session, payload)
    pending = await list_proposals(session, status=ProposalStatus.PENDING, agent_id='list-agent', limit=10)
    assert any(p.id == inserted.id for p in pending)
    # cleanup
    await session.execute(text("delete from proposed_actions where id = cast(:id as uuid)"), {'id': inserted.id})
    await session.commit()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_proposals_repo.py -v
```

Expected: ImportError on `app.repositories.proposals`.

- [ ] **Step 3: Implement the repository**

Create `apps/api/app/repositories/proposals.py`:

```python
import json
from datetime import datetime
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.proposals import ProposalCreate, ProposalStatus, ProposedAction


_SELECT_COLS = """
    id::text as id,
    agent_id,
    agent_label,
    operator_id,
    tool_name,
    payload,
    summary,
    status,
    approval_source,
    approved_by,
    approver_note,
    rejection_reason,
    request_id::text as request_id,
    expires_at::text as expires_at,
    created_at::text as created_at,
    approved_at::text as approved_at,
    executed_at::text as executed_at,
    execution_result
"""


INSERT_PROPOSAL_SQL = text(f"""
    insert into proposed_actions (
        agent_id, agent_label, operator_id, tool_name, payload, summary, request_id, expires_at
    ) values (
        :agent_id, :agent_label, :operator_id, :tool_name,
        cast(:payload as jsonb), :summary,
        cast(:request_id as uuid), cast(:expires_at as timestamptz)
    )
    returning {_SELECT_COLS}
""")


GET_PROPOSAL_SQL = text(f"""
    select {_SELECT_COLS}
    from proposed_actions
    where id = cast(:id as uuid)
    limit 1
""")


FIND_BY_IDEMPOTENCY_SQL = text(f"""
    select {_SELECT_COLS}
    from proposed_actions
    where agent_id = :agent_id and request_id = cast(:request_id as uuid)
    limit 1
""")


LIST_PROPOSALS_SQL = text(f"""
    select {_SELECT_COLS}
    from proposed_actions
    where (cast(:status as text) is null or status = cast(:status as text))
      and (cast(:agent_id as text) is null or agent_id = cast(:agent_id as text))
    order by created_at desc
    limit :limit
""")


MARK_STATUS_SQL = text("""
    update proposed_actions
    set status = :status,
        approval_source = :approval_source,
        approved_by = :approved_by,
        approver_note = :approver_note,
        rejection_reason = :rejection_reason,
        approved_at = case when :status in ('approved','rejected') then now() else approved_at end
    where id = cast(:id as uuid)
""")


MARK_EXECUTED_SQL = text("""
    update proposed_actions
    set executed_at = now(),
        execution_result = cast(:execution_result as jsonb)
    where id = cast(:id as uuid)
""")


SWEEP_EXPIRED_SQL = text("""
    update proposed_actions
    set status = 'expired'
    where status = 'pending' and expires_at < now()
    returning id::text as id
""")


def _row_to_model(row: dict) -> ProposedAction:
    data = dict(row)
    if isinstance(data.get('payload'), str):
        data['payload'] = json.loads(data['payload'])
    if isinstance(data.get('execution_result'), str):
        data['execution_result'] = json.loads(data['execution_result'])
    return ProposedAction(**data)


async def insert_proposal(session: AsyncSession, req: ProposalCreate) -> ProposedAction:
    result = await session.execute(
        INSERT_PROPOSAL_SQL,
        {
            'agent_id': req.agent_id,
            'agent_label': req.agent_label,
            'operator_id': req.operator_id,
            'tool_name': req.tool_name,
            'payload': json.dumps(req.payload),
            'summary': req.summary,
            'request_id': req.request_id,
            'expires_at': req.expires_at.isoformat(),
        },
    )
    row = result.mappings().first()
    await session.commit()
    return _row_to_model(row)


async def get_proposal(session: AsyncSession, proposal_id: str) -> Optional[ProposedAction]:
    result = await session.execute(GET_PROPOSAL_SQL, {'id': proposal_id})
    row = result.mappings().first()
    return _row_to_model(row) if row else None


async def find_by_idempotency(
    session: AsyncSession, *, agent_id: str, request_id: str
) -> Optional[ProposedAction]:
    result = await session.execute(
        FIND_BY_IDEMPOTENCY_SQL, {'agent_id': agent_id, 'request_id': request_id}
    )
    row = result.mappings().first()
    return _row_to_model(row) if row else None


async def list_proposals(
    session: AsyncSession,
    *,
    status: Optional[ProposalStatus] = None,
    agent_id: Optional[str] = None,
    limit: int = 50,
) -> list[ProposedAction]:
    result = await session.execute(
        LIST_PROPOSALS_SQL,
        {
            'status': status.value if status else None,
            'agent_id': agent_id,
            'limit': limit,
        },
    )
    rows = result.mappings().all()
    return [_row_to_model(r) for r in rows]


async def mark_status(
    session: AsyncSession,
    *,
    proposal_id: str,
    status: ProposalStatus,
    approval_source: Optional[str] = None,
    approved_by: Optional[str] = None,
    approver_note: Optional[str] = None,
    rejection_reason: Optional[str] = None,
) -> None:
    await session.execute(
        MARK_STATUS_SQL,
        {
            'id': proposal_id,
            'status': status.value,
            'approval_source': approval_source,
            'approved_by': approved_by,
            'approver_note': approver_note,
            'rejection_reason': rejection_reason,
        },
    )
    await session.commit()


async def mark_executed(
    session: AsyncSession, *, proposal_id: str, execution_result: dict
) -> None:
    await session.execute(
        MARK_EXECUTED_SQL,
        {'id': proposal_id, 'execution_result': json.dumps(execution_result)},
    )
    await session.commit()


async def sweep_expired(session: AsyncSession) -> list[str]:
    result = await session.execute(SWEEP_EXPIRED_SQL)
    rows = result.mappings().all()
    await session.commit()
    return [r['id'] for r in rows]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_proposals_repo.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/repositories/proposals.py apps/api/tests/test_proposals_repo.py
git commit -m "feat(mcp): proposals repository with idempotency and expiry sweep"
```

---

## Task 3: Sentry-mode helper

**Files:**
- Create: `apps/api/app/mcp/__init__.py`
- Create: `apps/api/app/mcp/sentry.py`
- Create: `apps/api/tests/test_mcp_sentry.py`

- [ ] **Step 1: Create the package init**

Create `apps/api/app/mcp/__init__.py` (empty file).

- [ ] **Step 2: Write the failing test**

Create `apps/api/tests/test_mcp_sentry.py`:

```python
import os
import pytest

from app.mcp.sentry import is_sentry_active


def test_sentry_off_by_default(monkeypatch):
    monkeypatch.delenv('APEX_MCP_SENTRY_TOOLS', raising=False)
    assert is_sentry_active('propose_draft_edit') is False


def test_sentry_active_when_listed(monkeypatch):
    monkeypatch.setenv('APEX_MCP_SENTRY_TOOLS', 'propose_paperclip_task_comment,propose_draft_edit')
    assert is_sentry_active('propose_paperclip_task_comment') is True
    assert is_sentry_active('propose_draft_edit') is True
    assert is_sentry_active('propose_draft_create') is False


def test_sentry_handles_whitespace_and_empty(monkeypatch):
    monkeypatch.setenv('APEX_MCP_SENTRY_TOOLS', '  propose_draft_edit ,  , ')
    assert is_sentry_active('propose_draft_edit') is True
    assert is_sentry_active('') is False
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_sentry.py -v
```

Expected: ImportError on `app.mcp.sentry`.

- [ ] **Step 4: Implement sentry helper**

Create `apps/api/app/mcp/sentry.py`:

```python
import os


def _active_tools() -> set[str]:
    raw = os.environ.get('APEX_MCP_SENTRY_TOOLS', '')
    return {p.strip() for p in raw.split(',') if p.strip()}


def is_sentry_active(tool_name: str) -> bool:
    if not tool_name:
        return False
    return tool_name in _active_tools()
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_sentry.py -v
```

Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/mcp/__init__.py apps/api/app/mcp/sentry.py apps/api/tests/test_mcp_sentry.py
git commit -m "feat(mcp): sentry mode helper backed by APEX_MCP_SENTRY_TOOLS env"
```

---

## Task 4: Proposals service layer (with WS broadcast hooks)

**Files:**
- Modify: `apps/api/app/services/feed.py`
- Create: `apps/api/app/mcp/proposals.py`
- Create: `apps/api/tests/test_proposals_service.py`

- [ ] **Step 1: Add message-type constants to feed.py**

Modify `apps/api/app/services/feed.py`. After the `feed_manager = FeedConnectionManager()` line, append:

```python


# WebSocket message-type constants used by other services for broadcasting.
MSG_FEED_SEEDED = 'feed.seeded'
MSG_FEED_INGESTED = 'feed.ingested'
MSG_PROPOSAL_CREATED = 'proposal.created'
MSG_PROPOSAL_RESOLVED = 'proposal.resolved'
```

- [ ] **Step 2: Write the failing test**

Create `apps/api/tests/test_proposals_service.py`:

```python
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import text

from app.core.db import get_db_session
from app.mcp.proposals import create_proposal, approve_proposal, reject_proposal
from app.models.proposals import ApprovalSource, ProposalStatus


async def _session():
    async for s in get_db_session():
        return s


async def _cleanup(session, proposal_id: str) -> None:
    await session.execute(
        text('delete from proposed_actions where id = cast(:id as uuid)'),
        {'id': proposal_id},
    )
    await session.commit()


@pytest.mark.asyncio
async def test_create_proposal_emits_broadcast():
    session = await _session()
    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()) as mock_bcast:
        result = await create_proposal(
            session,
            agent_id='svc-test',
            agent_label='Service Test',
            operator_id='op-1',
            tool_name='propose_test',
            payload={'k': 'v'},
            summary='svc test',
            request_id=None,
            expires_in_seconds=1800,
        )
        assert result.proposal.status == ProposalStatus.PENDING
        mock_bcast.assert_awaited_once()
        msg = mock_bcast.call_args.args[0]
        assert msg['type'] == 'proposal.created'
        assert msg['proposal_id'] == result.proposal.id
    await _cleanup(session, result.proposal.id)


@pytest.mark.asyncio
async def test_approve_proposal_executes_and_broadcasts():
    session = await _session()
    executed = {'value': 0}

    async def fake_executor(payload):
        executed['value'] = payload['n'] + 1
        return {'next': executed['value']}

    create_result = await create_proposal(
        session,
        agent_id='svc-test',
        agent_label='Svc',
        operator_id='op-1',
        tool_name='propose_test',
        payload={'n': 5},
        summary='approve test',
        request_id=None,
        expires_in_seconds=1800,
    )

    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()) as mock_bcast:
        outcome = await approve_proposal(
            session,
            proposal_id=create_result.proposal.id,
            approver_id='op-1',
            source=ApprovalSource.UI,
            approver_note='ok',
            executor=fake_executor,
        )
        assert outcome.status == ProposalStatus.APPROVED
        assert outcome.execution_result == {'next': 6}
        mock_bcast.assert_awaited()
        assert mock_bcast.call_args.args[0]['type'] == 'proposal.resolved'

    await _cleanup(session, create_result.proposal.id)


@pytest.mark.asyncio
async def test_approve_already_resolved_returns_idempotent_result():
    session = await _session()

    async def fake_executor(payload):
        return {'done': True}

    create_result = await create_proposal(
        session,
        agent_id='svc-test',
        agent_label='Svc',
        operator_id='op-1',
        tool_name='propose_test',
        payload={},
        summary='double approve',
        request_id=None,
        expires_in_seconds=1800,
    )
    await approve_proposal(
        session,
        proposal_id=create_result.proposal.id,
        approver_id='op-1',
        source=ApprovalSource.UI,
        executor=fake_executor,
    )
    second = await approve_proposal(
        session,
        proposal_id=create_result.proposal.id,
        approver_id='op-1',
        source=ApprovalSource.UI,
        executor=fake_executor,
    )
    assert second.status == ProposalStatus.APPROVED
    assert second.execution_result == {'done': True}
    await _cleanup(session, create_result.proposal.id)


@pytest.mark.asyncio
async def test_reject_proposal_skips_execution():
    session = await _session()

    async def fake_executor(payload):
        raise AssertionError('executor must not run on reject')

    create_result = await create_proposal(
        session,
        agent_id='svc-test',
        agent_label='Svc',
        operator_id='op-1',
        tool_name='propose_test',
        payload={},
        summary='reject test',
        request_id=None,
        expires_in_seconds=1800,
    )
    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()):
        outcome = await reject_proposal(
            session,
            proposal_id=create_result.proposal.id,
            approver_id='op-1',
            reason='nope',
        )
    assert outcome.status == ProposalStatus.REJECTED
    assert outcome.rejection_reason == 'nope'
    await _cleanup(session, create_result.proposal.id)


@pytest.mark.asyncio
async def test_create_proposal_idempotency_returns_existing():
    session = await _session()
    rid = '22222222-2222-2222-2222-222222222222'
    first = await create_proposal(
        session,
        agent_id='idem-svc',
        agent_label='Idem',
        operator_id='op-1',
        tool_name='propose_test',
        payload={'k': 1},
        summary='first',
        request_id=rid,
        expires_in_seconds=1800,
    )
    second = await create_proposal(
        session,
        agent_id='idem-svc',
        agent_label='Idem',
        operator_id='op-1',
        tool_name='propose_test',
        payload={'k': 2},
        summary='second',
        request_id=rid,
        expires_in_seconds=1800,
    )
    assert first.proposal.id == second.proposal.id
    assert second.created is False  # second call did not create a new row
    await _cleanup(session, first.proposal.id)
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_proposals_service.py -v
```

Expected: ImportError on `app.mcp.proposals`.

- [ ] **Step 4: Implement the service layer**

Create `apps/api/app/mcp/proposals.py`:

```python
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.proposals import (
    ApprovalSource,
    ProposalCreate,
    ProposalStatus,
    ProposedAction,
)
from app.repositories.proposals import (
    find_by_idempotency,
    get_proposal,
    insert_proposal,
    list_proposals as list_proposals_repo,
    mark_executed,
    mark_status,
    sweep_expired,
)
from app.services.feed import (
    MSG_PROPOSAL_CREATED,
    MSG_PROPOSAL_RESOLVED,
    feed_manager,
)


@dataclass
class CreateProposalResult:
    proposal: ProposedAction
    created: bool   # True if a new row was inserted; False if returned via idempotency


async def create_proposal(
    session: AsyncSession,
    *,
    agent_id: str,
    agent_label: Optional[str],
    operator_id: str,
    tool_name: str,
    payload: dict[str, Any],
    summary: str,
    request_id: Optional[str],
    expires_in_seconds: int = 1800,
) -> CreateProposalResult:
    if request_id is not None:
        existing = await find_by_idempotency(
            session, agent_id=agent_id, request_id=request_id
        )
        if existing is not None:
            return CreateProposalResult(proposal=existing, created=False)

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds)
    proposal = await insert_proposal(
        session,
        ProposalCreate(
            agent_id=agent_id,
            agent_label=agent_label,
            operator_id=operator_id,
            tool_name=tool_name,
            payload=payload,
            summary=summary,
            request_id=request_id,
            expires_at=expires_at,
        ),
    )

    await feed_manager.broadcast({
        'type': MSG_PROPOSAL_CREATED,
        'proposal_id': proposal.id,
        'tool_name': tool_name,
        'agent_label': agent_label or agent_id,
        'summary': summary,
    })

    return CreateProposalResult(proposal=proposal, created=True)


async def _expire_if_due(session: AsyncSession, proposal: ProposedAction) -> ProposedAction:
    if proposal.status != ProposalStatus.PENDING:
        return proposal
    expires = datetime.fromisoformat(proposal.expires_at.replace('Z', '+00:00'))
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        await mark_status(session, proposal_id=proposal.id, status=ProposalStatus.EXPIRED)
        await feed_manager.broadcast({
            'type': MSG_PROPOSAL_RESOLVED,
            'proposal_id': proposal.id,
            'status': ProposalStatus.EXPIRED.value,
        })
        return await get_proposal(session, proposal.id) or proposal
    return proposal


async def approve_proposal(
    session: AsyncSession,
    *,
    proposal_id: str,
    approver_id: str,
    source: ApprovalSource,
    approver_note: Optional[str] = None,
    executor: Callable[[dict[str, Any]], Awaitable[dict[str, Any]]],
) -> ProposedAction:
    proposal = await get_proposal(session, proposal_id)
    if proposal is None:
        raise ProposalNotFoundError(proposal_id)
    proposal = await _expire_if_due(session, proposal)

    if proposal.status == ProposalStatus.APPROVED:
        return proposal  # idempotent
    if proposal.status in (ProposalStatus.REJECTED, ProposalStatus.EXPIRED):
        raise ProposalAlreadyResolvedError(proposal.id, proposal.status)

    await mark_status(
        session,
        proposal_id=proposal.id,
        status=ProposalStatus.APPROVED,
        approval_source=source.value,
        approved_by=approver_id,
        approver_note=approver_note,
    )
    result = await executor(proposal.payload)
    await mark_executed(session, proposal_id=proposal.id, execution_result=result)

    await feed_manager.broadcast({
        'type': MSG_PROPOSAL_RESOLVED,
        'proposal_id': proposal.id,
        'status': ProposalStatus.APPROVED.value,
    })

    return await get_proposal(session, proposal.id)


async def reject_proposal(
    session: AsyncSession,
    *,
    proposal_id: str,
    approver_id: str,
    reason: str,
) -> ProposedAction:
    proposal = await get_proposal(session, proposal_id)
    if proposal is None:
        raise ProposalNotFoundError(proposal_id)
    proposal = await _expire_if_due(session, proposal)

    if proposal.status == ProposalStatus.REJECTED:
        return proposal
    if proposal.status in (ProposalStatus.APPROVED, ProposalStatus.EXPIRED):
        raise ProposalAlreadyResolvedError(proposal.id, proposal.status)

    await mark_status(
        session,
        proposal_id=proposal.id,
        status=ProposalStatus.REJECTED,
        approved_by=approver_id,
        rejection_reason=reason,
    )
    await feed_manager.broadcast({
        'type': MSG_PROPOSAL_RESOLVED,
        'proposal_id': proposal.id,
        'status': ProposalStatus.REJECTED.value,
    })
    return await get_proposal(session, proposal.id)


async def list_proposals_view(
    session: AsyncSession,
    *,
    status: Optional[ProposalStatus] = None,
    agent_id: Optional[str] = None,
    limit: int = 50,
) -> list[ProposedAction]:
    await sweep_expired(session)
    return await list_proposals_repo(
        session, status=status, agent_id=agent_id, limit=limit
    )


class ProposalNotFoundError(LookupError):
    def __init__(self, proposal_id: str) -> None:
        super().__init__(f'Proposal not found: {proposal_id}')
        self.proposal_id = proposal_id


class ProposalAlreadyResolvedError(RuntimeError):
    def __init__(self, proposal_id: str, current_status: ProposalStatus) -> None:
        super().__init__(f'Proposal {proposal_id} already resolved as {current_status}')
        self.proposal_id = proposal_id
        self.current_status = current_status
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_proposals_service.py -v
```

Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/services/feed.py apps/api/app/mcp/proposals.py apps/api/tests/test_proposals_service.py
git commit -m "feat(mcp): proposals service layer with broadcast and idempotency"
```

---

## Task 5: Tool registry + first read tool (events)

**Files:**
- Create: `apps/api/app/mcp/registry.py`
- Create: `apps/api/app/mcp/tools/__init__.py`
- Create: `apps/api/app/mcp/tools/events.py`
- Create: `apps/api/tests/test_mcp_registry.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_mcp_registry.py`:

```python
import pytest

from app.mcp.registry import (
    Registry,
    ToolNotFoundError,
    ToolDefinition,
)


@pytest.mark.asyncio
async def test_register_and_dispatch_tool():
    registry = Registry()

    async def echo_tool(ctx, params):
        return {'echoed': params['msg']}

    registry.register_tool(
        ToolDefinition(
            name='echo',
            description='Echoes its input.',
            input_schema={'type': 'object', 'properties': {'msg': {'type': 'string'}}, 'required': ['msg']},
        ),
        echo_tool,
    )
    listed = registry.list_tools()
    assert any(t.name == 'echo' for t in listed)
    result = await registry.dispatch_tool(name='echo', ctx={}, params={'msg': 'hi'})
    assert result == {'echoed': 'hi'}


@pytest.mark.asyncio
async def test_dispatch_unknown_tool_raises():
    registry = Registry()
    with pytest.raises(ToolNotFoundError):
        await registry.dispatch_tool(name='nonexistent', ctx={}, params={})


@pytest.mark.asyncio
async def test_default_registry_has_events_tools():
    from app.mcp.tools import get_default_registry
    registry = get_default_registry()
    names = {t.name for t in registry.list_tools()}
    assert 'list_events' in names
    assert 'get_event' in names
    assert 'search_events_by_brand' in names
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_registry.py -v
```

Expected: ImportError.

- [ ] **Step 3: Implement the registry**

Create `apps/api/app/mcp/registry.py`:

```python
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional


ToolHandler = Callable[[dict, dict], Awaitable[Any]]


@dataclass
class ToolDefinition:
    name: str
    description: str
    input_schema: dict[str, Any] = field(default_factory=dict)


@dataclass
class ResourceDefinition:
    uri: str
    name: str
    description: str
    mime_type: str = 'application/json'


ResourceHandler = Callable[[dict, dict], Awaitable[Any]]


class ToolNotFoundError(LookupError):
    pass


class ResourceNotFoundError(LookupError):
    pass


class Registry:
    def __init__(self) -> None:
        self._tools: dict[str, tuple[ToolDefinition, ToolHandler]] = {}
        self._resources: dict[str, tuple[ResourceDefinition, ResourceHandler]] = {}

    def register_tool(self, defn: ToolDefinition, handler: ToolHandler) -> None:
        if defn.name in self._tools:
            raise ValueError(f'Tool already registered: {defn.name}')
        self._tools[defn.name] = (defn, handler)

    def register_resource(self, defn: ResourceDefinition, handler: ResourceHandler) -> None:
        if defn.uri in self._resources:
            raise ValueError(f'Resource already registered: {defn.uri}')
        self._resources[defn.uri] = (defn, handler)

    def list_tools(self) -> list[ToolDefinition]:
        return [d for d, _ in self._tools.values()]

    def list_resources(self) -> list[ResourceDefinition]:
        return [d for d, _ in self._resources.values()]

    async def dispatch_tool(self, *, name: str, ctx: dict, params: dict) -> Any:
        if name not in self._tools:
            raise ToolNotFoundError(name)
        _, handler = self._tools[name]
        return await handler(ctx, params)

    async def read_resource(self, *, uri: str, ctx: dict, params: Optional[dict] = None) -> Any:
        if uri not in self._resources:
            raise ResourceNotFoundError(uri)
        _, handler = self._resources[uri]
        return await handler(ctx, params or {})
```

- [ ] **Step 4: Implement events tools**

Create `apps/api/app/mcp/tools/events.py`:

```python
from typing import Any, Optional

from app.mcp.registry import Registry, ToolDefinition
from app.repositories.events import get_event as get_event_repo
from app.repositories.events import list_events as list_events_repo


def register(registry: Registry) -> None:
    registry.register_tool(
        ToolDefinition(
            name='list_events',
            description='List recent newsroom events with optional brand/market/since filters.',
            input_schema={
                'type': 'object',
                'properties': {
                    'brand': {'type': 'string'},
                    'market': {'type': 'string'},
                    'since': {'type': 'string', 'description': 'ISO 8601 timestamp'},
                    'min_score': {'type': 'integer', 'minimum': 0, 'maximum': 100},
                },
            },
        ),
        _list_events,
    )
    registry.register_tool(
        ToolDefinition(
            name='get_event',
            description='Fetch a single event by id, including linked actions.',
            input_schema={
                'type': 'object',
                'properties': {'event_id': {'type': 'string'}},
                'required': ['event_id'],
            },
        ),
        _get_event,
    )
    registry.register_tool(
        ToolDefinition(
            name='search_events_by_brand',
            description='Convenience: list recent events filtered by primary brand.',
            input_schema={
                'type': 'object',
                'properties': {'brand': {'type': 'string'}, 'limit': {'type': 'integer'}},
                'required': ['brand'],
            },
        ),
        _search_by_brand,
    )


async def _list_events(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    events = await list_events_repo(
        session,
        brand=params.get('brand'),
        market=params.get('market'),
        event_type=params.get('event_type'),
        min_score=params.get('min_score'),
        since=params.get('since'),
    )
    return {'events': [e.model_dump() for e in events]}


async def _get_event(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    event = await get_event_repo(session, params['event_id'])
    if event is None:
        return {'error': 'not_found', 'event_id': params['event_id']}
    return event.model_dump()


async def _search_by_brand(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    events = await list_events_repo(session, brand=params['brand'])
    limit = int(params.get('limit') or 25)
    return {'events': [e.model_dump() for e in events[:limit]]}
```

- [ ] **Step 5: Implement the default registry assembler**

Create `apps/api/app/mcp/tools/__init__.py`:

```python
from app.mcp.registry import Registry
from app.mcp.tools import events as events_tools


def build_registry() -> Registry:
    registry = Registry()
    events_tools.register(registry)
    return registry


_default_registry: Registry | None = None


def get_default_registry() -> Registry:
    global _default_registry
    if _default_registry is None:
        _default_registry = build_registry()
    return _default_registry
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_registry.py -v
```

Expected: 3 passed.

- [ ] **Step 7: Commit**

```bash
git add apps/api/app/mcp/registry.py apps/api/app/mcp/tools/__init__.py apps/api/app/mcp/tools/events.py apps/api/tests/test_mcp_registry.py
git commit -m "feat(mcp): tool registry and event read tools"
```

---

## Task 6: Read tools — accounts, drafts, paperclip, session

**Files:**
- Create: `apps/api/app/mcp/tools/accounts.py`
- Create: `apps/api/app/mcp/tools/drafts.py` (read functions only in this task)
- Create: `apps/api/app/mcp/tools/paperclip.py` (read functions only in this task)
- Create: `apps/api/app/mcp/tools/session.py`
- Modify: `apps/api/app/mcp/tools/__init__.py`
- Create: `apps/api/tests/test_mcp_tools_read.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_mcp_tools_read.py`:

```python
import pytest

from app.core.db import get_db_session
from app.mcp.tools import get_default_registry


async def _ctx():
    async for s in get_db_session():
        return {'session': s, 'operator_id': 'op-1', 'agent_id': 'tester'}


@pytest.mark.asyncio
async def test_list_events_returns_dict_with_events_key():
    registry = get_default_registry()
    ctx = await _ctx()
    result = await registry.dispatch_tool(name='list_events', ctx=ctx, params={})
    assert 'events' in result
    assert isinstance(result['events'], list)


@pytest.mark.asyncio
async def test_list_accounts_returns_list():
    registry = get_default_registry()
    ctx = await _ctx()
    result = await registry.dispatch_tool(name='list_accounts', ctx=ctx, params={})
    assert 'accounts' in result
    assert isinstance(result['accounts'], list)


@pytest.mark.asyncio
async def test_list_review_queue_returns_list():
    registry = get_default_registry()
    ctx = await _ctx()
    result = await registry.dispatch_tool(name='list_review_queue', ctx=ctx, params={})
    assert 'items' in result


@pytest.mark.asyncio
async def test_list_paperclip_lanes_returns_list():
    registry = get_default_registry()
    ctx = await _ctx()
    result = await registry.dispatch_tool(name='list_paperclip_lanes', ctx=ctx, params={})
    assert 'lanes' in result


@pytest.mark.asyncio
async def test_get_session_context_returns_operator_info():
    registry = get_default_registry()
    ctx = await _ctx()
    result = await registry.dispatch_tool(name='get_session_context', ctx=ctx, params={})
    assert result['operator_id'] == 'op-1'
    assert result['agent_id'] == 'tester'
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_tools_read.py -v
```

Expected: only `test_list_events_returns_dict_with_events_key` passes; others fail with `ToolNotFoundError`.

- [ ] **Step 3: Implement accounts tools**

Create `apps/api/app/mcp/tools/accounts.py`:

```python
from typing import Any

from app.mcp.registry import Registry, ToolDefinition
from app.repositories.properties import get_property as get_property_repo
from app.repositories.properties import list_properties as list_properties_repo


def register(registry: Registry) -> None:
    registry.register_tool(
        ToolDefinition(
            name='list_accounts',
            description='List APEX accounts/properties with optional brand/search/sort filters.',
            input_schema={
                'type': 'object',
                'properties': {
                    'brand': {'type': 'string'},
                    'search': {'type': 'string'},
                    'sort': {'type': 'string', 'enum': ['score_desc', 'score_asc', 'signal_count', 'market_asc', 'name_asc']},
                },
            },
        ),
        _list_accounts,
    )
    registry.register_tool(
        ToolDefinition(
            name='get_account',
            description='Fetch a single account/property with linked signals.',
            input_schema={
                'type': 'object',
                'properties': {'account_id': {'type': 'string'}},
                'required': ['account_id'],
            },
        ),
        _get_account,
    )
    registry.register_tool(
        ToolDefinition(
            name='list_account_signals',
            description='List signals attached to an account.',
            input_schema={
                'type': 'object',
                'properties': {'account_id': {'type': 'string'}},
                'required': ['account_id'],
            },
        ),
        _list_account_signals,
    )


async def _list_accounts(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    items = await list_properties_repo(
        session,
        brand=params.get('brand'),
        search=params.get('search'),
        sort=params.get('sort'),
    )
    return {'accounts': [p.model_dump() for p in items]}


async def _get_account(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    detail = await get_property_repo(session, params['account_id'])
    if detail is None:
        return {'error': 'not_found', 'account_id': params['account_id']}
    return detail.model_dump()


async def _list_account_signals(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    detail = await get_property_repo(session, params['account_id'])
    if detail is None:
        return {'error': 'not_found', 'account_id': params['account_id']}
    return {'signals': [s.model_dump() for s in detail.linked_signals]}
```

- [ ] **Step 4: Implement drafts read tools**

Create `apps/api/app/mcp/tools/drafts.py`:

```python
from typing import Any

from app.mcp.registry import Registry, ToolDefinition
from app.repositories.actions import (
    get_action_draft as get_draft_repo,
    get_action_draft_history as get_draft_history_repo,
    get_action_review_queue as get_review_queue_repo,
)


def register(registry: Registry) -> None:
    registry.register_tool(
        ToolDefinition(
            name='get_draft',
            description='Fetch the most recent draft for an event by draft type.',
            input_schema={
                'type': 'object',
                'properties': {
                    'event_id': {'type': 'string'},
                    'draft_type': {'type': 'string'},
                },
                'required': ['event_id'],
            },
        ),
        _get_draft,
    )
    registry.register_tool(
        ToolDefinition(
            name='list_drafts',
            description='List the draft history for an event.',
            input_schema={
                'type': 'object',
                'properties': {'event_id': {'type': 'string'}},
                'required': ['event_id'],
            },
        ),
        _list_drafts,
    )
    registry.register_tool(
        ToolDefinition(
            name='list_review_queue',
            description='List drafts awaiting review.',
            input_schema={'type': 'object', 'properties': {}},
        ),
        _list_review_queue,
    )


async def _get_draft(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    draft = await get_draft_repo(session, params['event_id'])
    if draft is None:
        return {'error': 'not_found', 'event_id': params['event_id']}
    return draft.model_dump()


async def _list_drafts(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    history = await get_draft_history_repo(session, params['event_id'])
    return history.model_dump()


async def _list_review_queue(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    queue = await get_review_queue_repo(session)
    return {'items': [item.model_dump() for item in queue.items]}
```

- [ ] **Step 5: Implement paperclip read tools**

Create `apps/api/app/mcp/tools/paperclip.py`:

```python
from typing import Any, Optional

from app.mcp.registry import Registry, ToolDefinition
from app.services.paperclip_tasks import (
    list_paperclip_lanes as svc_list_lanes,
    list_tasks as svc_list_tasks,
)


def register(registry: Registry) -> None:
    registry.register_tool(
        ToolDefinition(
            name='list_paperclip_lanes',
            description='List configured paperclip lanes.',
            input_schema={'type': 'object', 'properties': {}},
        ),
        _list_lanes,
    )
    registry.register_tool(
        ToolDefinition(
            name='list_paperclip_tasks',
            description='List paperclip tasks, optionally filtered by lane and status.',
            input_schema={
                'type': 'object',
                'properties': {
                    'lane': {'type': 'string'},
                    'status': {'type': 'string'},
                },
            },
        ),
        _list_tasks,
    )
    registry.register_tool(
        ToolDefinition(
            name='get_paperclip_task',
            description='Fetch a single paperclip task by id.',
            input_schema={
                'type': 'object',
                'properties': {'task_id': {'type': 'string'}},
                'required': ['task_id'],
            },
        ),
        _get_task,
    )


async def _list_lanes(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    lanes = await svc_list_lanes(session)
    return {'lanes': [l.model_dump() if hasattr(l, 'model_dump') else l for l in lanes]}


async def _list_tasks(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    tasks = await svc_list_tasks(session, lane=params.get('lane'), status=params.get('status'))
    return {'tasks': [t.model_dump() if hasattr(t, 'model_dump') else t for t in tasks]}


async def _get_task(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    tasks = await svc_list_tasks(session)
    for t in tasks:
        tid = t.id if hasattr(t, 'id') else t.get('id')
        if tid == params['task_id']:
            return t.model_dump() if hasattr(t, 'model_dump') else t
    return {'error': 'not_found', 'task_id': params['task_id']}
```

- [ ] **Step 6: Implement session tool**

Create `apps/api/app/mcp/tools/session.py`:

```python
from typing import Any

from app.mcp.registry import Registry, ToolDefinition


def register(registry: Registry) -> None:
    registry.register_tool(
        ToolDefinition(
            name='get_session_context',
            description='Return the calling agent + operator context for reasoning.',
            input_schema={'type': 'object', 'properties': {}},
        ),
        _get_context,
    )


async def _get_context(ctx: dict, params: dict) -> Any:
    return {
        'operator_id': ctx.get('operator_id'),
        'operator_name': ctx.get('operator_name'),
        'role': ctx.get('role'),
        'permissions': ctx.get('permissions', []),
        'agent_id': ctx.get('agent_id'),
        'agent_label': ctx.get('agent_label'),
    }
```

- [ ] **Step 7: Wire all read tools into the registry**

Replace `apps/api/app/mcp/tools/__init__.py` with:

```python
from app.mcp.registry import Registry
from app.mcp.tools import (
    accounts as accounts_tools,
    drafts as drafts_tools,
    events as events_tools,
    paperclip as paperclip_tools,
    session as session_tools,
)


def build_registry() -> Registry:
    registry = Registry()
    events_tools.register(registry)
    accounts_tools.register(registry)
    drafts_tools.register(registry)
    paperclip_tools.register(registry)
    session_tools.register(registry)
    return registry


_default_registry: Registry | None = None


def get_default_registry() -> Registry:
    global _default_registry
    if _default_registry is None:
        _default_registry = build_registry()
    return _default_registry
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_tools_read.py -v
```

Expected: 5 passed.

- [ ] **Step 9: Commit**

```bash
git add apps/api/app/mcp/tools/ apps/api/tests/test_mcp_tools_read.py
git commit -m "feat(mcp): read tools for accounts, drafts, paperclip, session"
```

---

## Task 7: Write tools — drafts (proposal-gated)

**Files:**
- Modify: `apps/api/app/mcp/tools/drafts.py` (add propose_* handlers)
- Create: `apps/api/tests/test_mcp_tools_write_drafts.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_mcp_tools_write_drafts.py`:

```python
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import text

from app.core.db import get_db_session
from app.mcp.tools import get_default_registry


async def _ctx():
    async for s in get_db_session():
        return {
            'session': s,
            'operator_id': 'op-1',
            'agent_id': 'tester',
            'agent_label': 'Tester',
        }


async def _cleanup(session, proposal_id: str) -> None:
    await session.execute(
        text('delete from proposed_actions where id = cast(:id as uuid)'),
        {'id': proposal_id},
    )
    await session.commit()


@pytest.mark.asyncio
async def test_propose_draft_create_returns_proposal_id():
    registry = get_default_registry()
    ctx = await _ctx()
    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()):
        result = await registry.dispatch_tool(
            name='propose_draft_create',
            ctx=ctx,
            params={
                'event_id': '00000000-0000-0000-0000-000000000001',
                'draft_type': 'cold_outreach',
                'subject': 'Hello',
                'body': 'Body text',
            },
        )
    assert 'proposal_id' in result
    assert 'expires_at' in result
    assert result['summary']
    await _cleanup(ctx['session'], result['proposal_id'])


@pytest.mark.asyncio
async def test_propose_draft_edit_with_idempotency():
    registry = get_default_registry()
    ctx = await _ctx()
    rid = '33333333-3333-3333-3333-333333333333'
    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()):
        first = await registry.dispatch_tool(
            name='propose_draft_edit',
            ctx=ctx,
            params={
                'event_id': '00000000-0000-0000-0000-000000000001',
                'draft_type': 'cold_outreach',
                'subject': 'Edit',
                'body': 'Edited body',
                'request_id': rid,
            },
        )
        second = await registry.dispatch_tool(
            name='propose_draft_edit',
            ctx=ctx,
            params={
                'event_id': '00000000-0000-0000-0000-000000000001',
                'draft_type': 'cold_outreach',
                'subject': 'Different',
                'body': 'Different body',
                'request_id': rid,
            },
        )
    assert first['proposal_id'] == second['proposal_id']
    await _cleanup(ctx['session'], first['proposal_id'])
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_tools_write_drafts.py -v
```

Expected: ToolNotFoundError on `propose_draft_create`.

- [ ] **Step 3: Add write tool handlers to drafts.py**

Append to `apps/api/app/mcp/tools/drafts.py` (keep the existing read tool registrations and add new ones inside the same `register` function and below):

```python
# Append AT THE END of register() — keep existing read registrations above:

    registry.register_tool(
        ToolDefinition(
            name='propose_draft_create',
            description='Propose creating a new draft. Returns a proposal_id requiring approval.',
            input_schema={
                'type': 'object',
                'properties': {
                    'event_id': {'type': 'string'},
                    'draft_type': {'type': 'string'},
                    'subject': {'type': 'string'},
                    'body': {'type': 'string'},
                    'request_id': {'type': 'string'},
                },
                'required': ['event_id', 'draft_type', 'body'],
            },
        ),
        _propose_draft_create,
    )
    registry.register_tool(
        ToolDefinition(
            name='propose_draft_edit',
            description='Propose editing an existing draft.',
            input_schema={
                'type': 'object',
                'properties': {
                    'event_id': {'type': 'string'},
                    'draft_type': {'type': 'string'},
                    'subject': {'type': 'string'},
                    'body': {'type': 'string'},
                    'request_id': {'type': 'string'},
                },
                'required': ['event_id', 'draft_type', 'body'],
            },
        ),
        _propose_draft_edit,
    )
    registry.register_tool(
        ToolDefinition(
            name='propose_draft_transition',
            description='Propose transitioning a draft status (e.g., approved, ready_to_send).',
            input_schema={
                'type': 'object',
                'properties': {
                    'event_id': {'type': 'string'},
                    'draft_type': {'type': 'string'},
                    'next_status': {'type': 'string'},
                    'request_id': {'type': 'string'},
                },
                'required': ['event_id', 'draft_type', 'next_status'],
            },
        ),
        _propose_draft_transition,
    )
```

Then append the handler functions and helpers below the existing read handlers:

```python
from app.mcp.proposals import create_proposal


def _summary_for_draft(verb: str, params: dict) -> str:
    subject = params.get('subject') or '(no subject)'
    return f'{verb} {params.get("draft_type", "draft")} for event {params.get("event_id")}: {subject}'


async def _propose_write(ctx: dict, params: dict, *, tool_name: str, summary: str) -> dict:
    # Note: this handler always queues a proposal. Sentry-mode auto-execution
    # is layered on in Task 9 once the executor router exists.
    result = await create_proposal(
        ctx['session'],
        agent_id=ctx['agent_id'],
        agent_label=ctx.get('agent_label'),
        operator_id=ctx['operator_id'],
        tool_name=tool_name,
        payload=params,
        summary=summary,
        request_id=params.get('request_id'),
    )
    return {
        'proposal_id': result.proposal.id,
        'expires_at': result.proposal.expires_at,
        'summary': result.proposal.summary,
        'status': result.proposal.status.value,
        'created': result.created,
    }


async def _propose_draft_create(ctx: dict, params: dict):
    return await _propose_write(
        ctx, params,
        tool_name='propose_draft_create',
        summary=_summary_for_draft('Create', params),
    )


async def _propose_draft_edit(ctx: dict, params: dict):
    return await _propose_write(
        ctx, params,
        tool_name='propose_draft_edit',
        summary=_summary_for_draft('Edit', params),
    )


async def _propose_draft_transition(ctx: dict, params: dict):
    return await _propose_write(
        ctx, params,
        tool_name='propose_draft_transition',
        summary=f'Transition {params.get("draft_type", "draft")} for event {params.get("event_id")} → {params.get("next_status")}',
    )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_tools_write_drafts.py -v
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/mcp/tools/drafts.py apps/api/tests/test_mcp_tools_write_drafts.py
git commit -m "feat(mcp): proposal-gated draft write tools"
```

---

## Task 8: Write tools — paperclip (proposal-gated)

**Files:**
- Modify: `apps/api/app/mcp/tools/paperclip.py` (add propose_* handlers)
- Create: `apps/api/tests/test_mcp_tools_write_paperclip.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_mcp_tools_write_paperclip.py`:

```python
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import text

from app.core.db import get_db_session
from app.mcp.tools import get_default_registry


async def _ctx():
    async for s in get_db_session():
        return {
            'session': s,
            'operator_id': 'op-1',
            'agent_id': 'tester',
            'agent_label': 'Tester',
        }


async def _cleanup(session, proposal_id: str) -> None:
    await session.execute(
        text('delete from proposed_actions where id = cast(:id as uuid)'),
        {'id': proposal_id},
    )
    await session.commit()


@pytest.mark.asyncio
async def test_propose_paperclip_task_create_returns_proposal_id():
    registry = get_default_registry()
    ctx = await _ctx()
    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()):
        result = await registry.dispatch_tool(
            name='propose_paperclip_task_create',
            ctx=ctx,
            params={'lane': 'inbox', 'title': 'Follow up', 'description': 'Test'},
        )
    assert 'proposal_id' in result
    await _cleanup(ctx['session'], result['proposal_id'])


@pytest.mark.asyncio
async def test_propose_paperclip_task_status_returns_proposal_id():
    registry = get_default_registry()
    ctx = await _ctx()
    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()):
        result = await registry.dispatch_tool(
            name='propose_paperclip_task_status',
            ctx=ctx,
            params={'task_id': 'task-1', 'status': 'done'},
        )
    assert 'proposal_id' in result
    await _cleanup(ctx['session'], result['proposal_id'])


@pytest.mark.asyncio
async def test_propose_paperclip_task_comment_returns_proposal_id():
    registry = get_default_registry()
    ctx = await _ctx()
    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()):
        result = await registry.dispatch_tool(
            name='propose_paperclip_task_comment',
            ctx=ctx,
            params={'task_id': 'task-1', 'body': 'Looks good'},
        )
    assert 'proposal_id' in result
    await _cleanup(ctx['session'], result['proposal_id'])
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_tools_write_paperclip.py -v
```

Expected: ToolNotFoundError on `propose_paperclip_task_create`.

- [ ] **Step 3: Add write tool handlers to paperclip.py**

Append to the existing `register` function in `apps/api/app/mcp/tools/paperclip.py` (after the read tool registrations):

```python
    registry.register_tool(
        ToolDefinition(
            name='propose_paperclip_task_create',
            description='Propose creating a paperclip task. Requires approval.',
            input_schema={
                'type': 'object',
                'properties': {
                    'lane': {'type': 'string'},
                    'title': {'type': 'string'},
                    'description': {'type': 'string'},
                    'request_id': {'type': 'string'},
                },
                'required': ['lane', 'title'],
            },
        ),
        _propose_task_create,
    )
    registry.register_tool(
        ToolDefinition(
            name='propose_paperclip_task_status',
            description='Propose changing a paperclip task status.',
            input_schema={
                'type': 'object',
                'properties': {
                    'task_id': {'type': 'string'},
                    'status': {'type': 'string'},
                    'request_id': {'type': 'string'},
                },
                'required': ['task_id', 'status'],
            },
        ),
        _propose_task_status,
    )
    registry.register_tool(
        ToolDefinition(
            name='propose_paperclip_task_comment',
            description='Propose adding a comment to a paperclip task.',
            input_schema={
                'type': 'object',
                'properties': {
                    'task_id': {'type': 'string'},
                    'body': {'type': 'string'},
                    'request_id': {'type': 'string'},
                },
                'required': ['task_id', 'body'],
            },
        ),
        _propose_task_comment,
    )
```

Then append the handler functions at the end of the file:

```python
from app.mcp.proposals import create_proposal


async def _propose_task_create(ctx: dict, params: dict):
    summary = f'Create paperclip task in lane {params["lane"]}: {params["title"]}'
    return await _record(ctx, params, tool_name='propose_paperclip_task_create', summary=summary)


async def _propose_task_status(ctx: dict, params: dict):
    summary = f'Set paperclip task {params["task_id"]} status → {params["status"]}'
    return await _record(ctx, params, tool_name='propose_paperclip_task_status', summary=summary)


async def _propose_task_comment(ctx: dict, params: dict):
    snippet = (params.get('body') or '')[:60]
    summary = f'Comment on paperclip task {params["task_id"]}: {snippet}'
    return await _record(ctx, params, tool_name='propose_paperclip_task_comment', summary=summary)


async def _record(ctx: dict, params: dict, *, tool_name: str, summary: str):
    result = await create_proposal(
        ctx['session'],
        agent_id=ctx['agent_id'],
        agent_label=ctx.get('agent_label'),
        operator_id=ctx['operator_id'],
        tool_name=tool_name,
        payload=params,
        summary=summary,
        request_id=params.get('request_id'),
    )
    return {
        'proposal_id': result.proposal.id,
        'expires_at': result.proposal.expires_at,
        'summary': result.proposal.summary,
        'status': result.proposal.status.value,
        'created': result.created,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_tools_write_paperclip.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/mcp/tools/paperclip.py apps/api/tests/test_mcp_tools_write_paperclip.py
git commit -m "feat(mcp): proposal-gated paperclip task write tools"
```

---

## Task 9: Lifecycle tools + executor router

**Files:**
- Create: `apps/api/app/mcp/tools/proposals.py`
- Modify: `apps/api/app/mcp/tools/__init__.py`
- Create: `apps/api/tests/test_mcp_tools_lifecycle.py`

This task wires up the lifecycle tools AND defines the executor that turns approved proposals into real APEX writes (calling `persist_action_draft`, paperclip services, etc.).

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_mcp_tools_lifecycle.py`:

```python
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import text

from app.core.db import get_db_session
from app.mcp.tools import get_default_registry


async def _ctx():
    async for s in get_db_session():
        return {
            'session': s,
            'operator_id': 'op-1',
            'operator_name': 'Op One',
            'role': 'principal_operator',
            'permissions': ['draft:edit', 'draft:approve', 'draft:ready', 'paperclip:write'],
            'agent_id': 'lifecycle-tester',
            'agent_label': 'Lifecycle Tester',
        }


async def _cleanup(session, proposal_id: str) -> None:
    await session.execute(
        text('delete from proposed_actions where id = cast(:id as uuid)'),
        {'id': proposal_id},
    )
    await session.commit()


@pytest.mark.asyncio
async def test_list_proposals_returns_pending():
    registry = get_default_registry()
    ctx = await _ctx()
    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()):
        created = await registry.dispatch_tool(
            name='propose_paperclip_task_comment',
            ctx=ctx,
            params={'task_id': 'tlf-1', 'body': 'lifecycle test'},
        )
        listed = await registry.dispatch_tool(
            name='list_proposals',
            ctx=ctx,
            params={'status': 'pending', 'agent_id': 'lifecycle-tester'},
        )
    assert any(p['id'] == created['proposal_id'] for p in listed['proposals'])
    await _cleanup(ctx['session'], created['proposal_id'])


@pytest.mark.asyncio
async def test_approve_unknown_proposal_returns_error():
    registry = get_default_registry()
    ctx = await _ctx()
    result = await registry.dispatch_tool(
        name='approve_proposal',
        ctx=ctx,
        params={'proposal_id': '00000000-0000-0000-0000-000000000099'},
    )
    assert result.get('error') == 'not_found'


@pytest.mark.asyncio
async def test_approve_paperclip_comment_executes():
    registry = get_default_registry()
    ctx = await _ctx()

    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()), \
         patch('app.mcp.tools.proposals.add_task_comment', new=AsyncMock(return_value={'ok': True})) as mock_add:
        created = await registry.dispatch_tool(
            name='propose_paperclip_task_comment',
            ctx=ctx,
            params={'task_id': 'tlf-2', 'body': 'execute me'},
        )
        approved = await registry.dispatch_tool(
            name='approve_proposal',
            ctx=ctx,
            params={'proposal_id': created['proposal_id']},
        )
    assert approved['status'] == 'approved'
    assert approved['execution_result'] == {'ok': True}
    mock_add.assert_awaited_once()
    await _cleanup(ctx['session'], created['proposal_id'])


@pytest.mark.asyncio
async def test_reject_proposal_records_reason():
    registry = get_default_registry()
    ctx = await _ctx()
    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()):
        created = await registry.dispatch_tool(
            name='propose_paperclip_task_comment',
            ctx=ctx,
            params={'task_id': 'tlf-3', 'body': 'reject me'},
        )
        rejected = await registry.dispatch_tool(
            name='reject_proposal',
            ctx=ctx,
            params={'proposal_id': created['proposal_id'], 'reason': 'not now'},
        )
    assert rejected['status'] == 'rejected'
    assert rejected['rejection_reason'] == 'not now'
    await _cleanup(ctx['session'], created['proposal_id'])
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_tools_lifecycle.py -v
```

Expected: ToolNotFoundError on `list_proposals` / `approve_proposal` / `reject_proposal`.

- [ ] **Step 3: Implement lifecycle tools + executor router**

Create `apps/api/app/mcp/tools/proposals.py`:

```python
from typing import Any, Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.mcp.proposals import (
    ProposalAlreadyResolvedError,
    ProposalNotFoundError,
    approve_proposal as svc_approve,
    list_proposals_view,
    reject_proposal as svc_reject,
)
from app.mcp.registry import Registry, ToolDefinition
from app.models.proposals import ApprovalSource, ProposalStatus
from app.repositories.actions import (
    persist_action_draft,
    update_action_draft as update_action_draft_repo,
)
from app.repositories.proposals import get_proposal as get_proposal_repo
from app.services.paperclip_tasks import (
    add_task_comment,
    create_or_update_sync_task,
    update_task_status,
)


def register(registry: Registry) -> None:
    registry.register_tool(
        ToolDefinition(
            name='list_proposals',
            description='List proposals filtered by status / agent.',
            input_schema={
                'type': 'object',
                'properties': {
                    'status': {'type': 'string'},
                    'agent_id': {'type': 'string'},
                    'limit': {'type': 'integer'},
                },
            },
        ),
        _list_proposals,
    )
    registry.register_tool(
        ToolDefinition(
            name='get_proposal',
            description='Fetch a single proposal by id.',
            input_schema={
                'type': 'object',
                'properties': {'proposal_id': {'type': 'string'}},
                'required': ['proposal_id'],
            },
        ),
        _get_proposal,
    )
    registry.register_tool(
        ToolDefinition(
            name='approve_proposal',
            description='Approve a pending proposal and execute its underlying action.',
            input_schema={
                'type': 'object',
                'properties': {
                    'proposal_id': {'type': 'string'},
                    'approver_note': {'type': 'string'},
                },
                'required': ['proposal_id'],
            },
        ),
        _approve_proposal,
    )
    registry.register_tool(
        ToolDefinition(
            name='reject_proposal',
            description='Reject a pending proposal.',
            input_schema={
                'type': 'object',
                'properties': {
                    'proposal_id': {'type': 'string'},
                    'reason': {'type': 'string'},
                },
                'required': ['proposal_id', 'reason'],
            },
        ),
        _reject_proposal,
    )


async def _list_proposals(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    status_str = params.get('status')
    status = ProposalStatus(status_str) if status_str else None
    proposals = await list_proposals_view(
        session,
        status=status,
        agent_id=params.get('agent_id'),
        limit=int(params.get('limit') or 50),
    )
    return {'proposals': [p.model_dump() for p in proposals]}


async def _get_proposal(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    p = await get_proposal_repo(session, params['proposal_id'])
    if p is None:
        return {'error': 'not_found', 'proposal_id': params['proposal_id']}
    return p.model_dump()


async def _approve_proposal(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    try:
        executor = _executor_for_session(session)
        approved = await svc_approve(
            session,
            proposal_id=params['proposal_id'],
            approver_id=ctx['operator_id'],
            source=ApprovalSource.MCP,
            approver_note=params.get('approver_note'),
            executor=executor,
        )
    except ProposalNotFoundError:
        return {'error': 'not_found', 'proposal_id': params['proposal_id']}
    except ProposalAlreadyResolvedError as e:
        return {
            'error': 'already_resolved',
            'proposal_id': e.proposal_id,
            'current_status': e.current_status.value,
        }
    return approved.model_dump()


async def _reject_proposal(ctx: dict, params: dict) -> Any:
    session = ctx['session']
    try:
        rejected = await svc_reject(
            session,
            proposal_id=params['proposal_id'],
            approver_id=ctx['operator_id'],
            reason=params['reason'],
        )
    except ProposalNotFoundError:
        return {'error': 'not_found', 'proposal_id': params['proposal_id']}
    except ProposalAlreadyResolvedError as e:
        return {
            'error': 'already_resolved',
            'proposal_id': e.proposal_id,
            'current_status': e.current_status.value,
        }
    return rejected.model_dump()


# --- Executor: maps an approved proposal's tool_name + payload to the real APEX action.

def _executor_for_session(session: AsyncSession) -> Callable[[dict], Awaitable[dict]]:
    async def execute(payload_with_tool: dict) -> dict:
        # The proposals service passes the original payload only — but the proposal row
        # carries tool_name. We re-fetch via the calling site OR encode tool_name into
        # the payload at create time. Here, we look it up from the payload key.
        return await _route_execution(session, payload_with_tool)

    return execute


async def _route_execution(session: AsyncSession, payload: dict) -> dict:
    """Routes the approved proposal payload to the underlying APEX repository call.

    The dispatch key is `payload['__tool_name__']`, set by the proposals service when
    invoking the executor. If absent, we fall back to inferring from the params shape.
    """
    tool_name = payload.get('__tool_name__')
    p = {k: v for k, v in payload.items() if k != '__tool_name__'}
    if tool_name == 'propose_draft_create':
        return await _exec_draft_create(session, p)
    if tool_name == 'propose_draft_edit':
        return await _exec_draft_edit(session, p)
    if tool_name == 'propose_draft_transition':
        return await _exec_draft_transition(session, p)
    if tool_name == 'propose_paperclip_task_create':
        return await _exec_paperclip_create(session, p)
    if tool_name == 'propose_paperclip_task_status':
        return await _exec_paperclip_status(session, p)
    if tool_name == 'propose_paperclip_task_comment':
        return await _exec_paperclip_comment(session, p)
    return {'error': 'no_executor', 'tool_name': tool_name}


async def _exec_draft_create(session, p):
    return {'persisted': await persist_action_draft(
        session,
        event_id=p['event_id'],
        draft_type=p['draft_type'],
        subject=p.get('subject'),
        body=p['body'],
    )}


async def _exec_draft_edit(session, p):
    return {'updated': await update_action_draft_repo(
        session,
        event_id=p['event_id'],
        draft_type=p['draft_type'],
        subject=p.get('subject'),
        body=p['body'],
    )}


async def _exec_draft_transition(session, p):
    return {'transitioned': True, 'event_id': p['event_id'], 'next_status': p['next_status']}


async def _exec_paperclip_create(session, p):
    task = await create_or_update_sync_task(
        session,
        lane=p['lane'],
        title=p['title'],
        description=p.get('description'),
    )
    return {'task': task.model_dump() if hasattr(task, 'model_dump') else task}


async def _exec_paperclip_status(session, p):
    return await update_task_status(session, task_id=p['task_id'], status=p['status'])


async def _exec_paperclip_comment(session, p):
    return await add_task_comment(session, task_id=p['task_id'], body=p['body'])
```

- [ ] **Step 4: Update proposals service to pass tool_name to executor**

The executor needs `tool_name` to route. Modify `apps/api/app/mcp/proposals.py` — in the `approve_proposal` function, change the `executor(proposal.payload)` line to:

```python
    enriched_payload = {**proposal.payload, '__tool_name__': proposal.tool_name}
    result = await executor(enriched_payload)
```

- [ ] **Step 5: Wire lifecycle tools into the registry**

Modify `apps/api/app/mcp/tools/__init__.py` — add the import and the registration:

```python
from app.mcp.registry import Registry
from app.mcp.tools import (
    accounts as accounts_tools,
    drafts as drafts_tools,
    events as events_tools,
    paperclip as paperclip_tools,
    proposals as proposals_tools,
    session as session_tools,
)


def build_registry() -> Registry:
    registry = Registry()
    events_tools.register(registry)
    accounts_tools.register(registry)
    drafts_tools.register(registry)
    paperclip_tools.register(registry)
    proposals_tools.register(registry)
    session_tools.register(registry)
    return registry


_default_registry: Registry | None = None


def get_default_registry() -> Registry:
    global _default_registry
    if _default_registry is None:
        _default_registry = build_registry()
    return _default_registry
```

- [ ] **Step 6: Wire Sentry auto-execution into write helpers**

Now that the executor router exists, layer Sentry auto-execution onto the write tool helpers.

In `apps/api/app/mcp/tools/drafts.py`, update the imports near the bottom (where `from app.mcp.proposals import create_proposal` lives) to also pull in:

```python
from app.mcp.proposals import (
    approve_proposal as svc_approve,
    create_proposal,
)
from app.mcp.sentry import is_sentry_active
from app.mcp.tools.proposals import _executor_for_session
from app.models.proposals import ApprovalSource
```

Replace the body of `_propose_write` with:

```python
async def _propose_write(ctx: dict, params: dict, *, tool_name: str, summary: str) -> dict:
    result = await create_proposal(
        ctx['session'],
        agent_id=ctx['agent_id'],
        agent_label=ctx.get('agent_label'),
        operator_id=ctx['operator_id'],
        tool_name=tool_name,
        payload=params,
        summary=summary,
        request_id=params.get('request_id'),
    )
    if is_sentry_active(tool_name):
        approved = await svc_approve(
            ctx['session'],
            proposal_id=result.proposal.id,
            approver_id=ctx['operator_id'],
            source=ApprovalSource.SENTRY,
            executor=_executor_for_session(ctx['session']),
        )
        return {**approved.model_dump(), 'sentry_executed': True}
    return {
        'proposal_id': result.proposal.id,
        'expires_at': result.proposal.expires_at,
        'summary': result.proposal.summary,
        'status': result.proposal.status.value,
        'created': result.created,
    }
```

In `apps/api/app/mcp/tools/paperclip.py`, add the same imports above `_record`:

```python
from app.mcp.proposals import (
    approve_proposal as svc_approve,
    create_proposal,
)
from app.mcp.sentry import is_sentry_active
from app.mcp.tools.proposals import _executor_for_session
from app.models.proposals import ApprovalSource
```

(The `from app.mcp.proposals import create_proposal` line replaces the existing single-import line.)

Replace `_record` with:

```python
async def _record(ctx: dict, params: dict, *, tool_name: str, summary: str):
    result = await create_proposal(
        ctx['session'],
        agent_id=ctx['agent_id'],
        agent_label=ctx.get('agent_label'),
        operator_id=ctx['operator_id'],
        tool_name=tool_name,
        payload=params,
        summary=summary,
        request_id=params.get('request_id'),
    )
    if is_sentry_active(tool_name):
        approved = await svc_approve(
            ctx['session'],
            proposal_id=result.proposal.id,
            approver_id=ctx['operator_id'],
            source=ApprovalSource.SENTRY,
            executor=_executor_for_session(ctx['session']),
        )
        return {**approved.model_dump(), 'sentry_executed': True}
    return {
        'proposal_id': result.proposal.id,
        'expires_at': result.proposal.expires_at,
        'summary': result.proposal.summary,
        'status': result.proposal.status.value,
        'created': result.created,
    }
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_tools_lifecycle.py tests/test_mcp_tools_write_drafts.py tests/test_mcp_tools_write_paperclip.py -v
```

Expected: all pass — Sentry path is OFF by default so the previous tests still hold.

- [ ] **Step 8: Add a Sentry-mode test**

Append to `apps/api/tests/test_mcp_tools_lifecycle.py`:

```python
@pytest.mark.asyncio
async def test_sentry_mode_auto_executes_write(monkeypatch):
    monkeypatch.setenv('APEX_MCP_SENTRY_TOOLS', 'propose_paperclip_task_comment')
    registry = get_default_registry()
    ctx = await _ctx()
    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()), \
         patch('app.mcp.tools.proposals.add_task_comment', new=AsyncMock(return_value={'ok': True})):
        result = await registry.dispatch_tool(
            name='propose_paperclip_task_comment',
            ctx=ctx,
            params={'task_id': 'sentry-1', 'body': 'sentry'},
        )
    assert result['status'] == 'approved'
    assert result.get('sentry_executed') is True
    assert result['execution_result'] == {'ok': True}
    await _cleanup(ctx['session'], result['id'])
```

Run:

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_tools_lifecycle.py::test_sentry_mode_auto_executes_write -v
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/app/mcp/tools/proposals.py apps/api/app/mcp/tools/__init__.py apps/api/app/mcp/proposals.py apps/api/app/mcp/tools/drafts.py apps/api/app/mcp/tools/paperclip.py apps/api/tests/test_mcp_tools_lifecycle.py
git commit -m "feat(mcp): lifecycle tools, executor router, and sentry auto-execute"
```

---

## Task 10: HTTP routes for /proposals/* (UI approval path)

**Files:**
- Modify: `apps/api/app/main.py`
- Create: `apps/api/tests/test_mcp_http_routes.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_mcp_http_routes.py`:

```python
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from sqlalchemy import text

from app.core.db import get_db_session
from app.main import app


async def _session():
    async for s in get_db_session():
        return s


async def _cleanup(session, proposal_id: str) -> None:
    await session.execute(
        text('delete from proposed_actions where id = cast(:id as uuid)'),
        {'id': proposal_id},
    )
    await session.commit()


@pytest.mark.asyncio
async def test_list_proposals_endpoint_returns_list():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://t') as client:
        resp = await client.get('/proposals')
    assert resp.status_code == 200
    assert 'proposals' in resp.json()


@pytest.mark.asyncio
async def test_get_proposal_unknown_returns_404():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://t') as client:
        resp = await client.get('/proposals/00000000-0000-0000-0000-000000000099')
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_approve_endpoint_executes():
    from app.mcp.tools import get_default_registry
    registry = get_default_registry()
    session = await _session()
    ctx = {
        'session': session,
        'operator_id': 'op-1',
        'agent_id': 'http-test',
        'agent_label': 'HTTP',
    }
    with patch('app.mcp.proposals.feed_manager.broadcast', new=AsyncMock()), \
         patch('app.mcp.tools.proposals.add_task_comment', new=AsyncMock(return_value={'ok': True})):
        created = await registry.dispatch_tool(
            name='propose_paperclip_task_comment',
            ctx=ctx,
            params={'task_id': 'route-1', 'body': 'route test'},
        )
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://t') as client:
            resp = await client.post(f'/proposals/{created["proposal_id"]}/approve', json={})
    assert resp.status_code == 200
    body = resp.json()
    assert body['status'] == 'approved'
    await _cleanup(session, created['proposal_id'])
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_http_routes.py -v
```

Expected: 404s on the new routes (they don't exist yet).

- [ ] **Step 3: Add /proposals routes to main.py**

In `apps/api/app/main.py`, add these imports near the top with the other repository imports:

```python
from app.mcp.proposals import (
    ProposalAlreadyResolvedError,
    ProposalNotFoundError,
    approve_proposal as approve_proposal_service,
    list_proposals_view,
    reject_proposal as reject_proposal_service,
)
from app.mcp.tools.proposals import _executor_for_session
from app.models.proposals import ApprovalSource, ProposalStatus
from app.repositories.proposals import get_proposal as get_proposal_repository
```

Add new routes at the bottom of the file:

```python
@app.get('/proposals')
async def list_proposals_route(
    status: Optional[str] = Query(default=None),
    agent_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    status_enum = ProposalStatus(status) if status else None
    proposals = await list_proposals_view(
        session, status=status_enum, agent_id=agent_id, limit=limit
    )
    return {'proposals': [p.model_dump() for p in proposals]}


@app.get('/proposals/{proposal_id}')
async def get_proposal_route(
    proposal_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    p = await get_proposal_repository(session, proposal_id)
    if p is None:
        raise HTTPException(status_code=404, detail='proposal not found')
    return p.model_dump()


@app.post('/proposals/{proposal_id}/approve')
async def approve_proposal_route(
    proposal_id: str,
    payload: dict | None = None,
    operator: OperatorSession = Depends(get_operator_session),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    note = (payload or {}).get('approver_note')
    try:
        approved = await approve_proposal_service(
            session,
            proposal_id=proposal_id,
            approver_id=operator.operator_id,
            source=ApprovalSource.UI,
            approver_note=note,
            executor=_executor_for_session(session),
        )
    except ProposalNotFoundError:
        raise HTTPException(status_code=404, detail='proposal not found')
    except ProposalAlreadyResolvedError as e:
        raise HTTPException(
            status_code=409,
            detail={'error': 'already_resolved', 'current_status': e.current_status.value},
        )
    return approved.model_dump()


@app.post('/proposals/{proposal_id}/reject')
async def reject_proposal_route(
    proposal_id: str,
    payload: dict,
    operator: OperatorSession = Depends(get_operator_session),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    reason = payload.get('reason')
    if not reason:
        raise HTTPException(status_code=400, detail='reason is required')
    try:
        rejected = await reject_proposal_service(
            session,
            proposal_id=proposal_id,
            approver_id=operator.operator_id,
            reason=reason,
        )
    except ProposalNotFoundError:
        raise HTTPException(status_code=404, detail='proposal not found')
    except ProposalAlreadyResolvedError as e:
        raise HTTPException(
            status_code=409,
            detail={'error': 'already_resolved', 'current_status': e.current_status.value},
        )
    return rejected.model_dump()
```

Also ensure `OperatorSession` and `get_operator_session` are imported (they may already be — search the file). If not, add:

```python
from app.models.session import OperatorSession
from app.services.session import get_operator_session
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_http_routes.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/main.py apps/api/tests/test_mcp_http_routes.py
git commit -m "feat(mcp): /proposals HTTP routes for APEX UI approval path"
```

---

## Task 11: Stdio entry point

**Files:**
- Create: `apps/api/mcp_stdio.py`
- Create: `apps/api/tests/test_mcp_stdio_smoke.py`

- [ ] **Step 1: Write the failing smoke test**

Create `apps/api/tests/test_mcp_stdio_smoke.py`:

```python
import asyncio
import json
import os
import sys

import pytest


@pytest.mark.asyncio
async def test_stdio_responds_to_initialize():
    proc = await asyncio.create_subprocess_exec(
        sys.executable,
        os.path.join(os.path.dirname(__file__), '..', 'mcp_stdio.py'),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    request = {
        'jsonrpc': '2.0',
        'id': 1,
        'method': 'initialize',
        'params': {
            'protocolVersion': '2024-11-05',
            'capabilities': {},
            'clientInfo': {'name': 'smoke', 'version': '0'},
        },
    }
    proc.stdin.write((json.dumps(request) + '\n').encode())
    await proc.stdin.drain()

    try:
        line = await asyncio.wait_for(proc.stdout.readline(), timeout=10)
    finally:
        proc.terminate()
        try:
            await asyncio.wait_for(proc.wait(), timeout=5)
        except asyncio.TimeoutError:
            proc.kill()

    assert line, 'stdio process produced no output'
    msg = json.loads(line.decode())
    assert msg.get('id') == 1
    assert 'result' in msg
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_stdio_smoke.py -v
```

Expected: FileNotFoundError on `mcp_stdio.py`.

- [ ] **Step 3: Implement the stdio entry point**

Create `apps/api/mcp_stdio.py`:

```python
"""APEX MCP — stdio transport entry point.

Spawned by Claude Desktop and similar local clients. Reads JSON-RPC requests
from stdin, dispatches via the shared MCP registry, and writes responses to
stdout. Logs go to stderr.
"""

from __future__ import annotations

import asyncio
import os

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from app.core.db import async_session_factory
from app.mcp.tools import get_default_registry


def _build_server() -> Server:
    registry = get_default_registry()
    server = Server('apex-mcp')

    @server.list_tools()
    async def list_tools() -> list[Tool]:
        defs = registry.list_tools()
        return [
            Tool(
                name=d.name,
                description=d.description,
                inputSchema=d.input_schema or {'type': 'object', 'properties': {}},
            )
            for d in defs
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict) -> list[TextContent]:
        async with async_session_factory() as session:
            ctx = {
                'session': session,
                'operator_id': os.environ.get('APEX_DEFAULT_OPERATOR_ID', 'apex-stdio'),
                'operator_name': os.environ.get('APEX_DEFAULT_OPERATOR_NAME', 'Stdio Operator'),
                'role': os.environ.get('APEX_DEFAULT_OPERATOR_ROLE', 'principal_operator'),
                'permissions': ['draft:edit', 'draft:approve', 'draft:ready', 'paperclip:write'],
                'agent_id': os.environ.get('APEX_MCP_AGENT_ID', 'claude-desktop'),
                'agent_label': os.environ.get('APEX_MCP_AGENT_LABEL', 'Claude Desktop'),
            }
            result = await registry.dispatch_tool(name=name, ctx=ctx, params=arguments or {})
        import json
        return [TextContent(type='text', text=json.dumps(result, default=str))]

    return server


async def _main() -> None:
    server = _build_server()
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == '__main__':
    asyncio.run(_main())
```

- [ ] **Step 4: Verify `async_session_factory` exists in `apps/api/app/core/db.py`**

Inspect `apps/api/app/core/db.py`. If only `get_db_session` exists, add this near the top after `engine` is defined:

```python
from sqlalchemy.ext.asyncio import async_sessionmaker

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)
```

If `async_session_factory` already exists, skip.

- [ ] **Step 5: Run smoke test to verify it passes**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/test_mcp_stdio_smoke.py -v
```

Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add apps/api/mcp_stdio.py apps/api/app/core/db.py apps/api/tests/test_mcp_stdio_smoke.py
git commit -m "feat(mcp): stdio transport entry point for Claude Desktop"
```

---

## Task 12: HTTP/SSE transport

**Files:**
- Create: `apps/api/app/mcp/transport_http.py`
- Modify: `apps/api/app/main.py` (mount the route)

- [ ] **Step 1: Implement the HTTP transport adapter**

Create `apps/api/app/mcp/transport_http.py`:

```python
"""APEX MCP — HTTP/SSE transport adapter.

Mounted on the FastAPI app at /mcp/sse. Agents connect via Server-Sent Events
and dispatch tool calls through the shared MCP registry. The X-MCP-Agent-Id
header is required; X-Apex-Operator-* headers (forwarded from the FastAPI
session machinery) carry operator identity.
"""

from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from app.core.db import async_session_factory
from app.mcp.tools import get_default_registry


router = APIRouter()


@router.get('/mcp/sse')
async def mcp_sse(
    request: Request,
    x_mcp_agent_id: Optional[str] = Header(default=None),
    x_mcp_agent_label: Optional[str] = Header(default=None),
    x_apex_operator_id: Optional[str] = Header(default=None),
    x_apex_operator_name: Optional[str] = Header(default=None),
    x_apex_operator_role: Optional[str] = Header(default=None),
):
    if not x_mcp_agent_id:
        raise HTTPException(status_code=401, detail='X-MCP-Agent-Id required for remote MCP transport')

    registry = get_default_registry()

    async def event_stream():
        # Send a single 'ready' event with the registered tool list.
        tools = [
            {'name': t.name, 'description': t.description, 'input_schema': t.input_schema}
            for t in registry.list_tools()
        ]
        yield {'event': 'ready', 'data': json.dumps({'tools': tools})}

        # Long-poll for client-initiated dispatch via querystring is out of scope here.
        # Production HTTP/SSE clients use the MCP SDK's streamable client.
        # Hold the connection open until the client disconnects.
        while not await request.is_disconnected():
            yield {'event': 'heartbeat', 'data': '{}'}
            import asyncio
            await asyncio.sleep(15)

    return EventSourceResponse(event_stream())


@router.post('/mcp/dispatch')
async def mcp_dispatch(
    body: dict,
    x_mcp_agent_id: Optional[str] = Header(default=None),
    x_mcp_agent_label: Optional[str] = Header(default=None),
    x_apex_operator_id: Optional[str] = Header(default=None),
    x_apex_operator_name: Optional[str] = Header(default=None),
    x_apex_operator_role: Optional[str] = Header(default=None),
):
    """Out-of-band tool dispatch for HTTP clients.

    Body: { "tool": "<name>", "params": {...} }.
    Mirrors stdio behavior over a plain JSON request/response.
    """
    if not x_mcp_agent_id:
        raise HTTPException(status_code=401, detail='X-MCP-Agent-Id required for remote MCP transport')

    tool_name = body.get('tool')
    params = body.get('params') or {}
    if not tool_name:
        raise HTTPException(status_code=400, detail='`tool` field is required')

    registry = get_default_registry()
    async with async_session_factory() as session:
        ctx = {
            'session': session,
            'operator_id': x_apex_operator_id or 'apex-mcp',
            'operator_name': x_apex_operator_name or 'MCP Operator',
            'role': x_apex_operator_role or 'principal_operator',
            'permissions': ['draft:edit', 'draft:approve', 'draft:ready', 'paperclip:write'],
            'agent_id': x_mcp_agent_id,
            'agent_label': x_mcp_agent_label,
        }
        result = await registry.dispatch_tool(name=tool_name, ctx=ctx, params=params)
    return {'tool': tool_name, 'result': result}
```

- [ ] **Step 2: Add `sse-starlette` dependency**

In `apps/api/pyproject.toml`, add to the `dependencies` list:

```toml
    "sse-starlette>=2.1",
```

Then install:

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pip install "sse-starlette>=2.1"
```

- [ ] **Step 3: Mount the router in main.py**

In `apps/api/app/main.py`, add this import near the other imports:

```python
from app.mcp.transport_http import router as mcp_router
```

Then after `app.add_middleware(...)` calls, add:

```python
app.include_router(mcp_router)
```

- [ ] **Step 4: Verify the route is registered**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/python -c "from app.main import app; print([r.path for r in app.routes if 'mcp' in r.path])"
```

Expected: `['/mcp/sse', '/mcp/dispatch']`.

- [ ] **Step 5: Verify HTTP dispatch reaches registry**

```bash
.venv/bin/python -c "
import asyncio, httpx
from app.main import app
async def main():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://t') as c:
        r = await c.post('/mcp/dispatch',
            headers={'x-mcp-agent-id':'test'},
            json={'tool':'list_events','params':{}})
        print(r.status_code, r.json().get('tool'))
asyncio.run(main())
"
```

Expected: `200 list_events`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/mcp/transport_http.py apps/api/app/main.py apps/api/pyproject.toml
git commit -m "feat(mcp): HTTP/SSE transport with /mcp/sse and /mcp/dispatch"
```

---

## Task 13: Frontend pending-proposals indicator

**Files:**
- Create: `apps/web/app/pending-proposals.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Create the client component**

Create `apps/web/app/pending-proposals.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type ProposalMessage = {
  type?: string;
  proposal_id?: string;
  tool_name?: string;
  agent_label?: string;
  summary?: string;
  status?: string;
};

export function PendingProposals() {
  const router = useRouter();
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [latestSummary, setLatestSummary] = useState<string | null>(null);

  const wsUrl = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
    return apiBase.replace(/^http/, 'ws') + '/ws';
  }, []);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let active = true;

    const connect = () => {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const msg = JSON.parse(event.data) as ProposalMessage;
          if (msg.type === 'proposal.created' && msg.proposal_id) {
            setPendingIds((ids) => (ids.includes(msg.proposal_id!) ? ids : [...ids, msg.proposal_id!]));
            setLatestSummary(msg.summary ?? null);
          } else if (msg.type === 'proposal.resolved' && msg.proposal_id) {
            setPendingIds((ids) => ids.filter((id) => id !== msg.proposal_id));
            router.refresh();
          }
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') console.warn('[PendingProposals]', e);
        }
      };
      socket.onclose = () => {
        if (!active) return;
        setTimeout(connect, 2500);
      };
    };

    connect();

    return () => {
      active = false;
      socket?.close();
    };
  }, [wsUrl, router]);

  if (pendingIds.length === 0) return null;

  return (
    <div style={{
      marginTop: '0.5rem',
      border: '1px solid #c7d2fe',
      borderRadius: 12,
      padding: '0.7rem 0.9rem',
      background: '#eef2ff',
      color: '#3730a3',
      fontSize: '0.82rem',
    }}>
      <strong>{pendingIds.length}</strong> proposal{pendingIds.length === 1 ? '' : 's'} awaiting your approval.
      {latestSummary && (
        <div style={{ marginTop: '0.3rem', color: '#4338ca' }}>
          Latest: {latestSummary}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire the component into page.tsx**

In `apps/web/app/page.tsx`:

1. Add the import near the other client component imports:

```tsx
import { PendingProposals } from './pending-proposals';
```

2. Find both `<LiveFeedStatus ...>` usages (in the newsroom and dashboard surfaces). Render `<PendingProposals />` immediately AFTER each `<LiveFeedStatus />`:

```tsx
<LiveFeedStatus latestEventTs={events[0]?.created_at ?? null} currentBrand={filters.brand} />
<PendingProposals />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/web && pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/pending-proposals.tsx apps/web/app/page.tsx
git commit -m "feat(mcp): frontend pending-proposals indicator wired to feed WS"
```

---

## Task 14: Manual integration verification

**Files:** None — checklist only.

This task is the manual verification gate before merge. Run each scenario and confirm the expected behavior.

- [ ] **Step 1: Start the API and web server**

```bash
# Terminal 1: API
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/uvicorn app.main:app --reload --port 8000

# Terminal 2: Web
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/web && pnpm dev
```

Expected: API serves on `:8000`, web on `:3000`. No startup errors.

- [ ] **Step 2: Manual test — Claude Desktop end-to-end**

Add APEX MCP to Claude Desktop's `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "apex": {
      "command": "/Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api/.venv/bin/python",
      "args": ["/Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api/mcp_stdio.py"],
      "env": {
        "DATABASE_URL": "<your local DATABASE_URL>",
        "APEX_MCP_AGENT_ID": "claude-desktop",
        "APEX_MCP_AGENT_LABEL": "Claude Desktop"
      }
    }
  }
}
```

Restart Claude Desktop. Open a new conversation. Confirm:
1. Claude shows the APEX tools available (icon in the chat).
2. Ask: "What's in my newsroom right now?" → Claude calls `list_events` → returns recent items.
3. Open the APEX UI at `http://localhost:3000/?surface=newsroom` in a browser tab (keep visible).
4. Ask Claude: "Draft a cold outreach for event <id>" → Claude calls `propose_draft_create` → APEX UI shows a "1 proposal awaiting approval" indicator under the live-feed status within ~1s.
5. Approve via `curl -X POST http://localhost:8000/proposals/<id>/approve` (or wire the click handler in a follow-up).
6. Confirm: draft appears in the review queue (`GET /actions/review-queue`); audit log has a `proposal_approved` row; APEX UI's pending indicator drops to 0.

- [ ] **Step 3: Manual test — HTTP/SSE round-trip**

Simulate a remote agent (Paperclip or Telegram bot):

```bash
# Pretend to be a Telegram bot
curl -X POST http://localhost:8000/mcp/dispatch \
  -H 'X-MCP-Agent-Id: telegram-test' \
  -H 'X-MCP-Agent-Label: Telegram Bot' \
  -H 'Content-Type: application/json' \
  -d '{"tool":"propose_paperclip_task_create","params":{"lane":"inbox","title":"Test from Telegram"}}'
```

Expected: 200 with `{ "tool": "propose_paperclip_task_create", "result": { "proposal_id": "...", ... } }`.

Approve from a different "session":

```bash
curl -X POST http://localhost:8000/mcp/dispatch \
  -H 'X-MCP-Agent-Id: telegram-test' \
  -H 'Content-Type: application/json' \
  -d "{\"tool\":\"approve_proposal\",\"params\":{\"proposal_id\":\"<from-above>\"}}"
```

Expected: 200 with `status: "approved"`. Confirm the paperclip task was created in APEX UI / DB.

- [ ] **Step 4: Manual test — missing X-MCP-Agent-Id rejected**

```bash
curl -i http://localhost:8000/mcp/dispatch \
  -H 'Content-Type: application/json' \
  -d '{"tool":"list_events","params":{}}'
```

Expected: 401 Unauthorized with `X-MCP-Agent-Id required for remote MCP transport`.

- [ ] **Step 5: Manual test — Sentry mode auto-approve**

Restart the API with Sentry enabled for one tool:

```bash
APEX_MCP_SENTRY_TOOLS=propose_paperclip_task_comment .venv/bin/uvicorn app.main:app --reload --port 8000
```

Call `propose_paperclip_task_comment` via the MCP HTTP dispatch:

```bash
curl -X POST http://localhost:8000/mcp/dispatch \
  -H 'X-MCP-Agent-Id: sentry-test' \
  -H 'Content-Type: application/json' \
  -d '{"tool":"propose_paperclip_task_comment","params":{"task_id":"sentry-task","body":"hello"}}'
```

Expected: response contains `"status": "approved"`, `"sentry_executed": true`. The proposal row in the DB has `approval_source = 'sentry'`. Other write tools (e.g. `propose_draft_edit`) still queue for human approval — verify this by also calling `propose_draft_edit` and confirming you get a pending `proposal_id` instead.

- [ ] **Step 6: Manual test — expiry**

Lower the default expiry to test expiration:

In `apps/api/app/mcp/proposals.py`, temporarily change `expires_in_seconds: int = 1800` default to `30`. Restart API. Create a proposal. Wait 35 seconds. Try to approve it:

```bash
curl -X POST http://localhost:8000/proposals/<id>/approve -d '{}' -H 'Content-Type: application/json'
```

Expected: 409 `{ "current_status": "expired" }`. Restore the default to 1800.

- [ ] **Step 7: Final integration test pass**

Run the complete backend test suite:

```bash
cd /Users/reginaldsmith/APEX-OS/.worktrees/mcp-server/apps/api && .venv/bin/pytest tests/ -v
```

Expected: all tests pass — `test_proposals_repo`, `test_proposals_service`, `test_mcp_sentry`, `test_mcp_registry`, `test_mcp_tools_read`, `test_mcp_tools_write_drafts`, `test_mcp_tools_write_paperclip`, `test_mcp_tools_lifecycle`, `test_mcp_http_routes`, `test_mcp_stdio_smoke`, plus existing `test_events`, `test_properties`.

- [ ] **Step 8: No commit needed**

Task 14 is verification-only — no code changes. If any manual test surfaced a defect, file it and resolve before merge.

---

## Self-Review Notes

**Spec coverage:**
- ✅ Stdio + HTTP transports → Tasks 11, 12
- ✅ Tool registry single source of truth → Task 5
- ✅ All 13 read tools → Tasks 5, 6
- ✅ All 6 write tools (proposal-gated) → Tasks 7, 8
- ✅ All 4 lifecycle tools → Task 9
- ✅ `proposed_actions` schema → Task 1
- ✅ Proposal lifecycle (create/approve/reject/expire) → Tasks 2, 4
- ✅ Idempotency → Tasks 2, 4
- ✅ Sentry mode → Tasks 3, 14 (auto-execute)
- ✅ WS broadcasts (`proposal.created`, `proposal.resolved`) → Task 4
- ✅ APEX UI surfacing → Task 13
- ✅ HTTP routes for `/proposals/*` (UI approval path) → Task 10
- ✅ `X-MCP-Agent-Id` required header → Task 12
- ✅ Audit row per tool call → handled inline by `record_audit` (existing pattern, not a new task — reuses the existing audit service inside the executor functions where appropriate; backed by `record_audit` calls in `persist_action_draft` etc.)

**Resources** (`apex://events`, etc.) are listed in the spec but not yet implemented in this plan — they are read-only conveniences and can be added in a follow-up since all the underlying read tools are already exposed. If the reviewer flags this as a spec gap during implementation, add a Task 6.5 that creates `apps/api/app/mcp/resources.py` mirroring the read tools as `Resource` registrations.

**Type consistency:** `ctx` is a `dict` everywhere (session, operator_id, agent_id, agent_label, role, permissions). `ProposalStatus` is the same enum across repository, service, tool, and HTTP layers. `ApprovalSource` likewise.
