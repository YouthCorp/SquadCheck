import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import type { InjuryImpact } from '@/lib/types';
import { SEV_TAG, SEV_KEY } from '@/lib/constants';

interface HomeInjuryCardProps {
  impact: InjuryImpact;
  locale: Locale;
  leagueId: number;
}

function powerLossClass(pct: number): string {
  if (pct >= 20) return 'sc-tag--red';
  if (pct >= 10) return 'sc-tag--orange';
  return 'sc-tag--yellow';
}

export function HomeInjuryCard({ impact, locale, leagueId }: HomeInjuryCardProps) {
  const top2 = impact.injuredPlayers.slice(0, 2);

  return (
    <div style={{ background: 'var(--cds-layer-01, #262626)', border: '1px solid var(--cds-border-subtle-01, #393939)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      {/* Team header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {impact.team.logo && (
          <img src={impact.team.logo} alt="" width={24} height={24} style={{ objectFit: 'contain' }} />
        )}
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--cds-text-primary, #f4f4f4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {impact.team.name}
        </span>
      </div>

      {/* Power loss tag */}
      <div>
        <span className={`sc-tag ${powerLossClass(impact.powerLossPct)}`}>
          {t(locale, 'power_loss_pct', { n: Math.round(impact.powerLossPct) })}
        </span>
      </div>

      {/* Top 2 injured players */}
      {top2.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {top2.map((ip) => (
            <div key={ip.player.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.375rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary, #c6c6c6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {ip.player.name}
              </span>
              <span className={`sc-tag ${SEV_TAG[ip.severity] ?? 'sc-tag--gray'}`} style={{ fontSize: '0.625rem', flexShrink: 0 }}>
                {t(locale, SEV_KEY[ip.severity] ?? 'severity_low')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* View team link */}
      <Link
        href={`/team/${impact.team.id}?league=${leagueId}`}
        style={{ fontSize: '0.75rem', color: 'var(--cds-interactive, #4589ff)', textDecoration: 'none', marginTop: 'auto' }}
      >
        {t(locale, 'view_team')}
      </Link>
    </div>
  );
}
