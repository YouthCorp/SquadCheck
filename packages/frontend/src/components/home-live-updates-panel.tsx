import Link from "next/link";
import { t, tInjury } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { LiveUpdatesData, RecentInjuryEntry, RecentSignalEntry } from "@/lib/types";
import { TeamLogo } from "@/components/team-logo";
import { Badge } from "@/components/ui/badge";
import { ScrollHint } from "@/components/ui/scroll-hint";

interface Props {
  data: LiveUpdatesData;
  locale: Locale;
}

/** Returns a relative time string like "2h ago", "3d ago", "5m ago" */
function timeAgo(locale: Locale, dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (locale === "ko") {
    if (days >= 1) return `${days}일 전`;
    if (hours >= 1) return `${hours}시간 전`;
    return `${minutes}분 전`;
  }
  if (days >= 1) return `${days}d ago`;
  if (hours >= 1) return `${hours}h ago`;
  return `${minutes}m ago`;
}

function isNew(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 86_400_000;
}

function signalStageLabel(locale: Locale, stage: string | null): string {
  if (!stage) return "—";
  const map: Record<string, { en: string; ko: string }> = {
    partial_training: { en: "Partial Training", ko: "부분 훈련" },
    full_training: { en: "Full Training", ko: "전체 훈련" },
    available: { en: "Available", ko: "복귀 가능" },
    expected_to_start: { en: "Expected to Start", ko: "선발 예상" },
  };
  return map[stage]?.[locale] ?? stage;
}

function availabilityColor(pct: number): string {
  if (pct >= 0.7) return "text-[color:var(--sc-green)]";
  if (pct >= 0.4) return "text-[color:var(--sc-yellow)]";
  return "text-muted-foreground";
}

function InjuryRow({ entry, locale }: { entry: RecentInjuryEntry; locale: Locale }) {
  const isNewEntry = isNew(entry.fixtureDate);
  return (
    <Link
      href={`/team/${entry.team.id}?league=${entry.league.apiFootballId}`}
      className="flex items-center gap-3 py-2.5 px-3 rounded-md hover:bg-muted/50 transition-colors group"
    >
      {/* Player avatar */}
      <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0 overflow-hidden border border-border">
        {entry.player.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.player.photo}
            alt={entry.player.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground font-semibold">
            {entry.player.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Player + team */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground truncate leading-tight">
            {entry.player.name}
          </span>
          {isNewEntry && (
            <Badge variant="info" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
              {t(locale, "new_badge")}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <TeamLogo logo={entry.team.logo} size="xs" />
          <span className="text-xs text-muted-foreground truncate">{entry.team.name}</span>
        </div>
      </div>

      {/* Injury reason + time */}
      <div className="flex-shrink-0 text-right">
        <div className="text-xs text-muted-foreground/80 truncate max-w-[100px]">
          {tInjury(locale, entry.reason)}
        </div>
        <div className="text-[11px] text-muted-foreground/50 mt-0.5">
          {timeAgo(locale, entry.fixtureDate)}
        </div>
      </div>
    </Link>
  );
}

function SignalRow({ entry, locale }: { entry: RecentSignalEntry; locale: Locale }) {
  const pct = Math.round(entry.predictedAvailability * 100);
  const isNewEntry = isNew(entry.lastSignalAt);
  const href = entry.team ? `/team/${entry.team.id}` : "#";
  return (
    <Link
      href={href}
      className="flex items-center gap-3 py-2.5 px-3 rounded-md hover:bg-muted/50 transition-colors group"
    >
      {/* Player avatar */}
      <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0 overflow-hidden border border-border">
        {entry.player.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.player.photo}
            alt={entry.player.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground font-semibold">
            {entry.player.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Player + team */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground truncate leading-tight">
            {entry.player.name}
          </span>
          {isNewEntry && (
            <Badge variant="info" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
              {t(locale, "new_badge")}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {entry.team && <TeamLogo logo={entry.team.logo} size="xs" />}
          <span className="text-xs text-muted-foreground truncate">
            {entry.team?.name ?? "—"}
          </span>
        </div>
      </div>

      {/* Signal stage + probability + time */}
      <div className="flex-shrink-0 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-xs text-muted-foreground/80 truncate max-w-[90px]">
            {signalStageLabel(locale, entry.latestSignalStage)}
          </span>
          <span className={`text-xs font-semibold tabular-nums ${availabilityColor(entry.predictedAvailability)}`}>
            {pct}%
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground/50 mt-0.5">
          {timeAgo(locale, entry.lastSignalAt)}
        </div>
      </div>
    </Link>
  );
}

export function HomeLiveUpdatesPanel({ data, locale }: Props) {
  const recentInjuries = data.recentInjuries.slice(0, 10);
  const recentSignals = data.recentSignals.slice(0, 10);

  return (
    <div className="mt-8">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t(locale, "live_updates")}
        </span>
        {/* Live indicator dot */}
        <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--sc-green)] animate-pulse" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Recent Injuries */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[color:var(--sc-red)] flex-shrink-0" />
            <span className="text-sm font-semibold text-foreground">
              {t(locale, "recent_injuries")}
            </span>
          </div>
          <ScrollHint maxHeight="480px" className="divide-y divide-border/50">
            {recentInjuries.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                {t(locale, "no_recent_injuries")}
              </p>
            ) : (
              recentInjuries.map((entry) => (
                <InjuryRow key={entry.id} entry={entry} locale={locale} />
              ))
            )}
          </ScrollHint>
        </div>

        {/* Right: Recovery Signals */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[color:var(--sc-green)] flex-shrink-0" />
            <span className="text-sm font-semibold text-foreground">
              {t(locale, "recovery_signals")}
            </span>
          </div>
          <ScrollHint maxHeight="480px" className="divide-y divide-border/50">
            {recentSignals.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                {t(locale, "no_recovery_signals")}
              </p>
            ) : (
              recentSignals.map((entry) => (
                <SignalRow key={entry.playerId} entry={entry} locale={locale} />
              ))
            )}
          </ScrollHint>
        </div>
      </div>
    </div>
  );
}
