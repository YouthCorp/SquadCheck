import type { Metadata } from "next";
import { fetchApi } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import { t } from "@/lib/i18n";
import { CURRENT_SEASON, SITE_URL } from "@/lib/constants";
import { SectionHeader } from "@/components/section-header";
import { MatchupCard } from "@/components/matchup-card";
import { PredictedLineupColumn } from "@/components/predicted-lineup-column";
import { ShareButton } from "@/components/share-button";
import type { InjuryImpact, PredictedLineup } from "@/lib/types";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { home?: string; away?: string; season?: string };
}): Promise<Metadata> {
  const { home, away, season: seasonStr } = searchParams;
  if (!home || !away) {
    return { title: "Matchup Analysis" };
  }
  const season = seasonStr ? parseInt(seasonStr) : CURRENT_SEASON;

  try {
    const [homeImpact, awayImpact] = await Promise.all([
      fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${home}?season=${season}`).catch(() => null),
      fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${away}?season=${season}`).catch(() => null),
    ]);

    const homeName = homeImpact?.team.name ?? `Team ${home}`;
    const awayName = awayImpact?.team.name ?? `Team ${away}`;
    const title = `${homeName} vs ${awayName} — Matchup Analysis`;
    const desc = `Injury comparison: ${homeName} (${homeImpact?.powerLossPct.toFixed(1) ?? "—"}% power loss) vs ${awayName} (${awayImpact?.powerLossPct.toFixed(1) ?? "—"}% power loss).`;

    return {
      title,
      description: desc,
      openGraph: { title: `${title} | SquadCheck`, description: desc },
      alternates: { canonical: `/matchup?home=${home}&away=${away}` },
    };
  } catch {
    return { title: "Matchup Analysis" };
  }
}

export default async function MatchupPage({
  searchParams,
}: {
  searchParams: { home?: string; away?: string; season?: string };
}) {
  const locale = getLocale();
  const { home, away, season: seasonStr } = searchParams;
  const season = seasonStr ? parseInt(seasonStr) : CURRENT_SEASON;

  if (!home || !away) {
    return (
      <div className="max-w-[72rem] mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground text-sm">
          Select two teams to compare. Use{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">
            ?home=&#123;teamId&#125;&away=&#123;teamId&#125;
          </code>
        </p>
      </div>
    );
  }

  const [homeImpact, awayImpact, homeLineup, awayLineup] = await Promise.all([
    fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${home}?season=${season}`).catch(() => null),
    fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${away}?season=${season}`).catch(() => null),
    fetchApi<PredictedLineup>(`/api/analysis/predicted-lineup/${home}?season=${season}`).catch(() => null),
    fetchApi<PredictedLineup>(`/api/analysis/predicted-lineup/${away}?season=${season}`).catch(() => null),
  ]);

  const shareUrl = `${SITE_URL}/matchup?home=${home}&away=${away}&season=${season}&utm_source=share&utm_medium=social`;

  return (
    <div className="max-w-[72rem] mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader label="Matchup Intelligence" />
        <ShareButton url={shareUrl} />
      </div>

      <MatchupCard homeImpact={homeImpact} awayImpact={awayImpact} locale={locale} />

      <SectionHeader
        label={t(locale, "predicted_lineups")}
        tooltip={t(locale, "tooltip_predicted_lineup")}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PredictedLineupColumn lineup={homeLineup} locale={locale} />
        <PredictedLineupColumn lineup={awayLineup} locale={locale} />
      </div>
    </div>
  );
}
