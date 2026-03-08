import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { fetchApi } from '@/lib/api';
import type { InjuryImpact, InjurySummaryEntry, Standing, FixtureWithLeague } from '@/lib/types';
import { CURRENT_SEASON } from '@/lib/constants';
import { HomeFixturesList } from '@/components/home-fixtures-list';
import { HomeStandingsPanel } from '@/components/home-standings-panel';
import { HomeInjuryWatchPanel } from '@/components/home-injury-watch-panel';

const LEAGUE_IDS = [39, 140, 135, 78, 61] as const;


export default async function Home() {
  const locale = getLocale();

  // Batch 1: fixtures + 5 standings + 5 injury summaries (11 parallel calls)
  const [
    fixtures,
    s39, s140, s135, s78, s61,
    inj39, inj140, inj135, inj78, inj61,
  ] = await Promise.all([
    fetchApi<FixtureWithLeague[]>('/api/fixtures/upcoming?all=true').catch(() => [] as FixtureWithLeague[]),
    fetchApi<Standing>('/api/standings?league=39&season=${CURRENT_SEASON}').catch(() => null),
    fetchApi<Standing>('/api/standings?league=140&season=${CURRENT_SEASON}').catch(() => null),
    fetchApi<Standing>('/api/standings?league=135&season=${CURRENT_SEASON}').catch(() => null),
    fetchApi<Standing>('/api/standings?league=78&season=${CURRENT_SEASON}').catch(() => null),
    fetchApi<Standing>('/api/standings?league=61&season=${CURRENT_SEASON}').catch(() => null),
    fetchApi<InjurySummaryEntry[]>('/api/injuries/summary?league=39&season=${CURRENT_SEASON}').catch(() => [] as InjurySummaryEntry[]),
    fetchApi<InjurySummaryEntry[]>('/api/injuries/summary?league=140&season=${CURRENT_SEASON}').catch(() => [] as InjurySummaryEntry[]),
    fetchApi<InjurySummaryEntry[]>('/api/injuries/summary?league=135&season=${CURRENT_SEASON}').catch(() => [] as InjurySummaryEntry[]),
    fetchApi<InjurySummaryEntry[]>('/api/injuries/summary?league=78&season=${CURRENT_SEASON}').catch(() => [] as InjurySummaryEntry[]),
    fetchApi<InjurySummaryEntry[]>('/api/injuries/summary?league=61&season=${CURRENT_SEASON}').catch(() => [] as InjurySummaryEntry[]),
  ]);

  const standingsMap: Record<number, Standing | null> = {
    39: s39, 140: s140, 135: s135, 78: s78, 61: s61,
  };

  const injSummaries: Record<number, InjurySummaryEntry[]> = {
    39: inj39 ?? [],
    140: inj140 ?? [],
    135: inj135 ?? [],
    78: inj78 ?? [],
    61: inj61 ?? [],
  };

  // Batch 2: injury impacts for top 4 teams per league (up to 20 parallel calls)
  const allImpactCalls = LEAGUE_IDS.flatMap((lgId) =>
    (injSummaries[lgId] ?? [])
      .filter((e) => e.team != null)
      .slice(0, 4)
      .map((e) => ({ leagueId: lgId, teamId: e.team!.id }))
  );

  const impactResults = await Promise.all(
    allImpactCalls.map(({ teamId }) =>
      fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${teamId}`).catch(() => null)
    )
  );

  const injuryMap: Record<number, InjuryImpact[]> = {};
  allImpactCalls.forEach(({ leagueId }, i) => {
    const impact = impactResults[i];
    if (impact) {
      if (!injuryMap[leagueId]) injuryMap[leagueId] = [];
      injuryMap[leagueId].push(impact);
    }
  });

  // Sort each league's impacts by power loss descending
  for (const lgId of LEAGUE_IDS) {
    if (injuryMap[lgId]) {
      injuryMap[lgId].sort((a, b) => b.powerLossPct - a.powerLossPct);
    }
  }

  // Sort fixtures by date and take top 10
  const upcoming = (fixtures ?? [])
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 10);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://squadcheck.vercel.app';
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'SquadCheck',
    url: siteUrl,
    description:
      'Football injury impact analysis across top European leagues. Track Power Loss %, predicted lineups, and recovery signals.',
  };

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      {/* Hero */}
      <div style={{ marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--cds-border-subtle-01, #393939)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 300, color: 'var(--cds-text-primary, #f4f4f4)', margin: '0 0 0.25rem', letterSpacing: '-0.5px' }}>
          <span style={{ color: 'var(--cds-interactive, #4589ff)', fontWeight: 600 }}>Squad</span>Check
          <span style={{ fontSize: '1rem', fontWeight: 300, color: 'var(--cds-text-helper, #8d8d8d)', marginLeft: '0.75rem' }}>
            {t(locale, 'home_hero_title')}
          </span>
        </h1>

      </div>

      {/* 2-col: Fixtures (3fr) + Standings (2fr) */}
      <div className="sc-grid-home-main" style={{ marginBottom: '2rem' }}>
        <HomeFixturesList fixtures={upcoming} locale={locale} />
        <HomeStandingsPanel standingsMap={standingsMap} locale={locale} />
      </div>

      {/* Injury Watch */}
      <HomeInjuryWatchPanel injuryMap={injuryMap} locale={locale} />
    </div>
  );
}
