import { cookies } from 'next/headers';
import type { Locale } from './i18n';

export function getLocale(): Locale {
  const cookieStore = cookies();
  const val = cookieStore.get('locale')?.value;
  return val === 'ko' ? 'ko' : 'en';
}
