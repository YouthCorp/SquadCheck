import { cookies } from 'next/headers';

export type Theme = 'dark' | 'light';

export function getTheme(): Theme {
  try {
    const val = cookies().get('theme')?.value;
    return val === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}
