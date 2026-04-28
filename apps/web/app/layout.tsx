import type { Metadata, Viewport } from 'next';

import { ServiceWorkerRegister } from './service-worker-register';

export const metadata: Metadata = {
  title: 'APEX OS',
  description: 'CRE Intelligence OS newsroom shell',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'APEX OS',
  },
};

export const viewport: Viewport = {
  themeColor: '#185FA5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#fafafa', color: '#111827' }}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
