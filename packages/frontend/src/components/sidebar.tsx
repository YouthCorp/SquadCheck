'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { LangSelector } from './lang-selector';
import { ThemeToggle } from './theme-toggle';
import { UserAvatar } from './user-avatar';
import { NotificationBell } from './notification-bell';
import { t, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

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
  onClose?: () => void;
}

export function Sidebar({ locale, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // Auto-expand the competition that matches the current route
  useEffect(() => {
    const initial: Record<number, boolean> = {};
    for (const item of allItems) {
      const base = `/league/${item.id}`;
      if (pathname === base || pathname?.startsWith(`${base}/`)) {
        initial[item.id] = true;
      }
    }
    setExpanded(initial);
  }, [pathname]);

  function toggleExpand(leagueId: number) {
    setExpanded((prev) => ({ ...prev, [leagueId]: !prev[leagueId] }));
  }

  const navRef = useRef<HTMLElement>(null);
  const [showNavHint, setShowNavHint] = useState(false);

  const checkNavScroll = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 4;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 16;
    setShowNavHint(hasOverflow && !atBottom);
  }, []);

  useEffect(() => {
    checkNavScroll();
    const el = navRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkNavScroll, { passive: true });
    const ro = new ResizeObserver(checkNavScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkNavScroll);
      ro.disconnect();
    };
  }, [checkNavScroll]);

  const navItemCls = (active: boolean) =>
    cn(
      'flex items-center gap-3 px-4 py-2.5 text-sm border-l-2 transition-colors duration-150 cursor-pointer select-none',
      active
        ? 'border-primary bg-accent text-foreground'
        : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
    );

  const subItemCls = (active: boolean) =>
    cn(
      'flex items-center gap-2 pl-11 pr-4 py-[0.4375rem] text-[0.8125rem] border-l-2 transition-colors duration-150',
      active
        ? 'border-primary bg-accent text-foreground'
        : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
    );

  return (
    <div className="w-64 min-w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      {/* Brand header */}
      <div className="pl-3 pr-4 py-3 border-b border-sidebar-border flex items-center justify-between gap-2">
        <Link href="/" className="no-underline flex-1 min-w-0">
          <Image
            src="/logo_with_text.png"
            alt="SquadCheck"
            width={800}
            height={200}
            className="w-[85%] h-auto object-left object-contain dark:brightness-90"
            priority
          />
        </Link>

        {/* Close button — only visible on mobile via CSS */}
        <button
          className="sc-sidebar-close items-center justify-center shrink-0 p-1 text-muted-foreground hover:text-foreground bg-transparent border-0 cursor-pointer"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M13.5 4.5L4.5 13.5M4.5 4.5l9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <div className="relative flex-1 min-h-0">
      <nav ref={navRef} className="h-full overflow-y-auto py-2 sc-sidebar-nav">
        {sections.map((section, sIdx) => (
          <div key={section.labelKey}>
            {/* Section header */}
            <div className={cn(
              'text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground px-4 pb-1',
              sIdx === 0 ? 'pt-3' : 'pt-4'
            )}>
              {t(locale, section.labelKey)}
            </div>

            {section.items.map((item) => {
              const base = `/league/${item.id}`;
              const isUnderBase = pathname === base || pathname?.startsWith(`${base}/`);
              const isActive = isUnderBase;
              const isExpanded = !!expanded[item.id];
              const isStandingsActive =
                pathname === base ||
                (isUnderBase && !pathname?.includes('/fixtures'));
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
                    className={navItemCls(!!isActive)}
                  >
                    <span className="flex-1">{item.name}</span>
                    <svg
                      width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className={cn(
                        'text-muted-foreground shrink-0 transition-transform duration-150',
                        isExpanded ? 'rotate-180' : 'rotate-0'
                      )}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>

                  {/* Submenu */}
                  {isExpanded && (
                    <div>
                      {item.hasStandings && (
                        <Link href={base} className="no-underline block">
                          <div className={subItemCls(!!isStandingsActive)}>
                            <span className="text-xs opacity-70">≡</span>
                            <span>{t(locale, 'nav_standings')}</span>
                          </div>
                        </Link>
                      )}
                      <Link href={`${base}/fixtures`} className="no-underline block">
                        <div className={subItemCls(!!isFixturesActive)}>
                          <span className="text-xs opacity-70">◷</span>
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
        <div className="text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground px-4 pt-4 pb-1">
          {t(locale, 'nav_tools')}
        </div>
        <Link href="/watchlist" className="no-underline block">
          <div className={navItemCls(!!pathname?.startsWith('/watchlist'))}>
            <span>⭐</span>
            <span>{t(locale, 'nav_watchlist')}</span>
          </div>
        </Link>
        <Link href="/leaderboard" className="no-underline block">
          <div className={navItemCls(!!pathname?.startsWith('/leaderboard'))}>
            <span>🏆</span>
            <span>{t(locale, 'nav_leaderboard')}</span>
          </div>
        </Link>
      </nav>
      {showNavHint && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-14 flex items-end justify-center pb-2 bg-gradient-to-t from-sidebar to-transparent">
          <ChevronDown className="w-4 h-4 text-sidebar-foreground/30 animate-bounce" />
        </div>
      )}
      </div>

      {/* Footer */}
      <div className="border-t border-sidebar-border py-3 space-y-2.5">
        <div className="flex items-center gap-1.5 px-4">
          <NotificationBell align="left" direction="up" />
          <UserAvatar align="left" />
        </div>
        <ThemeToggle />
        <LangSelector />
        <p className="text-[0.6875rem] text-muted-foreground px-4 tracking-wide">
          {t(locale, 'nav_data')}
        </p>
        <div className="flex gap-3 px-4">
          <Link href="/terms" className="text-[0.6875rem] text-muted-foreground/60 hover:text-muted-foreground transition-colors no-underline">
            {locale === 'ko' ? '이용약관' : 'Terms'}
          </Link>
          <span className="text-[0.6875rem] text-muted-foreground/30">·</span>
          <Link href="/privacy" className="text-[0.6875rem] text-muted-foreground/60 hover:text-muted-foreground transition-colors no-underline">
            {locale === 'ko' ? '개인정보처리방침' : 'Privacy'}
          </Link>
        </div>
      </div>
    </div>
  );
}
