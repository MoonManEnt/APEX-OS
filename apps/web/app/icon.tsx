import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
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
          fontSize: 200,
          fontWeight: 800,
          letterSpacing: -12,
        }}
      >
        A
      </div>
    ),
    size,
  );
}
