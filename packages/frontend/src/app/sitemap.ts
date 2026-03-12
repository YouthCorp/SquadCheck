import { MetadataRoute } from "next";
import { LEAGUE_NAMES } from "@/lib/constants";

export const revalidate = 86400; // 하루 캐시

const ALL_LEAGUE_IDS = Object.keys(LEAGUE_NAMES).map(Number);

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://squadcheck.xyz";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();
  const now = new Date();

  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${baseUrl}/leaderboard`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  // League routes
  for (const leagueId of ALL_LEAGUE_IDS) {
    routes.push({
      url: `${baseUrl}/league/${leagueId}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    });

    routes.push({
      url: `${baseUrl}/league/${leagueId}/fixtures`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    });
  }

  return routes;
}
