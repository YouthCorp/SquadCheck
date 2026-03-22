import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { t, tPos } from '@/lib/i18n';
import { LEAGUE_NAMES } from '@/lib/constants';
import type { Team, InjuryImpact } from '@/lib/types';
import { InjuredPlayerCard } from '@/components/injured-player-card';
import { OutcomeImpactCard } from '@/components/outcome-impact-card';
import { PowerLossGauge } from '@/components/power-loss-gauge';
import { SectionHeader } from '@/components/section-header';
import { StatCard } from '@/components/stat-card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { TeamLogo } from '@/components/team-logo';

export async function generateMetadata({
  params,
}: {
  params: { teamId: string };
}): Promise<Metadata> {
  const teamId = parseInt(params.teamId);
  try {
    const impact = await fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${teamId}`);
    const teamName = impact.team.name;
    const count = impact.injuredPlayers.length;
    const powerLoss = impact.powerLossPct.toFixed(1);
    const injuredNames = impact.injuredPlayers.slice(0, 5).map((p) => p.player.name).join(', ');
    const title = `${teamName} Injuries & Squad News 2025/26`;
    const description =
      count > 0
        ? `${teamName}: ${count} player${count !== 1 ? 's' : ''} out (${injuredNames}). Power Loss ${powerLoss}%. Predicted lineup, injury timeline, and recovery signals.`
        : `${teamName}: Full squad available. Predicted lineup and squad analysis for the 2025/26 season.`;
    return {
      title,
      description,
      openGraph: { title: `${title} | SquadCheck`, description },
      alternates: { canonical: `/team/${teamId}` },
      keywords: [
        `${teamName} injuries`,
        `${teamName} injury news`,
        `${teamName} team news`,
        `${teamName} predicted lineup`,
        `${teamName} squad`,
        `${teamName} injury update`,
      ],
    };
  } catch {
    return { title: 'Team Injury Report' };
  }
}

interface PlayerEntry {
  player: { id: number; name: string; photo: string | null; position: string | null; nationality: string | null };
  minutes: number | null; rating: number | null; goalsTotal: number | null; assists: number | null; appearances: number | null;
}

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: { teamId: string };
  searchParams: { league?: string };
}) {
  const teamId = parseInt(params.teamId);
  const locale = getLocale();
  const backLeagueId = searchParams.league ? parseInt(searchParams.league) : null;

  let impact: InjuryImpact | null = null;
  let players: PlayerEntry[] = [];
  try {
    [impact, players] = await Promise.all([
      fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${teamId}${backLeagueId ? `?league=${backLeagueId}` : ''}`),
      fetchApi<PlayerEntry[]>(`/api/teams/${teamId}/players`),
    ]);
  } catch {}

  const team = impact?.team;
  const ss = impact?.severitySummary;
  const highImpact = impact?.injuredPlayers.filter(p => p.severity === 'critical' || p.severity === 'high') ?? [];
  const otherInjured = impact?.injuredPlayers.filter(p => p.severity === 'moderate' || p.severity === 'low') ?? [];

  const latestSignalAt = impact?.injuredPlayers
    .map(p => p.recoverySignal?.lastSignalAt)
    .filter((s): s is string => !!s)
    .sort()
    .at(-1) ?? null;

  const playerLinkSuffix = `?team=${teamId}${backLeagueId ? `&league=${backLeagueId}` : ''}`;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://squadcheck.xyz';
  const leagueName = backLeagueId ? (LEAGUE_NAMES[backLeagueId] ?? null) : null;

  const sportsTeamJsonLd = team ? {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: team.name,
    sport: 'Association Football',
    url: `${siteUrl}/team/${teamId}`,
    ...(team.logo ? { logo: team.logo } : {}),
    ...(leagueName ? {
      memberOf: {
        '@type': 'SportsOrganization',
        name: leagueName,
      },
    } : {}),
  } : null;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      ...(leagueName && backLeagueId ? [
        { '@type': 'ListItem', position: 2, name: leagueName, item: `${siteUrl}/league/${backLeagueId}` },
        { '@type': 'ListItem', position: 3, name: `${team?.name ?? 'Team'} Injury Report` },
      ] : [
        { '@type': 'ListItem', position: 2, name: `${team?.name ?? 'Team'} Injury Report` },
      ]),
    ],
  };

  return (
    <div className="max-w-[72rem] mx-auto">
      {sportsTeamJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsTeamJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Back button */}
      {backLeagueId && (
        <Link
          href={`/league/${backLeagueId}`}
          className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground no-underline hover:text-foreground transition-colors mb-4"
        >
          ← {t(locale, 'nav_standings')}
        </Link>
      )}

      {/* Team header */}
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-border">
        <TeamLogo logo={team?.logo} size="xl" />
        <div>
          <h1 className="text-3xl font-light text-foreground m-0">{team?.name ?? `Team ${teamId}`}</h1>
          {team?.country && (
            <p className="text-xs text-muted-foreground mt-1 tracking-wide m-0">
              {team.country}{team.founded ? ` · ${t(locale, 'founded')} ${team.founded}` : ''}
            </p>
          )}
        </div>
        {impact && (
          <div className="ml-auto">
            <PowerLossGauge value={impact.powerLossPct} size="lg" locale={locale} />
          </div>
        )}
      </div>

      {/* Stat grid */}
      {impact && ss && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard
            label={t(locale, 'players_out')}
            value={impact.injuredPlayers.length}
            severity="neutral"
            subtext={latestSignalAt ? `Signal ${timeAgo(latestSignalAt, locale)}` : undefined}
          />
          {ss.critical + ss.high > 0 && (
            <StatCard label={t(locale, 'key_players')} value={ss.critical + ss.high} severity="critical" />
          )}
          {ss.moderate > 0 && (
            <StatCard label={t(locale, 'moderate')} value={ss.moderate} severity="moderate" />
          )}
          {ss.low > 0 && (
            <StatCard label={t(locale, 'low_impact')} value={ss.low} severity="low" />
          )}
        </div>
      )}

      {/* Outcome Impact */}
      {impact?.outcomeImpact && impact.outcomeImpact.playerRecords.length > 0 && (
        <div className="mb-6">
          <OutcomeImpactCard outcome={impact.outcomeImpact} locale={locale} size="lg" />
        </div>
      )}

      {/* Key injuries */}
      {highImpact.length > 0 && (() => {
        const recordMap = new Map(
          impact?.outcomeImpact?.playerRecords.map(r => [r.playerId, r]) ?? []
        );
        return (
          <div className="mb-6">
            <SectionHeader label={t(locale, 'key_absences')} count={highImpact.length} accent="destructive" />
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {highImpact.map((ip) => (
                <InjuredPlayerCard
                  key={ip.player.id}
                  ip={ip}
                  locale={locale}
                  variant="team"
                  severity="high"
                  playerLinkSuffix={playerLinkSuffix}
                  playerRecord={recordMap.get(ip.player.id)}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Other injuries */}
      {otherInjured.length > 0 && (
        <div className="mb-6">
          <SectionHeader label={t(locale, 'other_injuries')} count={otherInjured.length} />
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {otherInjured.map((ip) => (
              <InjuredPlayerCard
                key={ip.player.id}
                ip={ip}
                locale={locale}
                variant="team"
                severity="other"
                playerLinkSuffix={playerLinkSuffix}
              />
            ))}
          </div>
        </div>
      )}

      {/* Squad table */}
      {players.length > 0 && (
        <div>
          <SectionHeader
            label={t(locale, 'squad')}
            count={players.length}
          />
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse bg-card text-[0.8125rem]">
              <thead>
                <tr className="bg-muted/50">
                  {[
                    { label: t(locale, 'player') },
                    { label: t(locale, 'position') },
                    { label: t(locale, 'app') },
                    { label: t(locale, 'min') },
                    { label: t(locale, 'rating'), tooltip: t(locale, 'tooltip_rating') },
                    { label: t(locale, 'goals') },
                    { label: t(locale, 'assists') },
                  ].map((h, i) => (
                    <th
                      key={h.label}
                      className={cn(
                        'py-2.5 text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground border-b border-border',
                        i === 0 ? 'px-4 text-left' : 'px-3 text-center'
                      )}
                    >
                      <span className={cn('inline-flex items-center gap-1', i !== 0 && 'justify-center w-full')}>
                        {h.label}
                        {h.tooltip && <InfoTooltip content={h.tooltip} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.slice(0, 30).map((p, idx) => (
                  <tr
                    key={p.player.id}
                    className={cn(
                      'border-b border-border hover:bg-accent/50 transition-colors',
                      idx % 2 === 1 ? 'bg-muted/20' : ''
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/player/${p.player.id}${playerLinkSuffix}`}
                        className="no-underline flex items-center gap-2"
                      >
                        <Avatar size="sm">
                          {p.player.photo && <AvatarImage src={p.player.photo} alt="" />}
                          <AvatarFallback>{p.player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-foreground">{p.player.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{tPos(locale, p.player.position)}</td>
                    <td className="px-3 py-2.5 text-center text-foreground/80 font-mono">{p.appearances ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center text-foreground/80 font-mono">{p.minutes ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center font-mono">
                      {p.rating ? (
                        <span className={
                          p.rating >= 7 ? 'text-[var(--sc-green)]' :
                          p.rating >= 6.5 ? 'text-[var(--sc-yellow)]' : 'text-foreground/80'
                        }>{p.rating.toFixed(2)}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center text-foreground/80 font-mono">{p.goalsTotal ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center text-foreground/80 font-mono">{p.assists ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
