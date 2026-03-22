import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/constants";

export const runtime = "edge";
export const alt = "SquadCheck — Football injury analysis & predicted lineups";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND_LOGO = `${SITE_URL}/logo_with_text.png`;

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0d0d0d",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Brand logo */}
      <img
        src={BRAND_LOGO}
        height={80}
        style={{ objectFit: "contain" }}
      />

      {/* Tagline */}
      <div
        style={{
          fontSize: 28,
          fontWeight: 300,
          color: "#8d8d8d",
          display: "flex",
          marginTop: 28,
          letterSpacing: "0.02em",
        }}
      >
        Football Injury Intelligence
      </div>
    </div>,
    { ...size },
  );
}
