import { ImageResponse } from "next/og";
import { CURRENT_SEASON, SITE_URL } from "@/lib/constants";

export const runtime = "edge";
export const alt = "Team Injury Report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const BRAND_LOGO = `${SITE_URL}/logo_with_text.png`;

interface InjuryImpact {
  team: { name: string; logo: string | null };
  powerLossPct: number;
  injuredPlayers: { player: { name: string }; severity: string }[];
  standingEntry?: {
    played: number;
    wins: number;
    draws: number;
    losses: number;
  } | null;
}

function powerColor(pct: number): string {
  return pct >= 20 ? "#fa4d56" : pct >= 10 ? "#f1c21b" : "#42be65";
}

export default async function Image({
  params,
}: {
  params: { teamId: string };
}) {
  let impact: InjuryImpact | null = null;
  try {
    const res = await fetch(
      `${API_BASE}/api/analysis/injury-impact/${params.teamId}?season=${CURRENT_SEASON}`,
      { next: { revalidate: 300 } },
    );
    if (res.ok) impact = await res.json();
  } catch {}

  const teamName = impact?.team.name ?? "Team";
  const injuredCount = impact?.injuredPlayers.length ?? 0;
  const powerLoss = impact?.powerLossPct ?? 0;
  const se = impact?.standingEntry;

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        background: "#161616",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Left brand panel */}
      <div
        style={{
          width: 380,
          height: 630,
          display: "flex",
          flexDirection: "column",
          background: "#0d0d0d",
          padding: "48px 40px",
          borderRight: "3px solid #0f62fe",
        }}
      >
        <img
          src={BRAND_LOGO}
          width={180}
          style={{ objectFit: "contain" }}
        />
        <div style={{ flex: 1, display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 16, color: "#525252", display: "flex" }}>
            Injury Intelligence
          </div>
          <div style={{ fontSize: 14, color: "#393939", display: "flex" }}>
            squadcheck.xyz
          </div>
        </div>
      </div>

      {/* Right content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 60px",
          gap: 20,
        }}
      >
        {/* Team logo */}
        {impact?.team.logo && (
          <img
            src={impact.team.logo}
            width={88}
            height={88}
            style={{ objectFit: "contain" }}
          />
        )}

        {/* Team name */}
        <div
          style={{
            fontSize: 40,
            fontWeight: 300,
            color: "#f4f4f4",
            display: "flex",
            letterSpacing: "-0.01em",
          }}
        >
          {teamName}
        </div>

        {/* Season record */}
        {se && (
          <div style={{ display: "flex", gap: 16, fontSize: 16 }}>
            <div style={{ color: "#8d8d8d", display: "flex" }}>
              P{se.played}
            </div>
            <div style={{ color: "#42be65", display: "flex" }}>
              W{se.wins}
            </div>
            <div style={{ color: "#f1c21b", display: "flex" }}>
              D{se.draws}
            </div>
            <div style={{ color: "#fa4d56", display: "flex" }}>
              L{se.losses}
            </div>
          </div>
        )}

        {/* Divider */}
        <div
          style={{
            width: 200,
            height: 1,
            background: "#262626",
            display: "flex",
          }}
        />

        {/* Power loss */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
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
          <div style={{ fontSize: 16, color: "#8d8d8d", display: "flex" }}>
            power loss
          </div>
        </div>

        {/* Injury count */}
        <div
          style={{
            fontSize: 18,
            color: injuredCount > 0 ? "#c6c6c6" : "#42be65",
            display: "flex",
          }}
        >
          {injuredCount > 0
            ? `${injuredCount} player${injuredCount !== 1 ? "s" : ""} injured`
            : "Full squad available"}
        </div>
      </div>
    </div>,
    { ...size },
  );
}
