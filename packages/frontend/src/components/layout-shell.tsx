'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
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

  // Close sidebar whenever route changes (mobile UX)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile top bar — hidden on desktop (≥1024px) via CSS */}
      <header className="sc-mobile-header">
        <button
          className="sc-hamburger"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect y="3" width="20" height="2" rx="1" fill="currentColor" />
            <rect y="9" width="20" height="2" rx="1" fill="currentColor" />
            <rect y="15" width="20" height="2" rx="1" fill="currentColor" />
          </svg>
        </button>

        <a
          href="/"
          className="sc-mobile-brand"
          style={{ textDecoration: 'none', color: 'var(--cds-text-primary, #f4f4f4)' }}
        >
          <span style={{ color: 'var(--cds-interactive, #4589ff)', fontWeight: 600 }}>Squad</span>
          <span style={{ fontWeight: 600 }}>Check</span>
        </a>

        {/* Right spacer keeps brand centered */}
        <div style={{ width: '2.5rem', flexShrink: 0 }} />
      </header>

      {/* Main layout row */}
      <div className="sc-layout">
        {/* Backdrop — blocks content when sidebar is open on mobile */}
        {sidebarOpen && (
          <div
            className="sc-sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <Sidebar
          locale={locale}
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="sc-main">{children}</main>
      </div>
    </>
  );
}
