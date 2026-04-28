import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0b1726 0%, #185FA5 55%, #7f77dd 100%)',
          color: 'white',
          fontSize: 84,
          fontWeight: 800,
          letterSpacing: -6,
        }}
      >
        A
      </div>
    ),
    { width: 192, height: 192 },
  );
}
