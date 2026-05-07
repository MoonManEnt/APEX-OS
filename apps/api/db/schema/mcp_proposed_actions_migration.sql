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
