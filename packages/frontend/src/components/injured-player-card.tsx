import Link from 'next/link';
import { t, tPos, tInjury, type Locale } from '@/lib/i18n';
import { SEV_TAG, SEV_KEY, ROLE_KEY, CTX_KEY } from '@/lib/constants';
import { isDisciplinaryReason, fmtDate, daysAgo } from '@/lib/format';
import type { InjuredPlayer } from '@/lib/types';

interface InjuredPlayerCardProps {
  ip: InjuredPlayer;
  locale: Locale;
  /** 'team' = team page layout, 'fixture' = fixture detail InjuryColumn layout */
  variant: 'team' | 'fixture';
  /** 'high' = critical/high severity (detailed card), 'other' = moderate/low (compact card) */
  severity: 'high' | 'other';
  /** Query string appended to /player/{id} link. e.g. "?team=11&league=39" */
  playerLinkSuffix?: string;
}

export function InjuredPlayerCard({
  ip,
  locale,
  variant,
  severity,
  playerLinkSuffix = '',
}: InjuredPlayerCardProps) {
  const isTeam = variant === 'team';
  const isHigh = severity === 'high';

  const disciplinary = isDisciplinaryReason(ip.injury.reason);
  const triggerDate = ip.starterProfile.lastStartFixtureDate ?? ip.injury.date;
  const triggerDays = daysAgo(triggerDate);
  const isLongTerm =
    !isHigh &&
    (ip.injuryContext.type === 'pre_season_absence' ||
      ip.injuryContext.type === 'extended_absence');

  // ── Style values by variant × severity ─────────────────────────────────────
  const photoSize = isTeam ? (isHigh ? '2.25rem' : '1.75rem') : isHigh ? '1.75rem' : '1.5rem';
  const nameFontSize = isTeam ? '0.875rem' : '0.8125rem';
  const nameFontWeight = isHigh ? 600 : 500;
  const tagGap = isTeam ? '0.5rem' : '0.375rem';
  const infoFontSize = isTeam ? '0.75rem' : '0.6875rem';
  const statsFontSize = isTeam
    ? isHigh
      ? '0.6875rem'
      : '0.625rem'
    : isHigh
    ? '0.625rem'
    : '0.5625rem';
  const statsGap = isTeam ? (isHigh ? '0.875rem' : '0.625rem') : isHigh ? '0.75rem' : '0.5rem';
  const containerPadding = isHigh
    ? isTeam
      ? '0.875rem 1rem'
      : '0.75rem 1rem'
    : '0.625rem 1rem';

  // Stats row — team+high shows minutes, others don't
  const showMinutes = isTeam && isHigh;
  // Start label — team+high shows "Start", team+other shows "S", fixture shows "Start"
  const startLabel = isTeam && !isHigh
    ? locale === 'ko' ? '선발' : 'S'
    : locale === 'ko' ? '선발 ' : 'Start ';
  const subLabel = locale === 'ko' ? (isTeam && !isHigh ? '교체' : '교체 ') : (isTeam && !isHigh ? 'Sub' : 'Sub ');

  // ── Tags row (shared across all variants) ──────────────────────────────────
  const tagsRow = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tagGap,
        flexWrap: 'wrap',
      }}
    >
      <Link
        href={`/player/${ip.player.id}${playerLinkSuffix}`}
        style={{
          textDecoration: 'none',
          fontSize: nameFontSize,
          fontWeight: nameFontWeight,
          color: 'var(--cds-text-primary, #f4f4f4)',
        }}
      >
        {ip.player.name}
      </Link>
      <span className={`sc-tag ${SEV_TAG[ip.severity]}`}>
        {t(locale, SEV_KEY[ip.severity] ?? 'severity_low')}
      </span>
      {isHigh && (
        <span className="sc-tag sc-tag--blue">
          {t(locale, ROLE_KEY[ip.starterProfile.role] ?? 'role_bench')}
        </span>
      )}
      {disciplinary && (
        <span className="sc-tag sc-tag--orange">
          {locale === 'ko' ? '출전 정지' : 'Suspended'}
        </span>
      )}
      {!isHigh && isLongTerm && !disciplinary && (
        <span className="sc-tag sc-tag--gray">
          {t(locale, CTX_KEY[ip.injuryContext.type] ?? 'ctx_mid_season_loss')}
        </span>
      )}
      {!isHigh && triggerDays <= 7 && !disciplinary && !isLongTerm && (
        <span className="sc-tag sc-tag--blue">{t(locale, 'new_badge')}</span>
      )}
    </div>
  );

  // ── Stats row (shared across all variants) ─────────────────────────────────
  const statsRow = (
    <div style={{ display: 'flex', gap: statsGap, marginTop: isHigh ? '0.25rem' : '0.1875rem' }}>
      <span
        style={{
          fontSize: statsFontSize,
          color: 'var(--cds-text-secondary, #c6c6c6)',
          fontFamily: 'var(--font-plex-mono, monospace)',
        }}
      >
        <span style={{ color: 'var(--cds-text-helper, #8d8d8d)' }}>{startLabel}</span>
        {ip.starterProfile.starterCount}
      </span>
      <span
        style={{
          fontSize: statsFontSize,
          color: 'var(--cds-text-secondary, #c6c6c6)',
          fontFamily: 'var(--font-plex-mono, monospace)',
        }}
      >
        <span style={{ color: 'var(--cds-text-helper, #8d8d8d)' }}>{subLabel}</span>
        {ip.starterProfile.substituteCount}
      </span>
      {ip.stats?.goals != null && (
        <span
          style={{
            fontSize: statsFontSize,
            color: 'var(--cds-text-secondary, #c6c6c6)',
            fontFamily: 'var(--font-plex-mono, monospace)',
          }}
        >
          <span style={{ color: 'var(--cds-text-helper, #8d8d8d)' }}>{t(locale, 'goals')} </span>
          {ip.stats.goals}
        </span>
      )}
      {ip.stats?.assists != null && (
        <span
          style={{
            fontSize: statsFontSize,
            color: 'var(--cds-text-secondary, #c6c6c6)',
            fontFamily: 'var(--font-plex-mono, monospace)',
          }}
        >
          <span style={{ color: 'var(--cds-text-helper, #8d8d8d)' }}>{t(locale, 'assists')} </span>
          {ip.stats.assists}
        </span>
      )}
      {showMinutes && ip.stats?.minutes != null && (
        <span
          style={{
            fontSize: statsFontSize,
            color: 'var(--cds-text-helper, #8d8d8d)',
            fontFamily: 'var(--font-plex-mono, monospace)',
          }}
        >
          {ip.stats.minutes}{locale === 'ko' ? '분' : 'min'}
        </span>
      )}
    </div>
  );

  // ── Photo element ──────────────────────────────────────────────────────────
  const photo = ip.player.photo ? (
    <img
      src={ip.player.photo}
      alt=""
      style={{
        width: photoSize,
        height: photoSize,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
      }}
    />
  ) : null;

  // ═══════════════════════════════════════════════════════════════════════════
  // TEAM + HIGH: flex row with right-side context/winRate panel
  // ═══════════════════════════════════════════════════════════════════════════
  if (isTeam && isHigh) {
    return (
      <div
        style={{
          background: 'var(--cds-layer-01, #262626)',
          padding: containerPadding,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {photo}
          <div>
            {tagsRow}
            <div style={{ fontSize: infoFontSize, color: 'var(--cds-text-helper, #8d8d8d)', marginTop: '0.25rem' }}>
              {tPos(locale, ip.player.position)} · {tInjury(locale, ip.injury.reason)} · {fmtDate(triggerDate)}
              <span style={{ marginLeft: '0.5rem', color: 'var(--sc-orange)' }}>
                {t(locale, 'days_ago', { n: triggerDays })}
              </span>
            </div>
            {statsRow}
          </div>
        </div>
        {/* Right panel: context + win rate */}
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper, #8d8d8d)' }}>
            {t(locale, CTX_KEY[ip.injuryContext.type] ?? 'ctx_mid_season_loss')}
          </div>
          {ip.winRateBoost > 0 && (
            <div style={{ fontSize: '0.6875rem', color: 'var(--sc-red)', marginTop: '2px' }}>
              {t(locale, 'win_rate_positive', { n: ip.winRateBoost })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEAM + OTHER: flex row with right-side injury reason/date panel
  // ═══════════════════════════════════════════════════════════════════════════
  if (isTeam && !isHigh) {
    return (
      <div
        style={{
          background: 'var(--cds-layer-01, #262626)',
          padding: containerPadding,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          {photo}
          <div>
            {tagsRow}
            <div style={{ fontSize: infoFontSize, color: 'var(--cds-text-helper, #8d8d8d)', marginTop: '2px' }}>
              {tPos(locale, ip.player.position)} · {t(locale, ROLE_KEY[ip.starterProfile.role] ?? 'role_bench')}
            </div>
            {statsRow}
          </div>
        </div>
        {/* Right panel: injury reason + date */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary, #c6c6c6)' }}>
            {tInjury(locale, ip.injury.reason)}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--cds-text-helper, #8d8d8d)', marginTop: '2px' }}>
            {ip.starterProfile.lastStartFixtureDate
              ? fmtDate(triggerDate)
              : locale === 'ko'
              ? '시즌 내내 결장'
              : 'Out all season'}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FIXTURE + HIGH: vertical stack, photo+tags row → info → stats → context
  // ═══════════════════════════════════════════════════════════════════════════
  if (!isTeam && isHigh) {
    return (
      <div
        style={{
          background: 'var(--cds-layer-01, #262626)',
          padding: containerPadding,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            marginBottom: '0.25rem',
          }}
        >
          {photo}
          <div style={{ minWidth: 0 }}>
            {tagsRow}
          </div>
        </div>
        <div
          style={{
            fontSize: infoFontSize,
            color: 'var(--cds-text-helper, #8d8d8d)',
            marginTop: '0.125rem',
          }}
        >
          {tPos(locale, ip.player.position)} · {tInjury(locale, ip.injury.reason)} · {fmtDate(triggerDate)}
          <span style={{ marginLeft: '0.375rem', color: 'var(--sc-orange)' }}>
            {t(locale, 'days_ago', { n: triggerDays })}
          </span>
        </div>
        {statsRow}
        {/* Context + win rate below stats, indented under photo */}
        <div
          style={{
            fontSize: '0.6875rem',
            color: 'var(--cds-text-helper, #8d8d8d)',
            paddingLeft: ip.player.photo ? '2.375rem' : 0,
          }}
        >
          {t(locale, CTX_KEY[ip.injuryContext.type] ?? 'ctx_mid_season_loss')}
          {ip.winRateBoost > 0 && (
            <span style={{ marginLeft: '0.5rem', color: 'var(--sc-red)' }}>
              {t(locale, 'win_rate_positive', { n: ip.winRateBoost })}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FIXTURE + OTHER: single flex row, no right panel
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div
      style={{
        background: 'var(--cds-layer-01, #262626)',
        padding: containerPadding,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      {photo}
      <div style={{ minWidth: 0, flex: 1 }}>
        {tagsRow}
        <div
          style={{
            fontSize: infoFontSize,
            color: 'var(--cds-text-helper, #8d8d8d)',
            marginTop: '0.125rem',
          }}
        >
          {tPos(locale, ip.player.position)} · {tInjury(locale, ip.injury.reason)} ·{' '}
          {ip.starterProfile.lastStartFixtureDate
            ? fmtDate(triggerDate)
            : locale === 'ko'
            ? '시즌 내내 결장'
            : 'Out all season'}
        </div>
        {statsRow}
      </div>
    </div>
  );
}
