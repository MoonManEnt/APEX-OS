import type React from 'react'
import { RegenButton } from './regen-button'

type EventItem = {
  id: string
  title: string
  summary: string | null
  primary_brand: string | null
  relevance_score: number
  confidence_score?: number
  badges?: string[]
  event_type?: string | null
  market?: string | null
}

type EventDetail = {
  property_name?: string | null
  account_name?: string | null
  market?: string | null
  metadata?: Record<string, unknown>
}

type ActionDraft = {
  event_id: string
  title: string
  body: string
  audience: string
  recommended_brand: string
  why_it_matters: string
  signal_posture: string
  context_notes: string[]
  draft_type?: string
  draft_status?: string
  edited_by_operator?: boolean
  metadata?: {
    operator_name?: string
    assigned_reviewer_name?: string
    reviewed_by_name?: string
  }
}

type HistoryItem = {
  action_id: string
  title: string
  model_name: string
  used_fallback: boolean
  updated_at?: string | null
  draft_type?: string
  draft_status?: string
  edited_by_operator?: boolean
}

type ContactRecord = {
  id: string
  initials: string
  name: string
  title: string
  tier: 'T1' | 'T2' | 'T3'
  brands: string[]
}

const CONTACTS: ContactRecord[] = [
  { id: 'sh', initials: 'SH', name: 'Sarah Hendricks', title: 'VP Real Estate, Goldman Sachs', tier: 'T1', brands: ['scout_security', 'partners_cc', 'clean_scapes', 'ecs_texas'] },
  { id: 'mc', initials: 'MC', name: 'Marcus Chen', title: 'SVP Procurement, Goldman Sachs', tier: 'T1', brands: ['partners_cc', 'scout_security'] },
  { id: 'lp', initials: 'LP', name: 'Lisa Park', title: 'Property Manager, JLL Dallas', tier: 'T2', brands: ['clean_scapes', 'partners_cc', 'scout_security'] },
  { id: 'jb', initials: 'JB', name: 'Joel Behrens', title: 'SVP, Trammell Crow Houston', tier: 'T2', brands: ['partners_cc', 'scout_security'] },
]

const STATUS_COLORS: Record<string, string> = {
  generated: '#6b7280',
  edited: '#92400e',
  awaiting_review: '#1d4ed8',
  changes_requested: '#991b1b',
  approved: '#166534',
  ready_to_send: '#166534',
}

function scoreColor(score: number): string {
  if (score >= 90) return '#991b1b'
  if (score >= 80) return '#92400e'
  return '#185FA5'
}

function formatTimestamp(value?: string | null): string {
  if (!value) return 'unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '0.65rem',
  fontSize: '0.88rem',
  background: '#fff',
}

type Props = {
  event: EventItem
  eventDetail: EventDetail | null
  draft: ActionDraft | null
  draftHistory: HistoryItem[]
  operatorName: string
  operatorRole: string
  permissions: string[]
  closeHref: string
  draftType: string
}

export function EventModal({
  event,
  eventDetail,
  draft,
  draftHistory,
  operatorName,
  operatorRole,
  permissions,
  closeHref,
  draftType,
}: Props) {
  const canApprove = permissions.includes('draft:approve')
  const canReady = permissions.includes('draft:ready')
  const canRequestChanges = permissions.includes('draft:approve')
  const isReadOnly = draft?.draft_status === 'ready_to_send'
  const tone = scoreColor(event.relevance_score)
  const relevantContacts = CONTACTS.filter(
    (c) => event.primary_brand && c.brands.includes(event.primary_brand),
  )

  async function saveDraft(formData: FormData) {
    'use server'
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'
    const intent = String(formData.get('submit_intent') ?? 'save')
    const selectedStatus = String(formData.get('draft_status') ?? 'edited')
    const computedStatus =
      intent === 'approve' ? 'approved' :
      intent === 'ready' ? 'ready_to_send' :
      intent === 'review' ? 'awaiting_review' :
      intent === 'changes' ? 'changes_requested' :
      selectedStatus

    await fetch(`${baseUrl}/actions/draft/${event.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-apex-operator-name': operatorName,
        'x-apex-operator-role': operatorRole,
      },
      body: JSON.stringify({
        event_id: event.id,
        title: String(formData.get('title') ?? ''),
        body: String(formData.get('body') ?? ''),
        audience: String(formData.get('audience') ?? ''),
        recommended_brand: String(formData.get('recommended_brand') ?? ''),
        why_it_matters: String(formData.get('why_it_matters') ?? ''),
        signal_posture: String(formData.get('signal_posture') ?? ''),
        draft_type: String(formData.get('draft_type') ?? draftType),
        draft_status: computedStatus,
        assigned_reviewer_name:
          String(formData.get('assigned_reviewer_name') ?? '').trim() || null,
        context_notes: String(formData.get('context_notes') ?? '')
          .split('\n').map((s) => s.trim()).filter(Boolean),
        operator_name: operatorName,
      }),
    })
  }

  return (
    <>
      {/* Backdrop — clicking closes the modal */}
      <a
        href={closeHref}
        aria-label="Close modal"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 49,
          background: 'rgba(0,0,0,0.5)',
          textDecoration: 'none',
        }}
      />

      {/* Modal surface */}
      <div
        style={{
          position: 'fixed',
          inset: '2rem',
          zIndex: 50,
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          display: 'flex',
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
          maxWidth: 1000,
          margin: '2rem auto',
        }}
      >
        {/* LEFT: Draft panel */}
        <div
          style={{
            flex: 1,
            padding: '1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            borderRight: '1px solid #e5e7eb',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
                Draft · {event.primary_brand ?? 'unassigned'}
              </div>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, lineHeight: 1.35, color: '#111827' }}>
                {event.title}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, color: tone, fontSize: '0.9rem' }}>
                {event.relevance_score}
              </span>
              <a
                href={closeHref}
                aria-label="Close"
                style={{ fontSize: '1.1rem', color: '#9ca3af', textDecoration: 'none', lineHeight: 1, padding: '0.2rem 0.4rem' }}
              >
                ✕
              </a>
            </div>
          </div>

          {/* Draft form (Server Action — same pattern as existing DraftEditor) */}
          {draft ? (
            <form action={saveDraft} style={{ display: 'grid', gap: '0.65rem' }}>
              <input name="title" defaultValue={draft.title} disabled={isReadOnly} style={inputStyle} />
              <textarea
                name="body"
                defaultValue={draft.body}
                disabled={isReadOnly}
                style={{ ...inputStyle, minHeight: 160, resize: 'vertical' }}
              />
              <input type="hidden" name="audience" defaultValue={draft.audience} />
              <input type="hidden" name="recommended_brand" defaultValue={draft.recommended_brand} />
              <input type="hidden" name="why_it_matters" defaultValue={draft.why_it_matters} />
              <input type="hidden" name="signal_posture" defaultValue={draft.signal_posture} />
              <input
                name="assigned_reviewer_name"
                defaultValue={draft.metadata?.assigned_reviewer_name ?? ''}
                placeholder="Assign reviewer (required before review)"
                disabled={isReadOnly}
                style={inputStyle}
              />
              <select name="draft_type" defaultValue={draft.draft_type ?? 'primary_outreach'} disabled={isReadOnly} style={inputStyle}>
                <option value="primary_outreach">Primary outreach</option>
                <option value="internal_note">Internal note</option>
                <option value="follow_up">Follow-up</option>
                <option value="executive_brief">Executive brief</option>
              </select>
              {isReadOnly ? (
                <div style={{ fontSize: '0.78rem', color: '#6b7280', textAlign: 'center', padding: '0.5rem' }}>
                  This draft is ready to send — no further edits permitted.
                </div>
              ) : (
                <>
                  <select name="draft_status" defaultValue={draft.draft_status ?? 'edited'} style={inputStyle}>
                    <option value="edited">Edited</option>
                    <option value="awaiting_review">Awaiting review</option>
                    {canRequestChanges ? <option value="changes_requested">Changes requested</option> : null}
                    {canApprove ? <option value="approved">Approved</option> : null}
                    {canReady ? <option value="ready_to_send">Ready to send</option> : null}
                  </select>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button name="submit_intent" value="save" type="submit" style={{ background: '#185FA5', color: '#fff', border: 0, borderRadius: 10, padding: '0.65rem 0.9rem', fontWeight: 700, cursor: 'pointer' }}>
                      Save draft
                    </button>
                    <button name="submit_intent" value="review" type="submit" style={{ background: '#f3f4f6', color: '#111827', border: 0, borderRadius: 10, padding: '0.65rem 0.9rem', fontWeight: 700, cursor: 'pointer' }}>
                      Submit for review
                    </button>
                    {canApprove ? (
                      <button name="submit_intent" value="approve" type="submit" style={{ background: '#dcfce7', color: '#166534', border: 0, borderRadius: 10, padding: '0.65rem 0.9rem', fontWeight: 700, cursor: 'pointer' }}>
                        Approve
                      </button>
                    ) : null}
                    {canReady ? (
                      <button name="submit_intent" value="ready" type="submit" style={{ background: '#e0e7ff', color: '#3730a3', border: 0, borderRadius: 10, padding: '0.65rem 0.9rem', fontWeight: 700, cursor: 'pointer' }}>
                        Ready to send
                      </button>
                    ) : null}
                  </div>
                </>
              )}
              <input
                type="hidden"
                name="context_notes"
                defaultValue={(draft.context_notes ?? []).join('\n')}
              />
            </form>
          ) : (
            <div style={{ color: '#6b7280', fontSize: '0.85rem', padding: '0.5rem 0' }}>
              No draft available — use Regenerate to create one.
            </div>
          )}

          {/* Regen — client component */}
          <RegenButton
            eventId={event.id}
            eventTitle={event.title}
            eventSummary={event.summary}
            eventType={event.event_type ?? null}
            market={event.market ?? null}
            primaryBrand={event.primary_brand}
            confidenceScore={event.confidence_score}
            badges={event.badges}
            draftType={draftType}
          />
        </div>

        {/* RIGHT: Account intel panel */}
        <div
          style={{
            width: 300,
            flexShrink: 0,
            padding: '1.5rem',
            overflowY: 'auto',
            background: '#f9fafb',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Account Intel
          </div>

          {/* Property */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '0.85rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
              Property
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>
              {eventDetail?.property_name ?? eventDetail?.account_name ?? 'Unresolved asset'}
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.78rem' }}>
              {event.market ?? eventDetail?.market ?? 'Market unknown'} · {event.event_type ?? 'event'}
            </div>
          </div>

          {/* Key Contacts */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '0.85rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>
              Key Contacts
            </div>
            {relevantContacts.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: '0.78rem' }}>No contacts mapped for this brand.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {relevantContacts.map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#185FA5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>
                      {c.initials}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{c.name}</div>
                      <div style={{ color: '#6b7280', fontSize: '0.72rem' }}>{c.title} · {c.tier}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Draft History */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '0.85rem', flex: 1 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>
              Draft History
            </div>
            {draftHistory.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: '0.78rem' }}>No history yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {draftHistory.slice(0, 8).map((h) => (
                  <div key={h.action_id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[h.draft_status ?? ''] ?? '#6b7280', marginTop: 4, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: STATUS_COLORS[h.draft_status ?? ''] ?? '#374151' }}>
                        {h.draft_status ?? 'unknown'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        {formatTimestamp(h.updated_at)} · {h.edited_by_operator ? 'operator' : h.model_name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
