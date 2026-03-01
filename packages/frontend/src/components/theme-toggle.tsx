'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Theme } from '@/lib/theme';

const MoonIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
  </svg>
);

const SunIcon = () => (
  <svg
    width="13" height="13" viewBox="0 0 24 24"
    fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ display: 'block' }}
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
    setIsDark(match?.[1] !== 'white');
  }, []);

  const toggle = () => {
    const next: Theme = isDark ? 'white' : 'g100';
    document.cookie = `theme=${next};path=/;max-age=31536000;SameSite=Lax`;
    document.documentElement.setAttribute('data-carbon-theme', next);
    setIsDark(!isDark);
    router.refresh();
  };

  return (
    <div style={{ padding: '0 1rem' }}>
      <div
        style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.32px',
          textTransform: 'uppercase',
          color: 'var(--cds-text-helper)',
          marginBottom: '0.5rem',
        }}
      >
        Theme
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        {/* Sliding pill — icon lives inside the thumb */}
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

        {/* Mode label */}
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--cds-text-secondary)',
            transition: 'color 0.2s',
          }}
        >
          {isDark ? 'Dark' : 'Light'}
        </span>
      </div>
    </div>
  );
}
