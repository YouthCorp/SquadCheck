import { getLocale } from "@/lib/locale";
import { t } from "@/lib/i18n";
import { fetchApi } from "@/lib/api";
import type {
  InjuryImpact,
  InjurySummaryEntry,
  Standing,
  FixtureWithLeague,
} from "@/lib/types";
import { CURRENT_SEASON } from "@/lib/constants";
import { HomeFixturesList } from "@/components/home-fixtures-list";
import { HomeStandingsPanel } from "@/components/home-standings-panel";
import { HomeInjuryWatchPanel } from "@/components/home-injury-watch-panel";

const LEAGUE_IDS = [39, 140, 135, 78, 61] as const;

export default async function Home() {
  const locale = getLocale();

  const [
    fixtures,
    s39,
    s140,
    s135,
    s78,
    s61,
    inj39,
    inj140,
    inj135,
    inj78,
    inj61,
  ] = await Promise.all([
    fetchApi<FixtureWithLeague[]>("/api/fixtures/upcoming?all=true").catch(
      () => [] as FixtureWithLeague[],
    ),
    fetchApi<Standing>(
      `/api/standings?league=39&season=${CURRENT_SEASON}`,
    ).catch(() => null),
    fetchApi<Standing>(
      `/api/standings?league=140&season=${CURRENT_SEASON}`,
    ).catch(() => null),
    fetchApi<Standing>(
      `/api/standings?league=135&season=${CURRENT_SEASON}`,
    ).catch(() => null),
    fetchApi<Standing>(
      `/api/standings?league=78&season=${CURRENT_SEASON}`,
    ).catch(() => null),
    fetchApi<Standing>(
      `/api/standings?league=61&season=${CURRENT_SEASON}`,
    ).catch(() => null),
    fetchApi<InjurySummaryEntry[]>(
      `/api/injuries/summary?league=39&season=${CURRENT_SEASON}`,
    ).catch(() => [] as InjurySummaryEntry[]),
    fetchApi<InjurySummaryEntry[]>(
      `/api/injuries/summary?league=140&season=${CURRENT_SEASON}`,
    ).catch(() => [] as InjurySummaryEntry[]),
    fetchApi<InjurySummaryEntry[]>(
      `/api/injuries/summary?league=135&season=${CURRENT_SEASON}`,
    ).catch(() => [] as InjurySummaryEntry[]),
    fetchApi<InjurySummaryEntry[]>(
      `/api/injuries/summary?league=78&season=${CURRENT_SEASON}`,
    ).catch(() => [] as InjurySummaryEntry[]),
    fetchApi<InjurySummaryEntry[]>(
      `/api/injuries/summary?league=61&season=${CURRENT_SEASON}`,
    ).catch(() => [] as InjurySummaryEntry[]),
  ]);

  const standingsMap: Record<number, Standing | null> = {
    39: s39,
    140: s140,
    135: s135,
    78: s78,
    61: s61,
  };

  const injSummaries: Record<number, InjurySummaryEntry[]> = {
    39: inj39 ?? [],
    140: inj140 ?? [],
    135: inj135 ?? [],
    78: inj78 ?? [],
    61: inj61 ?? [],
  };

  const allImpactCalls = LEAGUE_IDS.flatMap((lgId) =>
    (injSummaries[lgId] ?? [])
      .filter((e) => e.team != null)
      .slice(0, 4)
      .map((e) => ({ leagueId: lgId, teamId: e.team!.id })),
  );

  const impactResults = await Promise.all(
    allImpactCalls.map(({ teamId }) =>
      fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${teamId}`).catch(
        () => null,
      ),
    ),
  );

  const injuryMap: Record<number, InjuryImpact[]> = {};
  allImpactCalls.forEach(({ leagueId }, i) => {
    const impact = impactResults[i];
    if (impact) {
      if (!injuryMap[leagueId]) injuryMap[leagueId] = [];
      injuryMap[leagueId].push(impact);
    }
  });

  for (const lgId of LEAGUE_IDS) {
    if (injuryMap[lgId]) {
      injuryMap[lgId].sort((a, b) => b.powerLossPct - a.powerLossPct);
    }
  }

  const upcoming = (fixtures ?? [])
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 10);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://squadcheck.xyz";
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "SquadCheck",
    url: siteUrl,
    description: "Football injury impact analysis across top European leagues.",
  };

  return (
    <div className="max-w-[80rem] mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />

      {/* Hero */}
      <div className="relative mb-6 pb-5 border-b border-border overflow-hidden">
        {/* Animated background glow */}
        <div
          className="sc-hero-glow absolute -top-8 -left-8 w-72 h-36 rounded-full"
          style={{
            background:
              "radial-gradient(ellipse, rgba(59,130,246,0.12) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />
        <h1 className="relative text-3xl font-light text-foreground m-0 mb-1 tracking-tight">
          <span className="font-semibold text-primary">Squad</span>Check
          <span className="text-base font-light text-muted-foreground ml-3">
            {t(locale, "home_hero_title")}
          </span>
        </h1>
        <div className="relative flex items-center gap-4 mt-2">
          <span className="text-xs text-muted-foreground">5 leagues</span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-xs text-muted-foreground">
            9 cup competitions
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-xs text-muted-foreground">
            Real-time injury tracking
          </span>
        </div>
      </div>

      {/* 2-col: Fixtures (3fr) + Standings (2fr) */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 mb-8">
        <HomeFixturesList fixtures={upcoming} locale={locale} />
        <HomeStandingsPanel standingsMap={standingsMap} locale={locale} />
      </div>

      {/* Injury Watch */}
      <HomeInjuryWatchPanel injuryMap={injuryMap} locale={locale} />
    </div>
  );
}
