'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Sidebar } from './sidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { UserAvatar } from './user-avatar';
import { NotificationBell } from './notification-bell';
import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/i18n';

export function LayoutShell({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden lg:flex shrink-0 h-screen sticky top-0">
        <Sidebar locale={locale} />
      </aside>

      {/* Mobile sidebar — Sheet drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" showCloseButton={false} className="p-0 w-64 bg-sidebar">
          <Sidebar locale={locale} onClose={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Page content column */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-40 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            className="w-10 h-10 flex items-center justify-center text-foreground hover:bg-accent rounded transition-colors duration-150 border-0 bg-transparent cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect y="3" width="20" height="2" rx="1" fill="currentColor" />
              <rect y="9" width="20" height="2" rx="1" fill="currentColor" />
              <rect y="15" width="20" height="2" rx="1" fill="currentColor" />
            </svg>
          </button>

          <a href="/" className="no-underline flex items-center">
            <Image
              src="/logo_with_text.png"
              alt="SquadCheck"
              width={112}
              height={28}
              className="h-7 w-auto object-contain dark:brightness-90"
              priority
            />
          </a>

          <div className="flex items-center gap-1.5 shrink-0">
            <NotificationBell />
            <UserAvatar />
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background p-6 lg:p-8 min-w-0 pb-20 lg:pb-8">
          <div className="sc-page-enter">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav — hidden on lg+ */}
      <MobileBottomNav pathname={pathname} onOpenSidebar={() => setSidebarOpen(true)} />
    </div>
  );
}

function MobileBottomNav({ pathname, onOpenSidebar }: { pathname: string; onOpenSidebar: () => void }) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 h-16 bg-sidebar border-t border-sidebar-border flex items-stretch">
      {/* Home */}
      <Link
        href="/"
        className={cn(
          'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors duration-100',
          pathname === '/' ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12L12 3l9 9" /><path d="M9 21V12h6v9" />
        </svg>
        Home
      </Link>

      {/* Watchlist */}
      <Link
        href="/watchlist"
        className={cn(
          'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors duration-100',
          pathname.startsWith('/watchlist') ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        Watchlist
      </Link>

      {/* More — opens sidebar sheet */}
      <button
        onClick={onOpenSidebar}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-100 bg-transparent border-0 cursor-pointer"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
        </svg>
        More
      </button>
    </nav>
  );
}
