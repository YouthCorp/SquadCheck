import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { LayoutShell } from '@/components/layout-shell';
import { getLocale } from '@/lib/locale';
import { getTheme } from '@/lib/theme';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SquadCheck — Injury Impact Analysis',
  description: 'Analyze how injuries affect team performance across top European leagues',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();
  const theme = getTheme();
  return (
    <html
      lang={locale}
      data-carbon-theme={theme}
      className={`${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        <LayoutShell locale={locale}>{children}</LayoutShell>
      </body>
    </html>
  );
}
