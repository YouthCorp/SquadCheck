import type { Metadata } from "next";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { LayoutShell } from "@/components/layout-shell";
import { GoogleAnalytics } from "@/components/google-analytics";
import { AuthProvider } from "@/lib/auth-context";
import { getLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";

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
    default: "SquadCheck — Football Injury Intelligence",
    template: "%s | SquadCheck",
  },
  description:
    "Track injury impact and predicted lineups across Premier League, La Liga, Serie A, Bundesliga, and Ligue 1. Power Loss %, recovery signals, and real-time squad analysis. 축구 부상 분석 · 예상 라인업 · 파워 로스",
  keywords: [
    "football injuries",
    "injury tracker",
    "predicted lineup",
    "power loss",
    "Premier League injuries",
    "La Liga injuries",
    "Serie A injuries",
    "injury impact analysis",
    "스쿼드체크",
    "축구 부상",
    "부상 분석",
    "예상 라인업",
    "프리미어리그 부상",
    "라리가 부상",
    "세리에A 부상",
    "분데스리가 부상",
    "리그앙 부상",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png" },
      { url: "/apple-icon-180x180.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "manifest", url: "/manifest.json" },
    ],
  },
  openGraph: {
    type: "website",
    siteName: "SquadCheck (스쿼드체크)",
    title: "SquadCheck — Football Injury Intelligence",
    description:
      "Quantify how injuries affect team strength. Predicted lineups, Power Loss %, and recovery signals across top European leagues. 축구 부상이 팀 전력에 미치는 영향을 정량화.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "SquadCheck — Football Injury Intelligence",
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
    languages: {
      "en": SITE_URL,
      "ko": SITE_URL,
      "x-default": SITE_URL,
    },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "SquadCheck",
              alternateName: "스쿼드체크",
              url: SITE_URL,
              logo: `${SITE_URL}/favicon-96x96.png`,
            }),
          }}
        />
        <GoogleAnalytics />
        <AuthProvider>
          <LayoutShell locale={locale}>{children}</LayoutShell>
        </AuthProvider>
        <Toaster
          position="bottom-center"
          theme="dark"
          toastOptions={{
            style: {
              background: "#262626",
              border: "1px solid #393939",
              color: "#f4f4f4",
            },
          }}
        />
      </body>
    </html>
  );
}
