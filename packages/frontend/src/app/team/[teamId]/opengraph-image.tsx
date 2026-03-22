import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Team Injury Report';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface InjuryImpact {
  team: { name: string; logo: string | null };
  season: number;
  injuredPlayers: { player: { name: string }; severity: string }[];
  powerLossPct: number;
  severitySummary?: { critical: number; high: number; moderate: number; low: number };
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

  const topInjured = impact?.injuredPlayers
    .slice()
    .sort((a, b) => {
      const order: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
      return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
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
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '28px 80px',
            borderBottom: '1px solid #393939',
          }}
        >
          <div
            style={{
              background: '#0f62fe',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.08em',
              padding: '5px 14px',
              borderRadius: 2,
              display: 'flex',
            }}
          >
            SQUADCHECK
          </div>
          <div style={{ color: '#8d8d8d', fontSize: 16, display: 'flex' }}>
            Injury Report · {impact?.season ?? 2025}/{(impact?.season ?? 2025) + 1}
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '40px 80px',
          }}
        >
          {/* Team name */}
          <div
            style={{
              fontSize: 60,
              fontWeight: 300,
              color: '#f4f4f4',
              marginBottom: 32,
              letterSpacing: '-0.02em',
              display: 'flex',
            }}
          >
            {teamName}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 48, marginBottom: 36 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 48, fontWeight: 300, color: '#f4f4f4', display: 'flex' }}>
                {injuredCount}
              </div>
              <div style={{ fontSize: 15, color: '#8d8d8d', marginTop: 6, display: 'flex' }}>
                Players Out
              </div>
            </div>

            <div style={{ width: 1, background: '#393939', display: 'flex' }} />

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 48, fontWeight: 300, color: powerColor, display: 'flex' }}>
                {powerLoss}%
              </div>
              <div style={{ fontSize: 15, color: '#8d8d8d', marginTop: 6, display: 'flex' }}>
                Power Loss
              </div>
            </div>

            {critical + high > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
                <div style={{ width: 1, background: '#393939', display: 'flex' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 48, fontWeight: 300, color: '#fa4d56', display: 'flex' }}>
                    {critical + high}
                  </div>
                  <div style={{ fontSize: 15, color: '#8d8d8d', marginTop: 6, display: 'flex' }}>
                    Critical / High
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Injured player pills */}
          {topInjured.length > 0 && (
            <div style={{ display: 'flex', gap: 10 }}>
              {topInjured.map((p, i) => {
                const col =
                  p.severity === 'critical'
                    ? '#fa4d56'
                    : p.severity === 'high'
                      ? '#f1c21b'
                      : '#8d8d8d';
                return (
                  <div
                    key={i}
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
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: col,
                        display: 'flex',
                      }}
                    />
                    <div style={{ color: '#c6c6c6', fontSize: 15, display: 'flex' }}>
                      {p.player.name}
                    </div>
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
                    fontSize: 15,
                  }}
                >
                  +{injuredCount - 3} more
                </div>
              )}
            </div>
          )}

          {injuredCount === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#42be65',
                  display: 'flex',
                }}
              />
              <div style={{ color: '#42be65', fontSize: 18, display: 'flex' }}>
                Full squad available
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '18px 80px',
            borderTop: '1px solid #262626',
            color: '#525252',
            fontSize: 14,
            letterSpacing: '0.04em',
          }}
        >
          Injury intelligence · squadcheck.xyz
        </div>
      </div>
    ),
    { ...size },
  );
}
