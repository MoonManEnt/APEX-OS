'use client';

import { useEffect, useState } from 'react';

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function PwaInstallCta() {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPrompt | null>(null);
  const [mode, setMode] = useState<'hidden' | 'installable' | 'ios'>('hidden');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone) {
      setMode('hidden');
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    if (isIos) setMode('ios');

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredPrompt);
      setMode('installable');
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (mode === 'hidden') return null;

  return (
    <div style={{ border: '1px solid #dbeafe', background: '#eff6ff', color: '#0f172a', borderRadius: 12, padding: '0.8rem 0.9rem', display: 'grid', gap: '0.45rem' }}>
      <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>Install APEX</div>
      {mode === 'installable' ? (
        <>
          <div style={{ fontSize: '0.78rem', color: '#475569' }}>Add APEX to your home screen or desktop for an app-style launch experience.</div>
          <button
            type="button"
            onClick={async () => {
              if (!deferredPrompt) return;
              await deferredPrompt.prompt();
              await deferredPrompt.userChoice;
              setDeferredPrompt(null);
              setMode('hidden');
            }}
            style={{ background: '#185FA5', color: '#fff', border: 0, borderRadius: 10, padding: '0.6rem 0.8rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Install app
          </button>
        </>
      ) : (
        <div style={{ fontSize: '0.78rem', color: '#475569' }}>On iPhone/iPad, tap Share → <strong>Add to Home Screen</strong> to install APEX like an app.</div>
      )}
    </div>
  );
}
