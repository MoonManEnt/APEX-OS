'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  padding: '0.5rem 0.7rem',
  fontSize: '0.84rem',
  outline: 'none',
  boxSizing: 'border-box',
}

export function AccountAddForm({ cancelHref, surface, brand }: { cancelHref: string; surface: string; brand: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [market, setMarket] = useState('')
  const [buildingType, setBuildingType] = useState('other')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'
    try {
      const resp = await fetch(`${baseUrl}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          market: market.trim() || null,
          building_type: buildingType,
          brands: brand !== 'all' ? [brand] : [],
        }),
      })
      setLoading(false)
      if (!resp.ok) {
        if (resp.status === 409) {
          const body = await resp.json()
          const existingId = body?.detail?.existing_id
          if (!existingId) {
            setError('Duplicate found but ID missing. Refresh and try again.')
            return
          }
          const params = new URLSearchParams({ surface, brand, account: existingId })
          router.push(`?${params.toString()}`)
          return
        }
        setError('Failed to create property. Try again.')
        return
      }
      const created = await resp.json()
      const params = new URLSearchParams({ surface, brand, account: created.id })
      router.push(`?${params.toString()}`)
      router.refresh()
    } catch {
      setLoading(false)
      setError('Network error. Check your connection and try again.')
    }
  }

  return (
    <div style={{ padding: '1rem 1.2rem' }}>
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700 }}>Add account</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div>
          <label htmlFor="prop-name" style={{ fontSize: '0.74rem', color: '#6b7280', display: 'block', marginBottom: '0.2rem' }}>Property name *</label>
          <input
            id="prop-name"
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 2100 McKinney Ave"
            required
          />
        </div>
        <div>
          <label htmlFor="prop-market" style={{ fontSize: '0.74rem', color: '#6b7280', display: 'block', marginBottom: '0.2rem' }}>Market</label>
          <input
            id="prop-market"
            style={inputStyle}
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            placeholder="e.g. Dallas Uptown"
          />
        </div>
        <div>
          <label htmlFor="prop-building-type" style={{ fontSize: '0.74rem', color: '#6b7280', display: 'block', marginBottom: '0.2rem' }}>Property type</label>
          <select
            id="prop-building-type"
            style={inputStyle}
            value={buildingType}
            onChange={(e) => setBuildingType(e.target.value)}
          >
            {Object.entries(BUILDING_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        {error ? <div style={{ color: '#991b1b', fontSize: '0.8rem' }}>{error}</div> : null}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 6, padding: '0.45rem 1rem', fontWeight: 700, fontSize: '0.84rem', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Adding...' : 'Add account'}
          </button>
          <a
            href={cancelHref}
            style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, padding: '0.45rem 1rem', fontWeight: 700, fontSize: '0.84rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  )
}
