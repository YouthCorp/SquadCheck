import { ImageResponse } from "next/og";
import { CURRENT_SEASON, SITE_URL } from "@/lib/constants";

export const runtime = "edge";
export const alt = "Predicted XI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const BRAND_LOGO = `${SITE_URL}/logo_with_text.png`;

// Full-bleed landscape pitch: 1200×630
// Coordinate mapping (portrait→landscape, 90° clockwise):
//   landscape_x = pitchY (GK at left, FWD at right)
//   landscape_y = pitchX (left touchline at top, right at bottom)
const PW = 1200;
const PH = 630;

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

  const teamName =
    lineup?.teamName ?? impact?.team.name ?? `Team ${params.teamId}`;
  const formation = lineup?.formation ?? "—";
  const powerLoss = impact?.powerLossPct ?? 0;

  // Landscape field marking constants (px)
  const INSET_X = 24;
  const INSET_Y = 13;
  const FIELD_W = PW - INSET_X * 2; // 1152
  const FIELD_H = PH - INSET_Y * 2; // 604
  const MID_X = PW / 2; // 600
  const MID_Y = PH / 2; // 315
  const CIRCLE_D = 140;
  const PEN_DEPTH = Math.round(FIELD_W * 0.14); // ~161
  const PEN_HEIGHT = Math.round(FIELD_H * 0.56); // ~338
  const PEN_TOP = Math.round((PH - PEN_HEIGHT) / 2); // ~146

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        position: "relative",
        background:
          "linear-gradient(90deg, #1e5a22 0%, #2d6b30 25%, #1e5a22 50%, #2d6b30 75%, #1e5a22 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* === Field markings === */}

      {/* Pitch outline */}
      <div
        style={{
          position: "absolute",
          left: INSET_X,
          top: INSET_Y,
          width: FIELD_W,
          height: FIELD_H,
          border: "1px solid rgba(255,255,255,0.2)",
        }}
      />

      {/* Halfway line (vertical) */}
      <div
        style={{
          position: "absolute",
          left: MID_X,
          top: INSET_Y,
          width: 1,
          height: FIELD_H,
          background: "rgba(255,255,255,0.2)",
        }}
      />

      {/* Center circle */}
      <div
        style={{
          position: "absolute",
          left: MID_X - CIRCLE_D / 2,
          top: MID_Y - CIRCLE_D / 2,
          width: CIRCLE_D,
          height: CIRCLE_D,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.2)",
        }}
      />

      {/* Center spot */}
      <div
        style={{
          position: "absolute",
          left: MID_X - 4,
          top: MID_Y - 4,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.3)",
        }}
      />

      {/* Left penalty box (GK side) */}
      <div
        style={{
          position: "absolute",
          left: INSET_X,
          top: PEN_TOP,
          width: PEN_DEPTH,
          height: PEN_HEIGHT,
          borderTop: "1px solid rgba(255,255,255,0.2)",
          borderBottom: "1px solid rgba(255,255,255,0.2)",
          borderRight: "1px solid rgba(255,255,255,0.2)",
        }}
      />

      {/* Right penalty box */}
      <div
        style={{
          position: "absolute",
          left: PW - INSET_X - PEN_DEPTH,
          top: PEN_TOP,
          width: PEN_DEPTH,
          height: PEN_HEIGHT,
          borderTop: "1px solid rgba(255,255,255,0.2)",
          borderBottom: "1px solid rgba(255,255,255,0.2)",
          borderLeft: "1px solid rgba(255,255,255,0.2)",
        }}
      />

      {/* === Player dots === */}
      {lineup?.starters.map((p, i) => {
        const col = POS_COLORS[p.positionGroup] ?? "#8d8d8d";
        const lastName = p.playerName.split(" ").pop() ?? p.playerName;
        const label =
          lastName.length > 10 ? lastName.slice(0, 9) + "…" : lastName;

        // Landscape mapping: x=pitchY, y=pitchX
        const px = Math.round((p.pitchY / 100) * PW);
        const py = Math.round((p.pitchX / 100) * PH);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px - 18,
              top: py - 18,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 36,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: col,
                border: "2px solid rgba(255,255,255,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontSize: 12,
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
                fontSize: 10,
                fontWeight: 600,
                color: "#ffffff",
                background: "rgba(0,0,0,0.6)",
                padding: "1px 4px",
                borderRadius: 2,
                display: "flex",
              }}
            >
              {label}
            </div>
          </div>
        );
      })}

      {/* === Top overlay bar === */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1200,
          height: 56,
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          padding: "0 28px",
          gap: 20,
        }}
      >
        <img
          src={BRAND_LOGO}
          height={28}
          style={{ objectFit: "contain" }}
        />

        <div
          style={{
            width: 1,
            height: 24,
            background: "rgba(255,255,255,0.15)",
            display: "flex",
          }}
        />

        {lineup?.teamLogo && (
          <img
            src={lineup.teamLogo}
            width={28}
            height={28}
            style={{ objectFit: "contain" }}
          />
        )}

        <div style={{ fontSize: 16, color: "#e0e0e0", display: "flex" }}>
          {teamName}
        </div>

        <div style={{ fontSize: 14, color: "#8d8d8d", display: "flex" }}>
          {formation}
        </div>

        <div style={{ flex: 1, display: "flex" }} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 300,
              color: powerColor(powerLoss),
              display: "flex",
            }}
          >
            {powerLoss.toFixed(1)}%
          </div>
          <div style={{ fontSize: 12, color: "#8d8d8d", display: "flex" }}>
            power loss
          </div>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
