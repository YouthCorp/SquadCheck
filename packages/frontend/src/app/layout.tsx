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
    default: "SquadCheck | Football Injury Intelligence",
    template: "%s | SquadCheck",
  },
  description:
    "Track football injury updates, player availability, team injury news, predicted lineups, and recovery signals across the Premier League, La Liga, Serie A, Bundesliga, and Ligue 1.",
  keywords: [
    "football injuries",
    "injury tracker",
    "injury updates",
    "football injury news",
    "player injury updates",
    "team injury updates",
    "player availability",
    "predicted lineup",
    "power loss",
    "return date",
    "return updates",
    "Premier League injuries",
    "La Liga injuries",
    "Serie A injuries",
    "Bundesliga injuries",
    "Ligue 1 injuries",
    "injury impact analysis",
    "SquadCheck",
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
    other: [{ rel: "manifest", url: "/manifest.json" }],
  },
  openGraph: {
    type: "website",
    siteName: "SquadCheck",
    title: "SquadCheck | Football Injury Intelligence",
    description:
      "Track football injury updates, player availability, team injury news, predicted lineups, and recovery signals across top European leagues.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "SquadCheck | Football Injury Intelligence",
    description:
      "Track football injury updates, team news, player availability, and recovery signals across top European leagues.",
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
      en: SITE_URL,
      ko: SITE_URL,
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
              alternateName: "SquadCheck Football Injury Intelligence",
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
