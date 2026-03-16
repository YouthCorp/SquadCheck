import Link from 'next/link';
import { t, tPos, tInjury, type Locale } from '@/lib/i18n';
import { SEV_KEY, ROLE_KEY, CTX_KEY, SEV_TAG, LEAGUE_SHORT_NAMES } from '@/lib/constants';
import { isDisciplinaryReason, fmtDate, daysAgo, timeAgo } from '@/lib/format';
import type { InjuredPlayer, PlayerOutcomeRecord } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { cn } from '@/lib/utils';

interface InjuredPlayerCardProps {
  ip: InjuredPlayer;
  locale: Locale;
  /** 'team' = team page layout, 'fixture' = fixture detail InjuryColumn layout */
  variant: 'team' | 'fixture';
  /** 'high' = critical/high severity (detailed card), 'other' = moderate/low (compact card) */
  severity: 'high' | 'other';
  /** Query string appended to /player/{id} link. e.g. "?team=11&league=39" */
  playerLinkSuffix?: string;
  /** Per-player outcome record (W-D-L with/without) from outcomeImpact */
  playerRecord?: PlayerOutcomeRecord;
}

export function InjuredPlayerCard({
  ip,
  locale,
  variant,
  severity,
  playerLinkSuffix = '',
  playerRecord,
}: InjuredPlayerCardProps) {
  const isTeam = variant === 'team';
  const isHigh = severity === 'high';

  const disciplinary = isDisciplinaryReason(ip.injury.reason);
  // Disciplinary: use injury.date (= the fixture they're banned FOR) — no need for last-appearance proxy
  // Injury: use lastAppearanceFixtureDate (most recent lineup appearance) as best injury date proxy
  const triggerDate = disciplinary
    ? ip.injury.date
    : (ip.starterProfile.lastAppearanceFixtureDate ?? ip.starterProfile.lastStartFixtureDate ?? ip.injury.date);
  // Competition label for disciplinary absences (e.g. "UCL" or "PL")
  const suspensionLeague = disciplinary && ip.injury.leagueApiId
    ? LEAGUE_SHORT_NAMES[ip.injury.leagueApiId] ?? null
    : null;
  const triggerDays = daysAgo(triggerDate);
  const isLongTerm =
    !isHigh &&
    (ip.injuryContext.type === 'pre_season_absence' ||
      ip.injuryContext.type === 'extended_absence');

  const recovers = ip.recoverySignal && ip.recoverySignal.confidenceLevel >= 0.5;
  const recoverHigh = recovers && ip.recoverySignal!.predictedAvailability >= 0.7;

  // ── Start/Sub labels ──────────────────────────────────────────────────────
  const startLabel = isTeam && !isHigh ? (locale === 'ko' ? '선발' : 'S') : (locale === 'ko' ? '선발 ' : 'Start ');
  const subLabel   = isTeam && !isHigh ? (locale === 'ko' ? '교체' : 'Sub') : (locale === 'ko' ? '교체 ' : 'Sub ');
  const showMinutes = isTeam && isHigh;

  // ── Avatar sizes ──────────────────────────────────────────────────────────
  const avatarSize: 'sm' | 'default' | 'lg' =
    isTeam && isHigh ? 'lg' : isTeam && !isHigh ? 'default' : isHigh ? 'default' : 'sm';

  // ── Shared sub-elements ───────────────────────────────────────────────────
  const photo = (
    <Avatar size={avatarSize}>
      {ip.player.photo && <AvatarImage src={ip.player.photo} alt="" />}
      <AvatarFallback>{ip.player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );

  const tagsRow = (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Link
        href={`/player/${ip.player.id}${playerLinkSuffix}`}
        className={cn(
          'no-underline text-foreground hover:text-primary transition-colors',
          isHigh ? 'text-sm font-semibold' : 'text-[0.8125rem] font-medium'
        )}
      >
        {ip.player.name}
      </Link>

      <Badge variant={SEV_TAG[ip.severity] ?? 'low'}>
        {t(locale, SEV_KEY[ip.severity] ?? 'severity_low')}
      </Badge>
      <InfoTooltip content={t(locale, 'tooltip_severity')} />

      {isHigh && (
        <>
          <Badge variant="info">
            {t(locale, ROLE_KEY[ip.starterProfile.role] ?? 'role_bench')}
          </Badge>
          <InfoTooltip content={t(locale, 'tooltip_role')} />
        </>
      )}

      {disciplinary && (
        <Badge variant="high">{locale === 'ko' ? '출전 정지' : 'Suspended'}</Badge>
      )}

      {!isHigh && isLongTerm && !disciplinary && (
        <Badge variant="low">
          {t(locale, CTX_KEY[ip.injuryContext.type] ?? 'ctx_mid_season_loss')}
        </Badge>
      )}

      {!isHigh && triggerDays <= 7 && !disciplinary && !isLongTerm && (
        <Badge variant="info">{t(locale, 'new_badge')}</Badge>
      )}

      {recovers && (
        <>
          <Badge
            variant={recoverHigh ? 'success' : 'moderate'}
            title={`${locale === 'ko' ? '복귀 신호' : 'Return signal'}: ${Math.round(ip.recoverySignal!.predictedAvailability * 100)}% ${locale === 'ko' ? '가용성' : 'availability'}${ip.recoverySignal!.latestSignalStage ? ` (${ip.recoverySignal!.latestSignalStage.replace(/_/g, ' ')})` : ''}`}
          >
            {recoverHigh
              ? (locale === 'ko' ? '복귀 임박' : 'Return signal')
              : (locale === 'ko' ? '복귀 중' : 'In recovery')}
            {' '}{Math.round(ip.recoverySignal!.predictedAvailability * 100)}%
            {ip.recoverySignal!.lastSignalAt && (
              <span className="opacity-65 ml-1">· {timeAgo(ip.recoverySignal!.lastSignalAt, locale)}</span>
            )}
          </Badge>
          <InfoTooltip content={t(locale, 'tooltip_recovery_signal')} />
        </>
      )}
    </div>
  );

  const statsRow = (
    <div className={cn('flex mt-1 font-mono', isHigh ? 'gap-3.5' : 'gap-2.5', isTeam ? 'text-[0.6875rem]' : 'text-[0.625rem]')}>
      <span className="text-foreground/80">
        <span className="text-muted-foreground">{startLabel}</span>{ip.starterProfile.starterCount}
      </span>
      <span className="text-foreground/80">
        <span className="text-muted-foreground">{subLabel}</span>{ip.starterProfile.substituteCount}
      </span>
      {ip.stats?.goals != null && (
        <span className="text-foreground/80">
          <span className="text-muted-foreground">{t(locale, 'goals')} </span>{ip.stats.goals}
        </span>
      )}
      {ip.stats?.assists != null && (
        <span className="text-foreground/80">
          <span className="text-muted-foreground">{t(locale, 'assists')} </span>{ip.stats.assists}
        </span>
      )}
      {showMinutes && ip.stats?.minutes != null && (
        <span className="text-muted-foreground">
          {ip.stats.minutes}{locale === 'ko' ? '분' : 'min'}
        </span>
      )}
    </div>
  );

  // ── W-D-L outcome record (only for high severity with playerRecord) ──────
  const outcomeRow = isHigh && playerRecord && (playerRecord.withPlayer.matches > 0 || playerRecord.withoutPlayer.matches > 0) ? (
    <div className={cn('flex flex-col mt-1 font-mono gap-y-0.5', isTeam ? 'text-[0.6875rem]' : 'text-[0.625rem]')}>
      {playerRecord.withPlayer.matches > 0 && (
        <span className="text-foreground/80">
          <span className="text-muted-foreground">{t(locale, 'outcome_with')} </span>
          <span className="text-[var(--sc-green)]">{playerRecord.withPlayer.W}W</span>
          <span>-{playerRecord.withPlayer.D}D-</span>
          <span className="text-[var(--sc-red)]">{playerRecord.withPlayer.L}L</span>
          {playerRecord.withPlayer.xgAvg != null && (
            <span className="text-muted-foreground"> xG {playerRecord.withPlayer.xgAvg.toFixed(2)}</span>
          )}
        </span>
      )}
      {playerRecord.withoutPlayer.matches > 0 && (
        <span className={cn('text-foreground/80', !playerRecord.hasSignificantSample && 'opacity-60')}>
          <span className="text-muted-foreground">{t(locale, 'outcome_without')} </span>
          <span className="text-[var(--sc-green)]">{playerRecord.withoutPlayer.W}W</span>
          <span>-{playerRecord.withoutPlayer.D}D-</span>
          <span className="text-[var(--sc-red)]">{playerRecord.withoutPlayer.L}L</span>
          {playerRecord.withoutPlayer.xgAvg != null && (
            <span className="text-muted-foreground"> xG {playerRecord.withoutPlayer.xgAvg.toFixed(2)}</span>
          )}
          {!playerRecord.hasSignificantSample && (
            <span className="text-muted-foreground ml-1">
              ({t(locale, 'outcome_matches', { n: playerRecord.withoutPlayer.matches })})
            </span>
          )}
        </span>
      )}
      {playerRecord.withoutPlayer.matches === 0 && (
        <span className="text-muted-foreground opacity-60">
          {t(locale, 'outcome_without')} {t(locale, 'outcome_no_data')}
        </span>
      )}
    </div>
  ) : null;

  const infoLine = (full: boolean) => (
    <div className={cn('text-muted-foreground mt-0.5', isTeam ? 'text-xs' : 'text-[0.6875rem]')}>
      {tPos(locale, ip.player.position)}
      {full && <>
        {' · '}{tInjury(locale, ip.injury.reason)}{suspensionLeague && <span className="ml-1 text-[0.65rem] opacity-70">({suspensionLeague})</span>}{' · '}{fmtDate(triggerDate)}
        <span className="ml-1.5 text-[var(--sc-orange)]">{t(locale, 'days_ago', { n: triggerDays })}</span>
      </>}
    </div>
  );

  const cardCls = cn(
    'bg-card border-b border-border',
    isHigh ? (isTeam ? 'px-4 py-3.5' : 'px-4 py-3') : 'px-4 py-2.5'
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TEAM + HIGH
  // ═══════════════════════════════════════════════════════════════════════════
  if (isTeam && isHigh) {
    return (
      <div className={cn(cardCls, 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2')}>
        <div className="flex items-center gap-3 min-w-0">
          {photo}
          <div className="min-w-0">
            {tagsRow}
            {infoLine(true)}
            {statsRow}
            {outcomeRow}
          </div>
        </div>
        <div className="shrink-0 sm:ml-4 sm:text-right">
          <div className="text-xs text-muted-foreground">
            {t(locale, CTX_KEY[ip.injuryContext.type] ?? 'ctx_mid_season_loss')}
          </div>
          {ip.winRateBoost > 0 && (
            <div className="inline-flex items-center gap-1 text-[0.6875rem] text-[var(--sc-red)] mt-0.5">
              {t(locale, 'win_rate_positive', { n: ip.winRateBoost })}
              <InfoTooltip content={t(locale, 'tooltip_win_rate')} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEAM + OTHER
  // ═══════════════════════════════════════════════════════════════════════════
  if (isTeam && !isHigh) {
    return (
      <div className={cn(cardCls, 'flex items-center justify-between')}>
        <div className="flex items-center gap-2.5">
          {photo}
          <div>
            {tagsRow}
            <div className="text-[0.6875rem] text-muted-foreground mt-0.5">
              {tPos(locale, ip.player.position)} · {t(locale, ROLE_KEY[ip.starterProfile.role] ?? 'role_bench')}
            </div>
            {statsRow}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-foreground/80">
            {tInjury(locale, ip.injury.reason)}
            {suspensionLeague && <span className="ml-1 text-[0.65rem] text-muted-foreground">({suspensionLeague})</span>}
          </div>
          <div className="text-[0.6875rem] text-muted-foreground mt-0.5">
            {(disciplinary || ip.starterProfile.lastStartFixtureDate)
              ? fmtDate(triggerDate)
              : locale === 'ko' ? '시즌 내내 결장' : 'Out all season'}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FIXTURE + HIGH
  // ═══════════════════════════════════════════════════════════════════════════
  if (!isTeam && isHigh) {
    return (
      <div className={cardCls}>
        <div className="flex items-center gap-2.5 mb-1">
          {photo}
          <div className="min-w-0">{tagsRow}</div>
        </div>
        {infoLine(true)}
        {statsRow}
        {outcomeRow}
        <div className="text-[0.6875rem] text-muted-foreground mt-0.5">
          {t(locale, CTX_KEY[ip.injuryContext.type] ?? 'ctx_mid_season_loss')}
          {ip.winRateBoost > 0 && (
            <span className="inline-flex items-center gap-1 ml-2 text-[var(--sc-red)]">
              {t(locale, 'win_rate_positive', { n: ip.winRateBoost })}
              <InfoTooltip content={t(locale, 'tooltip_win_rate')} />
            </span>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FIXTURE + OTHER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className={cn(cardCls, 'flex items-center gap-2')}>
      {photo}
      <div className="min-w-0 flex-1">
        {tagsRow}
        <div className="text-[0.6875rem] text-muted-foreground mt-0.5">
          {tPos(locale, ip.player.position)} · {tInjury(locale, ip.injury.reason)}{suspensionLeague && ` (${suspensionLeague})`} ·{' '}
          {(disciplinary || ip.starterProfile.lastStartFixtureDate)
            ? fmtDate(triggerDate)
            : locale === 'ko' ? '시즌 내내 결장' : 'Out all season'}
        </div>
        {statsRow}
      </div>
    </div>
  );
}
