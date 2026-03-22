'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { fetchApiAuth } from '@/lib/api';
import type { WatchlistAlertEntry, WatchlistAlertsResponse } from '@/lib/types';
import { ALERT_ICONS } from '@/lib/types';

export function NotificationBell({ align = 'right', direction = 'down' }: { align?: 'left' | 'right'; direction?: 'up' | 'down' }) {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [alerts, setAlerts] = useState<WatchlistAlertEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await fetchApiAuth<WatchlistAlertsResponse>('/api/watchlist/alerts?limit=5');
      setAlerts(data.alerts);
      setUnreadCount(data.unreadCount);
      setLoaded(true);
    } catch {
      // not signed in or network error
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchAlerts();
    // Poll every 2 minutes
    const id = setInterval(fetchAlerts, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [session, fetchAlerts]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (!session) return null;

  async function markRead(id: string) {
    try {
      await fetchApiAuth(`/api/watchlist/alerts/${id}/read`, { method: 'PATCH' });
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, readAt: new Date().toISOString() } : a)));
      setUnreadCount((n) => Math.max(0, n - 1));
    } catch {
      // silent
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className="relative w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer rounded"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {loaded && unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-primary text-primary-foreground text-[0.5rem] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} ${direction === 'up' ? 'bottom-9' : 'top-9'} w-72 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-[200]`}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-foreground">Notifications</span>
            <Link
              href="/watchlist"
              onClick={() => setOpen(false)}
              className="text-[0.6875rem] text-primary hover:text-primary/70 no-underline"
            >
              See all
            </Link>
          </div>

          {alerts.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">No alerts yet</div>
          ) : (
            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-2 px-3 py-2.5 ${!alert.readAt ? 'bg-primary/5' : ''}`}
                >
                  <span className="text-sm shrink-0 mt-0.5">{ALERT_ICONS[alert.alertType] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.75rem] text-foreground leading-snug">{alert.message}</p>
                    <p className="text-[0.625rem] text-muted-foreground mt-0.5">
                      {new Date(alert.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!alert.readAt && (
                    <button
                      onClick={() => markRead(alert.id)}
                      className="shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5 cursor-pointer border-0"
                      title="Mark as read"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
