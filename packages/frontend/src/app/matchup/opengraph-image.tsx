import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/constants";

export const runtime = "edge";
export const alt = "Matchup Analysis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND_LOGO = `${SITE_URL}/logo_with_text.png`;

// opengraph-image.tsx does not receive searchParams in Next.js.
// This renders a static branded card for the matchup page.
export default function Image() {
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
            Injury Intelligence
          </div>
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

      {/* Right content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 60px",
          gap: 24,
        }}
      >
        <div
          style={{
            fontSize: 42,
            fontWeight: 300,
            color: "#f4f4f4",
            display: "flex",
            letterSpacing: "-0.01em",
          }}
        >
          Matchup Analysis
        </div>

        <div
          style={{
            width: 200,
            height: 1,
            background: "#1a1e2e",
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            gap: 24,
            fontSize: 16,
            color: "#6b7a9a",
          }}
        >
          <div style={{ display: "flex" }}>Power Loss %</div>
          <div style={{ color: "#1a1e2e", display: "flex" }}>·</div>
          <div style={{ display: "flex" }}>Predicted XI</div>
          <div style={{ color: "#1a1e2e", display: "flex" }}>·</div>
          <div style={{ display: "flex" }}>Key Absences</div>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
