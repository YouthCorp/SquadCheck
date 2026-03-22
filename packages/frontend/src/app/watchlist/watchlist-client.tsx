'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { SignInModal } from '@/components/sign-in-modal';
import { fetchApiAuth } from '@/lib/api';
import type { WatchlistPlayerEntry, WatchlistAlertEntry, WatchlistAlertsResponse } from '@/lib/types';
import { ALERT_ICONS } from '@/lib/types';
import { cn } from '@/lib/utils';

export function WatchlistClient() {
  const { data: session, status } = useSession();
  const [showModal, setShowModal] = useState(false);
  const [players, setPlayers] = useState<WatchlistPlayerEntry[]>([]);
  const [alerts, setAlerts] = useState<WatchlistAlertEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  const fetchPlayers = useCallback(async () => {
    try {
      const data = await fetchApiAuth<{ players: WatchlistPlayerEntry[] }>('/api/watchlist/players');
      setPlayers(data.players);
    } catch {
      // session expired or unauthenticated — handled by UI
    } finally {
      setLoadingPlayers(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await fetchApiAuth<WatchlistAlertsResponse>('/api/watchlist/alerts?limit=10');
      setAlerts(data.alerts);
      setUnreadCount(data.unreadCount);
    } catch {
      // silent
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchPlayers();
      fetchAlerts();
    } else if (status !== 'loading') {
      setLoadingPlayers(false);
      setLoadingAlerts(false);
    }
  }, [session, status, fetchPlayers, fetchAlerts]);

  async function removePlayer(playerId: number) {
    try {
      await fetchApiAuth(`/api/watchlist/players/${playerId}`, { method: 'DELETE' });
      setPlayers((prev) => prev.filter((p) => p.player.id !== playerId));
    } catch {
      // silent
    }
  }

  async function markRead(alertId: string) {
    try {
      await fetchApiAuth(`/api/watchlist/alerts/${alertId}/read`, { method: 'PATCH' });
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, readAt: new Date().toISOString() } : a)));
      setUnreadCount((n) => Math.max(0, n - 1));
    } catch {
      // silent
    }
  }

  // ─── Not signed in ───────────────────────────────────────────────────────
  if (status !== 'loading' && !session) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="text-4xl mb-4">⭐</div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Your Watchlist</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Sign in to track up to 5 players and get injury recovery alerts.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Sign in
        </button>
        <SignInModal open={showModal} onClose={() => setShowModal(false)} />
      </div>
    );
  }

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loadingPlayers) {
    return (
      <div className="max-w-2xl mx-auto py-2">
        <div className="h-7 w-40 bg-muted rounded animate-pulse mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ─── Main ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto py-2 space-y-8">
      {/* Players section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-foreground">
            ⭐ My Watchlist{' '}
            <span className="text-sm font-normal text-muted-foreground">({players.length}/5)</span>
          </h1>
        </div>

        {players.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground mb-1">No players watched yet.</p>
            <p className="text-xs text-muted-foreground/60">
              Browse <Link href="/" className="underline hover:text-muted-foreground">team pages</Link> and click ⭐ to add players.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {players.map((entry) => (
              <WatchlistPlayerCard key={entry.id} entry={entry} onRemove={removePlayer} />
            ))}
          </div>
        )}
      </section>

      {/* Alerts section */}
      {alerts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">
              🔔 Recent Alerts
              {unreadCount > 0 && (
                <span className="ml-2 text-xs font-medium bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                  {unreadCount}
                </span>
              )}
            </h2>
          </div>
          <div className="space-y-2">
            {loadingAlerts ? (
              [1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)
            ) : (
              alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} onRead={markRead} />
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Player Card ─────────────────────────────────────────────────────────────

function WatchlistPlayerCard({
  entry,
  onRemove,
}: {
  entry: WatchlistPlayerEntry;
  onRemove: (playerId: number) => void;
}) {
  const { player, team, injuryStatus, latestSignal } = entry;
  const isInjured = injuryStatus?.isActive;
  const signalPct = latestSignal?.predictedAvailability ?? 0;
  const hasSignal = isInjured && latestSignal && signalPct > 0;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      {player.photo && (
        <Image
          src={player.photo}
          alt={player.name}
          width={36}
          height={36}
          className="rounded-full object-cover shrink-0 border border-border"
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/player/${player.id}`}
            className="text-sm font-medium text-foreground hover:underline no-underline truncate"
          >
            {player.name}
          </Link>
          {player.position && (
            <span className="text-[0.6875rem] text-muted-foreground">{player.position}</span>
          )}
          {team && (
            <span className="text-[0.6875rem] text-muted-foreground">· {team.name}</span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {isInjured ? (
            <span className="text-[0.6875rem] text-destructive/80">Injured</span>
          ) : (
            <span className="text-[0.6875rem] text-emerald-500">Available</span>
          )}
          {hasSignal && (
            <span
              className={cn(
                'text-[0.6875rem] font-medium rounded px-1.5 py-0.5',
                signalPct >= 0.7
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-yellow-500/10 text-yellow-400',
              )}
            >
              {Math.round(signalPct * 100)}% return signal
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onRemove(player.id)}
        title="Remove from watchlist"
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors bg-transparent border-0 cursor-pointer"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Alert Card ──────────────────────────────────────────────────────────────

function AlertCard({ alert, onRead }: { alert: WatchlistAlertEntry; onRead: (id: string) => void }) {
  const isUnread = !alert.readAt;
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
        isUnread ? 'border-primary/30 bg-primary/5' : 'border-border bg-card',
      )}
    >
      <span className="text-base shrink-0 mt-0.5">{ALERT_ICONS[alert.alertType] ?? '🔔'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">{alert.message}</p>
        <p className="text-[0.6875rem] text-muted-foreground mt-0.5">
          {new Date(alert.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      {isUnread && (
        <button
          onClick={() => onRead(alert.id)}
          className="shrink-0 text-[0.6875rem] text-primary hover:text-primary/70 transition-colors bg-transparent border-0 cursor-pointer whitespace-nowrap"
        >
          Mark read
        </button>
      )}
    </div>
  );
}
