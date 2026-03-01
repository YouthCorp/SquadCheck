'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ContentSwitcher, Switch } from '@carbon/react';
import type { Locale } from '@/lib/i18n';

export function LangSelector() {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/);
    setIndex(match?.[1] === 'ko' ? 1 : 0);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChange = ({ index: i }: { index?: number; name?: string | number }) => {
    const next: Locale = i === 1 ? 'ko' : 'en';
    document.cookie = `locale=${next};path=/;max-age=31536000;SameSite=Lax`;
    setIndex(i ?? 0);
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
          color: 'var(--cds-text-helper, #8d8d8d)',
          marginBottom: '0.375rem',
        }}
      >
        Language
      </div>
      <ContentSwitcher
        selectedIndex={index}
        onChange={handleChange}
        size="sm"
      >
        <Switch name="en" text="🇬🇧  EN" />
        <Switch name="ko" text="🇰🇷  한국어" />
      </ContentSwitcher>
    </div>
  );
}
