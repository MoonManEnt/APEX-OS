'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  eventId: string
  eventTitle: string
  eventSummary: string | null
  eventType: string | null
  market: string | null
  primaryBrand: string | null
  confidenceScore?: number
  badges?: string[]
  draftType: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

export function RegenButton({
  eventId,
  eventTitle,
  eventSummary,
  eventType,
  market,
  primaryBrand,
  confidenceScore,
  badges,
  draftType,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRegen() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/actions/draft?force=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          event_title: eventTitle,
          event_summary: eventSummary,
          event_type: eventType,
          market,
          primary_brand: primaryBrand,
          confidence_score: confidenceScore,
          badges: badges ?? [],
          draft_type: draftType,
        }),
      })
      if (!res.ok) throw new Error(`Regen failed (${res.status})`)
      router.refresh()
    } catch {
      setError('Regenerate failed — existing draft preserved.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <button
        onClick={handleRegen}
        disabled={loading}
        style={{
          background: '#f3f4f6',
          color: '#374151',
          border: '1px solid #d1d5db',
          borderRadius: 10,
          padding: '0.6rem 0.9rem',
          fontWeight: 700,
          fontSize: '0.82rem',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Regenerating...' : '↺ Regenerate draft'}
      </button>
      {error && (
        <div style={{ fontSize: '0.74rem', color: '#991b1b' }}>{error}</div>
      )}
    </div>
  )
}
