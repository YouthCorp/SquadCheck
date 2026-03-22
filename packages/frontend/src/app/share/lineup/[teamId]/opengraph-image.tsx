import { ImageResponse } from "next/og";
import { CURRENT_SEASON, SITE_URL } from "@/lib/constants";

export const runtime = "edge";
export const alt = "Predicted XI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const BRAND_LOGO = `${SITE_URL}/logo_with_text.png`;

// Portrait pitch card dimensions & position on canvas
const PW = 380; // pitch card width
const PH = 560; // pitch card height
const PLX = 510; // pitch card left  = 200(strip) + (1000-380)/2
const PLY = 35; // pitch card top   = (630-560)/2

// Field insets inside the pitch card
const PFX = 16;
const PFY = 20;
const FW = PW - 2 * PFX; // 348
const FH = PH - 2 * PFY; // 520

// Canvas-relative center of pitch
const CMX = PLX + PW / 2; // 700
const CMY = PLY + PH / 2; // 315

const CIRCLE_D = 80;

// Penalty box (portrait)
const PEN_W = Math.round(FW * 0.56); // ~195
const PEN_H = Math.round(FH * 0.14); // ~73
const PEN_LX = PLX + PFX + Math.round((FW - PEN_W) / 2); // canvas x of pen box left

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
  const shortName = teamName.length > 13 ? teamName.slice(0, 12) + "…" : teamName;
  const formation = lineup?.formation ?? "—";
  const powerLoss = impact?.powerLossPct ?? 0;

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        position: "relative",
        background:
          "linear-gradient(135deg, #090c13 0%, #0e1325 50%, #0b0e1b 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── Left info strip (200px) ── */}
      <div
        style={{
          width: 200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "28px 20px 32px",
        }}
      >
        {/* Brand logo — small, top */}
        <img src={BRAND_LOGO} width={100} style={{ objectFit: "contain" }} />

        {/* Team info — center */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "#e0e4f0",
              display: "flex",
            }}
          >
            {shortName}
          </div>
          <div style={{ fontSize: 13, color: "#7a8aaa", display: "flex" }}>
            {formation}
          </div>
          <div style={{ height: 12, display: "flex" }} />
          <div
            style={{
              fontSize: 28,
              fontWeight: 300,
              color: powerColor(powerLoss),
              lineHeight: 1,
              display: "flex",
            }}
          >
            {powerLoss.toFixed(1)}%
          </div>
          <div style={{ fontSize: 12, color: "#5a6380", display: "flex" }}>
            power loss
          </div>
        </div>

        {/* Team logo — large, bottom */}
        {lineup?.teamLogo ? (
          <img
            src={lineup.teamLogo}
            width={110}
            height={110}
            style={{ objectFit: "contain" }}
          />
        ) : (
          <div style={{ width: 110, height: 110, display: "flex" }} />
        )}
      </div>

      {/* ── Portrait pitch card (floating) ── */}
      <div
        style={{
          position: "absolute",
          left: PLX,
          top: PLY,
          width: PW,
          height: PH,
          background:
            "linear-gradient(180deg, #1a5c1e 0%, #236626 40%, #1a5c1e 60%, #1e6322 100%)",
          borderRadius: 10,
          boxShadow:
            "0 12px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      />

      {/* ── Field markings (absolute, canvas-relative) ── */}

      {/* Pitch outline */}
      <div
        style={{
          position: "absolute",
          left: PLX + PFX,
          top: PLY + PFY,
          width: FW,
          height: FH,
          border: "1px solid rgba(255,255,255,0.18)",
        }}
      />

      {/* Halfway line (horizontal) */}
      <div
        style={{
          position: "absolute",
          left: PLX + PFX,
          top: CMY,
          width: FW,
          height: 1,
          background: "rgba(255,255,255,0.18)",
        }}
      />

      {/* Center circle */}
      <div
        style={{
          position: "absolute",
          left: CMX - CIRCLE_D / 2,
          top: CMY - CIRCLE_D / 2,
          width: CIRCLE_D,
          height: CIRCLE_D,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.18)",
        }}
      />

      {/* Center spot */}
      <div
        style={{
          position: "absolute",
          left: CMX - 3,
          top: CMY - 3,
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.3)",
        }}
      />

      {/* Top penalty box (attacking side — FWD at top when GK at bottom) */}
      <div
        style={{
          position: "absolute",
          left: PEN_LX,
          top: PLY + PFY,
          width: PEN_W,
          height: PEN_H,
          borderLeft: "1px solid rgba(255,255,255,0.18)",
          borderRight: "1px solid rgba(255,255,255,0.18)",
          borderBottom: "1px solid rgba(255,255,255,0.18)",
        }}
      />

      {/* Bottom penalty box (GK side) */}
      <div
        style={{
          position: "absolute",
          left: PEN_LX,
          top: PLY + PFY + FH - PEN_H,
          width: PEN_W,
          height: PEN_H,
          borderLeft: "1px solid rgba(255,255,255,0.18)",
          borderRight: "1px solid rgba(255,255,255,0.18)",
          borderTop: "1px solid rgba(255,255,255,0.18)",
        }}
      />

      {/* ── Player dots ── */}
      {lineup?.starters.map((p, i) => {
        const col = POS_COLORS[p.positionGroup] ?? "#8d8d8d";
        const lastName = p.playerName.split(" ").pop() ?? p.playerName;
        const label =
          lastName.length > 9 ? lastName.slice(0, 8) + "…" : lastName;

        // pitchX: 0=left touchline → 100=right (horizontal)
        // pitchY: 0=GK goal → 100=attacking (invert: GK at bottom)
        const cx =
          PLX + PFX + Math.round((p.pitchX / 100) * FW);
        const cy =
          PLY + PFY + Math.round(((100 - p.pitchY) / 100) * FH);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cx - 16,
              top: cy - 16,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 32,
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
                background: "rgba(0,0,0,0.65)",
                padding: "1px 3px",
                borderRadius: 2,
                display: "flex",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>,
    { ...size },
  );
}
