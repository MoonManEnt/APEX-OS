import type React from 'react'
import { revalidatePath } from 'next/cache'

export type PropertyItem = {
  id: string
  name: string | null
  market: string | null
  building_type: string
  sqft: number | null
  noi_cents: number | null
  notes: string | null
  source: string
  brands: string[]
  score: number | null
  signal_count: number
}

export type SignalItem = {
  id: string
  title: string
  confidence_score: number
  primary_brand: string | null
  market: string | null
  event_at: string | null
}

export type PropertyDetail = PropertyItem & {
  linked_signals: SignalItem[]
}

const BRAND_LABELS: Record<string, string> = {
  clean_scapes: 'Clean Scapes',
  partners_cc: 'Partners CC',
  scout_security: 'Scout Security',
  ecs_texas: 'ECS of Texas',
  revival_restoration: 'Revival',
}

const BRAND_COLORS: Record<string, string> = {
  clean_scapes: '#639922',
  partners_cc: '#5f5e5a',
  scout_security: '#185FA5',
  ecs_texas: '#1d9e75',
  revival_restoration: '#7f77dd',
}

const BUILDING_TYPE_LABELS: Record<string, string> = {
  office: 'Office',
  multifamily: 'Multifamily',
  retail: 'Retail',
  industrial: 'Industrial',
  data_center: 'Data Center',
  mixed_use: 'Mixed Use',
  hospitality: 'Hospitality',
  medical: 'Medical',
  other: 'Other',
}

function scoreColor(score: number | null): string {
  if (score === null) return '#6b7280'
  if (score >= 90) return '#991b1b'
  if (score >= 70) return '#92400e'
  return '#374151'
}

function formatNoi(cents: number | null): string {
  if (cents === null) return '—'
  const dollars = Math.round(cents / 100)
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M/yr`
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K/yr`
  return `$${dollars}/yr`
}

function buildHref(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) sp.set(k, v)
  }
  return `?${sp.toString()}`
}

export function AccountWorkspace({
  properties,
  selectedProperty,
  currentBrand,
  currentAccount,
  currentSearch,
  currentSort,
}: {
  properties: PropertyItem[]
  selectedProperty: PropertyDetail | null
  currentBrand: string
  currentAccount: string | undefined
  currentSearch: string | undefined
  currentSort: string
}) {
  async function saveField(formData: FormData) {
    'use server'
    const propertyId = formData.get('property_id') as string
    const field = formData.get('field') as string
    const value = formData.get('value') as string
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'
    const body: Record<string, unknown> = {}
    if (field === 'noi_cents') {
      const dollars = parseFloat(value.replace(/[^0-9.]/g, ''))
      body[field] = isNaN(dollars) ? null : Math.round(dollars * 100)
    } else if (field === 'sqft') {
      body[field] = parseInt(value.replace(/[^0-9]/g, ''), 10) || null
    } else {
      body[field] = value || null
    }
    await fetch(`${baseUrl}/properties/${propertyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    revalidatePath('/')
  }

  async function deleteProperty(formData: FormData) {
    'use server'
    const propertyId = formData.get('property_id') as string
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'
    await fetch(`${baseUrl}/properties/${propertyId}`, { method: 'DELETE' })
    revalidatePath('/')
  }

  const NAV_BRANDS = ['all', 'scout_security', 'partners_cc', 'clean_scapes', 'ecs_texas', 'revival_restoration']

  const pill: React.CSSProperties = {
    display: 'inline-block',
    padding: '0.2rem 0.6rem',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none',
  }

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 7rem)', overflow: 'hidden' }}>

      {/* LEFT COLUMN — account list (~40%) */}
      <div style={{ width: '38%', flexShrink: 0, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Brand pill filters */}
        <div style={{ padding: '0.75rem 0.9rem', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {NAV_BRANDS.map((brand) => {
            const active = currentBrand === brand
            const label = brand === 'all' ? 'All' : (BRAND_LABELS[brand] ?? brand)
            return (
              <a
                key={brand}
                href={buildHref({ surface: 'account', brand, account: currentAccount })}
                style={{
                  ...pill,
                  background: active ? '#185FA5' : '#fff',
                  color: active ? '#fff' : '#374151',
                  border: active ? 'none' : '1px solid #d1d5db',
                }}
              >
                {label}
              </a>
            )
          })}
        </div>

        {/* Search + sort + add row */}
        <div style={{ padding: '0.5rem 0.9rem', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <form method="get" style={{ display: 'contents' }}>
            <input type="hidden" name="surface" value="account" />
            <input type="hidden" name="brand" value={currentBrand} />
            <input
              name="accountSearch"
              defaultValue={currentSearch ?? ''}
              placeholder="Search..."
              style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 6, padding: '0.3rem 0.6rem', fontSize: '0.78rem', outline: 'none' }}
            />
            <select
              name="accountSort"
              defaultValue={currentSort}
              style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '0.3rem 0.4rem', fontSize: '0.74rem', outline: 'none' }}
            >
              <option value="score_desc">Score ↓</option>
              <option value="score_asc">Score ↑</option>
              <option value="signals_desc">Signals</option>
              <option value="market_asc">Market A–Z</option>
              <option value="name_asc">Name A–Z</option>
            </select>
            <button type="submit" style={{ display: 'none' }} />
          </form>
          <a
            href={buildHref({ surface: 'account', brand: currentBrand, account: '__add__' })}
            style={{ ...pill, background: '#185FA5', color: '#fff', padding: '0.3rem 0.65rem', whiteSpace: 'nowrap' }}
          >
            + Add
          </a>
        </div>

        {/* Property list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
          {properties.length === 0 ? (
            <div style={{ padding: '1.5rem', color: '#6b7280', fontSize: '0.84rem' }}>
              No properties yet. Add one or wait for signals to auto-populate.
            </div>
          ) : null}
          {properties.map((prop) => {
            const isSelected = selectedProperty?.id === prop.id
            const brandColor = prop.brands[0] ? (BRAND_COLORS[prop.brands[0]] ?? '#6b7280') : '#e5e7eb'
            return (
              <a
                key={prop.id}
                href={buildHref({ surface: 'account', brand: currentBrand, account: prop.id })}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{
                  padding: '0.65rem 0.9rem',
                  background: isSelected ? '#eff6ff' : 'transparent',
                  borderLeft: `3px solid ${isSelected ? '#185FA5' : brandColor}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {prop.name ?? 'Unnamed'}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.74rem' }}>
                      {[prop.market, BUILDING_TYPE_LABELS[prop.building_type]].filter(Boolean).join(' · ')}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                      {prop.source === 'auto' ? (
                        <span style={{ ...pill, background: '#dcfce7', color: '#166534', padding: '0.05rem 0.35rem', fontSize: '0.64rem' }}>AUTO</span>
                      ) : (
                        <span style={{ ...pill, background: '#eff6ff', color: '#1d4ed8', padding: '0.05rem 0.35rem', fontSize: '0.64rem' }}>MANUAL</span>
                      )}
                      {prop.signal_count > 0 ? (
                        <span style={{ ...pill, background: '#dcfce7', color: '#166534', padding: '0.05rem 0.35rem', fontSize: '0.64rem' }}>
                          {prop.signal_count} signal{prop.signal_count !== 1 ? 's' : ''}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {prop.score !== null ? (
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: scoreColor(prop.score), flexShrink: 0 }}>
                      {Math.round(prop.score)}
                    </div>
                  ) : null}
                </div>
              </a>
            )
          })}
        </div>
      </div>

      {/* RIGHT COLUMN — enrichment (top) + signals (bottom) */}
      {selectedProperty ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* ENRICHMENT PANEL (top ~55%) */}
          <div style={{ flex: '0 0 55%', overflowY: 'auto', padding: '1rem 1.2rem', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  {selectedProperty.name ?? 'Unnamed property'}
                  {' '}
                  <span style={{ ...pill, background: selectedProperty.source === 'auto' ? '#dcfce7' : '#eff6ff', color: selectedProperty.source === 'auto' ? '#166534' : '#1d4ed8', fontSize: '0.64rem' }}>
                    {selectedProperty.source.toUpperCase()}
                  </span>
                </h2>
                <div style={{ color: '#6b7280', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                  {[selectedProperty.market, BUILDING_TYPE_LABELS[selectedProperty.building_type]].filter(Boolean).join(' · ')}
                </div>
              </div>
              {selectedProperty.source === 'manual' ? (
                <form action={deleteProperty}>
                  <input type="hidden" name="property_id" value={selectedProperty.id} />
                  <button
                    type="submit"
                    style={{ background: 'none', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 6, padding: '0.25rem 0.6rem', fontSize: '0.74rem', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </form>
              ) : null}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.75rem' }}>
              {/* Market */}
              <form action={saveField} style={{ display: 'contents' }}>
                <input type="hidden" name="property_id" value={selectedProperty.id} />
                <input type="hidden" name="field" value="market" />
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem 0.7rem' }}>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Market</div>
                  <input
                    name="value"
                    defaultValue={selectedProperty.market ?? ''}
                    placeholder="e.g. Dallas Uptown"
                    style={{ border: 'none', background: 'transparent', fontSize: '0.84rem', fontWeight: 600, width: '100%', outline: 'none' }}
                  />
                  <button type="submit" style={{ display: 'none' }} />
                </div>
              </form>

              {/* Building type */}
              <form action={saveField} style={{ display: 'contents' }}>
                <input type="hidden" name="property_id" value={selectedProperty.id} />
                <input type="hidden" name="field" value="building_type" />
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem 0.7rem' }}>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Type</div>
                  <select
                    name="value"
                    defaultValue={selectedProperty.building_type}
                    style={{ border: 'none', background: 'transparent', fontSize: '0.84rem', fontWeight: 600, width: '100%', outline: 'none' }}
                  >
                    {Object.entries(BUILDING_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <button type="submit" style={{ display: 'none' }} />
                </div>
              </form>

              {/* Sqft */}
              <form action={saveField} style={{ display: 'contents' }}>
                <input type="hidden" name="property_id" value={selectedProperty.id} />
                <input type="hidden" name="field" value="sqft" />
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem 0.7rem' }}>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Sqft</div>
                  <input
                    name="value"
                    defaultValue={selectedProperty.sqft?.toLocaleString() ?? ''}
                    placeholder="e.g. 450000"
                    style={{ border: 'none', background: 'transparent', fontSize: '0.84rem', fontWeight: 600, width: '100%', outline: 'none' }}
                  />
                  <button type="submit" style={{ display: 'none' }} />
                </div>
              </form>

              {/* NOI */}
              <form action={saveField} style={{ display: 'contents' }}>
                <input type="hidden" name="property_id" value={selectedProperty.id} />
                <input type="hidden" name="field" value="noi_cents" />
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem 0.7rem' }}>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.2rem' }}>NOI / yr</div>
                  <input
                    name="value"
                    defaultValue={selectedProperty.noi_cents !== null ? String(selectedProperty.noi_cents / 100) : ''}
                    placeholder="e.g. 340000"
                    style={{ border: 'none', background: 'transparent', fontSize: '0.84rem', fontWeight: 600, color: '#166534', width: '100%', outline: 'none' }}
                  />
                  <button type="submit" style={{ display: 'none' }} />
                </div>
              </form>
            </div>

            {/* Notes */}
            <form action={saveField} style={{ marginBottom: '0.75rem' }}>
              <input type="hidden" name="property_id" value={selectedProperty.id} />
              <input type="hidden" name="field" value="notes" />
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem 0.7rem' }}>
                <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Notes</div>
                <textarea
                  name="value"
                  defaultValue={selectedProperty.notes ?? ''}
                  placeholder="Add operator notes..."
                  rows={2}
                  style={{ border: 'none', background: 'transparent', fontSize: '0.84rem', width: '100%', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              <button
                type="submit"
                style={{ marginTop: '0.35rem', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Save
              </button>
            </form>

            {/* Brand assignments */}
            {selectedProperty.brands.length > 0 ? (
              <div>
                <div style={{ fontSize: '0.74rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem' }}>Brands</div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {selectedProperty.brands.map((b) => (
                    <span
                      key={b}
                      style={{ ...pill, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}
                    >
                      {BRAND_LABELS[b] ?? b}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* SIGNALS PANEL (bottom ~45%) */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.85rem 1.2rem' }}>
            <div style={{ fontSize: '0.74rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
              Linked signals ({selectedProperty.linked_signals.length})
            </div>
            {selectedProperty.linked_signals.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: '0.84rem', fontStyle: 'italic' }}>
                No signals linked yet — they&apos;ll appear here as APEX ingests matching events.
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selectedProperty.linked_signals.map((signal) => {
                const brandColor = signal.primary_brand ? (BRAND_COLORS[signal.primary_brand] ?? '#6b7280') : '#6b7280'
                return (
                  <div
                    key={signal.id}
                    style={{ background: '#fff', border: '1px solid #e5e7eb', borderLeft: `3px solid ${brandColor}`, borderRadius: 6, padding: '0.65rem 0.8rem' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem', flex: 1, paddingRight: '0.5rem' }}>{signal.title}</div>
                      <span style={{ ...pill, background: scoreColor(signal.confidence_score) === '#991b1b' ? '#fef2f2' : scoreColor(signal.confidence_score) === '#92400e' ? '#fff7ed' : '#f9fafb', color: scoreColor(signal.confidence_score), fontSize: '0.72rem', flexShrink: 0 }}>
                        {Math.round(signal.confidence_score)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: '#6b7280', fontSize: '0.74rem' }}>
                        {[signal.primary_brand ? (BRAND_LABELS[signal.primary_brand] ?? signal.primary_brand) : null, signal.market].filter(Boolean).join(' · ')}
                      </div>
                      <a
                        href={`?surface=newsroom&selected=${signal.id}`}
                        style={{ ...pill, background: '#185FA5', color: '#fff', fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                      >
                        Open draft →
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
          Select a property to view details
        </div>
      )}
    </div>
  )
}
