import { ImageResponse } from "next/og";
import { LEAGUE_NAMES } from "@/lib/constants";

export const runtime = "edge";
export const alt = "Match Injury Analysis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface FixtureDetail {
  id: number;
  date: string;
  status: string;
  round: string | null;
  homeTeam: { id: number; name: string; logo: string | null };
  awayTeam: { id: number; name: string; logo: string | null };
}

interface InjuryImpact {
  injuredPlayers: { name: string; severity: string }[];
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
          `${API_BASE}/api/analysis/injury-impact/${homeTeamId}`,
        )
      : null,
    awayTeamId
      ? safeJson<InjuryImpact>(
          `${API_BASE}/api/analysis/injury-impact/${awayTeamId}`,
        )
      : null,
  ]);

  const homeName = fixture?.homeTeam.name ?? "Home";
  const awayName = fixture?.awayTeam.name ?? "Away";
  const matchDate = fixture?.date
    ? new Date(fixture.date).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  const homeOut = homeImpact?.injuredPlayers.length ?? null;
  const awayOut = awayImpact?.injuredPlayers.length ?? null;
  const homePL = homeImpact?.powerLossPct.toFixed(1) ?? null;
  const awayPL = awayImpact?.powerLossPct.toFixed(1) ?? null;

  function powerColor(pct: string | null): string {
    if (!pct) return "#8d8d8d";
    const n = parseFloat(pct);
    return n >= 20 ? "#fa4d56" : n >= 10 ? "#f1c21b" : "#42be65";
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
          padding: "28px 80px",
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
          }}
        >
          SQUADCHECK
        </div>
        <div style={{ color: "#8d8d8d", fontSize: 16 }}>{leagueName}</div>
        {matchDate && (
          <>
            <div style={{ color: "#393939", fontSize: 18 }}>·</div>
            <div style={{ color: "#8d8d8d", fontSize: 16 }}>{matchDate}</div>
          </>
        )}
      </div>

      {/* Match content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          padding: "0 80px",
          gap: 0,
        }}
      >
        {/* Home team */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          {fixture?.homeTeam.logo && (
            <img
              src={fixture.homeTeam.logo}
              width={64}
              height={64}
              style={{ objectFit: "contain", marginBottom: 16 }}
            />
          )}
          <div
            style={{
              fontSize: 52,
              fontWeight: 300,
              color: "#f4f4f4",
              lineHeight: 1.1,
              marginBottom: 24,
            }}
          >
            {homeName}
          </div>
          {homeOut !== null && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#fa4d56",
                    display: "flex",
                  }}
                />
                <span style={{ color: "#c6c6c6", fontSize: 20 }}>
                  {homeOut} out
                </span>
              </div>
              {homePL !== null && (
                <div
                  style={{ display: "flex", alignItems: "baseline", gap: 8 }}
                >
                  <span
                    style={{
                      fontSize: 32,
                      fontWeight: 300,
                      color: powerColor(homePL),
                    }}
                  >
                    {homePL}%
                  </span>
                  <span style={{ color: "#8d8d8d", fontSize: 16 }}>
                    power loss
                  </span>
                </div>
              )}
            </div>
          )}
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
          }}
        >
          {fixture?.awayTeam.logo && (
            <img
              src={fixture.awayTeam.logo}
              width={64}
              height={64}
              style={{ objectFit: "contain", marginBottom: 16 }}
            />
          )}
          <div
            style={{
              fontSize: 52,
              fontWeight: 300,
              color: "#f4f4f4",
              lineHeight: 1.1,
              marginBottom: 24,
              textAlign: "right",
            }}
          >
            {awayName}
          </div>
          {awayOut !== null && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                alignItems: "flex-end",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#fa4d56",
                    display: "flex",
                  }}
                />
                <span style={{ color: "#c6c6c6", fontSize: 20 }}>
                  {awayOut} out
                </span>
              </div>
              {awayPL !== null && (
                <div
                  style={{ display: "flex", alignItems: "baseline", gap: 8 }}
                >
                  <span
                    style={{
                      fontSize: 32,
                      fontWeight: 300,
                      color: powerColor(awayPL),
                    }}
                  >
                    {awayPL}%
                  </span>
                  <span style={{ color: "#8d8d8d", fontSize: 16 }}>
                    power loss
                  </span>
                </div>
              )}
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
          padding: "20px 80px",
          borderTop: "1px solid #262626",
          color: "#525252",
          fontSize: 15,
          letterSpacing: "0.04em",
        }}
      >
        Predicted lineups · Recovery signals · squadcheck.xyz
      </div>
    </div>,
    { ...size },
  );
}
