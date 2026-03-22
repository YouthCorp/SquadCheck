import type { Metadata } from "next";
import Link from "next/link";
import { ClientRedirect } from "./_client-redirect";
import { CURRENT_SEASON } from "@/lib/constants";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface PredictedLineup {
  teamId: number;
  teamName: string;
  formation: string;
}

async function getLineup(teamId: string): Promise<PredictedLineup | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/analysis/predicted-lineup/${teamId}?season=${CURRENT_SEASON}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as PredictedLineup;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { teamId: string };
}): Promise<Metadata> {
  const lineup = await getLineup(params.teamId);
  const teamName = lineup?.teamName;
  const title = teamName ? `Predicted XI: ${teamName}` : "Predicted XI";

  return {
    title,
    description: `Predicted starting lineup for ${teamName ?? "this team"} with Power Loss % and injury intelligence.`,
    alternates: { canonical: `/team/${params.teamId}` },
    robots: { index: false, follow: true },
  };
}

// This page renders a minimal server-side shell so that:
// 1. The og:image meta tag (from opengraph-image.tsx) is included in the HTML response
// 2. Social crawlers see the correct metadata
// 3. A client-side redirect sends human visitors to the team page
export default async function ShareLineupPage({
  params,
}: {
  params: { teamId: string };
}) {
  const lineup = await getLineup(params.teamId);
  const teamName = lineup?.teamName ?? `Team ${params.teamId}`;

  return (
    <>
      <ClientRedirect href={`/team/${params.teamId}`} />
      {/* Fallback content shown briefly before JS redirect fires,
          and indexed by crawlers that don't follow JS redirects */}
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4 text-center">
        <div className="text-sm text-muted-foreground">
          Predicted XI · {teamName}
          {lineup?.formation ? ` · ${lineup.formation}` : ""}
        </div>
        <Link
          href={`/team/${params.teamId}`}
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline"
        >
          View full analysis →
        </Link>
      </div>
    </>
  );
}
