import { ImageResponse } from "next/og";
import { CURRENT_SEASON } from "@/lib/constants";

export const runtime = "edge";
export const alt = "Predicted XI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Pitch panel dimensions (right side: 1200-320=880 wide, 630-64-50=516 tall)
const PW = 880;
const PH = 516;

interface PredictedLineup {
  teamId: number;
  teamName: string;
  teamLogo: string | null;
  formation: string;
  starters: {
    playerName: string;
    positionGroup: string;
    pitchX: number;
    pitchY: number;
  }[];
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

const POS_COLORS: Record<string, string> = {
  GK: "#f1c21b",
  DEF: "#4589ff",
  MID: "#42be65",
  FWD: "#fa4d56",
};

export default async function Image({
  params,
}: {
  params: { teamId: string };
}) {
  const [lineup, impact] = await Promise.all([
    safeJson<PredictedLineup>(
      `${API_BASE}/api/analysis/predicted-lineup/${params.teamId}?season=${CURRENT_SEASON}`,
    ),
    safeJson<InjuryImpact>(
      `${API_BASE}/api/analysis/injury-impact/${params.teamId}?season=${CURRENT_SEASON}`,
    ),
  ]);

  const teamName = lineup?.teamName ?? impact?.team.name ?? `Team ${params.teamId}`;
  const formation = lineup?.formation ?? "—";
  const powerLoss = impact?.powerLossPct ?? 0;
  const injuredPlayers = impact?.injuredPlayers ?? [];

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
      {/* Top bar — 64px */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0 56px",
          height: 64,
          borderBottom: "1px solid #393939",
          flexShrink: 0,
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
          Predicted XI
        </div>
      </div>

      {/* Content row */}
      <div style={{ flex: 1, display: "flex" }}>
        {/* Left info panel — 320px */}
        <div
          style={{
            width: 320,
            display: "flex",
            flexDirection: "column",
            padding: "28px 32px",
            borderRight: "1px solid #262626",
            flexShrink: 0,
          }}
        >
          {/* Team logo + name */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 6,
            }}
          >
            {lineup?.teamLogo && (
              <img
                src={lineup.teamLogo}
                width={44}
                height={44}
                style={{ objectFit: "contain" }}
              />
            )}
            <div
              style={{
                fontSize: 26,
                fontWeight: 300,
                color: "#f4f4f4",
                lineHeight: 1.2,
                display: "flex",
              }}
            >
              {teamName}
            </div>
          </div>

          {/* Formation */}
          <div
            style={{
              fontSize: 13,
              color: "#8d8d8d",
              display: "flex",
              marginBottom: 28,
            }}
          >
            Formation: {formation}
          </div>

          {/* Power loss */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontSize: 52,
                fontWeight: 300,
                color: powerColor(powerLoss),
                lineHeight: 1,
                display: "flex",
              }}
            >
              {powerLoss.toFixed(1)}%
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#8d8d8d",
                marginTop: 4,
                display: "flex",
              }}
            >
              power loss
            </div>
          </div>

          {/* Injuries */}
          {injuredPlayers.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div
                style={{ fontSize: 11, color: "#525252", display: "flex", marginBottom: 2 }}
              >
                {injuredPlayers.length} player
                {injuredPlayers.length !== 1 ? "s" : ""} out
              </div>
              {injuredPlayers.slice(0, 5).map((p, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
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
                      flexShrink: 0,
                    }}
                  />
                  <div
                    style={{ fontSize: 13, color: "#c6c6c6", display: "flex" }}
                  >
                    {p.player.name}
                  </div>
                </div>
              ))}
            </div>
          )}
          {injuredPlayers.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#42be65",
                  display: "flex",
                }}
              />
              <div style={{ fontSize: 13, color: "#42be65", display: "flex" }}>
                Full squad available
              </div>
            </div>
          )}
        </div>

        {/* Pitch visualization — 880×516 */}
        <div
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            background:
              "linear-gradient(180deg, #2d6b30 0%, #1e5a22 50%, #2d6b30 100%)",
          }}
        >
          {/* Pitch outline */}
          <div
            style={{
              position: "absolute",
              left: 18,
              top: 10,
              width: 844,
              height: 496,
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          />
          {/* Halfway line */}
          <div
            style={{
              position: "absolute",
              left: 35,
              top: 258,
              width: 810,
              height: 1,
              background: "rgba(255,255,255,0.18)",
            }}
          />
          {/* Center spot */}
          <div
            style={{
              position: "absolute",
              left: 436,
              top: 254,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.3)",
            }}
          />
          {/* Center circle — diam 158px, center (440, 258) */}
          <div
            style={{
              position: "absolute",
              left: 361,
              top: 179,
              width: 158,
              height: 158,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          />
          {/* Bottom penalty box */}
          <div
            style={{
              position: "absolute",
              left: 194,
              top: 434,
              width: 492,
              height: 72,
              border: "1px solid rgba(255,255,255,0.18)",
              borderBottom: "none" as const,
            }}
          />
          {/* Top penalty box */}
          <div
            style={{
              position: "absolute",
              left: 194,
              top: 10,
              width: 492,
              height: 72,
              border: "1px solid rgba(255,255,255,0.18)",
              borderTop: "none" as const,
            }}
          />

          {/* Formation label */}
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 20,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.35)",
              display: "flex",
            }}
          >
            {formation}
          </div>

          {/* Player dots */}
          {lineup?.starters.map((p, i) => {
            const col = POS_COLORS[p.positionGroup] ?? "#8d8d8d";
            const lastName = p.playerName.split(" ").pop() ?? p.playerName;
            const label = lastName.length > 10 ? lastName.slice(0, 9) + "…" : lastName;
            // pitchX: 0-100 (left→right), pitchY: 0-100 (bottom GK → top FWD)
            const px = Math.round((p.pitchX / 100) * PW);
            const py = Math.round(((100 - p.pitchY) / 100) * PH);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: px - 15,
                  top: py - 15,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: 30,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: col,
                    border: "2px solid rgba(255,255,255,0.85)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#0a0a0a",
                      display: "flex",
                    }}
                  >
                    {p.playerName[0] ?? "?"}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#ffffff",
                    background: "rgba(0,0,0,0.55)",
                    padding: "1px 3px",
                    borderRadius: 2,
                    display: "flex",
                  }}
                >
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom bar — 50px */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 50,
          borderTop: "1px solid #262626",
          color: "#525252",
          fontSize: 13,
          letterSpacing: "0.04em",
          flexShrink: 0,
        }}
      >
        Predicted lineups · Recovery signals · squadcheck.xyz
      </div>
    </div>,
    { ...size },
  );
}
