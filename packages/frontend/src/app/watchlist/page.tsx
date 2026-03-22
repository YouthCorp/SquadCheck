import type { Metadata } from 'next';
import { WatchlistClient } from './watchlist-client';

export const metadata: Metadata = {
  title: 'My Watchlist',
  description: 'Track your watched players and injury recovery signals.',
  robots: { index: false, follow: false },
};

export default function WatchlistPage() {
  return <WatchlistClient />;
}
