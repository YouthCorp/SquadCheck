'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { LangSelector } from './lang-selector';
import { ThemeToggle } from './theme-toggle';
import { t, type Locale } from '@/lib/i18n';

const leagues = [
  { id: 39,  name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 140, name: 'La Liga',        flag: '🇪🇸' },
  { id: 135, name: 'Serie A',        flag: '🇮🇹' },
  { id: 78,  name: 'Bundesliga',     flag: '🇩🇪' },
  { id: 61,  name: 'Ligue 1',        flag: '🇫🇷' },
];

interface SidebarProps {
  locale: Locale;
}

export function Sidebar({ locale }: SidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // Auto-expand the league that matches the current route
  useEffect(() => {
    const initial: Record<number, boolean> = {};
    for (const league of leagues) {
      if (pathname?.startsWith(`/league/${league.id}`)) {
        initial[league.id] = true;
      }
    }
    setExpanded(initial);
  }, [pathname]);

  function toggleExpand(leagueId: number) {
    setExpanded((prev) => ({ ...prev, [leagueId]: !prev[leagueId] }));
  }

  const subLinkStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.4375rem 1rem 0.4375rem 2.75rem',
    fontSize: '0.8125rem',
    color: active
      ? 'var(--cds-text-primary, #f4f4f4)'
      : 'var(--cds-text-secondary, #c6c6c6)',
    background: active
      ? 'var(--cds-layer-selected-01, #353535)'
      : 'transparent',
    borderLeft: active
      ? '3px solid var(--cds-interactive, #4589ff)'
      : '3px solid transparent',
    transition: 'background 0.1s, color 0.1s',
    cursor: 'pointer',
    textDecoration: 'none',
  });

  return (
    <aside
      style={{
        width: '16rem',
        minWidth: '16rem',
        background: 'var(--cds-background, #161616)',
        borderRight: '1px solid var(--cds-border-subtle-01, #393939)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Brand header */}
      <div
        style={{
          padding: '1.25rem 1rem',
          borderBottom: '1px solid var(--cds-border-subtle-01, #393939)',
        }}
      >
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
            <span
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--cds-interactive, #4589ff)',
                letterSpacing: '-0.5px',
              }}
            >
              Squad
            </span>
            <span
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--cds-text-primary, #f4f4f4)',
                letterSpacing: '-0.5px',
              }}
            >
              Check
            </span>
          </div>
          <div
            style={{
              fontSize: '0.6875rem',
              color: 'var(--cds-text-helper, #8d8d8d)',
              letterSpacing: '0.32px',
              textTransform: 'uppercase',
              marginTop: '2px',
            }}
          >
            Injury Impact Analysis
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
        {/* Leagues section */}
        <div
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.32px',
            textTransform: 'uppercase',
            color: 'var(--cds-text-helper, #8d8d8d)',
            padding: '0.75rem 1rem 0.25rem',
          }}
        >
          {t(locale, 'nav_leagues')}
        </div>

        {leagues.map((league) => {
          const leagueBase = `/league/${league.id}`;
          const isLeagueActive = pathname?.startsWith(leagueBase);
          const isExpanded = !!expanded[league.id];

          // Sub-link active states
          const isStandingsActive =
            pathname === leagueBase ||
            (pathname?.startsWith(leagueBase) && !pathname?.includes('/fixtures'));
          const isFixturesActive = pathname?.startsWith(`${leagueBase}/fixtures`);

          return (
            <div key={league.id}>
              {/* League row — click to toggle submenu */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleExpand(league.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') toggleExpand(league.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.625rem 1rem',
                  fontSize: '0.875rem',
                  color: isLeagueActive
                    ? 'var(--cds-text-primary, #f4f4f4)'
                    : 'var(--cds-text-secondary, #c6c6c6)',
                  background: isLeagueActive
                    ? 'var(--cds-layer-hover-01, #2e2e2e)'
                    : 'transparent',
                  borderLeft: '3px solid transparent',
                  transition: 'background 0.1s, color 0.1s',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    'var(--cds-layer-hover-01, #2e2e2e)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = isLeagueActive
                    ? 'var(--cds-layer-hover-01, #2e2e2e)'
                    : 'transparent';
                }}
              >
                <span style={{ flex: 1 }}>{league.name}</span>
                {/* Chevron */}
                <svg
                  width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{
                    color: 'var(--cds-text-helper, #8d8d8d)',
                    transition: 'transform 0.15s',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    flexShrink: 0,
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Submenu */}
              {isExpanded && (
                <div>
                  {/* Standings sub-link */}
                  <Link href={leagueBase} style={{ textDecoration: 'none', display: 'block' }}>
                    <div
                      style={subLinkStyle(!!isStandingsActive)}
                      onMouseEnter={(e) => {
                        if (!isStandingsActive) {
                          (e.currentTarget as HTMLDivElement).style.background =
                            'var(--cds-layer-hover-01, #2e2e2e)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isStandingsActive) {
                          (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                        }
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>≡</span>
                      <span>{t(locale, 'nav_standings')}</span>
                    </div>
                  </Link>

                  {/* Fixtures sub-link */}
                  <Link
                    href={`${leagueBase}/fixtures`}
                    style={{ textDecoration: 'none', display: 'block' }}
                  >
                    <div
                      style={subLinkStyle(!!isFixturesActive)}
                      onMouseEnter={(e) => {
                        if (!isFixturesActive) {
                          (e.currentTarget as HTMLDivElement).style.background =
                            'var(--cds-layer-hover-01, #2e2e2e)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isFixturesActive) {
                          (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                        }
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>◷</span>
                      <span>{t(locale, 'nav_fixtures')}</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          );
        })}

        {/* Tools section */}
        <div
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.32px',
            textTransform: 'uppercase',
            color: 'var(--cds-text-helper, #8d8d8d)',
            padding: '1rem 1rem 0.25rem',
          }}
        >
          {t(locale, 'nav_tools')}
        </div>
        <Link href="/matchup" style={{ textDecoration: 'none', display: 'block' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.625rem 1rem',
              fontSize: '0.875rem',
              color: pathname === '/matchup'
                ? 'var(--cds-text-primary, #f4f4f4)'
                : 'var(--cds-text-secondary, #c6c6c6)',
              background: pathname === '/matchup'
                ? 'var(--cds-layer-selected-01, #353535)'
                : 'transparent',
              borderLeft: pathname === '/matchup'
                ? '3px solid var(--cds-interactive, #4589ff)'
                : '3px solid transparent',
            }}
          >
            <span>⚔</span>
            <span>{t(locale, 'nav_matchup')}</span>
          </div>
        </Link>
      </nav>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid var(--cds-border-subtle-01, #393939)',
          padding: '0.75rem 0',
        }}
      >
        <ThemeToggle />
        <div style={{ height: '0.625rem' }} />
        <LangSelector />
        <div
          style={{
            fontSize: '0.6875rem',
            color: 'var(--cds-text-helper, #8d8d8d)',
            padding: '0.25rem 1rem 0',
            letterSpacing: '0.16px',
          }}
        >
          {t(locale, 'nav_data')}
        </div>
      </div>
    </aside>
  );
}
