import { MetadataRoute } from 'next';
import { LEAGUE_NAMES } from '@/lib/constants';

const ALL_LEAGUE_IDS = Object.keys(LEAGUE_NAMES).map(Number);
const MAJOR_LEAGUE_IDS = [39, 140, 135, 78, 61];

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const now = new Date();

  const routes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'hourly', priority: 1 },
  ];

  // League + fixtures routes
  for (const leagueId of ALL_LEAGUE_IDS) {
    routes.push({
      url: `${baseUrl}/league/${leagueId}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    });
    routes.push({
      url: `${baseUrl}/league/${leagueId}/fixtures`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.9,
    });
  }

  // Team routes — fetched from standings for major leagues
  const teamIds = new Set<number>();
  await Promise.allSettled(
    MAJOR_LEAGUE_IDS.map(async (leagueId) => {
      try {
        const res = await fetch(`${apiBase}/api/standings?league=${leagueId}`, {
          next: { revalidate: 3600 },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.entries) {
            for (const entry of data.entries) teamIds.add(entry.team.id);
          }
        }
      } catch {}
    }),
  );

  for (const teamId of Array.from(teamIds)) {
    routes.push({
      url: `${baseUrl}/team/${teamId}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    });
  }

  return routes;
}
