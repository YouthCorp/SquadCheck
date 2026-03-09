'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Theme } from '@/lib/theme';

const MoonIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="block">
    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
  </svg>
);

const SunIcon = () => (
  <svg
    width="13" height="13" viewBox="0 0 24 24"
    fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    className="block"
  >
    <circle cx="12" cy="12" r="4.5" />
    <line x1="12" y1="1.5" x2="12" y2="4.5" />
    <line x1="12" y1="19.5" x2="12" y2="22.5" />
    <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
    <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
    <line x1="1.5" y1="12" x2="4.5" y2="12" />
    <line x1="19.5" y1="12" x2="22.5" y2="12" />
    <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
    <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
  </svg>
);

export function ThemeToggle() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)theme=([^;]*)/);
    setIsDark(match?.[1] !== 'light');
  }, []);

  const toggle = () => {
    const next: Theme = isDark ? 'light' : 'dark';
    document.cookie = `theme=${next};path=/;max-age=31536000;SameSite=Lax`;
    document.documentElement.classList.toggle('dark', next === 'dark');
    setIsDark(next === 'dark');
    router.refresh();
  };

  return (
    <div className="px-4">
      <div className="mb-1.5 text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground">
        Theme
      </div>
      <div className="flex items-center gap-2.5">
        <button
          onClick={toggle}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className={`sc-toggle-pill ${isDark ? 'sc-toggle-pill--dark' : 'sc-toggle-pill--light'}`}
        >
          <span className={`sc-toggle-knob ${isDark ? 'sc-toggle-knob--dark' : 'sc-toggle-knob--light'}`}>
            <span className={isDark ? 'sc-toggle-icon--moon' : 'sc-toggle-icon--sun'}>
              {isDark ? <MoonIcon /> : <SunIcon />}
            </span>
          </span>
        </button>
        <span className="text-xs text-muted-foreground transition-colors duration-200">
          {isDark ? 'Dark' : 'Light'}
        </span>
      </div>
    </div>
  );
}
