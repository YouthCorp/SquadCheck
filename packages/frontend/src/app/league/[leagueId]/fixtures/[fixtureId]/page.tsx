import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { t, type Locale } from '@/lib/i18n';
import { LEAGUE_NAMES, CURRENT_SEASON } from '@/lib/constants';
import type {
  FixtureDetail,
  FixtureTeamStats,
  FixtureTeamLineup,
  FixtureEvent,
  InjuryImpact,
  PredictedLineup,
  Standing,
} from '@/lib/types';
import { formatRoundLabel, parseRoundNumber } from '@/lib/format';
import { ClientMatchDateTime } from '@/components/client-date';
import { InjuredPlayerCard } from '@/components/injured-player-card';
import { PitchLineup } from '@/components/pitch-lineup';

const COMPLETED_STATUSES = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);

// ── Shared helpers ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ padding: '0.75rem 1rem', background: 'var(--cds-layer-02, #393939)', marginBottom: '1rem' }}>
      <span className="sc-label">{label}</span>
    </div>
  );
}

// ── UPCOMING: Injury column ───────────────────────────────────────────────────

function InjuryColumn({ impact, locale }: { impact: InjuryImpact | null; locale: Locale }) {
  const team = impact?.team;
  const highImpact = impact?.injuredPlayers.filter((p) => p.severity === 'critical' || p.severity === 'high') ?? [];
  const otherInjured = impact?.injuredPlayers.filter((p) => p.severity === 'moderate' || p.severity === 'low') ?? [];
  const totalOut = impact?.injuredPlayers.length ?? 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', background: 'var(--cds-layer-02, #393939)', marginBottom: '1px' }}>
        {team?.logo && <img src={team.logo} alt="" style={{ width: '1.75rem', height: '1.75rem', objectFit: 'contain', flexShrink: 0 }} />}
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cds-text-primary, #f4f4f4)' }}>{team?.name ?? '—'}</span>
      </div>

      {impact && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--cds-border-subtle-01, #393939)', marginBottom: '1px' }}>
          <div style={{ background: 'var(--cds-layer-01, #262626)', padding: '0.875rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 300, color: impact.powerLossPct >= 15 ? 'var(--sc-red)' : impact.powerLossPct >= 8 ? 'var(--sc-orange)' : 'var(--cds-text-primary, #f4f4f4)', fontFamily: 'var(--font-plex-mono, monospace)' }}>
              {impact.powerLossPct.toFixed(1)}%
            </div>
            <div className="sc-label" style={{ marginTop: '0.25rem' }}>{t(locale, 'power_loss')}</div>
          </div>
          <div style={{ background: 'var(--cds-layer-01, #262626)', padding: '0.875rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 300, color: totalOut >= 4 ? 'var(--sc-red)' : totalOut >= 2 ? 'var(--sc-orange)' : 'var(--cds-text-secondary, #c6c6c6)', fontFamily: 'var(--font-plex-mono, monospace)' }}>
              {totalOut}
            </div>
            <div className="sc-label" style={{ marginTop: '0.25rem' }}>{t(locale, 'players_out')}</div>
          </div>
        </div>
      )}

      {impact && totalOut === 0 && (
        <div style={{ padding: '1.5rem 1rem', background: 'var(--cds-layer-01, #262626)', color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.875rem', textAlign: 'center' }}>
          {t(locale, 'no_injuries')}
        </div>
      )}

      {highImpact.length > 0 && (
        <div>
          <div style={{ padding: '0.5rem 1rem', background: 'var(--cds-layer-02, #393939)', marginBottom: '1px' }}>
            <span className="sc-label" style={{ color: '#ff8389' }}>{t(locale, 'key_absences')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--cds-border-subtle-01, #393939)', marginBottom: '1px' }}>
            {highImpact.map((ip) => <InjuredPlayerCard key={ip.player.id} ip={ip} locale={locale} variant="fixture" severity="high" />)}
          </div>
        </div>
      )}

      {otherInjured.length > 0 && (
        <div>
          <div style={{ padding: '0.5rem 1rem', background: 'var(--cds-layer-02, #393939)', marginBottom: '1px' }}>
            <span className="sc-label">{t(locale, 'other_injuries')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--cds-border-subtle-01, #393939)' }}>
            {otherInjured.map((ip) => <InjuredPlayerCard key={ip.player.id} ip={ip} locale={locale} variant="fixture" severity="other" />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── UPCOMING: Predicted lineup column ────────────────────────────────────────

function PredictedLineupColumn({ lineup, locale }: { lineup: PredictedLineup | null; locale: Locale }) {
  if (!lineup) {
    return (
      <div style={{ background: 'var(--cds-layer-01, #262626)', padding: '2rem 1rem', textAlign: 'center', color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.875rem' }}>
        {t(locale, 'lineup_no_data')}
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', background: 'var(--cds-layer-02, #393939)', marginBottom: '1px' }}>
        {lineup.teamLogo && <img src={lineup.teamLogo} alt="" style={{ width: '1.75rem', height: '1.75rem', objectFit: 'contain', flexShrink: 0 }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cds-text-primary, #f4f4f4)' }}>{lineup.teamName}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.125rem' }}>
            <span className="sc-label">{t(locale, 'lineup_formation')}: {lineup.formation}</span>
            {lineup.formationSource === 'default' && (
              <span style={{ fontSize: '0.625rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>({t(locale, 'lineup_default_formation')})</span>
            )}
          </div>
        </div>
      </div>
      <div style={{ padding: '0.5rem', background: 'var(--cds-layer-01, #262626)' }}>
        <PitchLineup lineup={lineup} />
      </div>
    </div>
  );
}

// ── RESULT: Match events ──────────────────────────────────────────────────────

function eventIcon(type: string, detail: string | null): string {
  if (type === 'Goal') return '⚽';
  if (type === 'Card') return detail?.toLowerCase().includes('red') ? '🟥' : '🟨';
  if (type === 'subst') return '🔄';
  if (type === 'Var') return '📺';
  return '•';
}

// ── RESULT: Compact horizontal timeline ──────────────────────────────────────

function CompactTimeline({ events, homeTeamId }: { events: FixtureEvent[]; homeTeamId: number }) {
  const relevant = events.filter((ev) => ['Goal', 'Card', 'subst'].includes(ev.type));
  if (relevant.length === 0) return null;

  const icon = (ev: FixtureEvent) => {
    if (ev.type === 'Goal') return '⚽';
    if (ev.type === 'Card') return ev.detail?.toLowerCase().includes('red') ? '🟥' : '🟨';
    return '🔄';
  };

  return (
    <div style={{ background: 'var(--cds-layer-01, #262626)', padding: '0.5rem 1rem 0.375rem' }}>
      <div style={{ fontSize: '0.4375rem', color: 'var(--cds-text-helper, #8d8d8d)', letterSpacing: '0.08em', marginBottom: '0.125rem' }}>HOME</div>
      <div style={{ position: 'relative', height: '3.75rem' }}>
        {/* Center line */}
        <div style={{ position: 'absolute', top: '50%', left: 0, right: '2rem', height: '1px', background: 'var(--cds-border-subtle-01, #393939)' }} />
        {/* HT tick */}
        <div style={{ position: 'absolute', left: `${(45 / 95) * 92}%`, top: 'calc(50% - 3px)', height: '6px', width: '1px', background: '#6f6f6f' }} />
        {/* 90' label */}
        <span style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', fontSize: '0.5rem', color: 'var(--cds-text-helper, #8d8d8d)', fontFamily: 'var(--font-plex-mono, monospace)' }}>90'</span>

        {relevant.map((ev) => {
          const isHome = ev.teamId === homeTeamId;
          const mins = ev.timeElapsed + (ev.timeExtra ?? 0);
          const pct = Math.min(Math.max((mins / 95) * 92, 1), 91);
          const ic = icon(ev);
          const label = ev.timeExtra ? `${ev.timeElapsed}+${ev.timeExtra}'` : `${ev.timeElapsed}'`;

          return (
            <div key={ev.id} style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translateX(-50%)' }}>
              {/* Dot on line */}
              <div style={{
                position: 'absolute', top: 0, left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '5px', height: '5px', borderRadius: '50%',
                background: ev.type === 'Goal' ? 'var(--cds-interactive, #4589ff)' : '#6f6f6f',
              }} />
              {/* Icon + time: above line for home, below for away */}
              <div style={{
                position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                ...(isHome ? { bottom: '6px' } : { top: '6px' }),
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
              }}>
                <span style={{ fontSize: '0.75rem', lineHeight: 1 }}>{ic}</span>
                <span style={{ fontSize: '0.4375rem', color: 'var(--cds-text-helper, #8d8d8d)', fontFamily: 'var(--font-plex-mono, monospace)', whiteSpace: 'nowrap' }}>{label}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: '0.4375rem', color: 'var(--cds-text-helper, #8d8d8d)', letterSpacing: '0.08em', marginTop: '0.125rem' }}>AWAY</div>
    </div>
  );
}

function MatchEvents({ events, homeTeamId, locale }: { events: FixtureEvent[]; homeTeamId: number; locale: Locale }) {
  if (!events.length) {
    return (
      <div style={{ padding: '2rem', background: 'var(--cds-layer-01, #262626)', color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.875rem', textAlign: 'center' }}>
        {t(locale, 'no_match_events')}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--cds-border-subtle-01, #393939)' }}>
      {events.map((ev) => {
        const isHome = ev.teamId === homeTeamId;
        const time = ev.timeExtra ? `${ev.timeElapsed}+${ev.timeExtra}'` : `${ev.timeElapsed}'`;
        const icon = eventIcon(ev.type, ev.detail);
        const isGoal = ev.type === 'Goal';
        const isSub = ev.type === 'subst';

        const playerBlock = (
          <span style={{ fontSize: '0.8125rem', color: isGoal ? 'var(--cds-text-primary, #f4f4f4)' : 'var(--cds-text-secondary, #c6c6c6)', fontWeight: isGoal ? 600 : 400 }}>
            {ev.player?.name ?? ''}
            {isSub && ev.assist && (
              <span style={{ fontSize: '0.6875rem', color: 'var(--cds-text-helper, #8d8d8d)', display: 'block' }}>↑ {ev.assist.name}</span>
            )}
            {isGoal && ev.assist && (
              <span style={{ fontSize: '0.6875rem', color: 'var(--cds-text-helper, #8d8d8d)', display: 'block' }}>{ev.assist.name}</span>
            )}
          </span>
        );

        return (
          <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '1fr 3.5rem 1fr', alignItems: 'center', background: 'var(--cds-layer-01, #262626)', padding: '0.5rem 1rem', minHeight: '2.5rem' }}>
            <div style={{ textAlign: 'right', paddingRight: '0.75rem' }}>{isHome && playerBlock}</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem' }}>
              <span style={{ fontSize: '0.625rem', color: 'var(--cds-text-helper, #8d8d8d)', fontFamily: 'var(--font-plex-mono, monospace)' }}>{time}</span>
              <span style={{ fontSize: '0.875rem' }}>{icon}</span>
            </div>
            <div style={{ textAlign: 'left', paddingLeft: '0.75rem' }}>{!isHome && playerBlock}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── RESULT: Actual lineup column ──────────────────────────────────────────────

function ActualLineupColumn({ lineup, events, locale }: { lineup: FixtureTeamLineup; events: FixtureEvent[]; locale: Locale }) {
  const starters = lineup.players.filter((p) => p.isStarting);
  const bench = lineup.players.filter((p) => !p.isStarting);

  // For sub type: player = came OFF, assist = came ON
  const teamSubs = events.filter((ev) => ev.type === 'subst' && ev.teamId === lineup.team.id);
  const subOutIds = new Set(teamSubs.map((ev) => ev.player?.id).filter((id): id is number => id !== undefined));
  const subInIds = new Set(teamSubs.map((ev) => ev.assist?.id).filter((id): id is number => id !== undefined));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', background: 'var(--cds-layer-02, #393939)', marginBottom: '1px' }}>
        {lineup.team.logo && <img src={lineup.team.logo} alt="" style={{ width: '1.75rem', height: '1.75rem', objectFit: 'contain', flexShrink: 0 }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cds-text-primary, #f4f4f4)' }}>{lineup.team.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)', marginTop: '0.125rem' }}>
            {lineup.formation && <span>{lineup.formation}</span>}
            {lineup.coachName && <span style={{ marginLeft: lineup.formation ? '0.5rem' : 0 }}>{t(locale, 'coach')}: {lineup.coachName}</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--cds-border-subtle-01, #393939)', marginBottom: '1px' }}>
        {starters.map((p) => (
          <div key={p.player.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 1rem', background: 'var(--cds-layer-01, #262626)' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--cds-text-helper, #8d8d8d)', fontFamily: 'var(--font-plex-mono, monospace)', minWidth: '1.25rem', textAlign: 'right', flexShrink: 0 }}>{p.number ?? ''}</span>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--cds-tag-color-gray, #8d8d8d)', minWidth: '2rem', flexShrink: 0 }}>{p.position ?? ''}</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--cds-text-primary, #f4f4f4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.playerName}</span>
            {subOutIds.has(p.player.id) && (
              <span style={{ fontSize: '0.875rem', color: '#fa4d56', flexShrink: 0, lineHeight: 1 }}>↓</span>
            )}
          </div>
        ))}
      </div>

      {bench.length > 0 && (
        <>
          <div style={{ padding: '0.375rem 1rem', background: 'var(--cds-layer-02, #393939)', marginBottom: '1px' }}>
            <span className="sc-label">{t(locale, 'bench')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--cds-border-subtle-01, #393939)' }}>
            {bench.map((p) => (
              <div key={p.player.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.375rem 1rem', background: 'var(--cds-layer-01, #262626)' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--cds-text-helper, #8d8d8d)', fontFamily: 'var(--font-plex-mono, monospace)', minWidth: '1.25rem', textAlign: 'right', flexShrink: 0 }}>{p.number ?? ''}</span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--cds-tag-color-gray, #8d8d8d)', minWidth: '2rem', flexShrink: 0 }}>{p.position ?? ''}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary, #c6c6c6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.playerName}</span>
                {subInIds.has(p.player.id) && (
                  <span style={{ fontSize: '0.875rem', color: '#42be65', flexShrink: 0, lineHeight: 1 }}>↑</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── RESULT: Statistics comparison ─────────────────────────────────────────────

function StatRow({ label, homeVal, awayVal, format = 'number' }: { label: string; homeVal: number | null | undefined; awayVal: number | null | undefined; format?: 'number' | 'pct' | 'decimal' }) {
  const h = homeVal ?? 0;
  const a = awayVal ?? 0;
  const total = h + a || 1;
  const fmt = (v: number) => format === 'pct' ? `${v}%` : format === 'decimal' ? v.toFixed(2) : String(v);

  const homeBarColor = h >= a ? 'var(--cds-interactive, #4589ff)' : '#525252';
  const awayBarColor = a >= h ? 'var(--cds-interactive, #4589ff)' : '#525252';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '3rem 1fr 5rem 1fr 3rem', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', background: 'var(--cds-layer-01, #262626)', borderBottom: '1px solid var(--cds-border-subtle-01, #393939)' }}>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cds-text-primary, #f4f4f4)', textAlign: 'right', fontFamily: 'var(--font-plex-mono, monospace)' }}>{fmt(h)}</span>
      <div style={{ height: '0.375rem', background: 'var(--cds-layer-02, #393939)', borderRadius: '2px', overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: `${(h / total) * 100}%`, height: '0.375rem', background: homeBarColor, borderRadius: '2px' }} />
      </div>
      <span style={{ fontSize: '0.6875rem', color: 'var(--cds-text-helper, #8d8d8d)', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
      <div style={{ height: '0.375rem', background: 'var(--cds-layer-02, #393939)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${(a / total) * 100}%`, height: '0.375rem', background: awayBarColor, borderRadius: '2px' }} />
      </div>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cds-text-primary, #f4f4f4)', fontFamily: 'var(--font-plex-mono, monospace)' }}>{fmt(a)}</span>
    </div>
  );
}

function Statistics({ stats, homeTeamId, locale }: { stats: FixtureTeamStats[]; homeTeamId: number; locale: Locale }) {
  if (!stats.length) {
    return (
      <div style={{ padding: '2rem', background: 'var(--cds-layer-01, #262626)', color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.875rem', textAlign: 'center' }}>
        {t(locale, 'no_statistics')}
      </div>
    );
  }
  const home = stats.find((s) => s.team.id === homeTeamId) ?? stats[0];
  const away = stats.find((s) => s.team.id !== homeTeamId) ?? stats[1];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 5rem 1fr', padding: '0.5rem 1rem', background: 'var(--cds-layer-02, #393939)', marginBottom: '1px', borderBottom: '1px solid var(--cds-border-subtle-01, #393939)' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cds-text-primary, #f4f4f4)' }}>{home?.team.name}</span>
        <span />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cds-text-primary, #f4f4f4)', textAlign: 'right' }}>{away?.team.name}</span>
      </div>
      <StatRow label={t(locale, 'stat_possession')} homeVal={home?.possession} awayVal={away?.possession} format="pct" />
      <StatRow label={t(locale, 'stat_shots')} homeVal={home?.totalShots} awayVal={away?.totalShots} />
      <StatRow label={t(locale, 'stat_on_target')} homeVal={home?.shotsOnGoal} awayVal={away?.shotsOnGoal} />
      <StatRow label={t(locale, 'stat_xg')} homeVal={home?.expectedGoals ?? undefined} awayVal={away?.expectedGoals ?? undefined} format="decimal" />
      <StatRow label={t(locale, 'stat_corners')} homeVal={home?.cornerKicks} awayVal={away?.cornerKicks} />
      <StatRow label={t(locale, 'stat_fouls')} homeVal={home?.fouls} awayVal={away?.fouls} />
      <StatRow label={t(locale, 'stat_offsides')} homeVal={home?.offsides} awayVal={away?.offsides} />
      <StatRow label={t(locale, 'stat_saves')} homeVal={home?.goalkeeperSaves} awayVal={away?.goalkeeperSaves} />
      <StatRow label={t(locale, 'stat_pass_pct')} homeVal={home?.passPercent ?? undefined} awayVal={away?.passPercent ?? undefined} format="pct" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FixtureDetailPage({
  params,
}: {
  params: { leagueId: string; fixtureId: string };
}) {
  const leagueId = parseInt(params.leagueId);
  const fixtureId = parseInt(params.fixtureId);
  const locale = getLocale();
  const leagueName = LEAGUE_NAMES[leagueId] ?? `League ${leagueId}`;
  const fixturesBase = `/league/${leagueId}/fixtures`;

  let fixture: FixtureDetail | null = null;
  let rankMap: Record<number, number> = {};

  try {
    const [f, standing] = await Promise.all([
      fetchApi<FixtureDetail>(`/api/fixtures/${fixtureId}`),
      fetchApi<Standing>(`/api/standings?league=${leagueId}&season=${CURRENT_SEASON}`).catch(() => null),
    ]);
    fixture = f;
    if (standing) {
      for (const e of standing.entries) rankMap[e.team.id] = e.rank;
    }
  } catch {}

  if (!fixture) {
    return (
      <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
        <div style={{ background: 'var(--cds-layer-01, #262626)', border: '1px solid var(--cds-border-subtle-01, #393939)', padding: '2rem', color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.875rem' }}>
          Match not found.
        </div>
      </div>
    );
  }

  const isCompleted = COMPLETED_STATUSES.has(fixture.status);
  const roundNum = parseRoundNumber(fixture.round);
  const backUrl = isCompleted
    ? `${fixturesBase}?tab=results${roundNum !== null ? `&round=${roundNum}` : ''}`
    : roundNum !== null ? `${fixturesBase}?round=${roundNum}` : fixturesBase;

  // ── Upcoming: fetch injury + lineup data ──────────────────────────────────
  let homeImpact: InjuryImpact | null = null;
  let awayImpact: InjuryImpact | null = null;
  let homeLineup: PredictedLineup | null = null;
  let awayLineup: PredictedLineup | null = null;

  if (!isCompleted) {
    try {
      const [hi, ai, hl, al] = await Promise.all([
        fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${fixture.homeTeam.id}`),
        fetchApi<InjuryImpact>(`/api/analysis/injury-impact/${fixture.awayTeam.id}`),
        fetchApi<PredictedLineup>(`/api/analysis/predicted-lineup/${fixture.homeTeam.id}`).catch(() => null),
        fetchApi<PredictedLineup>(`/api/analysis/predicted-lineup/${fixture.awayTeam.id}`).catch(() => null),
      ]);
      homeImpact = hi; awayImpact = ai; homeLineup = hl; awayLineup = al;
    } catch {}
  }

  const statusLabel = fixture.status === 'AET' ? 'AET' : fixture.status === 'PEN' ? 'PEN' : 'FT';
  const homeGoals = fixture.goalsHome ?? 0;
  const awayGoals = fixture.goalsAway ?? 0;
  const homeWon = homeGoals > awayGoals;
  const awayWon = awayGoals > homeGoals;

  const homeActualLineup = fixture.lineups.find((l) => l.team.id === fixture!.homeTeam.id) ?? null;
  const awayActualLineup = fixture.lineups.find((l) => l.team.id === fixture!.awayTeam.id) ?? null;

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
      {/* Back button */}
      <Link
        href={backUrl}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--cds-text-helper, #8d8d8d)', textDecoration: 'none', marginBottom: '1rem' }}
      >
        ← {t(locale, isCompleted ? 'tab_results' : 'fixtures_title')}
      </Link>

      {/* Breadcrumb & Header */}
      <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--cds-border-subtle-01, #393939)' }}>
        <p className="sc-label">
          <Link href={`/league/${leagueId}`} style={{ color: 'var(--cds-text-helper, #8d8d8d)', textDecoration: 'none' }}>{leagueName}</Link>
          {' / '}
          <Link href={backUrl} style={{ color: 'var(--cds-text-helper, #8d8d8d)', textDecoration: 'none' }}>
            {t(locale, 'fixtures_title')}
          </Link>
          {' / '}
          {t(locale, isCompleted ? 'result_detail' : 'match_detail')}
        </p>

        {/* Match title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
          {/* Home team */}
          <Link href={`/team/${fixture.homeTeam.id}?league=${leagueId}`} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: 1, minWidth: 0, textDecoration: 'none' }}>
            {fixture.homeTeam.logo && (
              <img src={fixture.homeTeam.logo} alt="" style={{ width: '2.5rem', height: '2.5rem', objectFit: 'contain', flexShrink: 0, opacity: isCompleted && awayWon ? 0.5 : 1 }} />
            )}
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: isCompleted && awayWon ? 'var(--cds-text-helper, #8d8d8d)' : 'var(--cds-text-primary, #f4f4f4)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fixture.homeTeam.name}
              </h1>
              {rankMap[fixture.homeTeam.id] && (
                <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)', fontFamily: 'var(--font-plex-mono, monospace)' }}>
                  #{rankMap[fixture.homeTeam.id]}
                </span>
              )}
            </div>
          </Link>

          {/* Center: score (completed) or vs (upcoming) */}
          {isCompleted ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--cds-text-primary, #f4f4f4)', fontFamily: 'var(--font-plex-mono, monospace)' }}>{homeGoals}</span>
                <span style={{ fontSize: '1.25rem', color: 'var(--cds-text-helper, #8d8d8d)', fontWeight: 300 }}>—</span>
                <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--cds-text-primary, #f4f4f4)', fontFamily: 'var(--font-plex-mono, monospace)' }}>{awayGoals}</span>
              </div>
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--cds-text-helper, #8d8d8d)', letterSpacing: '0.08em' }}>{statusLabel}</span>
            </div>
          ) : (
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--cds-text-helper, #8d8d8d)', flexShrink: 0, letterSpacing: '1px' }}>vs</div>
          )}

          {/* Away team */}
          <Link href={`/team/${fixture.awayTeam.id}?league=${leagueId}`} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: 1, justifyContent: 'flex-end', minWidth: 0, textDecoration: 'none' }}>
            <div style={{ minWidth: 0, textAlign: 'right' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: isCompleted && homeWon ? 'var(--cds-text-helper, #8d8d8d)' : 'var(--cds-text-primary, #f4f4f4)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fixture.awayTeam.name}
              </h1>
              {rankMap[fixture.awayTeam.id] && (
                <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)', fontFamily: 'var(--font-plex-mono, monospace)' }}>
                  #{rankMap[fixture.awayTeam.id]}
                </span>
              )}
            </div>
            {fixture.awayTeam.logo && (
              <img src={fixture.awayTeam.logo} alt="" style={{ width: '2.5rem', height: '2.5rem', objectFit: 'contain', flexShrink: 0, opacity: isCompleted && homeWon ? 0.5 : 1 }} />
            )}
          </Link>
        </div>

        {/* Match meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.625rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--cds-interactive, #4589ff)', fontWeight: 600 }}>
            {formatRoundLabel(fixture.round, locale)}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary, #c6c6c6)', fontFamily: 'var(--font-plex-mono, monospace)' }}>
            <ClientMatchDateTime dateStr={fixture.date} locale={locale} />
          </span>
          {fixture.venueName && (
            <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>
              {fixture.venueName}{fixture.venueCity ? `, ${fixture.venueCity}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── COMPLETED: Result view ─────────────────────────────────────────── */}
      {isCompleted && (
        <>
          <div style={{ marginBottom: '2rem' }}>
            <SectionHeader label={t(locale, 'match_events')} />
            {fixture.events.length > 0 ? (
              <>
                <CompactTimeline events={fixture.events} homeTeamId={fixture.homeTeam.id} />
                <details>
                  <summary style={{
                    cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.375rem 1rem', background: 'var(--cds-layer-01, #262626)',
                    borderTop: '1px solid var(--cds-border-subtle-01, #393939)',
                    fontSize: '0.6875rem', color: 'var(--cds-text-helper, #8d8d8d)', userSelect: 'none',
                  }}>
                    ▾ {t(locale, 'events_show_all')}
                  </summary>
                  <MatchEvents events={fixture.events} homeTeamId={fixture.homeTeam.id} locale={locale} />
                </details>
              </>
            ) : (
              <div style={{ padding: '2rem', background: 'var(--cds-layer-01, #262626)', color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.875rem', textAlign: 'center' }}>
                {t(locale, 'no_match_events')}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <SectionHeader label={t(locale, 'actual_lineups')} />
            {homeActualLineup || awayActualLineup ? (
              <div className="sc-grid-2col">
                {homeActualLineup
                  ? <ActualLineupColumn lineup={homeActualLineup} events={fixture.events} locale={locale} />
                  : <div style={{ padding: '2rem', background: 'var(--cds-layer-01, #262626)', color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.875rem', textAlign: 'center' }}>{t(locale, 'no_lineups')}</div>
                }
                {awayActualLineup
                  ? <ActualLineupColumn lineup={awayActualLineup} events={fixture.events} locale={locale} />
                  : <div style={{ padding: '2rem', background: 'var(--cds-layer-01, #262626)', color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.875rem', textAlign: 'center' }}>{t(locale, 'no_lineups')}</div>
                }
              </div>
            ) : (
              <div style={{ padding: '2rem', background: 'var(--cds-layer-01, #262626)', color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.875rem', textAlign: 'center' }}>{t(locale, 'no_lineups')}</div>
            )}
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <SectionHeader label={t(locale, 'statistics')} />
            <Statistics stats={fixture.statistics} homeTeamId={fixture.homeTeam.id} locale={locale} />
          </div>
        </>
      )}

      {/* ── UPCOMING: Injury + Predicted lineup view ───────────────────────── */}
      {!isCompleted && (
        <>
          <div style={{ marginBottom: '2rem' }}>
            <SectionHeader label={t(locale, 'injury_comparison')} />
            <div className="sc-grid-2col">
              <InjuryColumn impact={homeImpact} locale={locale} />
              <InjuryColumn impact={awayImpact} locale={locale} />
            </div>
          </div>

          <div>
            <SectionHeader label={t(locale, 'predicted_lineups')} />
            <div className="sc-grid-2col">
              <PredictedLineupColumn lineup={homeLineup} locale={locale} />
              <PredictedLineupColumn lineup={awayLineup} locale={locale} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
