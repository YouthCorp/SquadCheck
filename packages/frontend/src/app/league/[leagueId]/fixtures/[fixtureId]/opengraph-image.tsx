import { ImageResponse } from "next/og";
import { LEAGUE_NAMES, CURRENT_SEASON, SITE_URL } from "@/lib/constants";

export const runtime = "edge";
export const alt = "Match Injury Analysis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const BRAND_LOGO = `${SITE_URL}/logo_with_text.png`;

interface FixtureDetail {
  id: number;
  date: string;
  status: string;
  round: string | null;
  homeTeam: { id: number; name: string; logo: string | null };
  awayTeam: { id: number; name: string; logo: string | null };
}

interface InjuryImpact {
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
}: {
  params: { leagueId: string; fixtureId: string };
}) {
  const leagueName = LEAGUE_NAMES[parseInt(params.leagueId)] ?? "Football";

  const fixture = await safeJson<FixtureDetail>(
    `${API_BASE}/api/fixtures/${params.fixtureId}`,
  );

  const homeTeamId = fixture?.homeTeam.id;
  const awayTeamId = fixture?.awayTeam.id;

  const [homeImpact, awayImpact] = await Promise.all([
    homeTeamId
      ? safeJson<InjuryImpact>(
          `${API_BASE}/api/analysis/injury-impact/${homeTeamId}?season=${CURRENT_SEASON}`,
        )
      : null,
    awayTeamId
      ? safeJson<InjuryImpact>(
          `${API_BASE}/api/analysis/injury-impact/${awayTeamId}?season=${CURRENT_SEASON}`,
        )
      : null,
  ]);

  const homeName = fixture?.homeTeam.name ?? "Home";
  const awayName = fixture?.awayTeam.name ?? "Away";
  const homeLogo = fixture?.homeTeam.logo ?? null;
  const awayLogo = fixture?.awayTeam.logo ?? null;

  const homePL = homeImpact?.powerLossPct ?? 0;
  const awayPL = awayImpact?.powerLossPct ?? 0;
  const homeOut = homeImpact?.injuredPlayers.length ?? 0;
  const awayOut = awayImpact?.injuredPlayers.length ?? 0;

  const matchDate = fixture?.date
    ? new Date(fixture.date).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "";

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        position: "relative",
        background:
          "linear-gradient(135deg, #090c13 0%, #0d1120 50%, #0b0e1b 100%)",
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
          justifyContent: "center",
          background: "#060810",
          padding: "48px 44px",
          boxShadow: "8px 0 40px rgba(0,0,0,0.7)",
        }}
      >
        <img src={BRAND_LOGO} width={160} style={{ objectFit: "contain" }} />
        <div style={{ height: 28, display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ fontSize: 15, color: "#353a55", display: "flex" }}>
            {leagueName}
          </div>
          {matchDate && (
            <div style={{ fontSize: 14, color: "#22263a", display: "flex" }}>
              {matchDate}
            </div>
          )}
          <div style={{ fontSize: 13, color: "#22263a", display: "flex" }}>
            squadcheck.xyz
          </div>
        </div>
      </div>

      {/* Gradient separator */}
      <div
        style={{
          position: "absolute",
          left: 380,
          top: 0,
          width: 52,
          height: 630,
          background:
            "linear-gradient(90deg, rgba(6,8,16,0.95) 0%, transparent 100%)",
        }}
      />

      {/* Right content — vertical split home/away */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Home team — top half */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            padding: "0 56px",
            gap: 28,
            borderBottom: "1px solid #1a1e2e",
          }}
        >
          {homeLogo && (
            <img
              src={homeLogo}
              width={64}
              height={64}
              style={{ objectFit: "contain" }}
            />
          )}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 300,
                color: "#f4f4f4",
                display: "flex",
              }}
            >
              {homeName}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 300,
                  color: powerColor(homePL),
                  display: "flex",
                }}
              >
                {homePL.toFixed(1)}%
              </div>
              <div
                style={{ fontSize: 14, color: "#8d8d8d", display: "flex" }}
              >
                power loss
              </div>
              {homeOut > 0 && (
                <div
                  style={{ fontSize: 14, color: "#8d8d8d", display: "flex" }}
                >
                  · {homeOut} out
                </div>
              )}
            </div>
          </div>
        </div>

        {/* VS badge — centered on divider */}
        <div
          style={{
            position: "absolute",
            left: 380 + 820 / 2 - 24,
            top: 315 - 18,
            width: 48,
            height: 36,
            background: "#0d1120",
            border: "1px solid #1a1e2e",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 600,
            color: "#4a5570",
            letterSpacing: "0.08em",
          }}
        >
          VS
        </div>

        {/* Away team — bottom half */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            padding: "0 56px",
            gap: 28,
          }}
        >
          {awayLogo && (
            <img
              src={awayLogo}
              width={64}
              height={64}
              style={{ objectFit: "contain" }}
            />
          )}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 300,
                color: "#f4f4f4",
                display: "flex",
              }}
            >
              {awayName}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 300,
                  color: powerColor(awayPL),
                  display: "flex",
                }}
              >
                {awayPL.toFixed(1)}%
              </div>
              <div
                style={{ fontSize: 14, color: "#8d8d8d", display: "flex" }}
              >
                power loss
              </div>
              {awayOut > 0 && (
                <div
                  style={{ fontSize: 14, color: "#8d8d8d", display: "flex" }}
                >
                  · {awayOut} out
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
