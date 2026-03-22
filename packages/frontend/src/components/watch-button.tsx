'use client';

import { useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { SignInModal } from './sign-in-modal';
import { fetchApiAuth } from '@/lib/api';

interface WatchButtonProps {
  playerId: number;
  initialWatched?: boolean;
  /** Called after successful add/remove to sync parent state */
  onToggle?: (watching: boolean) => void;
}

export function WatchButton({ playerId, initialWatched = false, onToggle }: WatchButtonProps) {
  const { data: session, status } = useSession();
  const [watching, setWatching] = useState(initialWatched);
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status === 'loading') return null;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);

    if (!session) {
      setShowModal(true);
      return;
    }

    startTransition(async () => {
      try {
        if (watching) {
          await fetchApiAuth(`/api/watchlist/players/${playerId}`, { method: 'DELETE' });
          setWatching(false);
          onToggle?.(false);
        } else {
          await fetchApiAuth('/api/watchlist/players', {
            method: 'POST',
            body: JSON.stringify({ playerId }),
          });
          setWatching(true);
          onToggle?.(true);
        }
      } catch (err: any) {
        if (err?.body?.error === 'WATCHLIST_FULL') {
          setError(`Watchlist full (${err.body.limit}/${err.body.limit})`);
        } else if (err?.status === 409) {
          setWatching(true); // already watching — sync state
        } else {
          setError('Failed. Try again.');
        }
      }
    });
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isPending}
        title={watching ? 'Remove from watchlist' : 'Add to watchlist'}
        aria-label={watching ? 'Remove from watchlist' : 'Add to watchlist'}
        className={
          watching
            ? 'w-6 h-6 flex items-center justify-center rounded text-yellow-400 hover:text-yellow-300 bg-transparent border-0 cursor-pointer transition-colors disabled:opacity-50'
            : 'w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground bg-transparent border-0 cursor-pointer transition-colors disabled:opacity-50'
        }
      >
        {isPending ? (
          <span className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill={watching ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        )}
      </button>

      {error && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-[0.625rem] text-destructive bg-background border border-border rounded px-1.5 py-0.5 whitespace-nowrap z-10 pointer-events-none">
          {error}
        </span>
      )}

      <SignInModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
