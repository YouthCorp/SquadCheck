import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'SquadCheck — Football injury analysis & predicted lineups';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#161616',
          padding: '80px 100px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Top label */}
        <div style={{ display: 'flex', marginBottom: 32 }}>
          <div
            style={{
              background: '#0f62fe',
              color: '#ffffff',
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '0.08em',
              padding: '6px 16px',
              borderRadius: 2,
            }}
          >
            SQUADCHECK
          </div>
        </div>

        {/* Main heading */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 72,
            fontWeight: 300,
            color: '#f4f4f4',
            lineHeight: 1.1,
            marginBottom: 32,
            letterSpacing: '-0.02em',
          }}
        >
          <span>Football injury</span>
          <span>intelligence.</span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 24,
            color: '#8d8d8d',
            marginBottom: 56,
            lineHeight: 1.5,
          }}
        >
          <span>Injury impact analysis · Predicted lineups · Recovery signals</span>
          <span>5 leagues · 9 cup competitions</span>
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 16 }}>
          {['Power Loss %', 'Predicted XI', 'Recovery Signals', 'Matchup Compare'].map((f) => (
            <div
              key={f}
              style={{
                background: '#262626',
                border: '1px solid #393939',
                color: '#c6c6c6',
                fontSize: 15,
                padding: '8px 18px',
                borderRadius: 2,
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
