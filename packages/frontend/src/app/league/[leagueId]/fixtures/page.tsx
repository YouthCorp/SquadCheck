import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { LEAGUE_NAMES, CURRENT_SEASON } from '@/lib/constants';
import type { Fixture, Standing } from '@/lib/types';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: { leagueId: string };
}): Promise<Metadata> {
  const leagueId = parseInt(params.leagueId);
  const leagueName = LEAGUE_NAMES[leagueId] ?? `League ${leagueId}`;
  const title = `${leagueName} Fixtures & Results`;
  const description = `${leagueName} upcoming fixtures and past results. Injury impact analysis and predicted lineups before every match.`;
  return {
    title,
    description,
    openGraph: { title: `${title} | SquadCheck`, description },
    alternates: { canonical: `/league/${leagueId}/fixtures` },
  };
}

import {
  parseRoundNumberForSort,
  formatRoundLabel,
  formatRoundPill,
  isKnockoutRound,
} from '@/lib/format';
import { ClientMatchDate } from '@/components/client-date';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { FixtureTabSwitcher } from './fixture-tab-switcher';

/* ── Tie type (for knockout grouping) ───────────────────────────────────── */
interface Tie {
  key: string;
  team1: { id: number; name: string; logo: string | null };
  team2: { id: number; name: string; logo: string | null };
  legs: Fixture[];
}

function groupIntoTies(fixtures: Fixture[]): Tie[] {
  const map = new Map<string, Tie>();
  const byDate = [...fixtures].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  for (const fix of byDate) {
    const ids = [fix.homeTeam.id, fix.awayTeam.id].sort((a, b) => a - b);
    const key = ids.join('-');
    if (!map.has(key)) {
      map.set(key, { key, team1: fix.homeTeam, team2: fix.awayTeam, legs: [] });
    }
    map.get(key)!.legs.push(fix);
  }
  return Array.from(map.values());
}

export default async function FixturesPage({
  params,
  searchParams,
}: {
  params: { leagueId: string };
  searchParams: { round?: string; tab?: string };
}) {
  const leagueId = parseInt(params.leagueId);
  const locale = getLocale();
  const isResults = searchParams.tab === 'results';

  let fixtures: Fixture[] = [];
  let rankMap: Record<number, number> = {};
  try {
    const endpoint = isResults
      ? `/api/fixtures/results?league=${leagueId}&season=${CURRENT_SEASON}`
      : `/api/fixtures/upcoming?league=${leagueId}&all=true`;

    const [fixtureData, standing] = await Promise.all([
      fetchApi<Fixture[]>(endpoint),
      fetchApi<Standing>(`/api/standings?league=${leagueId}&season=${CURRENT_SEASON}`).catch(() => null),
    ]);
    fixtures = fixtureData;
    if (standing) {
      for (const e of standing.entries) rankMap[e.team.id] = e.rank;
    }
  } catch {}

  const roundMap = new Map<string, Fixture[]>();
  for (const fix of fixtures) {
    const key = fix.round ?? 'Unknown';
    if (!roundMap.has(key)) roundMap.set(key, []);
    roundMap.get(key)!.push(fix);
  }
  const sortedRounds = Array.from(roundMap.entries()).sort(([a], [b]) => {
    const diff = parseRoundNumberForSort(a) - parseRoundNumberForSort(b);
    return isResults ? -diff : diff;
  });

  const leagueName = LEAGUE_NAMES[leagueId] ?? `League ${leagueId}`;
  const baseUrl = `/league/${leagueId}/fixtures`;
  const tabBase = isResults ? `${baseUrl}?tab=results` : baseUrl;

  const requestedRound = searchParams.round ?? null;
  const currentIdx = requestedRound !== null
    ? Math.max(0, sortedRounds.findIndex(([r]) => r === requestedRound))
    : 0;

  const currentEntry = sortedRounds[currentIdx] ?? null;
  const prevRound = currentIdx > 0 ? sortedRounds[currentIdx - 1] : null;
  const nextRound = currentIdx < sortedRounds.length - 1 ? sortedRounds[currentIdx + 1] : null;

  const noDataMsg = isResults ? t(locale, 'no_results') : t(locale, 'no_fixtures');

  function roundHref(round: string) {
    const sep = tabBase.includes('?') ? '&' : '?';
    return `${tabBase}${sep}round=${encodeURIComponent(round)}`;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://squadcheck.xyz';
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: leagueName, item: `${siteUrl}/league/${leagueId}` },
      { '@type': 'ListItem', position: 3, name: 'Fixtures & Results' },
    ],
  };

  return (
    <div className="max-w-[72rem] mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Page header */}
      <div className="mb-6 pb-4 border-b border-border">
        <p className="text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground mb-1">
          <Link href={`/league/${leagueId}`} className="text-muted-foreground no-underline hover:text-foreground transition-colors">
            {leagueName}
          </Link>
          {' / '}
          {t(locale, 'fixtures_title')}
        </p>
        <h1 className="text-3xl font-light text-foreground m-0">
          {t(locale, 'fixtures_title')}
        </h1>
      </div>

      {/* Tab switcher (client component) */}
      <FixtureTabSwitcher
        isResults={isResults}
        baseUrl={baseUrl}
        upcomingLabel={t(locale, 'tab_upcoming')}
        resultsLabel={t(locale, 'tab_results')}
      />

      {sortedRounds.length === 0 || !currentEntry ? (
        <Card className="p-8 text-center text-sm text-muted-foreground items-center justify-center">
          {noDataMsg}
        </Card>
      ) : (
        <>
          {/* Round navigation bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border border-border rounded-lg mb-4">
            {prevRound ? (
              <Link
                href={roundHref(prevRound[0])}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.8125rem] font-medium text-foreground bg-card border border-border rounded no-underline hover:bg-accent transition-colors"
              >
                ← {formatRoundLabel(prevRound[0], locale)}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.8125rem] font-medium text-muted-foreground/50 border border-transparent cursor-default">
                ← {locale === 'ko' ? '이전' : 'Prev'}
              </span>
            )}

            <div className="text-center">
              <div className="text-base font-semibold text-primary">
                {formatRoundLabel(currentEntry[0], locale)}
              </div>
              <div className="text-[0.6875rem] text-muted-foreground mt-0.5">
                {currentEntry[1].length} {locale === 'ko' ? '경기' : 'matches'}
                {' · '}
                {locale === 'ko'
                  ? `${currentIdx + 1} / ${sortedRounds.length}`
                  : `${currentIdx + 1} of ${sortedRounds.length}`}
              </div>
            </div>

            {nextRound ? (
              <Link
                href={roundHref(nextRound[0])}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.8125rem] font-medium text-foreground bg-card border border-border rounded no-underline hover:bg-accent transition-colors"
              >
                {formatRoundLabel(nextRound[0], locale)} →
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.8125rem] font-medium text-muted-foreground/50 border border-transparent cursor-default">
                {locale === 'ko' ? '다음' : 'Next'} →
              </span>
            )}
          </div>

          {/* Knockout tie view or regular card grid */}
          {isKnockoutRound(currentEntry[0]) ? (
            <TiesView
              ties={groupIntoTies(currentEntry[1])}
              leagueId={leagueId}
              locale={locale}
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {currentEntry[1].map((fix: Fixture) => (
                <Link
                  key={fix.id}
                  href={`/league/${leagueId}/fixtures/${fix.id}`}
                  className="no-underline block"
                >
                  {isResults
                    ? <ResultCard fix={fix} rankMap={rankMap} locale={locale} />
                    : <UpcomingCard fix={fix} rankMap={rankMap} locale={locale} />
                  }
                </Link>
              ))}
            </div>
          )}

          {/* Round pills */}
          {sortedRounds.length > 1 && (
            <div className="flex gap-1.5 flex-wrap justify-center mt-6">
              {sortedRounds.map(([round], idx) => {
                const pill = formatRoundPill(round);
                const isActive = idx === currentIdx;
                return (
                  <Link
                    key={round}
                    href={roundHref(round)}
                    className={cn(
                      'inline-flex items-center justify-center min-w-8 h-8 px-1.5 text-[0.6875rem] font-mono border rounded no-underline transition-colors whitespace-nowrap',
                      isActive
                        ? 'font-bold text-white bg-primary border-primary'
                        : 'font-normal text-foreground/70 bg-card border-border hover:bg-accent hover:text-foreground'
                    )}
                  >
                    {pill}
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Knockout ties view ─────────────────────────────────────────────────── */
function TiesView({ ties, leagueId, locale }: { ties: Tie[]; leagueId: number; locale: string }) {
  return (
    <div className="flex flex-col gap-3">
      {ties.map((tie) => (
        <TieCard key={tie.key} tie={tie} leagueId={leagueId} locale={locale} />
      ))}
    </div>
  );
}

function TieCard({ tie, leagueId, locale }: { tie: Tie; leagueId: number; locale: string }) {
  const isTwoLegs = tie.legs.length >= 2;
  const [leg1, leg2] = tie.legs;
  const ko = locale === 'ko';

  let t1Agg: number | null = null;
  let t2Agg: number | null = null;
  if (
    isTwoLegs &&
    leg1.goalsHome !== null && leg1.goalsAway !== null &&
    leg2.goalsHome !== null && leg2.goalsAway !== null
  ) {
    const leg1T1 = leg1.homeTeam.id === tie.team1.id ? leg1.goalsHome : leg1.goalsAway;
    const leg1T2 = leg1.homeTeam.id === tie.team2.id ? leg1.goalsHome : leg1.goalsAway;
    const leg2T1 = leg2.homeTeam.id === tie.team1.id ? leg2.goalsHome : leg2.goalsAway;
    const leg2T2 = leg2.homeTeam.id === tie.team2.id ? leg2.goalsHome : leg2.goalsAway;
    t1Agg = leg1T1 + leg2T1;
    t2Agg = leg1T2 + leg2T2;
  } else if (!isTwoLegs && leg1.goalsHome !== null && leg1.goalsAway !== null) {
    t1Agg = leg1.homeTeam.id === tie.team1.id ? leg1.goalsHome : leg1.goalsAway;
    t2Agg = leg1.homeTeam.id === tie.team2.id ? leg1.goalsHome : leg1.goalsAway;
  }

  const t1Wins = t1Agg !== null && t2Agg !== null && t1Agg > t2Agg;
  const t2Wins = t1Agg !== null && t2Agg !== null && t2Agg > t1Agg;

  return (
    <Card className="p-0 gap-0">
      {/* Tie header */}
      <div className="flex items-center px-4 py-4 gap-3">
        {/* Team 1 */}
        <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
          {tie.team1.logo && (
            <img src={tie.team1.logo} alt="" className={cn('w-10 h-10 object-contain transition-opacity', t2Wins ? 'opacity-40' : '')} />
          )}
          <span className={cn(
            'text-[0.8125rem] font-semibold text-center leading-tight line-clamp-2',
            t2Wins ? 'text-muted-foreground' : 'text-foreground'
          )}>
            {tie.team1.name}
          </span>
        </div>

        {/* Aggregate */}
        <div className="shrink-0 text-center px-2 min-w-20">
          {t1Agg !== null && t2Agg !== null ? (
            <>
              <div className="text-2xl font-bold font-mono text-foreground tracking-wide">
                {t1Agg} — {t2Agg}
              </div>
              {isTwoLegs && (
                <div className="text-[0.5625rem] font-semibold tracking-widest uppercase text-muted-foreground mt-0.5">
                  {ko ? '합산' : 'AGG'}
                </div>
              )}
            </>
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">vs</span>
          )}
        </div>

        {/* Team 2 */}
        <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
          {tie.team2.logo && (
            <img src={tie.team2.logo} alt="" className={cn('w-10 h-10 object-contain transition-opacity', t1Wins ? 'opacity-40' : '')} />
          )}
          <span className={cn(
            'text-[0.8125rem] font-semibold text-center leading-tight line-clamp-2',
            t1Wins ? 'text-muted-foreground' : 'text-foreground'
          )}>
            {tie.team2.name}
          </span>
        </div>
      </div>

      {/* Leg rows */}
      <div className="flex border-t border-border">
        {tie.legs.map((leg, i) => {
          const legScore = leg.goalsHome !== null && leg.goalsAway !== null
            ? `${leg.goalsHome} — ${leg.goalsAway}` : null;
          const statusBadge =
            leg.status === 'AET' ? 'AET' :
            leg.status === 'PEN' ? 'PEN' :
            leg.status !== 'NS' ? 'FT' : null;

          return (
            <Link
              key={leg.id}
              href={`/league/${leagueId}/fixtures/${leg.id}`}
              className={cn(
                'flex-1 no-underline px-3 py-2.5 flex flex-col gap-1 hover:bg-accent transition-colors',
                i < tie.legs.length - 1 ? 'border-r border-border' : ''
              )}
            >
              <div className="text-[0.625rem] font-semibold tracking-widest uppercase text-muted-foreground">
                {isTwoLegs ? (ko ? `${i + 1}차전` : `Leg ${i + 1}`) : (ko ? '경기' : 'Match')}
              </div>
              <div className="text-[0.6875rem] text-foreground/70">
                {leg.homeTeam.name} {ko ? '홈' : '(H)'}
              </div>
              <div className="flex items-center gap-1.5">
                {legScore ? (
                  <span className="text-[0.9375rem] font-bold font-mono text-foreground">{legScore}</span>
                ) : (
                  <span className="text-xs text-foreground/70 font-mono">
                    <ClientMatchDate dateStr={leg.date} locale={locale} />
                  </span>
                )}
                {statusBadge && (
                  <span className="text-[0.5rem] font-semibold tracking-widest uppercase text-muted-foreground">
                    {statusBadge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Upcoming fixture card ───────────────────────────────────────────────── */
function UpcomingCard({
  fix,
  rankMap,
  locale,
}: {
  fix: Fixture;
  rankMap: Record<number, number>;
  locale: string;
}) {
  return (
    <Card className="p-4 gap-3 h-full cursor-pointer hover:bg-accent transition-colors">
      <div className="flex items-center justify-between gap-2">
        <TeamBlock name={fix.homeTeam.name} logo={fix.homeTeam.logo} />
        <div className="flex flex-col items-center gap-1 shrink-0 px-1">
          <span className="text-xs font-semibold text-muted-foreground tracking-wide">vs</span>
          {rankMap[fix.homeTeam.id] && rankMap[fix.awayTeam.id] && (
            <span className="text-[0.625rem] text-muted-foreground font-mono whitespace-nowrap">
              #{rankMap[fix.homeTeam.id]} · #{rankMap[fix.awayTeam.id]}
            </span>
          )}
        </div>
        <TeamBlock name={fix.awayTeam.name} logo={fix.awayTeam.logo} />
      </div>
      <div className="border-t border-border pt-2.5">
        <div className="text-xs text-foreground/70 font-mono">
          <ClientMatchDate dateStr={fix.date} locale={locale} />
        </div>
        {fix.venueName && (
          <div className="text-[0.6875rem] text-muted-foreground mt-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {fix.venueName}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ── Result card ─────────────────────────────────────────────────────────── */
function ResultCard({
  fix,
  rankMap,
  locale,
}: {
  fix: Fixture;
  rankMap: Record<number, number>;
  locale: string;
}) {
  const homeGoals = fix.goalsHome ?? 0;
  const awayGoals = fix.goalsAway ?? 0;
  const homeWon = homeGoals > awayGoals;
  const awayWon = awayGoals > homeGoals;
  const statusLabel = fix.status === 'AET' ? 'AET' : fix.status === 'PEN' ? 'PEN' : 'FT';

  return (
    <Card className="p-4 gap-3 h-full cursor-pointer hover:bg-accent transition-colors">
      <div className="flex items-center justify-between gap-2">
        <TeamBlock name={fix.homeTeam.name} logo={fix.homeTeam.logo} dimmed={awayWon} />
        <div className="flex flex-col items-center gap-1 shrink-0 px-1">
          <span className="text-xl font-bold text-foreground font-mono tracking-wide">
            {homeGoals} — {awayGoals}
          </span>
          <span className="text-[0.5625rem] font-semibold text-muted-foreground tracking-widest uppercase">
            {statusLabel}
          </span>
          {rankMap[fix.homeTeam.id] && rankMap[fix.awayTeam.id] && (
            <span className="text-[0.625rem] text-muted-foreground font-mono whitespace-nowrap">
              #{rankMap[fix.homeTeam.id]} · #{rankMap[fix.awayTeam.id]}
            </span>
          )}
        </div>
        <TeamBlock name={fix.awayTeam.name} logo={fix.awayTeam.logo} dimmed={homeWon} />
      </div>
      <div className="border-t border-border pt-2.5">
        <div className="text-xs text-foreground/70 font-mono">
          <ClientMatchDate dateStr={fix.date} locale={locale} />
        </div>
        {fix.venueName && (
          <div className="text-[0.6875rem] text-muted-foreground mt-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {fix.venueName}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ── Shared team block ───────────────────────────────────────────────────── */
function TeamBlock({ name, logo, dimmed = false }: { name: string; logo: string | null; dimmed?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      {logo && (
        <img src={logo} alt="" className={cn('w-9 h-9 object-contain transition-opacity', dimmed ? 'opacity-40' : '')} />
      )}
      <span className={cn(
        'text-[0.8125rem] font-semibold text-center leading-tight line-clamp-2',
        dimmed ? 'text-muted-foreground' : 'text-foreground'
      )}>
        {name}
      </span>
    </div>
  );
}
