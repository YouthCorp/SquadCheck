import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Matchup Analysis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const CURRENT_SEASON = 2025;

interface InjuryImpact {
  team: { name: string };
  powerLossPct: number;
  injuredPlayers: { player: { name: string }; severity: string }[];
}

async function safeJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    return res.ok ? (res.json() as Promise<T>) : null;
  } catch {
    return null;
  }
}

function powerColor(pct: number): string {
  return pct >= 20 ? "#fa4d56" : pct >= 10 ? "#f1c21b" : "#42be65";
}

export default async function Image({
  searchParams,
}: {
  searchParams: { home?: string; away?: string; season?: string };
}) {
  const { home, away, season: seasonStr } = searchParams;
  const season = seasonStr ? parseInt(seasonStr) : CURRENT_SEASON;

  const [homeImpact, awayImpact] = await Promise.all([
    home
      ? safeJson<InjuryImpact>(`${API_BASE}/api/analysis/injury-impact/${home}?season=${season}`)
      : null,
    away
      ? safeJson<InjuryImpact>(`${API_BASE}/api/analysis/injury-impact/${away}?season=${season}`)
      : null,
  ]);

  const homeName = homeImpact?.team.name ?? (home ? `Team ${home}` : "Home");
  const awayName = awayImpact?.team.name ?? (away ? `Team ${away}` : "Away");
  const homePL = homeImpact?.powerLossPct ?? 0;
  const awayPL = awayImpact?.powerLossPct ?? 0;
  const homeOut = homeImpact?.injuredPlayers.length ?? null;
  const awayOut = awayImpact?.injuredPlayers.length ?? null;

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        background: "#161616",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "24px 72px",
          borderBottom: "1px solid #393939",
        }}
      >
        <div
          style={{
            background: "#0f62fe",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.08em",
            padding: "5px 14px",
            borderRadius: 2,
            display: "flex",
          }}
        >
          SQUADCHECK
        </div>
        <div style={{ color: "#8d8d8d", fontSize: 16, display: "flex" }}>
          Matchup Analysis
        </div>
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          padding: "0 72px",
        }}
      >
        {/* Home team */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 0,
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 300,
              color: "#f4f4f4",
              lineHeight: 1.1,
              marginBottom: 20,
              display: "flex",
            }}
          >
            {homeName}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 40,
                fontWeight: 300,
                color: powerColor(homePL),
                display: "flex",
              }}
            >
              {homePL.toFixed(1)}%
            </span>
            <span style={{ color: "#8d8d8d", fontSize: 15, display: "flex" }}>
              power loss
            </span>
          </div>
          {homeOut !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#fa4d56",
                  display: "flex",
                }}
              />
              <span style={{ color: "#c6c6c6", fontSize: 18, display: "flex" }}>
                {homeOut} out
              </span>
            </div>
          )}
          {homeImpact?.injuredPlayers.slice(0, 2).map((p, i) => (
            <div
              key={i}
              style={{
                fontSize: 14,
                color: "#8d8d8d",
                marginTop: 6,
                display: "flex",
              }}
            >
              {p.player.name}
            </div>
          ))}
        </div>

        {/* VS */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0 40px",
          }}
        >
          <div
            style={{
              fontSize: 28,
              color: "#393939",
              fontWeight: 300,
              letterSpacing: "0.1em",
              display: "flex",
            }}
          >
            VS
          </div>
        </div>

        {/* Away team */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 0,
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 300,
              color: "#f4f4f4",
              lineHeight: 1.1,
              marginBottom: 20,
              textAlign: "right",
              display: "flex",
            }}
          >
            {awayName}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 40,
                fontWeight: 300,
                color: powerColor(awayPL),
                display: "flex",
              }}
            >
              {awayPL.toFixed(1)}%
            </span>
            <span style={{ color: "#8d8d8d", fontSize: 15, display: "flex" }}>
              power loss
            </span>
          </div>
          {awayOut !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#fa4d56",
                  display: "flex",
                }}
              />
              <span style={{ color: "#c6c6c6", fontSize: 18, display: "flex" }}>
                {awayOut} out
              </span>
            </div>
          )}
          {awayImpact?.injuredPlayers.slice(0, 2).map((p, i) => (
            <div
              key={i}
              style={{
                fontSize: 14,
                color: "#8d8d8d",
                marginTop: 6,
                display: "flex",
              }}
            >
              {p.player.name}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "18px 72px",
          borderTop: "1px solid #262626",
          color: "#525252",
          fontSize: 14,
          letterSpacing: "0.04em",
        }}
      >
        Matchup Analysis · squadcheck.xyz
      </div>
    </div>,
    { ...size },
  );
}
