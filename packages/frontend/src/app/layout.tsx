import type { Metadata } from "next";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { LayoutShell } from "@/components/layout-shell";
import { GoogleAnalytics } from "@/components/google-analytics";
import { getLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://squadcheck.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SquadCheck — Injury Impact Analysis",
    template: "%s | SquadCheck",
  },
  description:
    "Track injury impact and predicted lineups across Premier League, La Liga, Serie A, Bundesliga, and Ligue 1. Power Loss %, recovery signals, and real-time squad analysis.",
  keywords: [
    "football injuries",
    "injury tracker",
    "predicted lineup",
    "power loss",
    "Premier League injuries",
    "La Liga injuries",
    "Serie A injuries",
    "injury impact analysis",
  ],
  openGraph: {
    type: "website",
    siteName: "SquadCheck",
    title: "SquadCheck — Injury Impact Analysis",
    description:
      "Quantify how injuries affect team strength. Predicted lineups, Power Loss %, and recovery signals across top European leagues.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "SquadCheck — Injury Impact Analysis",
    description:
      "Quantify how injuries affect team strength across top European leagues.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = getLocale();
  return (
    <html
      lang={locale}
      className={cn(dmSans.variable, plexMono.variable, "dark")}
    >
      <body>
        <GoogleAnalytics />
        <LayoutShell locale={locale}>{children}</LayoutShell>
      </body>
    </html>
  );
}
