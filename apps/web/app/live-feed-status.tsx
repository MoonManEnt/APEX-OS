'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type FeedMessage = {
  type?: string;
  count?: number;
  eventId?: string;
  primaryBrand?: string | null;
  primaryBrands?: string[];
};

type Props = {
  latestEventTs: string | null;
  currentBrand?: string;
};

export function LiveFeedStatus({ latestEventTs, currentBrand }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<'connecting' | 'live' | 'reconnecting' | 'offline'>('connecting');
  const [lastMessage, setLastMessage] = useState<FeedMessage | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const lastSeenTs = useRef<string | null>(latestEventTs);

  // Sync prop → ref after each router.refresh()
  useEffect(() => {
    if (latestEventTs) lastSeenTs.current = latestEventTs;
  }, [latestEventTs]);

  const wsUrl = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
    return apiBase.replace(/^http/, 'ws') + '/ws';
  }, []);

  const matchesBrand = (brand: string | null | undefined): boolean => {
    if (!currentBrand || currentBrand === 'all') return true;
    return brand === currentBrand;
  };

  const matchesBrands = (brands: string[] | undefined): boolean => {
    if (!currentBrand || currentBrand === 'all') return true;
    return (brands ?? []).includes(currentBrand);
  };

  // Auto-refresh when pendingCount is 1 or 2
  useEffect(() => {
    if (pendingCount === 0 || pendingCount > 2) return;
    const timer = setTimeout(() => {
      router.refresh();
      setPendingCount(0);
    }, 800);
    return () => clearTimeout(timer);
  }, [pendingCount, router]);

  // Polling fallback when offline
  useEffect(() => {
    if (status !== 'offline') return;
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
    const poll = async () => {
      try {
        const url = lastSeenTs.current
          ? `${apiBase}/events?since=${encodeURIComponent(lastSeenTs.current)}`
          : `${apiBase}/events`;
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) return;
        const data = await resp.json() as { events?: unknown[] };
        const events = Array.isArray(data.events) ? data.events : [];
        if (events.length > 0) setPendingCount((c) => c + events.length);
      } catch { /* swallow */ }
    };
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

    const catchUp = async () => {
      if (!lastSeenTs.current) return;
      try {
        const resp = await fetch(
          `${apiBase}/events?since=${encodeURIComponent(lastSeenTs.current)}`,
          { cache: 'no-store' }
        );
        if (!resp.ok) return;
        const data = await resp.json() as { events?: unknown[] };
        const missed = Array.isArray(data.events) ? data.events.length : 0;
        if (missed > 0) setPendingCount((c) => c + missed);
      } catch { /* swallow */ }
    };

    const connect = () => {
      setStatus((current) => (current === 'live' ? 'reconnecting' : 'connecting'));
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        if (!active) return;
        setStatus('live');
        catchUp();
      };

      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const message = JSON.parse(event.data) as FeedMessage;
          setLastMessage(message);
          if (message.type === 'feed.seeded') {
            if (matchesBrand(message.primaryBrand)) {
              setPendingCount((c) => c + 1);
            }
          } else if (message.type === 'feed.ingested') {
            if (matchesBrands(message.primaryBrands)) {
              setPendingCount((c) => c + (message.count ?? 1));
            }
          }
        } catch { /* ignore malformed payloads */ }
      };

      socket.onclose = () => {
        if (!active) return;
        setStatus('offline');
        reconnectTimer = setTimeout(connect, 2500);
      };

      socket.onerror = () => {
        if (!active) return;
        setStatus('offline');
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [wsUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const tone = status === 'live' ? '#166534' : status === 'connecting' || status === 'reconnecting' ? '#92400e' : '#991b1b';
  const bg = status === 'live' ? '#dcfce7' : status === 'connecting' || status === 'reconnecting' ? '#fef3c7' : '#fee2e2';
  const label = status === 'live' ? 'Live feed connected' : status === 'reconnecting' ? 'Reconnecting feed' : status === 'connecting' ? 'Connecting feed' : 'Feed offline — polling';

  return (
    <div style={{ marginTop: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 12, padding: '0.85rem', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: bg, color: tone, borderRadius: 999, padding: '0.35rem 0.7rem', fontSize: '0.8rem', fontWeight: 700 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone, display: 'inline-block' }} />
          {label}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {pendingCount > 2 && (
            <button
              type="button"
              onClick={() => { router.refresh(); setPendingCount(0); }}
              style={{ border: '1px solid #185FA5', background: '#eff6ff', color: '#185FA5', borderRadius: 10, padding: '0.45rem 0.7rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
            >
              {pendingCount} new {pendingCount === 1 ? 'item' : 'items'} — load
            </button>
          )}
          <button
            type="button"
            onClick={() => { router.refresh(); setPendingCount(0); }}
            style={{ border: '1px solid #d1d5db', background: '#fff', color: '#111827', borderRadius: 10, padding: '0.45rem 0.7rem', cursor: 'pointer', fontWeight: 600 }}
          >
            Refresh newsroom
          </button>
        </div>
      </div>
      <div style={{ marginTop: '0.6rem', color: '#6b7280', fontSize: '0.82rem' }}>
        {lastMessage?.type ? `Last feed event: ${lastMessage.type}${lastMessage.count ? ` · ${lastMessage.count} ingested` : ''}${lastMessage.eventId ? ` · ${lastMessage.eventId}` : ''}` : 'Waiting for feed activity.'}
      </div>
    </div>
  );
}
