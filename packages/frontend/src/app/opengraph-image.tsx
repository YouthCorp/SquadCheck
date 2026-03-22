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
        background:
          "linear-gradient(135deg, #090c13 0%, #0d1120 50%, #0b0e1b 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <img src={BRAND_LOGO} height={80} style={{ objectFit: "contain" }} />
      <div
        style={{
          fontSize: 28,
          fontWeight: 300,
          color: "#4a5570",
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
