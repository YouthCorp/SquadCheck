import { MetadataRoute } from "next";
import { LEAGUE_NAMES } from "@/lib/constants";

const ALL_LEAGUE_IDS = Object.keys(LEAGUE_NAMES).map(Number);
const MAJOR_LEAGUE_IDS = [39, 140, 135, 78, 61];

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const apiBase = getApiBase();
  const now = new Date();

  // Static + league routes (always present regardless of API availability)
  const routes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "hourly", priority: 1 },
    {
      url: `${baseUrl}/injuries`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/leaderboard`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/matchup`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

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
        } else {
          console.error(`[sitemap] standings fetch failed for league ${leagueId}: ${res.status}`);
        }
      } catch (e) {
        console.error(`[sitemap] standings fetch error for league ${leagueId}:`, e);
      }
    }),
  );

  for (const teamId of Array.from(teamIds)) {
    routes.push({
      url: `${baseUrl}/team/${teamId}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  // Player routes — fetched from each team's player list
  const playerIds = new Set<number>();
  await Promise.allSettled(
    Array.from(teamIds).map(async (teamId) => {
      try {
        const res = await fetch(`${apiBase}/api/teams/${teamId}/players`, {
          next: { revalidate: 3600 },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            for (const entry of data) {
              if (entry.player?.id) playerIds.add(entry.player.id);
            }
          }
        } else {
          console.error(`[sitemap] players fetch failed for team ${teamId}: ${res.status}`);
        }
      } catch (e) {
        console.error(`[sitemap] players fetch error for team ${teamId}:`, e);
      }
    }),
  );

  for (const playerId of Array.from(playerIds)) {
    routes.push({
      url: `${baseUrl}/player/${playerId}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    });
  }

  return routes;
}
