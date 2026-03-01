import { cookies } from 'next/headers';

export type Theme = 'g100' | 'white';

export function getTheme(): Theme {
  try {
    const val = cookies().get('theme')?.value;
    return val === 'white' ? 'white' : 'g100';
  } catch {
    return 'g100';
  }
}
