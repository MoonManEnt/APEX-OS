import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
          fontSize: 86,
          fontWeight: 800,
          letterSpacing: -4,
          borderRadius: 36,
        }}
      >
        A
      </div>
    ),
    size,
  );
}
