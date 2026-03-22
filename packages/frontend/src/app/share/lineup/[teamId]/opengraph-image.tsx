import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Predicted XI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const CURRENT_SEASON = 2025;

interface PredictedLineup {
  teamId: number;
  teamName: string;
  formation: string;
  starters: { playerName: string; positionGroup: string }[];
}

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
  params,
  searchParams,
}: {
  params: { teamId: string };
  searchParams: { season?: string };
}) {
  const season = searchParams.season ? parseInt(searchParams.season) : CURRENT_SEASON;

  const [lineup, impact] = await Promise.all([
    safeJson<PredictedLineup>(
      `${API_BASE}/api/analysis/predicted-lineup/${params.teamId}?season=${season}`,
    ),
    safeJson<InjuryImpact>(
      `${API_BASE}/api/analysis/injury-impact/${params.teamId}?season=${season}`,
    ),
  ]);

  const teamName = lineup?.teamName ?? impact?.team.name ?? `Team ${params.teamId}`;
  const formation = lineup?.formation ?? "—";
  const powerLoss = impact?.powerLossPct ?? 0;
  const injuredPlayers = impact?.injuredPlayers ?? [];

  // Group starters by position
  const groups: Record<string, string[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  if (lineup?.starters) {
    for (const p of lineup.starters) {
      const g = p.positionGroup as "GK" | "DEF" | "MID" | "FWD";
      if (groups[g]) groups[g].push(p.playerName);
    }
  }

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
        <div style={{ color: "#8d8d8d", fontSize: 16, display: "flex" }}>Predicted XI</div>
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          padding: "32px 72px",
          gap: 48,
        }}
      >
        {/* Left: team name + formation + player list */}
        <div
          style={{
            flex: "1 1 60%",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          <div
            style={{
              fontSize: 52,
              fontWeight: 300,
              color: "#f4f4f4",
              lineHeight: 1.1,
              marginBottom: 8,
              display: "flex",
            }}
          >
            {teamName}
          </div>
          <div
            style={{
              fontSize: 18,
              color: "#8d8d8d",
              marginBottom: 28,
              display: "flex",
            }}
          >
            Formation: {formation}
          </div>

          {/* Position rows */}
          {(["GK", "DEF", "MID", "FWD"] as const).map((grp) => {
            const names = groups[grp];
            if (!names || names.length === 0) return null;
            return (
              <div
                key={grp}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#525252",
                    letterSpacing: "0.08em",
                    minWidth: 32,
                    display: "flex",
                  }}
                >
                  {grp}
                </span>
                <span style={{ fontSize: 16, color: "#c6c6c6", display: "flex" }}>
                  {names.join(" · ")}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right: power loss + injuries */}
        <div
          style={{
            flex: "0 0 280px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 0,
          }}
        >
          {/* Power loss */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              marginBottom: 28,
            }}
          >
            <div
              style={{
                fontSize: 56,
                fontWeight: 300,
                color: powerColor(powerLoss),
                lineHeight: 1,
                display: "flex",
              }}
            >
              {powerLoss.toFixed(1)}%
            </div>
            <div style={{ fontSize: 14, color: "#8d8d8d", marginTop: 4, display: "flex" }}>
              power loss
            </div>
          </div>

          {/* Injured players */}
          {injuredPlayers.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                alignItems: "flex-end",
              }}
            >
              <div style={{ fontSize: 13, color: "#525252", display: "flex" }}>
                {injuredPlayers.length} player{injuredPlayers.length !== 1 ? "s" : ""} out
              </div>
              {injuredPlayers.slice(0, 4).map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background:
                        p.severity === "critical" || p.severity === "high"
                          ? "#fa4d56"
                          : "#f1c21b",
                      display: "flex",
                    }}
                  />
                  <span style={{ fontSize: 15, color: "#c6c6c6", display: "flex" }}>
                    {p.player.name}
                  </span>
                </div>
              ))}
            </div>
          )}
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
        Predicted lineups · Recovery signals · squadcheck.xyz
      </div>
    </div>,
    { ...size },
  );
}
