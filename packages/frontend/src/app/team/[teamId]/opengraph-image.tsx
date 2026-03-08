import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Team Injury Report';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface InjuryImpact {
  team: { name: string; logo: string | null };
  season: number;
  injuredPlayers: { name: string; severity: string }[];
  powerLossPct: number;
  severitySummary?: { critical: number; high: number; moderate: number; low: number };
}

function SeverityDot({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: color,
        display: 'flex',
      }}
    />
  );
}

export default async function Image({ params }: { params: { teamId: string } }) {
  let impact: InjuryImpact | null = null;
  try {
    const res = await fetch(`${API_BASE}/api/analysis/injury-impact/${params.teamId}`, {
      next: { revalidate: 300 },
    });
    if (res.ok) impact = await res.json();
  } catch {}

  const teamName = impact?.team.name ?? 'Team';
  const injuredCount = impact?.injuredPlayers.length ?? 0;
  const powerLoss = impact?.powerLossPct.toFixed(1) ?? '0.0';
  const ss = impact?.severitySummary;
  const critical = ss?.critical ?? 0;
  const high = ss?.high ?? 0;

  // Top 3 injured players (critical/high first)
  const topInjured = impact?.injuredPlayers
    .sort((a, b) => {
      const order = { critical: 0, high: 1, moderate: 2, low: 3 };
      return (order[a.severity as keyof typeof order] ?? 9) - (order[b.severity as keyof typeof order] ?? 9);
    })
    .slice(0, 3) ?? [];

  const powerLossNum = parseFloat(powerLoss);
  const powerColor = powerLossNum >= 20 ? '#fa4d56' : powerLossNum >= 10 ? '#f1c21b' : '#42be65';

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          background: '#161616',
          padding: '60px 80px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 48 }}>
          <div
            style={{
              background: '#0f62fe',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.08em',
              padding: '5px 14px',
              borderRadius: 2,
            }}
          >
            SQUADCHECK
          </div>
          <div style={{ color: '#8d8d8d', fontSize: 16 }}>Injury Report · {impact?.season ?? 2025}/{(impact?.season ?? 2025) + 1}</div>
        </div>

        {/* Team name */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 300,
            color: '#f4f4f4',
            marginBottom: 40,
            letterSpacing: '-0.02em',
          }}
        >
          {teamName}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 48, marginBottom: 40 }}>
          {/* Players out */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 52, fontWeight: 300, color: '#f4f4f4', lineHeight: 1 }}>
              {injuredCount}
            </div>
            <div style={{ fontSize: 16, color: '#8d8d8d', marginTop: 8 }}>Players Out</div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: '#393939', display: 'flex' }} />

          {/* Power Loss */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 52, fontWeight: 300, color: powerColor, lineHeight: 1 }}>
              {powerLoss}%
            </div>
            <div style={{ fontSize: 16, color: '#8d8d8d', marginTop: 8 }}>Power Loss</div>
          </div>

          {/* Divider */}
          {(critical + high > 0) && (
            <>
              <div style={{ width: 1, background: '#393939', display: 'flex' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 52, fontWeight: 300, color: '#fa4d56', lineHeight: 1 }}>
                  {critical + high}
                </div>
                <div style={{ fontSize: 16, color: '#8d8d8d', marginTop: 8 }}>Critical / High</div>
              </div>
            </>
          )}
        </div>

        {/* Injured players list */}
        {topInjured.length > 0 && (
          <div style={{ display: 'flex', gap: 12 }}>
            {topInjured.map((p) => {
              const col = p.severity === 'critical' ? '#fa4d56'
                : p.severity === 'high' ? '#f1c21b'
                : '#8d8d8d';
              return (
                <div
                  key={p.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#262626',
                    border: '1px solid #393939',
                    padding: '8px 16px',
                    borderRadius: 2,
                  }}
                >
                  <SeverityDot color={col} />
                  <span style={{ color: '#c6c6c6', fontSize: 16 }}>{p.name}</span>
                </div>
              );
            })}
            {injuredCount > 3 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#262626',
                  border: '1px solid #393939',
                  padding: '8px 16px',
                  borderRadius: 2,
                  color: '#8d8d8d',
                  fontSize: 16,
                }}
              >
                +{injuredCount - 3} more
              </div>
            )}
          </div>
        )}

        {injuredCount === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#42be65', display: 'flex' }} />
            <span style={{ color: '#42be65', fontSize: 20 }}>Full squad available</span>
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}
