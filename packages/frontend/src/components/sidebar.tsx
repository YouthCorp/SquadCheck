'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { LangSelector } from './lang-selector';
import { ThemeToggle } from './theme-toggle';
import { t, type Locale } from '@/lib/i18n';

interface CompetitionItem { id: number; name: string; hasStandings: boolean; }
interface CompetitionSection { labelKey: 'nav_leagues' | 'nav_european_cups' | 'nav_domestic_cups'; items: CompetitionItem[]; }

const sections: CompetitionSection[] = [
  {
    labelKey: 'nav_leagues',
    items: [
      { id: 39,  name: 'Premier League',    hasStandings: true },
      { id: 140, name: 'La Liga',           hasStandings: true },
      { id: 135, name: 'Serie A',           hasStandings: true },
      { id: 78,  name: 'Bundesliga',        hasStandings: true },
      { id: 61,  name: 'Ligue 1',          hasStandings: true },
    ],
  },
  {
    labelKey: 'nav_european_cups',
    items: [
      { id: 2,   name: 'Champions League',  hasStandings: true },
      { id: 3,   name: 'Europa League',     hasStandings: true },
      { id: 848, name: 'Conference League', hasStandings: true },
    ],
  },
  {
    labelKey: 'nav_domestic_cups',
    items: [
      { id: 45,  name: 'FA Cup',            hasStandings: false },
      { id: 48,  name: 'EFL Cup',           hasStandings: false },
      { id: 143, name: 'Copa del Rey',      hasStandings: false },
      { id: 137, name: 'Coppa Italia',      hasStandings: false },
      { id: 81,  name: 'DFB-Pokal',        hasStandings: false },
    ],
  },
];

const allItems = sections.flatMap((s) => s.items);

interface SidebarProps {
  locale: Locale;
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ locale, mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // Auto-expand the competition that matches the current route
  useEffect(() => {
    const initial: Record<number, boolean> = {};
    for (const item of allItems) {
      if (pathname?.startsWith(`/league/${item.id}`)) {
        initial[item.id] = true;
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
      data-sidebar=""
      data-mobile-open={String(mobileOpen ?? false)}
      style={{
        width: '16rem',
        minWidth: '16rem',
        background: 'var(--cds-background, #161616)',
        borderRight: '1px solid var(--cds-border-subtle-01, #393939)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
      }}
    >
      {/* Brand header */}
      <div
        style={{
          padding: '1.25rem 1rem',
          borderBottom: '1px solid var(--cds-border-subtle-01, #393939)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.5rem',
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

        {/* Close button — only visible on mobile via CSS */}
        <button
          className="sc-sidebar-close"
          onClick={onClose}
          aria-label="Close navigation"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--cds-text-secondary, #c6c6c6)',
            padding: '0.25rem',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M13.5 4.5L4.5 13.5M4.5 4.5l9 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
        {sections.map((section, sIdx) => (
          <div key={section.labelKey}>
            {/* Section header */}
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                letterSpacing: '0.32px',
                textTransform: 'uppercase',
                color: 'var(--cds-text-helper, #8d8d8d)',
                padding: sIdx === 0 ? '0.75rem 1rem 0.25rem' : '1rem 1rem 0.25rem',
              }}
            >
              {t(locale, section.labelKey)}
            </div>

            {section.items.map((item) => {
              const base = `/league/${item.id}`;
              const isActive = pathname?.startsWith(base);
              const isExpanded = !!expanded[item.id];
              const isStandingsActive =
                pathname === base ||
                (pathname?.startsWith(base) && !pathname?.includes('/fixtures'));
              const isFixturesActive = pathname?.startsWith(`${base}/fixtures`);

              return (
                <div key={item.id}>
                  {/* Competition row */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpand(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') toggleExpand(item.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.625rem 1rem',
                      fontSize: '0.875rem',
                      color: isActive
                        ? 'var(--cds-text-primary, #f4f4f4)'
                        : 'var(--cds-text-secondary, #c6c6c6)',
                      background: isActive ? 'var(--cds-layer-hover-01, #2e2e2e)' : 'transparent',
                      borderLeft: '3px solid transparent',
                      transition: 'background 0.1s, color 0.1s',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'var(--cds-layer-hover-01, #2e2e2e)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = isActive ? 'var(--cds-layer-hover-01, #2e2e2e)' : 'transparent';
                    }}
                  >
                    <span style={{ flex: 1 }}>{item.name}</span>
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
                      {/* Standings — only for competitions with a standings table */}
                      {item.hasStandings && (
                        <Link href={base} style={{ textDecoration: 'none', display: 'block' }}>
                          <div
                            style={subLinkStyle(!!isStandingsActive)}
                            onMouseEnter={(e) => {
                              if (!isStandingsActive)
                                (e.currentTarget as HTMLDivElement).style.background = 'var(--cds-layer-hover-01, #2e2e2e)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isStandingsActive)
                                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                            }}
                          >
                            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>≡</span>
                            <span>{t(locale, 'nav_standings')}</span>
                          </div>
                        </Link>
                      )}

                      {/* Fixtures */}
                      <Link href={`${base}/fixtures`} style={{ textDecoration: 'none', display: 'block' }}>
                        <div
                          style={subLinkStyle(!!isFixturesActive)}
                          onMouseEnter={(e) => {
                            if (!isFixturesActive)
                              (e.currentTarget as HTMLDivElement).style.background = 'var(--cds-layer-hover-01, #2e2e2e)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isFixturesActive)
                              (e.currentTarget as HTMLDivElement).style.background = 'transparent';
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
          </div>
        ))}

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
        <Link href="/leaderboard" style={{ textDecoration: 'none', display: 'block' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.625rem 1rem',
              fontSize: '0.875rem',
              color: pathname?.startsWith('/leaderboard')
                ? 'var(--cds-text-primary, #f4f4f4)'
                : 'var(--cds-text-secondary, #c6c6c6)',
              background: pathname?.startsWith('/leaderboard')
                ? 'var(--cds-layer-selected-01, #353535)'
                : 'transparent',
              borderLeft: pathname?.startsWith('/leaderboard')
                ? '3px solid var(--cds-interactive, #4589ff)'
                : '3px solid transparent',
            }}
          >
            <span>🏆</span>
            <span>{t(locale, 'nav_leaderboard')}</span>
          </div>
        </Link>
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
