'use client';

import { useEffect, useMemo, useState } from 'react';
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
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const msg = JSON.parse(event.data) as ProposalMessage;
          if (msg.type === 'proposal.created' && msg.proposal_id) {
            const id = msg.proposal_id;
            setPendingIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
            setLatestSummary(msg.summary ?? null);
          } else if (msg.type === 'proposal.resolved' && msg.proposal_id) {
            const id = msg.proposal_id;
            setPendingIds((ids) => ids.filter((existing) => existing !== id));
            router.refresh();
          }
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') console.warn('[PendingProposals]', e);
        }
      };
      socket.onclose = () => {
        if (!active) return;
        reconnectTimer = setTimeout(connect, 2500);
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
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
