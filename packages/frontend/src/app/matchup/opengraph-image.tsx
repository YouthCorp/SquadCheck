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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 300 },
    });
    clearTimeout(timer);
    return res.ok ? (res.json() as Promise<T>) : null;
  } catch {
    return null;
  }
}

function powerColor(pct: number): string {
  return pct >= 20 ? "#fa4d56" : pct >= 10 ? "#f1c21b" : "#42be65";
}

// opengraph-image.tsx does not receive searchParams in Next.js.
// This image renders a generic Matchup Analysis brand card that works
// regardless of which teams are being compared. Team-specific data would
// require a dynamic route like /matchup/[home]/[away]/opengraph-image.tsx.
export default async function Image() {
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

      {/* Main */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          padding: "0 72px",
        }}
      >
        <div
          style={{
            fontSize: 56,
            fontWeight: 300,
            color: "#f4f4f4",
            letterSpacing: "-0.02em",
            display: "flex",
          }}
        >
          Side-by-Side Injury Intelligence
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
            color: "#8d8d8d",
            fontSize: 20,
          }}
        >
          <span style={{ display: "flex" }}>Power Loss %</span>
          <span style={{ color: "#393939", display: "flex" }}>·</span>
          <span style={{ display: "flex" }}>Predicted Lineups</span>
          <span style={{ color: "#393939", display: "flex" }}>·</span>
          <span style={{ display: "flex" }}>Key Absences</span>
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
