'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type FeedMessage = {
  type?: string;
  count?: number;
  eventId?: string;
};

export function LiveFeedStatus() {
  const router = useRouter();
  const [status, setStatus] = useState<'connecting' | 'live' | 'reconnecting' | 'offline'>('connecting');
  const [lastMessage, setLastMessage] = useState<FeedMessage | null>(null);

  const wsUrl = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
    return apiBase.replace(/^http/, 'ws') + '/ws';
  }, []);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      setStatus((current) => (current === 'live' ? 'reconnecting' : 'connecting'));
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        if (!active) return;
        setStatus('live');
      };

      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const message = JSON.parse(event.data) as FeedMessage;
          setLastMessage(message);
          if (message.type === 'feed.ingested' || message.type === 'feed.seeded') {
            router.refresh();
          }
        } catch {
          // Ignore malformed payloads in beta.
        }
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
  }, [router, wsUrl]);

  const tone = status === 'live' ? '#166534' : status === 'connecting' || status === 'reconnecting' ? '#92400e' : '#991b1b';
  const bg = status === 'live' ? '#dcfce7' : status === 'connecting' || status === 'reconnecting' ? '#fef3c7' : '#fee2e2';
  const label = status === 'live' ? 'Live feed connected' : status === 'reconnecting' ? 'Reconnecting feed' : status === 'connecting' ? 'Connecting feed' : 'Feed offline';

  return (
    <div style={{ marginTop: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 12, padding: '0.85rem', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: bg, color: tone, borderRadius: 999, padding: '0.35rem 0.7rem', fontSize: '0.8rem', fontWeight: 700 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone, display: 'inline-block' }} />
          {label}
        </span>
        <button
          type="button"
          onClick={() => router.refresh()}
          style={{ border: '1px solid #d1d5db', background: '#fff', color: '#111827', borderRadius: 10, padding: '0.45rem 0.7rem', cursor: 'pointer', fontWeight: 600 }}
        >
          Refresh newsroom
        </button>
      </div>
      <div style={{ marginTop: '0.6rem', color: '#6b7280', fontSize: '0.82rem' }}>
        {lastMessage?.type ? `Last feed event: ${lastMessage.type}${lastMessage.count ? ` · ${lastMessage.count} ingested` : ''}${lastMessage.eventId ? ` · ${lastMessage.eventId}` : ''}` : 'Waiting for feed activity.'}
      </div>
    </div>
  );
}
