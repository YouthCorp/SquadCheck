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
          alignItems: "center",
          padding: "48px 44px",
        }}
      >
        <img src={BRAND_LOGO} width={280} style={{ objectFit: "contain" }} />
        <div style={{ height: 32, display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: "#8d96b5", display: "flex" }}>
            Injury Intelligence
          </div>
          <div style={{ fontSize: 14, color: "#5a6380", display: "flex" }}>
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
          <div style={{ color: "#4a5570", display: "flex" }}>·</div>
          <div style={{ display: "flex" }}>Predicted XI</div>
          <div style={{ color: "#4a5570", display: "flex" }}>·</div>
          <div style={{ display: "flex" }}>Key Absences</div>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
