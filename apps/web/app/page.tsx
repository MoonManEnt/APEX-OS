import { EventModal } from './event-modal';
import { LiveFeedStatus } from './live-feed-status';
import { PwaInstallCta } from './pwa-install-cta';

type EventItem = {
  id: string;
  title: string;
  summary: string | null;
  primary_brand: string | null;
  relevance_score: number;
  confidence_score?: number;
  badges?: string[];
  event_type?: string | null;
  market?: string | null;
  source_url?: string | null;
  latest_draft_type?: string | null;
  latest_draft_status?: string | null;
  latest_draft_updated_at?: string | null;
  created_at?: string;
};

type EventDetail = EventItem & {
  raw_scrape_id?: string | null;
  property_id?: string | null;
  property_name?: string | null;
  account_id?: string | null;
  account_name?: string | null;
  metadata?: Record<string, unknown>;
};

type ActionDraft = {
  event_id: string;
  title: string;
  body: string;
  audience: string;
  recommended_brand: string;
  why_it_matters: string;
  signal_posture: string;
  model_name: string;
  used_fallback: boolean;
  context_notes: string[];
  updated_at?: string | null;
  metadata?: {
    action_id?: string;
    operator_name?: string;
    assigned_reviewer_name?: string;
    reviewed_by_name?: string;
  };
  draft_type?: string;
  draft_status?: string;
  edited_by_operator?: boolean;
};

type ActionDraftHistoryItem = {
  action_id: string;
  title: string;
  body: string;
  model_name: string;
  used_fallback: boolean;
  updated_at?: string | null;
  draft_type?: string;
  draft_status?: string;
  edited_by_operator?: boolean;
};

type ActionReviewQueueItem = {
  action_id: string;
  event_id: string;
  title: string;
  recommended_brand: string;
  draft_type: string;
  draft_status: string;
  updated_at?: string | null;
  operator_name?: string | null;
  assigned_reviewer_name?: string | null;
  reviewed_by_name?: string | null;
};

type PaperclipContextItem = {
  title: string;
  source: string;
  excerpt: string;
};

type PaperclipSyncEntry = {
  timestamp: string;
  workstream: string;
  status: string;
  summary: string;
  verification: string[];
};

type PaperclipContextResponse = {
  status: string;
  items: PaperclipContextItem[];
  latest_sync?: PaperclipSyncEntry | null;
};

type PaperclipTaskComment = {
  timestamp: string;
  body: string;
};

type PaperclipTask = {
  id: string;
  title: string;
  event_id?: string | null;
  lane: string;
  status: string;
  summary: string;
  created_at: string;
  updated_at: string;
  comments: PaperclipTaskComment[];
};

type AuditEntry = {
  id: string;
  timestamp: string;
  actor: string;
  entity_type: string;
  entity_id: string;
  event_id?: string | null;
  action: string;
  summary: string;
  metadata: Record<string, unknown>;
};

type OperatorSession = {
  operator_id: string;
  operator_name: string;
  role: string;
  auth_mode: string;
  permissions: string[];
};

type ContactRecord = {
  id: string;
  initials: string;
  name: string;
  title: string;
  tier: 'T1' | 'T2' | 'T3';
  brands: string[];
  phone?: string;
  email?: string;
  linkedin?: string;
  intelligence: string;
};

type HomePageProps = {
  searchParams?: Promise<{
    brand?: string;
    eventType?: string;
    market?: string;
    selected?: string;
    draftType?: string;
    draftStatus?: string;
    surface?: string;
    contact?: string;
  }>;
};

type ApiResult<T> = {
  data: T;
  error: string | null;
};

const BRAND_META: Record<string, { label: string; short: string; color: string }> = {
  all: { label: 'All brands', short: 'A', color: '#ba7517' },
  clean_scapes: { label: 'Clean Scapes', short: 'CS', color: '#639922' },
  partners_cc: { label: 'Partners CC', short: 'PCC', color: '#5f5e5a' },
  scout_security: { label: 'Scout Security', short: 'SC', color: '#185FA5' },
  ecs_texas: { label: 'ECS of Texas', short: 'EC', color: '#1d9e75' },
  revival_restoration: { label: 'Revival', short: 'RV', color: '#7f77dd' },
};

const NAV_ITEMS = [
  { key: 'command', label: 'Command center', section: 'Daily flow' },
  { key: 'newsroom', label: 'Newsroom', section: 'Daily flow' },
  { key: 'xfeed', label: 'X signals', section: 'Daily flow' },
  { key: 'account', label: 'Account workspace', section: 'Intelligence' },
  { key: 'brain', label: 'Mind map', section: 'Intelligence' },
  { key: 'contacts', label: 'Contacts', section: 'Intelligence' },
  { key: 'map', label: 'Spatial map', section: 'Intelligence' },
  { key: 'pipeline', label: 'Pipeline', section: 'Action' },
  { key: 'proposal', label: 'Proposals', section: 'Action' },
  { key: 'sentry', label: 'Sentry mode', section: 'Action' },
  { key: 'brand', label: 'Brand profile', section: 'System' },
  { key: 'apify', label: 'Integrations', section: 'System' },
] as const;

const CONTACTS: ContactRecord[] = [
  {
    id: 'sh',
    initials: 'SH',
    name: 'Sarah Hendricks',
    title: 'VP Real Estate, Goldman Sachs',
    tier: 'T1',
    brands: ['scout_security', 'partners_cc', 'clean_scapes', 'ecs_texas'],
    phone: '+1 (212) 555-0184',
    email: 's.hendricks@gs.com',
    linkedin: 'linkedin.com/in/sarah-hendricks-cre',
    intelligence: 'Top decision-maker on the Dallas commitment. Vendor consolidation is likely a major NOI lever. Warm path runs through Chris Covo and Joel Behrens.',
  },
  {
    id: 'mc',
    initials: 'MC',
    name: 'Marcus Chen',
    title: 'SVP Procurement, Goldman Sachs',
    tier: 'T1',
    brands: ['partners_cc', 'scout_security'],
    phone: '+1 (212) 555-0291',
    email: 'm.chen@gs.com',
    linkedin: 'linkedin.com/in/marcus-chen-procurement',
    intelligence: 'Final signature authority on national vendor agreements. Do not lead here cold. Use Sarah or JLL as the champion path first.',
  },
  {
    id: 'lp',
    initials: 'LP',
    name: 'Lisa Park',
    title: 'Property Manager, JLL Dallas',
    tier: 'T2',
    brands: ['clean_scapes', 'partners_cc', 'scout_security'],
    phone: '+1 (214) 555-0411',
    email: 'lisa.park@jll.com',
    linkedin: 'linkedin.com/in/lisa-park-jll',
    intelligence: 'Local operations contact and strongest day-to-day champion candidate. Good bridge into renovation and vendor transition timing.',
  },
  {
    id: 'jb',
    initials: 'JB',
    name: 'Joel Behrens',
    title: 'SVP, Trammell Crow Houston',
    tier: 'T2',
    brands: ['partners_cc', 'scout_security'],
    phone: '+1 (713) 555-0670',
    email: 'j.behrens@trammellcrow.com',
    linkedin: 'linkedin.com/in/joel-behrens',
    intelligence: 'Promoted recently. Important bridge contact. Congratulate first, then use the relationship for a warm path request.',
  },
];

function formatTimestamp(value?: string | null): string {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function prettyBrand(value: string | null | undefined): string {
  if (!value) return 'Unassigned';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function sourceHost(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace('www.', '');
  } catch {
    return null;
  }
}

function linkageTone(value: string | null | undefined): 'neutral' | 'purple' | 'green' | 'amber' | 'red' {
  if (value === 'resolved' || value === 'high') return 'green';
  if (value === 'partial' || value === 'medium') return 'amber';
  if (value === 'unresolved' || value === 'low') return 'red';
  return 'neutral';
}

function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'purple' | 'green' | 'amber' | 'red' }) {
  const palette = {
    neutral: { bg: '#f3f4f6', color: '#374151' },
    purple: { bg: '#f3e8ff', color: '#6d28d9' },
    green: { bg: '#dcfce7', color: '#166534' },
    amber: { bg: '#fef3c7', color: '#92400e' },
    red: { bg: '#fee2e2', color: '#991b1b' },
  } as const;
  const style = palette[tone];
  return <span style={{ background: style.bg, color: style.color, borderRadius: 999, padding: '0.18rem 0.55rem', fontSize: '0.74rem', fontWeight: 600 }}>{label}</span>;
}

function Button({ label, primary = false }: { label: string; primary?: boolean }) {
  return (
    <span
      style={{
        border: primary ? 'none' : '1px solid #d1d5db',
        background: primary ? '#185FA5' : '#fff',
        color: primary ? '#fff' : '#111827',
        borderRadius: 8,
        padding: '0.5rem 0.8rem',
        fontSize: '0.8rem',
        fontWeight: 600,
        display: 'inline-flex',
      }}
    >
      {label}
    </span>
  );
}

function DraftEditor({ draft, operatorName, operatorRole, permissions }: { draft: ActionDraft | null; operatorName: string; operatorRole: string; permissions: string[] }) {
  if (!draft) return null;
  const eventId = draft.event_id;
  const canApprove = permissions.includes('draft:approve');
  const canReady = permissions.includes('draft:ready');
  const canRequestChanges = permissions.includes('draft:approve');

  async function saveDraft(formData: FormData) {
    'use server';
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
    const intent = String(formData.get('submit_intent') ?? 'save');
    const selectedStatus = String(formData.get('draft_status') ?? 'edited');
    const computedStatus = intent === 'approve' ? 'approved' : intent === 'ready' ? 'ready_to_send' : intent === 'review' ? 'awaiting_review' : intent === 'changes' ? 'changes_requested' : selectedStatus;

    await fetch(`${baseUrl}/actions/draft/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-apex-operator-name': operatorName, 'x-apex-operator-role': operatorRole },
      body: JSON.stringify({
        event_id: eventId,
        title: String(formData.get('title') ?? ''),
        body: String(formData.get('body') ?? ''),
        audience: String(formData.get('audience') ?? ''),
        recommended_brand: String(formData.get('recommended_brand') ?? ''),
        why_it_matters: String(formData.get('why_it_matters') ?? ''),
        signal_posture: String(formData.get('signal_posture') ?? ''),
        draft_type: String(formData.get('draft_type') ?? 'primary_outreach'),
        draft_status: computedStatus,
        assigned_reviewer_name: String(formData.get('assigned_reviewer_name') ?? '').trim() || null,
        context_notes: String(formData.get('context_notes') ?? '')
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
        operator_name: operatorName,
      }),
    });
  }

  return (
    <form action={saveDraft} style={{ display: 'grid', gap: '0.65rem' }}>
      <input name="title" defaultValue={draft.title} style={inputStyle} />
      <textarea name="body" defaultValue={draft.body} style={{ ...inputStyle, minHeight: 140, resize: 'vertical' }} />
      <input type="hidden" name="audience" defaultValue={draft.audience} />
      <input type="hidden" name="recommended_brand" defaultValue={draft.recommended_brand} />
      <input type="hidden" name="why_it_matters" defaultValue={draft.why_it_matters} />
      <input type="hidden" name="signal_posture" defaultValue={draft.signal_posture} />
      <input name="assigned_reviewer_name" defaultValue={draft.metadata?.assigned_reviewer_name ?? ''} placeholder="Assign reviewer" style={inputStyle} />
      <select name="draft_type" defaultValue={draft.draft_type ?? 'primary_outreach'} style={inputStyle}>
        <option value="primary_outreach">Primary outreach</option>
        <option value="internal_note">Internal note</option>
        <option value="follow_up">Follow-up</option>
        <option value="executive_brief">Executive brief</option>
      </select>
      <select name="draft_status" defaultValue={draft.draft_status ?? 'edited'} style={inputStyle}>
        <option value="generated">Generated</option>
        <option value="edited">Edited</option>
        <option value="awaiting_review">Awaiting review</option>
        {canRequestChanges ? <option value="changes_requested">Changes requested</option> : null}
        {canApprove ? <option value="approved">Approved</option> : null}
        {canReady ? <option value="ready_to_send">Ready to send</option> : null}
      </select>
      <textarea name="context_notes" defaultValue={draft.context_notes.join('\n')} style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} />
      <div style={{ color: '#6b7280', fontSize: '0.76rem' }}>
        Reviewer: <strong>{draft.metadata?.assigned_reviewer_name ?? 'Unassigned'}</strong>
        {draft.metadata?.reviewed_by_name ? <> · Last review by <strong>{draft.metadata.reviewed_by_name}</strong></> : null}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button name="submit_intent" value="save" type="submit" style={primaryButtonStyle}>Save draft</button>
        <button name="submit_intent" value="review" type="submit" style={secondaryButtonStyle}>Submit for review</button>
        {canRequestChanges ? <button name="submit_intent" value="changes" type="submit" style={softAmberButtonStyle}>Request changes</button> : null}
        {canApprove ? <button name="submit_intent" value="approve" type="submit" style={softGreenButtonStyle}>Approve</button> : null}
        {canReady ? <button name="submit_intent" value="ready" type="submit" style={softBlueButtonStyle}>Ready to send</button> : null}
      </div>
    </form>
  );
}

async function getEvents(filters: { brand?: string; eventType?: string; market?: string }): Promise<ApiResult<EventItem[]>> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
  const params = new URLSearchParams();
  if (filters.brand && filters.brand !== 'all') params.set('brand', filters.brand);
  if (filters.eventType) params.set('event_type', filters.eventType);
  if (filters.market && filters.market !== 'ALL') params.set('market', filters.market);
  const query = params.toString();

  try {
    const response = await fetch(`${baseUrl}/events${query ? `?${query}` : ''}`, { cache: 'no-store' });
    if (!response.ok) {
      return { data: [], error: `Newsroom feed unavailable (${response.status}).` };
    }
    const data = await response.json();
    return { data: Array.isArray(data.events) ? data.events : [], error: null };
  } catch {
    return { data: [], error: 'Newsroom feed unavailable. Check API connectivity.' };
  }
}

async function getEventDetail(eventId?: string): Promise<ApiResult<EventDetail | null>> {
  if (!eventId) return { data: null, error: null };
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
  try {
    const response = await fetch(`${baseUrl}/events/${eventId}`, { cache: 'no-store' });
    if (!response.ok) {
      return { data: null, error: `Selected event detail unavailable (${response.status}).` };
    }
    return { data: (await response.json()) as EventDetail, error: null };
  } catch {
    return { data: null, error: 'Selected event detail failed to load.' };
  }
}

async function getActionDraft(event?: EventItem, draftType?: string): Promise<ApiResult<ActionDraft | null>> {
  if (!event) return { data: null, error: null };
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
  try {
    const response = await fetch(`${baseUrl}/actions/draft`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: event.id,
        event_title: event.title,
        event_summary: event.summary,
        event_type: event.event_type,
        market: event.market,
        primary_brand: event.primary_brand,
        confidence_score: event.confidence_score,
        badges: event.badges ?? [],
        draft_type: draftType ?? 'primary_outreach',
      }),
    });
    if (!response.ok) {
      return { data: null, error: `Draft rail unavailable (${response.status}).` };
    }
    return { data: (await response.json()) as ActionDraft, error: null };
  } catch {
    return { data: null, error: 'Draft rail unavailable. Action generation could not load.' };
  }
}

async function getActionDraftHistory(eventId?: string): Promise<ActionDraftHistoryItem[]> {
  if (!eventId) return [];
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
  try {
    const response = await fetch(`${baseUrl}/actions/draft/${eventId}/history`, { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

async function getReviewQueue(): Promise<ActionReviewQueueItem[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
  try {
    const response = await fetch(`${baseUrl}/actions/review-queue`, { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

async function getCurrentSession(): Promise<OperatorSession | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
  try {
    const response = await fetch(`${baseUrl}/session/current`, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as OperatorSession;
  } catch {
    return null;
  }
}

async function getPaperclipContext(): Promise<PaperclipContextResponse | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
  try {
    const response = await fetch(`${baseUrl}/paperclip/context`, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as PaperclipContextResponse;
  } catch {
    return null;
  }
}

async function getPaperclipTasks(eventId?: string): Promise<PaperclipTask[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
  const query = eventId ? `?event_id=${encodeURIComponent(eventId)}` : '';
  try {
    const response = await fetch(`${baseUrl}/paperclip/tasks${query}`, { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

async function getPaperclipLanes(): Promise<string[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
  try {
    const response = await fetch(`${baseUrl}/paperclip/lanes`, { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

async function getAudit(eventId?: string): Promise<AuditEntry[]> {
  if (!eventId) return [];
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
  try {
    const response = await fetch(`${baseUrl}/audit?event_id=${encodeURIComponent(eventId)}`, { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

function buildHref(filters: Record<string, string | undefined>, patch: Record<string, string | undefined>): string {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  Object.entries(next).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `/?${query}` : '/';
}

function ShellCard({ children, subtle = false }: { children: React.ReactNode; subtle?: boolean }) {
  return (
    <div style={{ background: subtle ? '#f7f8fa' : '#fff', border: subtle ? 'none' : '1px solid #e5e7eb', borderRadius: 14, padding: '0.95rem 1rem' }}>
      {children}
    </div>
  );
}

function InlineNotice({ tone = 'amber', children }: { tone?: 'amber' | 'red' | 'blue'; children: React.ReactNode }) {
  const palette = {
    amber: { bg: '#fef3c7', border: '#f59e0b', color: '#92400e' },
    red: { bg: '#fee2e2', border: '#ef4444', color: '#991b1b' },
    blue: { bg: '#dbeafe', border: '#60a5fa', color: '#1d4ed8' },
  } as const;
  const style = palette[tone];
  return (
    <div style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.color, borderRadius: 12, padding: '0.8rem 0.9rem', fontSize: '0.82rem', lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{title}</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.82rem' }}>{subtitle}</p>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>{actions}</div>
    </div>
  );
}

function renderPlaceholderSurface(name: string, description: string, brandLabel?: string) {
  return (
    <div>
      <SectionHeader title={name} subtitle={`${description}${brandLabel ? ` · ${brandLabel} context active` : ''}`} actions={<Button label="Coming online" />} />
      <ShellCard>
        <div style={{ color: '#4b5563', fontSize: '0.9rem', lineHeight: 1.6 }}>
          This surface is now inside the unified APEX shell and ready for deeper implementation on top of the live beta spine.
        </div>
      </ShellCard>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '0.65rem',
  fontSize: '0.88rem',
  background: '#fff',
};
const primaryButtonStyle: React.CSSProperties = { background: '#185FA5', color: '#fff', border: 0, borderRadius: 10, padding: '0.65rem 0.9rem', fontWeight: 700, cursor: 'pointer' };
const secondaryButtonStyle: React.CSSProperties = { background: '#f3f4f6', color: '#111827', border: 0, borderRadius: 10, padding: '0.65rem 0.9rem', fontWeight: 700, cursor: 'pointer' };
const softAmberButtonStyle: React.CSSProperties = { background: '#fef3c7', color: '#92400e', border: 0, borderRadius: 10, padding: '0.65rem 0.9rem', fontWeight: 700, cursor: 'pointer' };
const softGreenButtonStyle: React.CSSProperties = { background: '#dcfce7', color: '#166534', border: 0, borderRadius: 10, padding: '0.65rem 0.9rem', fontWeight: 700, cursor: 'pointer' };
const softBlueButtonStyle: React.CSSProperties = { background: '#e0e7ff', color: '#3730a3', border: 0, borderRadius: 10, padding: '0.65rem 0.9rem', fontWeight: 700, cursor: 'pointer' };

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolved = (await searchParams) ?? {};
  const filters = {
    surface: resolved.surface ?? 'command',
    brand: resolved.brand ?? 'all',
    eventType: resolved.eventType,
    market: resolved.market ?? 'ALL',
    selected: resolved.selected,
    draftType: resolved.draftType,
    draftStatus: resolved.draftStatus,
    contact: resolved.contact ?? CONTACTS[0].id,
  };
  const closeHref = buildHref(filters, { selected: undefined });

  const operatorSession = await getCurrentSession();
  const operatorName = operatorSession?.operator_name ?? 'Reginald';
  const operatorRole = operatorSession?.role ?? 'principal_operator';
  const operatorPermissions = operatorSession?.permissions ?? ['draft:edit', 'draft:approve', 'draft:ready', 'paperclip:write'];

  const eventsResult = await getEvents({ brand: filters.brand, eventType: filters.eventType, market: filters.market });
  const events = eventsResult.data;
  const reviewQueue = await getReviewQueue();
  const selectedEvent = events.find((event) => event.id === filters.selected) ?? events[0] ?? null;
  const selectedEventDetailResult = await getEventDetail(selectedEvent?.id);
  const selectedEventDetail = selectedEventDetailResult.data;
  const liveDraftResult = await getActionDraft(selectedEvent ?? undefined, filters.draftType);
  const liveDraft = liveDraftResult.data;
  const draftHistory = await getActionDraftHistory(selectedEvent?.id);
  const paperclipContext = await getPaperclipContext();
  const paperclipTasks = await getPaperclipTasks(selectedEvent?.id);
  const paperclipLanes = await getPaperclipLanes();
  const auditEntries = await getAudit(selectedEvent?.id);
  const activeBrandMeta = BRAND_META[filters.brand] ?? BRAND_META.all;
  const navSections = Array.from(new Set(NAV_ITEMS.map((item) => item.section)));
  const visibleContacts = filters.brand === 'all' ? CONTACTS : CONTACTS.filter((contact) => contact.brands.includes(filters.brand));
  const selectedContact = visibleContacts.find((contact) => contact.id === filters.contact) ?? visibleContacts[0] ?? CONTACTS[0];
  const criticalEvents = events.filter((event) => event.relevance_score >= 90);
  const highEvents = events.filter((event) => event.relevance_score >= 80);
  const primaryBrandCount = filters.brand === 'all' ? events.length : events.filter((event) => event.primary_brand === filters.brand).length;
  const xSignalFeed = [...events]
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 6)
    .map((event, index) => ({
      ...event,
      handle: `@${(event.primary_brand ?? 'apex').replace(/_/g, '')}${index + 1}`,
      narrativeTone: event.relevance_score >= 90 ? 'Narrative break' : event.relevance_score >= 80 ? 'Watch escalation' : 'Baseline monitoring',
      actionability: event.latest_draft_status === 'ready_to_send' ? 'ready' : event.latest_draft_status === 'approved' ? 'approved' : 'monitor',
    }));
  const xWatchTopics = Array.from(new Set(events.flatMap((event) => [event.event_type, event.market, prettyBrand(event.primary_brand)].filter(Boolean) as string[])))
    .slice(0, 6)
    .map((topic, index) => ({
      topic,
      count: events.filter((event) => event.event_type === topic || event.market === topic || prettyBrand(event.primary_brand) === topic).length,
      posture: index % 3 === 0 ? 'Escalate' : index % 3 === 1 ? 'Monitor' : 'Map',
    }));
  const xWhoToWatch = visibleContacts.slice(0, 4).map((contact, index) => ({
    ...contact,
    watchReason: index === 0 ? 'Decision authority' : index === 1 ? 'Champion pathway' : index === 2 ? 'Local operator signal' : 'Relationship bridge',
  }));
  const actionableMentions = xSignalFeed.filter((event) => event.actionability !== 'monitor').length;
  const executiveHandlesWatched = xWhoToWatch.length;
  const criticalNarrativeShifts = xSignalFeed.filter((event) => event.relevance_score >= 90).length;
  const relationshipNodes = [
    { id: 'brand', label: activeBrandMeta.label, type: 'Brand core', detail: `Active operating context · ${primaryBrandCount} live signals`, tone: activeBrandMeta.color },
    ...(selectedEvent
      ? [{ id: 'signal', label: selectedEvent.title, type: 'Live signal', detail: selectedEvent.summary ?? 'Selected signal in focus', tone: '#185FA5' }]
      : []),
    ...(selectedEventDetail?.account_name || selectedEventDetail?.account_id
      ? [{ id: 'account', label: selectedEventDetail?.account_name ?? selectedEventDetail?.account_id ?? 'Account', type: 'Account node', detail: 'Linked through ingestion and account/property matching', tone: '#7c3aed' }]
      : []),
    ...(selectedEventDetail?.property_name || selectedEventDetail?.property_id
      ? [{ id: 'property', label: selectedEventDetail?.property_name ?? selectedEventDetail?.property_id ?? 'Property', type: 'Property node', detail: `${selectedEventDetail?.market ?? 'Unknown market'} property context`, tone: '#0f766e' }]
      : []),
    ...visibleContacts.slice(0, 4).map((contact, index) => ({
      id: `contact-${contact.id}`,
      label: contact.name,
      type: index === 0 ? 'Decision-maker' : index === 1 ? 'Champion path' : 'Relationship node',
      detail: contact.title,
      tone: contact.tier === 'T1' ? '#991b1b' : '#92400e',
    })),
  ];
  const relationshipEdges = relationshipNodes.slice(1).map((node, index) => ({
    from: relationshipNodes[0]?.label ?? activeBrandMeta.label,
    to: node.label,
    reason: index === 0 ? 'Signal ownership' : node.type === 'Account node' ? 'Commercial target' : node.type === 'Property node' ? 'Asset context' : 'Relationship access',
  }));
  const pursuitTracks = [
    { title: 'Signal → account path', value: selectedEventDetail?.account_name ?? 'Awaiting account resolution', note: selectedEventDetail?.metadata?.linkage_status ? `Linkage ${String(selectedEventDetail.metadata.linkage_status)}` : 'Linkage pending' },
    { title: 'Champion pathway', value: visibleContacts[0]?.name ?? 'No contact mapped', note: visibleContacts[0]?.title ?? 'Need contact enrichment' },
    { title: 'Execution rail', value: paperclipTasks[0]?.title ?? 'No synced task yet', note: paperclipTasks[0]?.status ?? 'Paperclip sync available' },
    { title: 'Governance', value: auditEntries[0]?.summary ?? 'No recent audit entry', note: auditEntries[0] ? formatTimestamp(auditEntries[0].timestamp) : 'Audit rail quiet' },
  ];
  const proposalReadinessScore = Math.min(
    100,
    (selectedEvent ? 35 : 0)
      + ((selectedEventDetail?.account_name || selectedEventDetail?.account_id) ? 20 : 0)
      + ((selectedEventDetail?.property_name || selectedEventDetail?.property_id) ? 15 : 0)
      + (visibleContacts.filter((contact) => contact.tier === 'T1').length ? 15 : 0)
      + (paperclipTasks.length ? 10 : 0)
      + (auditEntries.length ? 5 : 0),
  );
  const proposalPackage = [
    { label: 'Target account', value: selectedEventDetail?.account_name ?? selectedEventDetail?.account_id ?? 'Unresolved account' },
    { label: 'Property / asset', value: selectedEventDetail?.property_name ?? selectedEventDetail?.property_id ?? 'Unresolved property' },
    { label: 'Lead brand', value: prettyBrand(selectedEvent?.primary_brand ?? filters.brand) },
    { label: 'Market', value: selectedEventDetail?.market ?? selectedEvent?.market ?? 'Unknown market' },
  ];
  const proposalModules = [
    { title: 'Executive framing', status: selectedEvent ? 'ready' : 'missing', note: selectedEvent?.summary ?? 'Need selected signal summary' },
    { title: 'Scope architecture', status: selectedEventDetail?.property_name || selectedEventDetail?.account_name ? 'ready' : 'draft', note: selectedEventDetail?.property_name ? `Anchor on ${selectedEventDetail.property_name}` : 'Need stronger asset context' },
    { title: 'Pricing thesis', status: visibleContacts.length ? 'draft' : 'missing', note: visibleContacts[0]?.title ? `Buyer path through ${visibleContacts[0].title}` : 'Need buyer mapping' },
    { title: 'Proof + governance', status: paperclipTasks.length || auditEntries.length ? 'ready' : 'draft', note: paperclipTasks[0]?.title ?? auditEntries[0]?.summary ?? 'Need operational proof rail' },
  ];
  const proposalActions = [
    `Position ${activeBrandMeta.label} against the live trigger, not as a generic capability deck.`,
    selectedEventDetail?.account_name ? `Write the offer around ${selectedEventDetail.account_name}'s likely NOI / risk priorities.` : 'Resolve account target before final proposal language.',
    visibleContacts[0]?.name ? `Use ${visibleContacts[0].name} as the relationship anchor for delivery path and internal routing.` : 'Map a clear champion before sending.',
    paperclipTasks[0] ? `Sync proposal build status with Paperclip task: ${paperclipTasks[0].title}.` : 'Create a Paperclip task to keep proposal work visible.',
  ];
  const proposalTimeline = [
    { stage: 'Trigger captured', detail: selectedEvent?.title ?? 'Awaiting selected signal', when: selectedEvent ? 'Live now' : 'Pending' },
    { stage: 'Entity resolution', detail: selectedEventDetail?.account_name ?? selectedEventDetail?.property_name ?? 'Linkage still developing', when: String(selectedEventDetail?.metadata?.linkage_status ?? 'pending') },
    { stage: 'Internal handoff', detail: paperclipTasks[0]?.title ?? 'No synced work item yet', when: paperclipTasks[0]?.status ?? 'available' },
    { stage: 'Proposal governance', detail: auditEntries[0]?.summary ?? 'No recent audit confirmation', when: auditEntries[0] ? formatTimestamp(auditEntries[0].timestamp) : 'quiet' },
  ];
  const sentryAutonomyLevel = criticalEvents.length ? 'Operator approval required' : highEvents.length ? 'Assistive mode' : 'Monitor only';
  const sentryGuardrails = [
    { label: 'Brand scope lock', status: filters.brand === 'all' ? 'broad' : 'locked', note: filters.brand === 'all' ? 'All-brand monitoring still active' : `${activeBrandMeta.label} constrained context` },
    { label: 'Audit requirement', status: auditEntries.length ? 'armed' : 'warning', note: auditEntries.length ? `${auditEntries.length} audit entries available` : 'No recent audit proof found' },
    { label: 'Paperclip visibility', status: paperclipTasks.length ? 'armed' : 'warning', note: paperclipTasks.length ? `${paperclipTasks.length} synced tasks visible` : 'No synced task on current signal' },
    { label: 'Linkage confidence', status: selectedEventDetail?.metadata?.linkage_status ? 'armed' : 'warning', note: String(selectedEventDetail?.metadata?.linkage_status ?? 'pending') },
  ];
  const sentryActions = [
    { title: 'Watch', detail: `${events.length} live signals under monitoring`, state: 'active' },
    { title: 'Escalate', detail: criticalEvents[0]?.title ?? 'No critical escalation candidate', state: criticalEvents.length ? 'ready' : 'idle' },
    { title: 'Draft', detail: liveDraft?.title ?? 'No active operator draft in rail', state: liveDraft ? 'ready' : 'idle' },
    { title: 'Sync', detail: paperclipTasks[0]?.title ?? 'No Paperclip sync item yet', state: paperclipTasks.length ? 'ready' : 'idle' },
  ];
  const sentryTimeline = [
    { stage: 'Detection', detail: selectedEvent?.title ?? 'Awaiting selected signal', status: selectedEvent ? 'captured' : 'idle' },
    { stage: 'Classification', detail: selectedEvent?.event_type ?? 'Unclassified', status: selectedEvent?.event_type ? 'captured' : 'idle' },
    { stage: 'Governance', detail: auditEntries[0]?.summary ?? 'Awaiting operator-confirmed audit step', status: auditEntries.length ? 'captured' : 'warning' },
    { stage: 'Execution', detail: paperclipTasks[0]?.status ?? 'No downstream work item', status: paperclipTasks.length ? 'captured' : 'idle' },
  ];
  const sentryRecommendations = [
    criticalEvents.length ? 'Hold autonomous execution at operator-approval level until the critical signal is dispositioned.' : 'Stay in assistive posture while monitoring live narrative change.',
    paperclipTasks.length ? `Use Paperclip task \"${paperclipTasks[0].title}\" as the visible downstream rail.` : 'Create a Paperclip sync item before allowing downstream execution.',
    auditEntries.length ? 'Audit rail is present; preserve operator confirmation before external action.' : 'Require an audit event before external-facing actions.',
  ];
  const marketOrder = ['Dallas-Fort Worth', 'Austin', 'Houston', 'San Antonio'];
  const marketCards = marketOrder.map((market, index) => {
    const marketEvents = events.filter((event) => (event.market ?? 'Unknown market') === market);
    const primaryEvent = marketEvents[0];
    return {
      market,
      signals: marketEvents.length,
      critical: marketEvents.filter((event) => event.relevance_score >= 90).length,
      activeBrand: primaryEvent?.primary_brand ? prettyBrand(primaryEvent.primary_brand) : activeBrandMeta.label,
      occupancy: 72 + index * 6,
      pressure: marketEvents.length ? Math.min(96, 48 + marketEvents.length * 11) : 28 + index * 4,
      note: primaryEvent?.summary ?? 'No active monitored signal in this market window.',
    };
  });
  const selectedMarketCard = marketCards.find((item) => item.market === (selectedEventDetail?.market ?? selectedEvent?.market ?? filters.market))
    ?? marketCards.find((item) => item.market === filters.market)
    ?? marketCards[0];
  const spatialWatchlist = [
    { label: 'Primary market', value: selectedMarketCard?.market ?? 'Unknown', note: `${selectedMarketCard?.signals ?? 0} live signals` },
    { label: 'Linked property', value: selectedEventDetail?.property_name ?? selectedEventDetail?.property_id ?? 'Unresolved asset', note: selectedEventDetail?.market ?? 'Awaiting linkage' },
    { label: 'Target account', value: selectedEventDetail?.account_name ?? selectedEventDetail?.account_id ?? 'Unresolved account', note: selectedEventDetail?.metadata?.linkage_status ? `Linkage ${String(selectedEventDetail.metadata.linkage_status)}` : 'Linkage pending' },
    { label: 'Territory pressure', value: `${selectedMarketCard?.pressure ?? 0}%`, note: `${selectedMarketCard?.critical ?? 0} critical signals in zone` },
  ];
  const spatialSubmarkets = ['CBD', 'Uptown', 'Legacy / Plano', 'North Austin', 'Energy Corridor', 'Pearland'].map((name, index) => ({
    name,
    market: marketOrder[index % marketOrder.length],
    pressure: Math.max(32, (selectedMarketCard?.pressure ?? 40) - 10 + index * 6),
    posture: index % 3 === 0 ? 'Expand' : index % 3 === 1 ? 'Defend' : 'Monitor',
  }));
  const spatialRecommendations = [
    selectedMarketCard ? `Prioritize ${selectedMarketCard.market} because it carries ${selectedMarketCard.signals} live signals and ${selectedMarketCard.critical} critical triggers.` : 'Establish a primary market priority before allocating operator time.',
    selectedEventDetail?.property_name ? `Anchor territory pursuit around ${selectedEventDetail.property_name} and its surrounding submarket dynamics.` : 'Resolve property linkage before claiming submarket precision.',
    visibleContacts[0]?.name ? `Use ${visibleContacts[0].name} to validate local operating realities before proposal finalization.` : 'Map a local contact path before pushing market-specific action.',
  ];
  const activeBrandKey = Object.entries(BRAND_META).find(([, meta]) => meta.label === activeBrandMeta.label)?.[0] ?? filters.brand;
  const brandStandards = [
    { label: 'Operating scope', value: activeBrandMeta.label, note: `${primaryBrandCount} live signals in current context` },
    { label: 'Core market focus', value: selectedMarketCard?.market ?? 'Texas coverage', note: `${marketCards.filter((item) => item.signals > 0).length} active markets monitored` },
    { label: 'Primary pursuit posture', value: criticalEvents.length ? 'Escalate' : highEvents.length ? 'Advance' : 'Monitor', note: `${criticalEvents.length} critical · ${highEvents.length} high priority` },
    { label: 'Governance state', value: auditEntries.length ? 'Audited' : 'Light', note: paperclipTasks.length ? `${paperclipTasks.length} synced execution rails` : 'No synced execution rail yet' },
  ];
  const brandCapabilities = [
    { title: 'Signal intake', status: events.length ? 'active' : 'standby', note: `${events.length} monitored events available` },
    { title: 'Relationship graph', status: visibleContacts.length ? 'active' : 'draft', note: `${visibleContacts.length} visible contacts in scope` },
    { title: 'Proposal conversion', status: proposalReadinessScore >= 60 ? 'active' : 'draft', note: `${proposalReadinessScore}% readiness` },
    { title: 'Governed execution', status: auditEntries.length || paperclipTasks.length ? 'active' : 'draft', note: `${auditEntries.length} audit · ${paperclipTasks.length} Paperclip` },
  ];
  const brandPillars = [
    `APEX should speak as ${activeBrandMeta.label}, not as a generic multi-brand operator shell.`,
    selectedEventDetail?.account_name ? `Current commercial framing should orbit ${selectedEventDetail.account_name} and the live trigger behind it.` : 'Resolve target-account framing to sharpen this brand profile.',
    visibleContacts[0]?.name ? `${visibleContacts[0].name} is the clearest relationship entry point in the current brand context.` : 'Map a clearer relationship entry point for this brand.',
  ];
  const brandSurfaceCoverage = [
    { surface: 'Command center', state: 'live' },
    { surface: 'Newsroom', state: 'live' },
    { surface: 'X signals', state: 'live' },
    { surface: 'Mind map', state: 'live' },
    { surface: 'Proposals', state: 'live' },
    { surface: 'Sentry mode', state: 'live' },
    { surface: 'Spatial map', state: 'live' },
  ];
  const integrationRegistry = [
    { name: 'Live event API', type: 'Ingestion', status: events.length ? 'connected' : 'standby', detail: `${events.length} events available in current session context` },
    { name: 'Paperclip tandem', type: 'Execution sync', status: paperclipContext?.status === 'ok' ? 'connected' : 'degraded', detail: paperclipContext?.latest_sync?.summary ?? 'Context sync available through local ledger' },
    { name: 'Audit rail', type: 'Governance', status: auditEntries.length ? 'connected' : 'standby', detail: `${auditEntries.length} audit entries visible for current selection` },
    { name: 'Draft engine', type: 'Operator assist', status: liveDraft ? 'connected' : 'standby', detail: liveDraft?.title ?? 'Draft rail available when signal selected' },
    { name: 'Entity linkage', type: 'Resolution', status: selectedEventDetail?.metadata?.linkage_status ? 'connected' : 'degraded', detail: String(selectedEventDetail?.metadata?.linkage_status ?? 'pending') },
  ];
  const integrationFlows = [
    { from: 'Signal ingestion', to: 'Newsroom / X signals', note: `${events.length} signals flowing into operator surfaces` },
    { from: 'Entity linkage', to: 'Account / Spatial / Mind map', note: selectedEventDetail?.account_name ?? selectedEventDetail?.property_name ?? 'Awaiting stronger linkage context' },
    { from: 'Draft rail', to: 'Proposals / Sentry', note: liveDraft?.draft_status ?? 'draft generation available' },
    { from: 'Paperclip', to: 'Execution visibility', note: paperclipTasks[0]?.title ?? 'No synced downstream work item yet' },
  ];
  const integrationRecommendations = [
    paperclipContext?.status === 'ok' ? 'Paperclip tandem is live enough for visible execution tracking; keep using it as the downstream rail.' : 'Stabilize Paperclip tandem visibility before claiming full cross-system continuity.',
    selectedEventDetail?.metadata?.linkage_status ? 'Entity linkage is present; use it to reduce generic surface behavior.' : 'Improve linkage confidence so integrations feel systemic instead of decorative.',
    auditEntries.length ? 'Audit rail is active; preserve it as a non-optional system primitive.' : 'Add more operator-confirmed audit events to strengthen governance credibility.',
  ];
  const selectedSurfaceLabel = NAV_ITEMS.find((item) => item.key === filters.surface)?.label ?? 'Surface';
  const contextChips = [
    { label: 'Surface', value: selectedSurfaceLabel },
    { label: 'Signal', value: selectedEvent?.title ?? 'No signal selected' },
    { label: 'Account', value: selectedEventDetail?.account_name ?? selectedEventDetail?.account_id ?? 'Unresolved' },
    { label: 'Property', value: selectedEventDetail?.property_name ?? selectedEventDetail?.property_id ?? 'Unresolved' },
  ];
  const quickActions = [
    { label: 'Open newsroom', href: buildHref(filters, { surface: 'newsroom' }) },
    { label: 'Open proposals', href: buildHref(filters, { surface: 'proposal' }) },
    { label: 'Open sentry', href: buildHref(filters, { surface: 'sentry' }) },
  ];

  const commandMetrics = [
    { label: 'Pipeline value', value: `$${((events.reduce((sum, event) => sum + event.relevance_score, 0) * 25) / 1000).toFixed(1)}M`, delta: `${criticalEvents.length} critical signals` },
    { label: 'Live events', value: String(events.length), delta: `${primaryBrandCount} in active brand` },
    { label: 'Priority contacts', value: String(visibleContacts.length), delta: `${visibleContacts.filter((contact) => contact.tier === 'T1').length} tier 1` },
    { label: 'Paperclip tasks', value: String(paperclipTasks.length), delta: `${auditEntries.length} audit entries` },
  ];

  const renderPaperclipPanel = () => (
    <ShellCard subtle>
      <div style={{ display: 'grid', gap: '0.8rem' }}>
        <div>
          <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Paperclip tandem</strong>
          <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>Status: <strong style={{ color: '#1d4ed8' }}>{paperclipContext?.status ?? 'unavailable'}</strong></div>
        </div>
        {paperclipContext?.latest_sync ? (
          <div style={{ border: '1px solid #dbeafe', borderRadius: 10, padding: '0.75rem', background: '#fff' }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{paperclipContext.latest_sync.workstream}</div>
            <div style={{ color: '#6b7280', fontSize: '0.78rem', marginTop: '0.2rem' }}>{paperclipContext.latest_sync.status} · {formatTimestamp(paperclipContext.latest_sync.timestamp)}</div>
            <p style={{ color: '#4b5563', fontSize: '0.82rem' }}>{paperclipContext.latest_sync.summary}</p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {paperclipContext.latest_sync.verification.map((check) => <Badge key={check} label={check} tone="green" />)}
            </div>
          </div>
        ) : null}
        {selectedEvent ? (
          <form
            action={async (formData: FormData) => {
              'use server';
              const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
              await fetch(`${baseUrl}/paperclip/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-apex-operator-name': operatorName, 'x-apex-operator-role': operatorRole },
                body: JSON.stringify({
                  title: `APEX sync — ${selectedEvent.title}`,
                  event_id: selectedEvent.id,
                  lane: String(formData.get('lane') ?? 'ai-technology-lane'),
                  summary: String(formData.get('summary') ?? selectedEvent.summary ?? selectedEvent.title),
                  operator_name: operatorName,
                }),
              });
            }}
            style={{ display: 'grid', gap: '0.55rem', border: '1px solid #dbeafe', borderRadius: 10, padding: '0.75rem', background: '#fff' }}
          >
            <strong>Create / refresh task</strong>
            <select name="lane" defaultValue={paperclipLanes.includes('ai-technology-lane') ? 'ai-technology-lane' : paperclipLanes[0]} style={inputStyle}>
              {paperclipLanes.map((lane) => <option key={lane} value={lane}>{lane}</option>)}
            </select>
            <textarea name="summary" defaultValue={selectedEvent.summary ?? selectedEvent.title} style={{ ...inputStyle, minHeight: 72 }} />
            <button type="submit" style={primaryButtonStyle}>Sync into Paperclip</button>
          </form>
        ) : null}
        <div style={{ display: 'grid', gap: '0.55rem' }}>
          {paperclipTasks.length ? paperclipTasks.map((task) => (
            <div key={task.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.75rem', background: '#fff' }}>
              <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{task.title}</div>
              <div style={{ color: '#6b7280', fontSize: '0.76rem', margin: '0.15rem 0 0.35rem' }}>{task.lane} · {task.status} · {formatTimestamp(task.updated_at)}</div>
              <div style={{ color: '#4b5563', fontSize: '0.82rem', marginBottom: '0.5rem' }}>{task.summary}</div>
              <form
                action={async (formData: FormData) => {
                  'use server';
                  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
                  await fetch(`${baseUrl}/paperclip/tasks/${task.id}/status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-apex-operator-name': operatorName, 'x-apex-operator-role': operatorRole },
                    body: JSON.stringify({ status: String(formData.get('status') ?? task.status), operator_name: operatorName }),
                  });
                }}
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
              >
                <select name="status" defaultValue={task.status} style={{ ...inputStyle, padding: '0.45rem 0.55rem' }}>
                  {['todo', 'in_progress', 'blocked', 'done'].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <button type="submit" style={softBlueButtonStyle}>Update</button>
              </form>
            </div>
          )) : <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>No Paperclip tasks linked yet.</div>}
        </div>
      </div>
    </ShellCard>
  );

  const renderAuditPanel = () => (
    <ShellCard subtle>
      <strong style={{ display: 'block', marginBottom: '0.55rem' }}>Audit trail</strong>
      <div style={{ display: 'grid', gap: '0.55rem' }}>
        {auditEntries.length ? auditEntries.slice(0, 8).map((entry) => (
          <div key={entry.id} style={{ borderLeft: '3px solid #c7d2fe', paddingLeft: '0.65rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{entry.summary}</div>
            <div style={{ color: '#6b7280', fontSize: '0.76rem' }}>{entry.actor} · {entry.action} · {formatTimestamp(entry.timestamp)}</div>
          </div>
        )) : <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>No audit entries yet.</div>}
      </div>
    </ShellCard>
  );

  const renderDraftHistoryPanel = () => (
    <ShellCard subtle>
      <strong style={{ display: 'block', marginBottom: '0.55rem' }}>Draft history</strong>
      <div style={{ display: 'grid', gap: '0.55rem' }}>
        {draftHistory.length ? draftHistory.slice(0, 5).map((item) => (
          <div key={item.action_id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.7rem', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <strong style={{ fontSize: '0.82rem' }}>{item.title}</strong>
              <Badge label={item.draft_status ?? 'generated'} tone={item.draft_status === 'ready_to_send' ? 'green' : item.draft_status === 'approved' ? 'purple' : 'amber'} />
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.74rem', marginTop: '0.2rem' }}>{item.draft_type ?? 'primary_outreach'} · {formatTimestamp(item.updated_at)}</div>
          </div>
        )) : <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>No saved draft history yet.</div>}
      </div>
    </ShellCard>
  );

  const renderReviewQueuePanel = () => (
    <ShellCard subtle>
      <strong style={{ display: 'block', marginBottom: '0.55rem' }}>Approval queue</strong>
      <div style={{ display: 'grid', gap: '0.55rem' }}>
        {reviewQueue.length ? reviewQueue.slice(0, 6).map((item) => (
          <a key={item.action_id} href={buildHref(filters, { selected: item.event_id, surface: 'newsroom' })} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.7rem', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                <strong style={{ fontSize: '0.82rem' }}>{item.title}</strong>
                <Badge label={item.draft_status} tone={item.draft_status === 'approved' ? 'purple' : item.draft_status === 'changes_requested' ? 'amber' : 'red'} />
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.74rem', marginTop: '0.2rem' }}>{prettyBrand(item.recommended_brand)} · {item.draft_type} · {formatTimestamp(item.updated_at)}</div>
              <div style={{ color: '#6b7280', fontSize: '0.74rem', marginTop: '0.2rem' }}>Owner: {item.operator_name ?? 'Unknown operator'}</div>
              <div style={{ color: '#6b7280', fontSize: '0.74rem', marginTop: '0.2rem' }}>Reviewer: {item.assigned_reviewer_name ?? 'Unassigned'}{item.reviewed_by_name ? ` · Reviewed by ${item.reviewed_by_name}` : ''}</div>
            </div>
          </a>
        )) : <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>No drafts in the approval queue.</div>}
      </div>
    </ShellCard>
  );

  const renderNewsroomFeed = () => (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      {eventsResult.error ? <InlineNotice tone="red">{eventsResult.error} The feed is showing a safe empty state instead of silently failing.</InlineNotice> : null}
      {events.length ? events.map((event) => {
        const selected = event.id === selectedEvent?.id;
        const tone = event.relevance_score >= 90 ? '#991b1b' : event.relevance_score >= 80 ? '#92400e' : '#185FA5';
        return (
          <a key={event.id} href={buildHref(filters, { selected: event.id, surface: 'newsroom' })} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ background: '#fff', border: selected ? '2px solid #185FA5' : '1px solid #e5e7eb', borderLeft: `4px solid ${tone}`, borderRadius: 12, padding: '0.85rem 0.95rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <strong style={{ fontSize: '0.86rem', lineHeight: 1.4 }}>{event.title}</strong>
                <span style={{ fontWeight: 700, color: tone }}>{event.relevance_score}</span>
              </div>
              <p style={{ color: '#4b5563', margin: '0.35rem 0 0.45rem', fontSize: '0.82rem', lineHeight: 1.5 }}>{event.summary ?? 'No summary yet.'}</p>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <Badge label={prettyBrand(event.primary_brand)} />
                {event.event_type ? <Badge label={event.event_type} tone="purple" /> : null}
                {event.market ? <Badge label={event.market} /> : null}
                {sourceHost(event.source_url) ? <Badge label={sourceHost(event.source_url) ?? ''} tone="amber" /> : null}
              </div>
            </div>
          </a>
        );
      }) : <ShellCard><div style={{ color: '#6b7280' }}>{eventsResult.error ? 'No feed items rendered because the newsroom API is currently unavailable.' : 'No events yet. Seed one through the API.'}</div></ShellCard>}
    </div>
  );

  const surfaceNode = (() => {
    switch (filters.surface) {
      case 'command':
        return (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <SectionHeader title={`Command center · ${activeBrandMeta.label}`} subtitle="Executive operating layer for signal triage, brand posture, operator action, and system visibility." actions={<><Button label="Daily digest" /><Button label="Open newsroom" primary /></>} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
              {commandMetrics.map((metric) => (
                <ShellCard key={metric.label} subtle>
                  <div style={{ color: '#6b7280', fontSize: '0.74rem', marginBottom: '0.25rem' }}>{metric.label}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{metric.value}</div>
                  <div style={{ color: '#166534', fontSize: '0.72rem', marginTop: '0.15rem' }}>{metric.delta}</div>
                </ShellCard>
              ))}
            </div>
            <LiveFeedStatus latestEventTs={events[0]?.created_at ?? null} currentBrand={filters.brand} />
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 0.95fr', gap: '0.8rem' }}>
              <ShellCard>
                <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Operator queue</strong>
                <div style={{ display: 'grid', gap: '0.55rem' }}>
                  {(highEvents.slice(0, 4)).map((event, index) => (
                    <a key={event.id} href={buildHref(filters, { selected: event.id, surface: 'newsroom' })} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ display: 'flex', gap: '0.65rem', background: '#f7f8fa', borderRadius: 10, padding: '0.7rem' }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: event.relevance_score >= 90 ? '#991b1b' : '#185FA5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.76rem', fontWeight: 700 }}>{index + 1}</div>
                        <div style={{ fontSize: '0.84rem', lineHeight: 1.45, flex: 1 }}>
                          <strong>{event.title}</strong>
                          <div style={{ color: '#4b5563' }}>{event.summary}</div>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                            <Badge label={prettyBrand(event.primary_brand)} />
                            {event.market ? <Badge label={event.market} /> : null}
                            <Badge label={`Score ${event.relevance_score}`} tone={event.relevance_score >= 90 ? 'red' : 'amber'} />
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                  {!highEvents.length ? <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>No high-priority signals in the current brand/market context.</div> : null}
                </div>
              </ShellCard>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Brand focus board</strong>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {Object.entries(BRAND_META).filter(([key]) => key !== 'all').map(([key, meta]) => {
                      const brandEvents = events.filter((event) => event.primary_brand === key);
                      const active = filters.brand === key;
                      return (
                        <a key={key} href={buildHref(filters, { brand: key, selected: undefined })} style={{ textDecoration: 'none', color: 'inherit' }}>
                          <div style={{ border: active ? `1px solid ${meta.color}` : '1px solid #e5e7eb', background: active ? '#f8fbff' : '#fff', borderRadius: 10, padding: '0.7rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.2rem' }}>
                              <span style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}><span style={{ width: 16, height: 16, borderRadius: 999, background: meta.color, color: '#fff', fontSize: '0.55rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{meta.short}</span>{meta.label}</span>
                              <strong>{brandEvents.length} live</strong>
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '0.74rem' }}>{brandEvents.filter((event) => event.relevance_score >= 90).length} critical · {brandEvents.filter((event) => event.latest_draft_status === 'ready_to_send').length} ready-to-send</div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </ShellCard>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Relationship heat</strong>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {visibleContacts.slice(0, 3).map((contact) => (
                      <div key={contact.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', background: '#f7f8fa', borderRadius: 10, padding: '0.65rem' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{contact.name}</div>
                          <div style={{ color: '#6b7280', fontSize: '0.74rem' }}>{contact.title}</div>
                        </div>
                        <Badge label={contact.tier} tone={contact.tier === 'T1' ? 'red' : 'amber'} />
                      </div>
                    ))}
                  </div>
                </ShellCard>
              </div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Execution posture</strong>
                  <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Brand scope</span><strong>{activeBrandMeta.label}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sentry mode</span><strong style={{ color: '#166534' }}>Manual</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Paperclip tandem</span><strong style={{ color: '#166534' }}>{paperclipContext?.status ?? 'offline'}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Audit rail</span><strong>{auditEntries.length} entries</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Linkage status</span><strong>{selectedEventDetail?.metadata?.linkage_status ? String(selectedEventDetail.metadata.linkage_status) : 'pending'}</strong></div>
                  </div>
                </ShellCard>
                {renderReviewQueuePanel()}
                {renderPaperclipPanel()}
              </div>
            </div>
          </div>
        );
      case 'newsroom':
        return (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <SectionHeader title="Newsroom" subtitle="Real-time CRE intelligence across all sources. The unified shell now matches the APEX framing direction." actions={<Badge label="Streaming" tone="green" />} />
            <PwaInstallCta />
            <LiveFeedStatus latestEventTs={events[0]?.created_at ?? null} currentBrand={filters.brand} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1rem' }}>
              <div>{renderNewsroomFeed()}</div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.55rem' }}>Selected signal</strong>
                  {selectedEvent ? (
                    <>
                      {selectedEventDetailResult.error ? <div style={{ marginBottom: '0.7rem' }}><InlineNotice tone="amber">{selectedEventDetailResult.error} Core event context is degraded, so linkage details may be incomplete.</InlineNotice></div> : null}
                      <div style={{ fontWeight: 700 }}>{selectedEvent.title}</div>
                      <p style={{ color: '#4b5563', fontSize: '0.82rem' }}>{selectedEvent.summary}</p>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <Badge label={prettyBrand(selectedEvent.primary_brand)} />
                        {selectedEvent.event_type ? <Badge label={selectedEvent.event_type} tone="purple" /> : null}
                        {selectedEvent.market ? <Badge label={selectedEvent.market} /> : null}
                        {selectedEventDetail?.metadata?.linkage_status ? <Badge label={`linkage ${String(selectedEventDetail.metadata.linkage_status)}`} tone={linkageTone(String(selectedEventDetail.metadata.linkage_status))} /> : null}
                        {selectedEventDetail?.metadata?.linkage_confidence ? <Badge label={`confidence ${String(selectedEventDetail.metadata.linkage_confidence)}`} tone={linkageTone(String(selectedEventDetail.metadata.linkage_confidence))} /> : null}
                      </div>
                      {selectedEventDetail?.metadata?.linkage_strategy ? <div style={{ color: '#6b7280', fontSize: '0.76rem', marginTop: '0.45rem' }}>Linkage strategy: <strong>{String(selectedEventDetail.metadata.linkage_strategy)}</strong></div> : null}
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                        <a href={buildHref(filters, { surface: 'proposal' })} style={{ textDecoration: 'none' }}><span style={{ ...softBlueButtonStyle, padding: '0.45rem 0.7rem' }}>Proposal rail</span></a>
                        <a href={buildHref(filters, { surface: 'sentry' })} style={{ textDecoration: 'none' }}><span style={{ ...softBlueButtonStyle, padding: '0.45rem 0.7rem' }}>Sentry rail</span></a>
                        <a href={buildHref(filters, { surface: 'account' })} style={{ textDecoration: 'none' }}><span style={{ ...softBlueButtonStyle, padding: '0.45rem 0.7rem' }}>Account workspace</span></a>
                      </div>
                    </>
                  ) : <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>No event selected.</div>}
                </ShellCard>
                {liveDraft ? (
                  <ShellCard>
                    <strong style={{ display: 'block', marginBottom: '0.55rem' }}>Action draft rail</strong>
                    <DraftEditor draft={liveDraft} operatorName={operatorName} operatorRole={operatorRole} permissions={operatorPermissions} />
                  </ShellCard>
                ) : selectedEvent ? (
                  <ShellCard>
                    <strong style={{ display: 'block', marginBottom: '0.55rem' }}>Action draft rail</strong>
                    {liveDraftResult.error ? <InlineNotice tone="red">{liveDraftResult.error} Operators can still review the signal, but draft generation needs recovery.</InlineNotice> : <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>No draft loaded for this signal yet.</div>}
                  </ShellCard>
                ) : null}
                {renderDraftHistoryPanel()}
                {renderReviewQueuePanel()}
                {renderPaperclipPanel()}
                {renderAuditPanel()}
              </div>
            </div>
            {filters.selected && selectedEvent ? (
              <EventModal
                event={selectedEvent}
                eventDetail={selectedEventDetail}
                draft={liveDraft}
                draftHistory={draftHistory}
                operatorName={operatorName}
                operatorRole={operatorRole}
                permissions={operatorPermissions}
                closeHref={closeHref}
                draftType={filters.draftType ?? 'primary_outreach'}
              />
            ) : null}
          </div>
        );
      case 'account':
        return (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <SectionHeader title={selectedEventDetail?.property_name ?? selectedEvent?.title ?? 'Account workspace'} subtitle="Property intelligence, relationship logic, and commercial opportunity in one place." actions={<><Button label="Mind map" /><Button label="Generate proposal" primary /></>} />
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {selectedEvent?.badges?.map((badge) => <Badge key={badge} label={badge} tone="amber" />)}
              <Badge label={`APEX score ${selectedEvent?.relevance_score ?? 0}`} tone="red" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1rem' }}>
              <ShellCard>
                <strong style={{ display: 'block', marginBottom: '0.6rem' }}>Property intelligence</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem 1rem', fontSize: '0.82rem' }}>
                  <div><div style={{ color: '#6b7280' }}>Property linkage</div><div style={{ fontWeight: 700 }}>{selectedEventDetail?.property_name ?? selectedEventDetail?.property_id ?? 'Unresolved'}</div></div>
                  <div><div style={{ color: '#6b7280' }}>Account linkage</div><div style={{ fontWeight: 700 }}>{selectedEventDetail?.account_name ?? selectedEventDetail?.account_id ?? 'Unresolved'}</div></div>
                  <div><div style={{ color: '#6b7280' }}>Market</div><div style={{ fontWeight: 700 }}>{selectedEventDetail?.market ?? 'Unknown'}</div></div>
                  <div><div style={{ color: '#6b7280' }}>Linkage status</div><div style={{ fontWeight: 700 }}>{String(selectedEventDetail?.metadata?.linkage_status ?? 'pending')}</div></div>
                  <div><div style={{ color: '#6b7280' }}>Linkage confidence</div><div style={{ fontWeight: 700 }}>{String(selectedEventDetail?.metadata?.linkage_confidence ?? 'unknown')}</div></div>
                  <div><div style={{ color: '#6b7280' }}>Linkage strategy</div><div style={{ fontWeight: 700 }}>{String(selectedEventDetail?.metadata?.linkage_strategy ?? 'unknown')}</div></div>
                  <div><div style={{ color: '#6b7280' }}>Primary brand</div><div style={{ fontWeight: 700 }}>{prettyBrand(selectedEventDetail?.primary_brand)}</div></div>
                  <div><div style={{ color: '#6b7280' }}>Confidence</div><div style={{ fontWeight: 700 }}>{selectedEventDetail?.confidence_score ?? 0}</div></div>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
                  {selectedEventDetail?.metadata?.linkage_status ? <Badge label={`linkage ${String(selectedEventDetail.metadata.linkage_status)}`} tone={linkageTone(String(selectedEventDetail.metadata.linkage_status))} /> : null}
                  {selectedEventDetail?.metadata?.linkage_confidence ? <Badge label={`confidence ${String(selectedEventDetail.metadata.linkage_confidence)}`} tone={linkageTone(String(selectedEventDetail.metadata.linkage_confidence))} /> : null}
                </div>
                <div style={{ marginTop: '1rem', color: '#4b5563', fontSize: '0.84rem', lineHeight: 1.6 }}>{selectedEventDetail?.summary ?? selectedEvent?.summary}</div>
              </ShellCard>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.55rem' }}>Cross-brand opportunity</strong>
                  {Object.entries(BRAND_META).filter(([key]) => key !== 'all').map(([key, meta]) => (
                    <div key={key} style={{ marginBottom: '0.55rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}><span>{meta.label}</span><strong>{selectedEvent?.primary_brand === key ? 'active lead' : 'monitor'}</strong></div>
                      <div style={{ height: 5, background: '#eef2f7', borderRadius: 999, marginTop: 4 }}><div style={{ width: `${selectedEvent?.primary_brand === key ? 82 : 38}%`, height: '100%', background: meta.color, borderRadius: 999 }} /></div>
                    </div>
                  ))}
                </ShellCard>
                {renderPaperclipPanel()}
              </div>
            </div>
          </div>
        );
      case 'contacts':
        return (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <SectionHeader title={`Contacts · ${activeBrandMeta.label}`} subtitle="Decision-makers with executable contact actions and relationship intelligence, scoped by active brand context." />
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1rem' }}>
              <ShellCard subtle>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  {visibleContacts.map((contact) => {
                    const active = contact.id === selectedContact.id;
                    return (
                      <a key={contact.id} href={buildHref(filters, { surface: 'contacts', contact: contact.id })} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ display: 'flex', gap: '0.6rem', padding: '0.6rem', borderRadius: 10, background: active ? '#eaf2fb' : 'transparent' }}>
                          <div style={{ width: 30, height: 30, borderRadius: 999, background: '#e6f1fb', color: '#0c447c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>{contact.initials}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{contact.name}</div>
                            <div style={{ color: '#6b7280', fontSize: '0.76rem' }}>{contact.title}</div>
                          </div>
                          <Badge label={contact.tier} tone={contact.tier === 'T1' ? 'red' : contact.tier === 'T2' ? 'amber' : 'neutral'} />
                        </div>
                      </a>
                    );
                  })}
                  {!visibleContacts.length ? <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>No contacts mapped to the active brand yet.</div> : null}
                </div>
              </ShellCard>
              <ShellCard>
                <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 999, background: '#e6f1fb', color: '#0c447c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.92rem', fontWeight: 700 }}>{selectedContact.initials}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedContact.name}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>{selectedContact.title}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                  {selectedContact.phone ? <a href={`tel:${selectedContact.phone.replace(/[^\d+]/g, '')}`} style={{ textDecoration: 'none' }}><span style={primaryButtonStyle}>Call</span></a> : null}
                  {selectedContact.email ? <a href={`mailto:${selectedContact.email}`} style={{ textDecoration: 'none' }}><span style={softBlueButtonStyle}>Email</span></a> : null}
                  {selectedContact.linkedin ? <a href={`https://${selectedContact.linkedin}`} style={{ textDecoration: 'none' }} target="_blank"><span style={{ ...softBlueButtonStyle, background: '#0c447c', color: '#fff' }}>LinkedIn</span></a> : null}
                </div>
                <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.84rem', marginBottom: '0.9rem' }}>
                  {selectedContact.phone ? <div><strong>Phone:</strong> {selectedContact.phone}</div> : null}
                  {selectedContact.email ? <div><strong>Email:</strong> {selectedContact.email}</div> : null}
                  {selectedContact.linkedin ? <div><strong>LinkedIn:</strong> {selectedContact.linkedin}</div> : null}
                </div>
                <ShellCard subtle>
                  <strong style={{ display: 'block', marginBottom: '0.45rem' }}>Relationship intelligence</strong>
                  <div style={{ color: '#4b5563', fontSize: '0.84rem', lineHeight: 1.6 }}>{selectedContact.intelligence}</div>
                </ShellCard>
              </ShellCard>
            </div>
          </div>
        );
      case 'pipeline':
        return (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <SectionHeader title={`Pipeline · ${activeBrandMeta.label}`} subtitle="Five-stage commercial motion in the unified APEX shell." actions={<><Button label="Timeline view" /><Button label="Forecast" /><Button label="New deal" primary /></>} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
              {['Qualified', 'Proposed', 'Negotiation', 'Won', 'Lost'].map((column, index) => (
                <ShellCard key={column} subtle>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.65rem' }}><strong style={{ fontSize: '0.82rem' }}>{column}</strong><Badge label={String(Math.max(1, events.length - index))} /></div>
                  <div style={{ display: 'grid', gap: '0.45rem' }}>
                    {events.slice(index, index + 2).map((event) => (
                      <div key={`${column}-${event.id}`} style={{ background: '#fff', borderRadius: 10, padding: '0.65rem', borderLeft: `4px solid ${(BRAND_META[event.primary_brand ?? 'all'] ?? BRAND_META.all).color}` }}>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{event.title}</div>
                        <div style={{ color: '#6b7280', fontSize: '0.74rem' }}>{event.market ?? 'Texas'} · {prettyBrand(event.primary_brand)}</div>
                      </div>
                    ))}
                  </div>
                </ShellCard>
              ))}
            </div>
          </div>
        );
      case 'xfeed':
        return (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <SectionHeader title={`X signals · ${activeBrandMeta.label}`} subtitle="Parallel narrative and social signal monitoring tied back into APEX operating action." actions={<><Badge label="Monitored" tone="green" /><Button label="Open newsroom" /></>} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
              {[
                { label: 'Monitored signals', value: String(xSignalFeed.length), delta: `${primaryBrandCount} in active brand scope` },
                { label: 'Critical narrative shifts', value: String(criticalNarrativeShifts), delta: criticalNarrativeShifts ? 'Escalation required' : 'No active breaks' },
                { label: 'Executive handles watched', value: String(executiveHandlesWatched), delta: `${visibleContacts.filter((contact) => contact.tier === 'T1').length} tier 1` },
                { label: 'Actionable mentions', value: String(actionableMentions), delta: `${draftHistory.length} draft revisions in rail` },
              ].map((metric) => (
                <ShellCard key={metric.label} subtle>
                  <div style={{ color: '#6b7280', fontSize: '0.74rem', marginBottom: '0.25rem' }}>{metric.label}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{metric.value}</div>
                  <div style={{ color: '#166534', fontSize: '0.72rem', marginTop: '0.15rem' }}>{metric.delta}</div>
                </ShellCard>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.95fr 0.95fr', gap: '0.9rem' }}>
              <ShellCard>
                <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Signal feed</strong>
                <div style={{ display: 'grid', gap: '0.6rem' }}>
                  {xSignalFeed.length ? xSignalFeed.map((signal) => (
                    <a key={signal.id} href={buildHref(filters, { selected: signal.id, surface: 'xfeed' })} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ background: signal.id === selectedEvent?.id ? '#eef6ff' : '#f7f8fa', border: signal.id === selectedEvent?.id ? '1px solid #93c5fd' : '1px solid transparent', borderRadius: 12, padding: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.3rem' }}>
                          <strong style={{ fontSize: '0.84rem' }}>{signal.handle}</strong>
                          <Badge label={`Score ${signal.relevance_score}`} tone={signal.relevance_score >= 90 ? 'red' : signal.relevance_score >= 80 ? 'amber' : 'neutral'} />
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', lineHeight: 1.4 }}>{signal.title}</div>
                        <div style={{ color: '#4b5563', fontSize: '0.8rem', marginTop: '0.3rem', lineHeight: 1.5 }}>{signal.summary ?? 'No narrative summary yet.'}</div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                          <Badge label={signal.narrativeTone} tone={signal.relevance_score >= 90 ? 'red' : 'purple'} />
                          {signal.market ? <Badge label={signal.market} /> : null}
                          <Badge label={prettyBrand(signal.primary_brand)} />
                        </div>
                      </div>
                    </a>
                  )) : <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>No monitored signals in the current brand/market context.</div>}
                </div>
              </ShellCard>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Narrative clusters</strong>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {xWatchTopics.length ? xWatchTopics.map((item) => (
                      <div key={item.topic} style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.7rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.82rem' }}>{item.topic}</strong>
                          <Badge label={item.posture} tone={item.posture === 'Escalate' ? 'red' : item.posture === 'Monitor' ? 'amber' : 'purple'} />
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '0.76rem', marginTop: '0.25rem' }}>{item.count} connected signals in active view</div>
                      </div>
                    )) : <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>No narrative clusters yet.</div>}
                  </div>
                </ShellCard>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Who to watch</strong>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {xWhoToWatch.length ? xWhoToWatch.map((contact) => (
                      <div key={contact.id} style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.7rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{contact.name}</div>
                            <div style={{ color: '#6b7280', fontSize: '0.74rem' }}>{contact.title}</div>
                          </div>
                          <Badge label={contact.tier} tone={contact.tier === 'T1' ? 'red' : 'amber'} />
                        </div>
                        <div style={{ color: '#4b5563', fontSize: '0.78rem', marginTop: '0.3rem' }}>{contact.watchReason}</div>
                      </div>
                    )) : <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>No brand-scoped contacts to watch yet.</div>}
                  </div>
                </ShellCard>
              </div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Action rail</strong>
                  {selectedEvent ? (
                    <div style={{ display: 'grid', gap: '0.6rem' }}>
                      <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{selectedEvent.title}</div>
                        <div style={{ color: '#4b5563', fontSize: '0.8rem', marginTop: '0.3rem', lineHeight: 1.5 }}>{selectedEvent.summary ?? 'No summary available.'}</div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                          <Badge label={prettyBrand(selectedEvent.primary_brand)} />
                          {selectedEvent.event_type ? <Badge label={selectedEvent.event_type} tone='purple' /> : null}
                          <Badge label={selectedEvent.latest_draft_status ?? 'draft pending'} tone={selectedEvent.latest_draft_status === 'ready_to_send' ? 'green' : 'amber'} />
                        </div>
                      </div>
                      <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem', fontSize: '0.8rem' }}>
                        <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Recommended next moves</strong>
                        <ul style={{ margin: 0, paddingLeft: '1rem', color: '#4b5563', lineHeight: 1.6 }}>
                          <li>Validate whether this signal changes pursuit timing for {prettyBrand(selectedEvent.primary_brand)}.</li>
                          <li>Push the current narrative into Paperclip if a handoff or follow-up is required.</li>
                          <li>Check the audit rail before operator outreach to preserve sequence integrity.</li>
                        </ul>
                      </div>
                    </div>
                  ) : <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>Select a signal to open its action rail.</div>}
                </ShellCard>
                {renderPaperclipPanel()}
                {renderAuditPanel()}
              </div>
            </div>
          </div>
        );
      case 'brain':
        return (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <SectionHeader title={`Mind map · ${activeBrandMeta.label}`} subtitle="Relationship graph and pursuit logic stitched from live signals, linked entities, and operator context." actions={<><Badge label="Graph live" tone="green" /><Button label="Open account workspace" /></>} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
              {[
                { label: 'Active nodes', value: String(relationshipNodes.length), delta: `${relationshipEdges.length} connection paths` },
                { label: 'Decision-makers mapped', value: String(visibleContacts.filter((contact) => contact.tier === 'T1').length), delta: `${visibleContacts.length} visible contacts` },
                { label: 'Live pursuit tracks', value: String(pursuitTracks.length), delta: `${paperclipTasks.length} synced tasks` },
                { label: 'Linkage confidence', value: String(selectedEventDetail?.confidence_score ?? 0), delta: String(selectedEventDetail?.metadata?.linkage_status ?? 'pending') },
              ].map((metric) => (
                <ShellCard key={metric.label} subtle>
                  <div style={{ color: '#6b7280', fontSize: '0.74rem', marginBottom: '0.25rem' }}>{metric.label}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{metric.value}</div>
                  <div style={{ color: '#166534', fontSize: '0.72rem', marginTop: '0.15rem' }}>{metric.delta}</div>
                </ShellCard>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.95fr 0.95fr', gap: '0.9rem' }}>
              <ShellCard>
                <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Relationship graph</strong>
                <div style={{ display: 'grid', gap: '0.6rem' }}>
                  {relationshipNodes.map((node, index) => (
                    <div key={node.id} style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: '0.7rem', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 64 }}>
                        <div style={{ width: 16, height: 16, borderRadius: 999, background: node.tone, marginTop: 4 }} />
                        {index < relationshipNodes.length - 1 ? <div style={{ width: 2, flex: 1, background: '#dbeafe', marginTop: 6 }} /> : null}
                      </div>
                      <div style={{ background: '#f7f8fa', borderRadius: 12, padding: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <strong style={{ fontSize: '0.84rem' }}>{node.label}</strong>
                          <Badge label={node.type} tone="purple" />
                        </div>
                        <div style={{ color: '#4b5563', fontSize: '0.8rem', lineHeight: 1.5 }}>{node.detail}</div>
                        {index > 0 ? <div style={{ color: '#6b7280', fontSize: '0.74rem', marginTop: '0.35rem' }}>Connected via: {relationshipEdges[index - 1]?.reason}</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </ShellCard>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Pursuit tracks</strong>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {pursuitTracks.map((track) => (
                      <div key={track.title} style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{track.title}</div>
                        <div style={{ color: '#111827', fontSize: '0.82rem', marginTop: '0.2rem' }}>{track.value}</div>
                        <div style={{ color: '#6b7280', fontSize: '0.74rem', marginTop: '0.2rem' }}>{track.note}</div>
                      </div>
                    ))}
                  </div>
                </ShellCard>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Relationship priorities</strong>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {visibleContacts.slice(0, 4).map((contact, index) => (
                      <div key={contact.id} style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.82rem' }}>{contact.name}</strong>
                          <Badge label={contact.tier} tone={contact.tier === 'T1' ? 'red' : 'amber'} />
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '0.74rem', marginTop: '0.2rem' }}>{contact.title}</div>
                        <div style={{ color: '#4b5563', fontSize: '0.78rem', marginTop: '0.3rem' }}>{index === 0 ? 'Use as primary decision path.' : index === 1 ? 'Strengthen as champion route.' : 'Monitor as support node.'}</div>
                      </div>
                    ))}
                  </div>
                </ShellCard>
              </div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Operator next moves</strong>
                  <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem', fontSize: '0.8rem' }}>
                    <ul style={{ margin: 0, paddingLeft: '1rem', color: '#4b5563', lineHeight: 1.7 }}>
                      <li>Confirm whether the selected signal should escalate the {activeBrandMeta.label} pursuit path.</li>
                      <li>Use the linked account/property pair to anchor outreach and proposal positioning.</li>
                      <li>Sync next action into Paperclip so the pursuit stays visible across both systems.</li>
                    </ul>
                  </div>
                </ShellCard>
                {renderPaperclipPanel()}
                {renderAuditPanel()}
              </div>
            </div>
          </div>
        );
      case 'map':
        return (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <SectionHeader title={`Spatial map · ${activeBrandMeta.label}`} subtitle="Metro, submarket, and building-level territory intelligence tied to live signal pressure." actions={<><Badge label="Territory live" tone="green" /><Button label="Open account workspace" /></>} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
              {[
                { label: 'Active markets', value: String(marketCards.filter((item) => item.signals > 0).length), delta: `${events.length} total signals` },
                { label: 'Primary market pressure', value: `${selectedMarketCard?.pressure ?? 0}%`, delta: selectedMarketCard?.market ?? 'No market selected' },
                { label: 'Linked territory nodes', value: String([selectedEventDetail?.account_id || selectedEventDetail?.account_name, selectedEventDetail?.property_id || selectedEventDetail?.property_name].filter(Boolean).length), delta: String(selectedEventDetail?.metadata?.linkage_status ?? 'pending') },
                { label: 'Critical market triggers', value: String(marketCards.reduce((sum, item) => sum + item.critical, 0)), delta: `${selectedMarketCard?.critical ?? 0} in focus zone` },
              ].map((metric) => (
                <ShellCard key={metric.label} subtle>
                  <div style={{ color: '#6b7280', fontSize: '0.74rem', marginBottom: '0.25rem' }}>{metric.label}</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{metric.value}</div>
                  <div style={{ color: '#166534', fontSize: '0.72rem', marginTop: '0.15rem' }}>{metric.delta}</div>
                </ShellCard>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr 0.95fr', gap: '0.9rem' }}>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Market board</strong>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {marketCards.map((item) => (
                      <div key={item.market} style={{ background: item.market === selectedMarketCard?.market ? '#eef6ff' : '#f7f8fa', border: item.market === selectedMarketCard?.market ? '1px solid #93c5fd' : '1px solid transparent', borderRadius: 12, padding: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <strong style={{ fontSize: '0.84rem' }}>{item.market}</strong>
                          <Badge label={`${item.pressure}% pressure`} tone={item.pressure >= 75 ? 'red' : item.pressure >= 55 ? 'amber' : 'green'} />
                        </div>
                        <div style={{ color: '#4b5563', fontSize: '0.78rem', lineHeight: 1.5 }}>{item.note}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.55rem', fontSize: '0.74rem' }}>
                          <div><div style={{ color: '#6b7280' }}>Signals</div><div style={{ fontWeight: 700 }}>{item.signals}</div></div>
                          <div><div style={{ color: '#6b7280' }}>Critical</div><div style={{ fontWeight: 700 }}>{item.critical}</div></div>
                          <div><div style={{ color: '#6b7280' }}>Lead brand</div><div style={{ fontWeight: 700 }}>{item.activeBrand}</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ShellCard>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Submarket watchlist</strong>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {spatialSubmarkets.map((item) => (
                      <div key={item.name} style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.82rem' }}>{item.name}</strong>
                          <Badge label={item.posture} tone={item.posture === 'Expand' ? 'green' : item.posture === 'Defend' ? 'red' : 'amber'} />
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '0.74rem', marginTop: '0.2rem' }}>{item.market} · {item.pressure}% territory pressure</div>
                      </div>
                    ))}
                  </div>
                </ShellCard>
              </div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Territory watchlist</strong>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {spatialWatchlist.map((item) => (
                      <div key={item.label} style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem' }}>
                        <div style={{ color: '#6b7280', fontSize: '0.74rem' }}>{item.label}</div>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', marginTop: '0.2rem' }}>{item.value}</div>
                        <div style={{ color: '#4b5563', fontSize: '0.76rem', marginTop: '0.2rem' }}>{item.note}</div>
                      </div>
                    ))}
                  </div>
                </ShellCard>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Operator recommendations</strong>
                  <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.8rem', fontSize: '0.8rem' }}>
                    <ul style={{ margin: 0, paddingLeft: '1rem', color: '#4b5563', lineHeight: 1.7 }}>
                      {spatialRecommendations.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                </ShellCard>
              </div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Selected territory anchor</strong>
                  {selectedEvent ? (
                    <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.8rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{selectedEventDetail?.property_name ?? selectedEvent.title}</div>
                      <div style={{ color: '#4b5563', fontSize: '0.8rem', marginTop: '0.3rem', lineHeight: 1.5 }}>{selectedEvent.summary ?? 'No summary available.'}</div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                        <Badge label={selectedEventDetail?.market ?? selectedEvent.market ?? 'Unknown market'} />
                        <Badge label={prettyBrand(selectedEvent.primary_brand)} />
                        <Badge label={selectedEventDetail?.metadata?.linkage_status ? String(selectedEventDetail.metadata.linkage_status) : 'linkage pending'} tone={selectedEventDetail?.metadata?.linkage_status ? 'green' : 'amber'} />
                      </div>
                    </div>
                  ) : <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>Select a signal to anchor the spatial view.</div>}
                </ShellCard>
                {renderPaperclipPanel()}
                {renderAuditPanel()}
              </div>
            </div>
          </div>
        );
      case 'proposal':
        return (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <SectionHeader title={`Proposals · ${activeBrandMeta.label}`} subtitle="Convert live signal, account context, and relationship posture into a structured commercial package." actions={<><Badge label="Conversion rail" tone="green" /><Button label="Open account workspace" /></>} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
              {[
                { label: 'Proposal readiness', value: `${proposalReadinessScore}%`, delta: selectedEvent ? 'Signal anchored' : 'Select signal first' },
                { label: 'Active modules', value: String(proposalModules.filter((module) => module.status !== 'missing').length), delta: `${proposalModules.filter((module) => module.status === 'ready').length} ready` },
                { label: 'Decision path', value: visibleContacts[0]?.name ?? 'Unmapped', delta: visibleContacts[0]?.title ?? 'Need contact anchor' },
                { label: 'Governance proofs', value: String(auditEntries.length + paperclipTasks.length), delta: `${paperclipTasks.length} tasks · ${auditEntries.length} audit` },
              ].map((metric) => (
                <ShellCard key={metric.label} subtle>
                  <div style={{ color: '#6b7280', fontSize: '0.74rem', marginBottom: '0.25rem' }}>{metric.label}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{metric.value}</div>
                  <div style={{ color: '#166534', fontSize: '0.72rem', marginTop: '0.15rem' }}>{metric.delta}</div>
                </ShellCard>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr 0.95fr', gap: '0.9rem' }}>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Proposal package</strong>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {proposalPackage.map((item) => (
                      <div key={item.label} style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem' }}>
                        <div style={{ color: '#6b7280', fontSize: '0.74rem' }}>{item.label}</div>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', marginTop: '0.2rem' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </ShellCard>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Proposal build modules</strong>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {proposalModules.map((module) => (
                      <div key={module.title} style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.82rem' }}>{module.title}</strong>
                          <Badge label={module.status} tone={module.status === 'ready' ? 'green' : module.status === 'draft' ? 'amber' : 'red'} />
                        </div>
                        <div style={{ color: '#4b5563', fontSize: '0.78rem', marginTop: '0.3rem' }}>{module.note}</div>
                      </div>
                    ))}
                  </div>
                </ShellCard>
              </div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Recommended next moves</strong>
                  <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.8rem', fontSize: '0.8rem' }}>
                    <ul style={{ margin: 0, paddingLeft: '1rem', color: '#4b5563', lineHeight: 1.7 }}>
                      {proposalActions.map((action) => <li key={action}>{action}</li>)}
                    </ul>
                  </div>
                </ShellCard>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Proposal timeline</strong>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {proposalTimeline.map((item) => (
                      <div key={item.stage} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '0.65rem', alignItems: 'start' }}>
                        <div style={{ color: '#6b7280', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>{item.stage}</div>
                        <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.7rem' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{item.detail}</div>
                          <div style={{ color: '#6b7280', fontSize: '0.74rem', marginTop: '0.2rem' }}>{item.when}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ShellCard>
              </div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Selected signal anchor</strong>
                  {selectedEvent ? (
                    <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.8rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{selectedEvent.title}</div>
                      <div style={{ color: '#4b5563', fontSize: '0.8rem', marginTop: '0.3rem', lineHeight: 1.5 }}>{selectedEvent.summary ?? 'No summary yet.'}</div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                        <Badge label={prettyBrand(selectedEvent.primary_brand)} />
                        {selectedEvent.market ? <Badge label={selectedEvent.market} /> : null}
                        {selectedEvent.event_type ? <Badge label={selectedEvent.event_type} tone="purple" /> : null}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                        <a href={buildHref(filters, { surface: 'sentry' })} style={{ textDecoration: 'none' }}><span style={{ ...softBlueButtonStyle, padding: '0.45rem 0.7rem' }}>Open sentry</span></a>
                        <a href={buildHref(filters, { surface: 'account' })} style={{ textDecoration: 'none' }}><span style={{ ...softBlueButtonStyle, padding: '0.45rem 0.7rem' }}>Open account</span></a>
                      </div>
                    </div>
                  ) : <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>Select a signal to anchor the proposal logic.</div>}
                </ShellCard>
                {renderDraftHistoryPanel()}
                {renderPaperclipPanel()}
                {renderAuditPanel()}
              </div>
            </div>
          </div>
        );
      case 'sentry':
        return (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <SectionHeader title={`Sentry mode · ${activeBrandMeta.label}`} subtitle="Graduated autonomy, guardrails, and operator-governed execution posture for APEX." actions={<><Badge label="Governed" tone="green" /><Button label="Open audit rail" /></>} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
              {[
                { label: 'Autonomy level', value: sentryAutonomyLevel, delta: `${criticalEvents.length} critical signals` },
                { label: 'Guardrails armed', value: String(sentryGuardrails.filter((item) => item.status === 'armed').length), delta: `${sentryGuardrails.length} total rails` },
                { label: 'Escalation candidates', value: String(criticalEvents.length), delta: highEvents.length ? `${highEvents.length} high-priority signals` : 'No active escalations' },
                { label: 'Visible execution rails', value: String(auditEntries.length + paperclipTasks.length), delta: `${paperclipTasks.length} tasks · ${auditEntries.length} audit` },
              ].map((metric) => (
                <ShellCard key={metric.label} subtle>
                  <div style={{ color: '#6b7280', fontSize: '0.74rem', marginBottom: '0.25rem' }}>{metric.label}</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{metric.value}</div>
                  <div style={{ color: '#166534', fontSize: '0.72rem', marginTop: '0.15rem' }}>{metric.delta}</div>
                </ShellCard>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr 0.95fr', gap: '0.9rem' }}>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Guardrail matrix</strong>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {sentryGuardrails.map((rail) => (
                      <div key={rail.label} style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.82rem' }}>{rail.label}</strong>
                          <Badge label={rail.status} tone={rail.status === 'armed' ? 'green' : rail.status === 'locked' ? 'purple' : rail.status === 'broad' ? 'amber' : 'red'} />
                        </div>
                        <div style={{ color: '#4b5563', fontSize: '0.78rem', marginTop: '0.3rem' }}>{rail.note}</div>
                      </div>
                    ))}
                  </div>
                </ShellCard>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Autonomy actions</strong>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {sentryActions.map((action) => (
                      <div key={action.title} style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.82rem' }}>{action.title}</strong>
                          <Badge label={action.state} tone={action.state === 'ready' ? 'green' : action.state === 'active' ? 'purple' : 'neutral'} />
                        </div>
                        <div style={{ color: '#4b5563', fontSize: '0.78rem', marginTop: '0.3rem' }}>{action.detail}</div>
                      </div>
                    ))}
                  </div>
                </ShellCard>
              </div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Execution timeline</strong>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {sentryTimeline.map((item) => (
                      <div key={item.stage} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: '0.65rem', alignItems: 'start' }}>
                        <div style={{ color: '#6b7280', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>{item.stage}</div>
                        <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.7rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{item.detail}</div>
                            <Badge label={item.status} tone={item.status === 'captured' ? 'green' : item.status === 'warning' ? 'red' : 'neutral'} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ShellCard>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Operator recommendations</strong>
                  <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.8rem', fontSize: '0.8rem' }}>
                    <ul style={{ margin: 0, paddingLeft: '1rem', color: '#4b5563', lineHeight: 1.7 }}>
                      {sentryRecommendations.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                </ShellCard>
              </div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Selected signal governance</strong>
                  {selectedEvent ? (
                    <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.8rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{selectedEvent.title}</div>
                      <div style={{ color: '#4b5563', fontSize: '0.8rem', marginTop: '0.3rem', lineHeight: 1.5 }}>{selectedEvent.summary ?? 'No summary available.'}</div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                        <Badge label={prettyBrand(selectedEvent.primary_brand)} />
                        <Badge label={selectedEvent.event_type ?? 'unclassified'} tone="purple" />
                        <Badge label={selectedEvent.latest_draft_status ?? 'draft pending'} tone={selectedEvent.latest_draft_status === 'ready_to_send' ? 'green' : 'amber'} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                        <a href={buildHref(filters, { surface: 'proposal' })} style={{ textDecoration: 'none' }}><span style={{ ...softBlueButtonStyle, padding: '0.45rem 0.7rem' }}>Open proposal</span></a>
                        <a href={buildHref(filters, { surface: 'newsroom' })} style={{ textDecoration: 'none' }}><span style={{ ...softBlueButtonStyle, padding: '0.45rem 0.7rem' }}>Back to newsroom</span></a>
                      </div>
                    </div>
                  ) : <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>Select a signal to evaluate sentry posture.</div>}
                </ShellCard>
                {renderDraftHistoryPanel()}
                {renderPaperclipPanel()}
                {renderAuditPanel()}
              </div>
            </div>
          </div>
        );
      case 'brand':
        return (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <SectionHeader title={`Brand profile · ${activeBrandMeta.label}`} subtitle="System-level brand context, operating posture, and cross-surface behavior inside APEX." actions={<><Badge label="Profile live" tone="green" /><Button label="Open command center" /></>} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
              {[
                { label: 'Active brand', value: activeBrandMeta.label, delta: activeBrandKey === 'all' ? 'Global shell scope' : 'Scoped operating context' },
                { label: 'Surface coverage', value: String(brandSurfaceCoverage.length), delta: `${brandSurfaceCoverage.filter((item) => item.state === 'live').length} live surfaces` },
                { label: 'Brand-readiness', value: `${Math.min(100, 45 + primaryBrandCount * 5 + visibleContacts.length * 3)}%`, delta: `${primaryBrandCount} active signals` },
                { label: 'Governance proofs', value: String(auditEntries.length + paperclipTasks.length), delta: `${auditEntries.length} audit · ${paperclipTasks.length} sync` },
              ].map((metric) => (
                <ShellCard key={metric.label} subtle>
                  <div style={{ color: '#6b7280', fontSize: '0.74rem', marginBottom: '0.25rem' }}>{metric.label}</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{metric.value}</div>
                  <div style={{ color: '#166534', fontSize: '0.72rem', marginTop: '0.15rem' }}>{metric.delta}</div>
                </ShellCard>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr 0.95fr', gap: '0.9rem' }}>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Brand standards</strong>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {brandStandards.map((item) => (
                      <div key={item.label} style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem' }}>
                        <div style={{ color: '#6b7280', fontSize: '0.74rem' }}>{item.label}</div>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', marginTop: '0.2rem' }}>{item.value}</div>
                        <div style={{ color: '#4b5563', fontSize: '0.76rem', marginTop: '0.2rem' }}>{item.note}</div>
                      </div>
                    ))}
                  </div>
                </ShellCard>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Surface behavior coverage</strong>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {brandSurfaceCoverage.map((item) => (
                      <div key={item.surface} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7f8fa', borderRadius: 10, padding: '0.7rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{item.surface}</span>
                        <Badge label={item.state} tone={item.state === 'live' ? 'green' : 'amber'} />
                      </div>
                    ))}
                  </div>
                </ShellCard>
              </div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Capability stack</strong>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {brandCapabilities.map((item) => (
                      <div key={item.title} style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.82rem' }}>{item.title}</strong>
                          <Badge label={item.status} tone={item.status === 'active' ? 'green' : 'amber'} />
                        </div>
                        <div style={{ color: '#4b5563', fontSize: '0.78rem', marginTop: '0.3rem' }}>{item.note}</div>
                      </div>
                    ))}
                  </div>
                </ShellCard>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Profile guidance</strong>
                  <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.8rem', fontSize: '0.8rem' }}>
                    <ul style={{ margin: 0, paddingLeft: '1rem', color: '#4b5563', lineHeight: 1.7 }}>
                      {brandPillars.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                </ShellCard>
              </div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Brand context anchor</strong>
                  <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.35rem' }}>
                      <span style={{ width: 22, height: 22, borderRadius: 999, background: activeBrandMeta.color, color: '#fff', fontSize: '0.68rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{activeBrandMeta.short}</span>
                      <strong style={{ fontSize: '0.86rem' }}>{activeBrandMeta.label}</strong>
                    </div>
                    <div style={{ color: '#4b5563', fontSize: '0.8rem', lineHeight: 1.5 }}>
                      {selectedEvent?.summary ?? `APEX is currently expressing ${activeBrandMeta.label} as the active operating context across the shell.`}
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                      <Badge label={`${primaryBrandCount} live signals`} />
                      <Badge label={`${visibleContacts.length} contacts`} tone="purple" />
                      <Badge label={`${marketCards.filter((item) => item.signals > 0).length} active markets`} tone="amber" />
                    </div>
                  </div>
                </ShellCard>
                {renderPaperclipPanel()}
                {renderAuditPanel()}
              </div>
            </div>
          </div>
        );
      case 'apify':
        return (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <SectionHeader title={`Integrations · ${activeBrandMeta.label}`} subtitle="System registry for live feeds, execution rails, governance visibility, and cross-surface adapters." actions={<><Badge label="Registry live" tone="green" /><Button label="Open newsroom" /></>} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
              {[
                { label: 'Connected services', value: String(integrationRegistry.filter((item) => item.status === 'connected').length), delta: `${integrationRegistry.length} tracked integrations` },
                { label: 'Degraded rails', value: String(integrationRegistry.filter((item) => item.status === 'degraded').length), delta: 'Watch these before beta claims' },
                { label: 'Live flow paths', value: String(integrationFlows.length), delta: `${paperclipTasks.length} execution sync items` },
                { label: 'Governance-linked services', value: String(integrationRegistry.filter((item) => item.type === 'Governance' || item.type === 'Execution sync').length), delta: `${auditEntries.length} audit proofs` },
              ].map((metric) => (
                <ShellCard key={metric.label} subtle>
                  <div style={{ color: '#6b7280', fontSize: '0.74rem', marginBottom: '0.25rem' }}>{metric.label}</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{metric.value}</div>
                  <div style={{ color: '#166534', fontSize: '0.72rem', marginTop: '0.15rem' }}>{metric.delta}</div>
                </ShellCard>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr 0.95fr', gap: '0.9rem' }}>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Integration registry</strong>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {integrationRegistry.map((item) => (
                      <div key={item.name} style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{item.name}</div>
                            <div style={{ color: '#6b7280', fontSize: '0.74rem' }}>{item.type}</div>
                          </div>
                          <Badge label={item.status} tone={item.status === 'connected' ? 'green' : item.status === 'degraded' ? 'red' : 'amber'} />
                        </div>
                        <div style={{ color: '#4b5563', fontSize: '0.78rem', marginTop: '0.3rem' }}>{item.detail}</div>
                      </div>
                    ))}
                  </div>
                </ShellCard>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Flow map</strong>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {integrationFlows.map((item) => (
                      <div key={`${item.from}-${item.to}`} style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{item.from} → {item.to}</div>
                        <div style={{ color: '#4b5563', fontSize: '0.78rem', marginTop: '0.3rem' }}>{item.note}</div>
                      </div>
                    ))}
                  </div>
                </ShellCard>
              </div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>System recommendations</strong>
                  <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.8rem', fontSize: '0.8rem' }}>
                    <ul style={{ margin: 0, paddingLeft: '1rem', color: '#4b5563', lineHeight: 1.7 }}>
                      {integrationRecommendations.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                </ShellCard>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Current system posture</strong>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem' }}><strong style={{ fontSize: '0.82rem' }}>Brand context</strong><div style={{ color: '#4b5563', fontSize: '0.78rem', marginTop: '0.25rem' }}>{activeBrandMeta.label} is active across the shell.</div></div>
                    <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem' }}><strong style={{ fontSize: '0.82rem' }}>Selected signal</strong><div style={{ color: '#4b5563', fontSize: '0.78rem', marginTop: '0.25rem' }}>{selectedEvent?.title ?? 'No signal selected'}</div></div>
                    <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.75rem' }}><strong style={{ fontSize: '0.82rem' }}>Execution visibility</strong><div style={{ color: '#4b5563', fontSize: '0.78rem', marginTop: '0.25rem' }}>{paperclipTasks[0]?.title ?? 'No downstream sync item yet'}</div></div>
                  </div>
                </ShellCard>
              </div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <ShellCard>
                  <strong style={{ display: 'block', marginBottom: '0.65rem' }}>Integration anchor</strong>
                  <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.8rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{selectedEvent?.title ?? 'APEX system shell'}</div>
                    <div style={{ color: '#4b5563', fontSize: '0.8rem', marginTop: '0.3rem', lineHeight: 1.5 }}>
                      {selectedEvent?.summary ?? 'The unified shell is now stitching ingestion, draft generation, linkage, Paperclip sync, and audit into one operating environment.'}
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                      <Badge label={`${integrationRegistry.filter((item) => item.status === 'connected').length} connected`} tone="green" />
                      <Badge label={`${integrationRegistry.filter((item) => item.status === 'degraded').length} degraded`} tone="red" />
                      <Badge label={`${integrationFlows.length} flow paths`} tone="purple" />
                    </div>
                  </div>
                </ShellCard>
                {renderPaperclipPanel()}
                {renderAuditPanel()}
              </div>
            </div>
          </div>
        );
      default:
        return renderPlaceholderSurface('Surface', 'APEX unified operating surface.', activeBrandMeta.label);
    }
  })();

  return (
    <main style={{ fontFamily: 'Inter, sans-serif', background: '#f4f6f8', padding: '1rem', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1600, margin: '0 auto', background: '#edf1f5', border: '1px solid #e5e7eb', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 1rem', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: '#185FA5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem' }}>A</div>
            <strong>APEX</strong>
            <Badge label="v1.0" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            {Object.entries(BRAND_META).map(([key, meta]) => {
              const active = filters.brand === key;
              return (
                <a key={key} href={buildHref(filters, { brand: key, selected: undefined, contact: undefined })} style={{ textDecoration: 'none' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.28rem 0.6rem 0.28rem 0.32rem', borderRadius: 999, border: active ? `1px solid ${meta.color}` : '1px solid #e5e7eb', background: active ? '#f7f8fa' : '#fff', color: active ? '#111827' : '#6b7280', fontSize: '0.78rem', fontWeight: 600 }}>
                    <span style={{ width: 18, height: 18, borderRadius: 999, background: meta.color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.52rem', fontWeight: 700 }}>{meta.short}</span>
                    {meta.label}
                  </span>
                </a>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', marginLeft: 'auto' }}>
            {['ALL', 'Dallas-Fort Worth', 'Austin', 'Houston', 'San Antonio'].map((market) => {
              const active = filters.market === market || (filters.market === 'ALL' && market === 'ALL');
              return (
                <a key={market} href={buildHref(filters, { market, selected: undefined })} style={{ textDecoration: 'none' }}>
                  <span style={{ border: '1px solid #d1d5db', background: active ? '#eaf2fb' : 'transparent', color: active ? '#185FA5' : '#6b7280', borderRadius: 999, padding: '0.3rem 0.55rem', fontSize: '0.72rem', fontWeight: 600, display: 'inline-flex' }}>{market === 'Dallas-Fort Worth' ? 'DFW' : market}</span>
                </a>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #e5e7eb', padding: '0.3rem 0.6rem', borderRadius: 999 }}>
            <div style={{ width: 22, height: 22, borderRadius: 999, background: '#639922', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>RS</div>
            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{operatorName}</span>
            <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{operatorRole.replaceAll('_', ' ')}</span>
          </div>
        </div>

        {filters.brand !== 'all' ? (
          <div style={{ padding: '0.55rem 1rem', background: '#eaf2fb', borderBottom: '1px solid #dbeafe', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', color: '#185FA5' }}>
            <span>Viewing <strong>{activeBrandMeta.label}</strong> · brand-context scope is active across the shell.</span>
            <a href={buildHref(filters, { brand: 'all' })} style={{ color: '#185FA5', fontWeight: 700, textDecoration: 'none' }}>Clear ↗</a>
          </div>
        ) : null}

        <div style={{ padding: '0.7rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {contextChips.map((chip) => (
              <div key={chip.label} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 999, padding: '0.28rem 0.55rem', fontSize: '0.74rem' }}>
                <span style={{ color: '#6b7280', fontWeight: 600 }}>{chip.label}</span>
                <span style={{ color: '#111827', fontWeight: 700 }}>{chip.value}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {quickActions.map((action) => (
              <a key={action.label} href={action.href} style={{ textDecoration: 'none' }}>
                <span style={{ display: 'inline-flex', border: '1px solid #d1d5db', background: '#fff', color: '#374151', borderRadius: 999, padding: '0.32rem 0.6rem', fontSize: '0.74rem', fontWeight: 600 }}>{action.label}</span>
              </a>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', minHeight: 720 }}>
          <aside style={{ background: '#fff', borderRight: '1px solid #e5e7eb', padding: '0.9rem 0.55rem' }}>
            {navSections.map((section) => (
              <div key={section} style={{ marginBottom: '0.9rem' }}>
                <div style={{ padding: '0 0.5rem 0.35rem', color: '#9ca3af', fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>{section}</div>
                <div style={{ display: 'grid', gap: '0.2rem' }}>
                  {NAV_ITEMS.filter((item) => item.section === section).map((item) => {
                    const active = filters.surface === item.key;
                    return (
                      <a key={item.key} href={buildHref(filters, { surface: item.key })} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ padding: '0.55rem 0.6rem', borderRadius: 10, background: active ? '#eaf2fb' : 'transparent', color: active ? '#185FA5' : '#4b5563', fontSize: '0.82rem', fontWeight: active ? 700 : 500 }}>{item.label}</div>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </aside>

          <section style={{ padding: '1rem' }}>{surfaceNode}</section>
        </div>
      </div>
    </main>
  );
}
