import { redirect } from "next/navigation";
import type { Metadata } from "next";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const CURRENT_SEASON = 2025;

interface PredictedLineup {
  teamId: number;
  teamName: string;
  formation: string;
}

async function getTeamName(teamId: string, season: number): Promise<string | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/analysis/predicted-lineup/${teamId}?season=${season}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as PredictedLineup;
    return data.teamName ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { teamId: string };
  searchParams: { season?: string };
}): Promise<Metadata> {
  const season = searchParams.season ? parseInt(searchParams.season) : CURRENT_SEASON;
  const teamName = await getTeamName(params.teamId, season);
  const title = teamName ? `Predicted XI: ${teamName}` : "Predicted XI";

  return {
    title,
    description: `Predicted starting lineup for ${teamName ?? "this team"} with Power Loss % and injury intelligence.`,
    alternates: { canonical: `/team/${params.teamId}` },
  };
}

export default function ShareLineupPage({
  params,
}: {
  params: { teamId: string };
}) {
  redirect(`/team/${params.teamId}`);
}
