'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n';

const LANGS: { value: Locale; label: string }[] = [
  { value: 'en', label: '🇬🇧 EN' },
  { value: 'ko', label: '🇰🇷 한국어' },
];

export function LangSelector() {
  const router = useRouter();
  const [current, setCurrent] = useState<Locale>('en');

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/);
    setCurrent((match?.[1] === 'ko' ? 'ko' : 'en') as Locale);
  }, []);

  const handleChange = (next: Locale) => {
    document.cookie = `locale=${next};path=/;max-age=31536000;SameSite=Lax`;
    setCurrent(next);
    router.refresh();
  };

  return (
    <div className="px-4">
      <div className="mb-1.5 text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground">
        Language
      </div>
      <div className="flex gap-1">
        {LANGS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleChange(value)}
            className={[
              'flex-1 px-2 py-1 text-[0.8125rem] rounded-sm border cursor-pointer transition-all duration-100',
              current === value
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
