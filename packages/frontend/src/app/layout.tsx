import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/sidebar';
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
        <div className="flex min-h-screen">
          <Sidebar locale={locale} />
          <main
            className="flex-1 overflow-auto"
            style={{
              background: 'var(--cds-background, #161616)',
              padding: '2rem',
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
