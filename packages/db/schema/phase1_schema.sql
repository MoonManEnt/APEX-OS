-- APEX OS Phase 1 foundational schema
-- WS-1: ingest → classify → persist

create extension if not exists pgcrypto;

create type brand_enum as enum (
  'clean_scapes',
  'partners_cc',
  'scout_security',
  'ecs_texas',
  'revival_restoration'
);

create type event_type_enum as enum (
  'ownership_transfer',
  'lease_signed',
  'lease_expiring',
  'personnel_change',
  'construction_start',
  'construction_completion',
  'permit_filed',
  'zoning_action',
  'capital_raise',
  'corporate_relocation',
  'data_center_announcement',
  'vendor_change_signal',
  'market_news',
  'other'
);

create type building_type_enum as enum (
  'office',
  'multifamily',
  'retail',
  'industrial',
  'data_center',
  'mixed_use',
  'hospitality',
  'medical',
  'other'
);

create type company_type_enum as enum (
  'owner',
  'property_manager',
  'broker',
  'tenant',
  'vendor',
  'developer',
  'investor',
  'lender',
  'other'
);

create type pipeline_stage_enum as enum (
  'identified',
  'qualified',
  'contacting',
  'conversation',
  'proposal',
  'verbal',
  'won',
  'lost',
  'nurture'
);

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  slug brand_enum unique not null,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  company_type company_type_enum not null default 'other',
  primary_brand brand_enum,
  brand_relevance brand_enum[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  name text,
  account_id uuid references accounts(id) on delete set null,
  building_type building_type_enum not null default 'other',
  address_line_1 text,
  city text,
  state text,
  postal_code text,
  coordinates jsonb,
  current_vendors jsonb not null default '[]'::jsonb,
  deed_history jsonb not null default '[]'::jsonb,
  warm_path_brokers text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  first_name text,
  last_name text,
  email text,
  title text,
  phone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists raw_scrapes (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text not null,
  source_hash text not null unique,
  fetched_at timestamptz not null default now(),
  published_at timestamptz,
  title text,
  raw_text text,
  payload jsonb not null default '{}'::jsonb,
  parse_status text not null default 'fetched',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  raw_scrape_id uuid references raw_scrapes(id) on delete set null,
  property_id uuid references properties(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  title text not null,
  summary text,
  event_type event_type_enum not null default 'other',
  market text,
  urgency_score integer not null default 0,
  relevance_score integer not null default 0,
  confidence_score numeric(5,2) not null default 0,
  primary_brand brand_enum,
  brand_relevance brand_enum[] not null default '{}',
  badges text[] not null default '{}',
  source_url text,
  event_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_classifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  classifier_version text not null,
  model_name text not null,
  rationale text,
  extracted_entities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists actions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  property_id uuid references properties(id) on delete set null,
  voice_note_id uuid,
  primary_brand brand_enum,
  kind text not null,
  status text not null default 'draft',
  subject text,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pipeline_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  primary_brand brand_enum not null,
  stage pipeline_stage_enum not null default 'identified',
  relationship_depth integer not null default 0,
  last_touch_at timestamptz,
  next_action_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists voice_notes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete set null,
  property_id uuid references properties(id) on delete set null,
  event_id uuid references events(id) on delete set null,
  storage_url text,
  transcript text,
  action_items jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table actions
  add constraint actions_voice_note_id_fkey
  foreign key (voice_note_id)
  references voice_notes(id)
  on delete set null;

create index if not exists idx_events_primary_brand on events(primary_brand);
create index if not exists idx_events_event_type on events(event_type);
create index if not exists idx_events_created_at on events(created_at desc);
create index if not exists idx_events_brand_relevance on events using gin (brand_relevance);
create index if not exists idx_events_badges on events using gin (badges);
create index if not exists idx_properties_coordinates on properties using gin (coordinates);
create index if not exists idx_properties_current_vendors on properties using gin (current_vendors);
create index if not exists idx_properties_deed_history on properties using gin (deed_history);
