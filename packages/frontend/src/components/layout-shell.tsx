'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Sidebar } from './sidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { UserAvatar } from './user-avatar';
import { NotificationBell } from './notification-bell';
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

        <main className="flex-1 overflow-auto bg-background p-6 lg:p-8 min-w-0">
          <div className="sc-page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
