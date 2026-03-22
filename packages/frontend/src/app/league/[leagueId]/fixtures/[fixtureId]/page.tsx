import { fetchApi } from "@/lib/api";
import Link from "next/link";
import { getLocale } from "@/lib/locale";
import { t, type Locale } from "@/lib/i18n";
import { LEAGUE_NAMES, CURRENT_SEASON, SITE_URL } from "@/lib/constants";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { leagueId: string; fixtureId: string };
}): Promise<Metadata> {
  const leagueId = parseInt(params.leagueId);
  const fixtureId = parseInt(params.fixtureId);
  const leagueName = LEAGUE_NAMES[leagueId] ?? `League ${leagueId}`;
  try {
    const fixture = await fetchApi<FixtureDetail>(`/api/fixtures/${fixtureId}`);
    const matchTitle = `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`;
    const title = `${matchTitle} — ${leagueName}`;
    const description = `${matchTitle} match analysis: injury impact comparison, predicted lineups, and Power Loss % in ${leagueName}.`;
    return {
      title,
      description,
      openGraph: { title: `${title} | SquadCheck`, description },
      alternates: { canonical: `/league/${leagueId}/fixtures/${fixtureId}` },
    };
  } catch {
    return {
      title: `Match Analysis — ${leagueName}`,
      alternates: { canonical: `/league/${leagueId}/fixtures/${fixtureId}` },
    };
  }
}

import type {
  FixtureDetail,
  FixtureTeamStats,
  FixtureTeamLineup,
  FixtureEvent,
  InjuryImpact,
  PredictedLineup,
  Standing,
} from "@/lib/types";
import { formatRoundLabel, parseRoundNumber } from "@/lib/format";
import { ClientMatchDateTime } from "@/components/client-date";
import { InjuredPlayerCard } from "@/components/injured-player-card";
import { OutcomeImpactCard } from "@/components/outcome-impact-card";
import { SectionHeader } from "@/components/section-header";
import { PowerLossGauge } from "@/components/power-loss-gauge";
import { cn } from "@/lib/utils";
import { TeamLogo } from "@/components/team-logo";
import { PredictedLineupColumn } from "@/components/predicted-lineup-column";

const COMPLETED_STATUSES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);

// ── UPCOMING: Injury column ───────────────────────────────────────────────────

function InjuryColumn({
  impact,
  locale,
}: {
  impact: InjuryImpact | null;
  locale: Locale;
}) {
  const team = impact?.team;
  const highImpact =
    impact?.injuredPlayers.filter(
      (p) => p.severity === "critical" || p.severity === "high",
    ) ?? [];
  const otherInjured =
    impact?.injuredPlayers.filter(
      (p) => p.severity === "moderate" || p.severity === "low",
    ) ?? [];
  const totalOut = impact?.injuredPlayers.length ?? 0;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <TeamLogo logo={team?.logo} size="lg" />
        <span className="text-sm font-semibold text-foreground">
          {team?.name ?? "—"}
        </span>
      </div>

      {impact && (
        <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
          <div className="px-4 py-3 flex flex-col items-center justify-center">
            <PowerLossGauge value={impact.powerLossPct} size="sm" locale={locale} />
          </div>
          <div className="px-4 py-3 text-center">
            <div
              className={cn(
                "text-2xl font-light font-mono",
                totalOut >= 4
                  ? "text-[var(--sc-red)]"
                  : totalOut >= 2
                    ? "text-[var(--sc-orange)]"
                    : "text-muted-foreground",
              )}
            >
              {totalOut}
            </div>
            <div className="text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground mt-1">
              {t(locale, "players_out")}
            </div>
          </div>
        </div>
      )}

      {impact?.outcomeImpact && impact.outcomeImpact.playerRecords.length > 0 && (
        <div className="px-3 py-3 border-b border-border">
          <OutcomeImpactCard outcome={impact.outcomeImpact} locale={locale} size="sm" />
        </div>
      )}

      {impact && totalOut === 0 && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          {t(locale, "no_injuries")}
        </div>
      )}

      {highImpact.length > 0 && (
        <div>
          <div className="px-4 py-2 border-b border-border bg-muted/20">
            <span className="text-[0.6875rem] font-semibold tracking-wider uppercase text-[var(--sc-red)]">
              {t(locale, "key_absences")}
            </span>
          </div>
          <div className="flex flex-col">
            {highImpact.map((ip) => (
              <InjuredPlayerCard
                key={ip.player.id}
                ip={ip}
                locale={locale}
                variant="fixture"
                severity="high"
                playerRecord={impact?.outcomeImpact?.playerRecords?.find(
                  (r) => r.playerId === ip.player.id,
                )}
              />
            ))}
          </div>
        </div>
      )}

      {otherInjured.length > 0 && (
        <div>
          <div className="px-4 py-2 border-b border-border bg-muted/20">
            <span className="text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground">
              {t(locale, "other_injuries")}
            </span>
          </div>
          <div className="flex flex-col">
            {otherInjured.map((ip) => (
              <InjuredPlayerCard
                key={ip.player.id}
                ip={ip}
                locale={locale}
                variant="fixture"
                severity="other"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── UPCOMING: Predicted lineup column ────────────────────────────────────────

// ── RESULT: Match events ──────────────────────────────────────────────────────

function eventIcon(type: string, detail: string | null): string {
  if (type === "Goal") return "⚽";
  if (type === "Card")
    return detail?.toLowerCase().includes("red") ? "🟥" : "🟨";
  if (type === "subst") return "🔄";
  if (type === "Var") return "📺";
  return "•";
}

// ── RESULT: Compact horizontal timeline ──────────────────────────────────────

function CompactTimeline({
  events,
  homeTeamId,
}: {
  events: FixtureEvent[];
  homeTeamId: number;
}) {
  const relevant = events.filter((ev) =>
    ["Goal", "Card", "subst"].includes(ev.type),
  );
  if (relevant.length === 0) return null;

  const icon = (ev: FixtureEvent) => {
    if (ev.type === "Goal") return "⚽";
    if (ev.type === "Card")
      return ev.detail?.toLowerCase().includes("red") ? "🟥" : "🟨";
    return "🔄";
  };

  return (
    <div className="bg-card px-4 pt-2 pb-1.5">
      <div className="text-[0.4375rem] text-muted-foreground tracking-widest mb-0.5">
        HOME
      </div>
      <div className="relative h-[3.75rem]">
        <div className="absolute top-1/2 left-0 right-8 h-px bg-border" />
        <div
          className="absolute bg-muted-foreground/40"
          style={{
            left: `${(45 / 95) * 92}%`,
            top: "calc(50% - 3px)",
            height: "6px",
            width: "1px",
          }}
        />
        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[0.5rem] text-muted-foreground font-mono">
          90'
        </span>

        {relevant.map((ev) => {
          const isHome = ev.teamId === homeTeamId;
          const mins = ev.timeElapsed + (ev.timeExtra ?? 0);
          const pct = Math.min(Math.max((mins / 95) * 92, 1), 91);
          const ic = icon(ev);
          const label = ev.timeExtra
            ? `${ev.timeElapsed}+${ev.timeExtra}'`
            : `${ev.timeElapsed}'`;

          return (
            <div
              key={ev.id}
              style={{
                position: "absolute",
                left: `${pct}%`,
                top: "50%",
                transform: "translateX(-50%)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background:
                    ev.type === "Goal"
                      ? "var(--primary)"
                      : "var(--muted-foreground)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                  ...(isHome ? { bottom: "6px" } : { top: "6px" }),
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1px",
                }}
              >
                <span style={{ fontSize: "0.75rem", lineHeight: 1 }}>{ic}</span>
                <span
                  style={{
                    fontSize: "0.4375rem",
                    color: "var(--muted-foreground)",
                    fontFamily: "var(--font-mono)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[0.4375rem] text-muted-foreground tracking-widest mt-0.5">
        AWAY
      </div>
    </div>
  );
}

function MatchEvents({
  events,
  homeTeamId,
  locale,
}: {
  events: FixtureEvent[];
  homeTeamId: number;
  locale: Locale;
}) {
  if (!events.length) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        {t(locale, "no_match_events")}
      </div>
    );
  }
  return (
    <div className="flex flex-col divide-y divide-border">
      {events.map((ev) => {
        const isHome = ev.teamId === homeTeamId;
        const time = ev.timeExtra
          ? `${ev.timeElapsed}+${ev.timeExtra}'`
          : `${ev.timeElapsed}'`;
        const icon = eventIcon(ev.type, ev.detail);
        const isGoal = ev.type === "Goal";
        const isSub = ev.type === "subst";

        const playerBlock = (
          <span
            className={cn(
              "text-[0.8125rem]",
              isGoal ? "text-foreground font-semibold" : "text-foreground/70",
            )}
          >
            {ev.player?.name ?? ""}
            {isSub && ev.assist && (
              <span className="text-[0.6875rem] text-muted-foreground block">
                ↑ {ev.assist.name}
              </span>
            )}
            {isGoal && ev.assist && (
              <span className="text-[0.6875rem] text-muted-foreground block">
                {ev.assist.name}
              </span>
            )}
          </span>
        );

        return (
          <div
            key={ev.id}
            className="grid grid-cols-[1fr_3.5rem_1fr] items-center bg-card px-4 py-2 min-h-10"
          >
            <div className="text-right pr-3">{isHome && playerBlock}</div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[0.625rem] text-muted-foreground font-mono">
                {time}
              </span>
              <span className="text-sm">{icon}</span>
            </div>
            <div className="text-left pl-3">{!isHome && playerBlock}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── RESULT: Actual lineup column ──────────────────────────────────────────────

function ActualLineupColumn({
  lineup,
  events,
  locale,
}: {
  lineup: FixtureTeamLineup;
  events: FixtureEvent[];
  locale: Locale;
}) {
  const starters = lineup.players.filter((p) => p.isStarting);
  const bench = lineup.players.filter((p) => !p.isStarting);

  const teamSubs = events.filter(
    (ev) => ev.type === "subst" && ev.teamId === lineup.team.id,
  );
  const subOutIds = new Set(
    teamSubs
      .map((ev) => ev.player?.id)
      .filter((id): id is number => id !== undefined),
  );
  const subInIds = new Set(
    teamSubs
      .map((ev) => ev.assist?.id)
      .filter((id): id is number => id !== undefined),
  );

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <TeamLogo logo={lineup.team.logo} size="lg" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">
            {lineup.team.name}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {lineup.formation && <span>{lineup.formation}</span>}
            {lineup.coachName && (
              <span className={lineup.formation ? "ml-2" : ""}>
                {t(locale, "coach")}: {lineup.coachName}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {starters.map((p) => (
          <div
            key={p.player.id}
            className="flex items-center gap-2.5 px-4 py-2"
          >
            <span className="text-[0.6875rem] text-muted-foreground font-mono min-w-5 text-right shrink-0">
              {p.number ?? ""}
            </span>
            <span className="text-[0.6875rem] font-semibold text-muted-foreground min-w-8 shrink-0">
              {p.position ?? ""}
            </span>
            <span className="text-[0.8125rem] text-foreground overflow-hidden text-ellipsis whitespace-nowrap flex-1">
              {p.playerName}
            </span>
            {subOutIds.has(p.player.id) && (
              <span className="text-[var(--sc-red)] shrink-0 leading-none text-base">
                ↓
              </span>
            )}
          </div>
        ))}
      </div>

      {bench.length > 0 && (
        <>
          <div className="px-4 py-1.5 border-t border-border bg-muted/20">
            <span className="text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground">
              {t(locale, "bench")}
            </span>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {bench.map((p) => (
              <div
                key={p.player.id}
                className="flex items-center gap-2.5 px-4 py-1.5"
              >
                <span className="text-[0.6875rem] text-muted-foreground font-mono min-w-5 text-right shrink-0">
                  {p.number ?? ""}
                </span>
                <span className="text-[0.6875rem] font-semibold text-muted-foreground min-w-8 shrink-0">
                  {p.position ?? ""}
                </span>
                <span className="text-xs text-foreground/70 overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                  {p.playerName}
                </span>
                {subInIds.has(p.player.id) && (
                  <span className="text-[var(--sc-green)] shrink-0 leading-none text-base">
                    ↑
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── RESULT: Statistics comparison ─────────────────────────────────────────────

function StatRow({
  label,
  homeVal,
  awayVal,
  format = "number",
}: {
  label: string;
  homeVal: number | null | undefined;
  awayVal: number | null | undefined;
  format?: "number" | "pct" | "decimal";
}) {
  const h = homeVal ?? 0;
  const a = awayVal ?? 0;
  const total = h + a || 1;
  const fmt = (v: number) =>
    format === "pct"
      ? `${v}%`
      : format === "decimal"
        ? v.toFixed(2)
        : String(v);

  return (
    <div className="grid grid-cols-[3rem_1fr_5rem_1fr_3rem] items-center gap-2 px-4 py-2.5 border-b border-border bg-card last:border-0">
      <span className="text-sm font-semibold text-foreground text-right font-mono">
        {fmt(h)}
      </span>
      <div className="h-1.5 bg-muted rounded-sm overflow-hidden flex justify-end">
        <div
          className={cn(
            "h-1.5 rounded-sm",
            h >= a ? "bg-primary" : "bg-muted-foreground/40",
          )}
          style={{ width: `${(h / total) * 100}%` }}
        />
      </div>
      <span className="text-[0.6875rem] text-muted-foreground text-center leading-tight">
        {label}
      </span>
      <div className="h-1.5 bg-muted rounded-sm overflow-hidden">
        <div
          className={cn(
            "h-1.5 rounded-sm",
            a >= h ? "bg-primary" : "bg-muted-foreground/40",
          )}
          style={{ width: `${(a / total) * 100}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-foreground font-mono">
        {fmt(a)}
      </span>
    </div>
  );
}

function Statistics({
  stats,
  homeTeamId,
  locale,
}: {
  stats: FixtureTeamStats[];
  homeTeamId: number;
  locale: Locale;
}) {
  if (!stats.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-4 py-8 text-center text-sm text-muted-foreground">
        {t(locale, "no_statistics")}
      </div>
    );
  }
  const home = stats.find((s) => s.team.id === homeTeamId) ?? stats[0];
  const away = stats.find((s) => s.team.id !== homeTeamId) ?? stats[1];
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr_5rem_1fr] px-4 py-2.5 border-b border-border bg-muted/30">
        <span className="text-xs font-semibold text-foreground">
          {home?.team.name}
        </span>
        <span />
        <span className="text-xs font-semibold text-foreground text-right">
          {away?.team.name}
        </span>
      </div>
      <StatRow
        label={t(locale, "stat_possession")}
        homeVal={home?.possession}
        awayVal={away?.possession}
        format="pct"
      />
      <StatRow
        label={t(locale, "stat_shots")}
        homeVal={home?.totalShots}
        awayVal={away?.totalShots}
      />
      <StatRow
        label={t(locale, "stat_on_target")}
        homeVal={home?.shotsOnGoal}
        awayVal={away?.shotsOnGoal}
      />
      <StatRow
        label={t(locale, "stat_xg")}
        homeVal={home?.expectedGoals ?? undefined}
        awayVal={away?.expectedGoals ?? undefined}
        format="decimal"
      />
      <StatRow
        label={t(locale, "stat_corners")}
        homeVal={home?.cornerKicks}
        awayVal={away?.cornerKicks}
      />
      <StatRow
        label={t(locale, "stat_fouls")}
        homeVal={home?.fouls}
        awayVal={away?.fouls}
      />
      <StatRow
        label={t(locale, "stat_offsides")}
        homeVal={home?.offsides}
        awayVal={away?.offsides}
      />
      <StatRow
        label={t(locale, "stat_saves")}
        homeVal={home?.goalkeeperSaves}
        awayVal={away?.goalkeeperSaves}
      />
      <StatRow
        label={t(locale, "stat_pass_pct")}
        homeVal={home?.passPercent ?? undefined}
        awayVal={away?.passPercent ?? undefined}
        format="pct"
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FixtureDetailPage({
  params,
}: {
  params: { leagueId: string; fixtureId: string };
}) {
  const leagueId = parseInt(params.leagueId);
  const fixtureId = parseInt(params.fixtureId);
  const locale = getLocale();
  const leagueName = LEAGUE_NAMES[leagueId] ?? `League ${leagueId}`;
  const fixturesBase = `/league/${leagueId}/fixtures`;

  let fixture: FixtureDetail | null = null;
  let rankMap: Record<number, number> = {};

  try {
    const [f, standing] = await Promise.all([
      fetchApi<FixtureDetail>(`/api/fixtures/${fixtureId}`),
      fetchApi<Standing>(
        `/api/standings?league=${leagueId}&season=${CURRENT_SEASON}`,
      ).catch(() => null),
    ]);
    fixture = f;
    if (standing) {
      for (const e of standing.entries) rankMap[e.team.id] = e.rank;
    }
  } catch {}

  if (!fixture) {
    return (
      <div className="max-w-[72rem] mx-auto">
        <div className="bg-card border border-border rounded-lg px-4 py-8 text-center text-sm text-muted-foreground">
          Match not found.
        </div>
      </div>
    );
  }

  const isCompleted = COMPLETED_STATUSES.has(fixture.status);
  const roundNum = parseRoundNumber(fixture.round);
  const backUrl = isCompleted
    ? `${fixturesBase}?tab=results${roundNum !== null ? `&round=${roundNum}` : ""}`
    : roundNum !== null
      ? `${fixturesBase}?round=${roundNum}`
      : fixturesBase;

  let homeImpact: InjuryImpact | null = null;
  let awayImpact: InjuryImpact | null = null;
  let homeLineup: PredictedLineup | null = null;
  let awayLineup: PredictedLineup | null = null;

  if (!isCompleted) {
    try {
      const [hi, ai, hl, al] = await Promise.all([
        fetchApi<InjuryImpact>(
          `/api/analysis/injury-impact/${fixture.homeTeam.id}?league=${leagueId}`,
        ),
        fetchApi<InjuryImpact>(
          `/api/analysis/injury-impact/${fixture.awayTeam.id}?league=${leagueId}`,
        ),
        fetchApi<PredictedLineup>(
          `/api/analysis/predicted-lineup/${fixture.homeTeam.id}?league=${leagueId}`,
        ).catch(() => null),
        fetchApi<PredictedLineup>(
          `/api/analysis/predicted-lineup/${fixture.awayTeam.id}?league=${leagueId}`,
        ).catch(() => null),
      ]);
      homeImpact = hi;
      awayImpact = ai;
      homeLineup = hl;
      awayLineup = al;
    } catch {}
  }

  const statusLabel =
    fixture.status === "AET" ? "AET" : fixture.status === "PEN" ? "PEN" : "FT";
  const homeGoals = fixture.goalsHome ?? 0;
  const awayGoals = fixture.goalsAway ?? 0;
  const homeWon = homeGoals > awayGoals;
  const awayWon = awayGoals > homeGoals;

  const homeActualLineup =
    fixture.lineups.find((l) => l.team.id === fixture!.homeTeam.id) ?? null;
  const awayActualLineup =
    fixture.lineups.find((l) => l.team.id === fixture!.awayTeam.id) ?? null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`,
    sport: "Association Football",
    startDate: fixture.date,
    url: `${SITE_URL}/league/${leagueId}/fixtures/${fixtureId}`,
    description: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name} — ${leagueName} match analysis with injury impact and predicted lineups.`,
    homeTeam: { "@type": "SportsTeam", name: fixture.homeTeam.name },
    awayTeam: { "@type": "SportsTeam", name: fixture.awayTeam.name },
    ...(fixture.venueName && {
      location: {
        "@type": "StadiumOrArena",
        name: fixture.venueName,
        ...(fixture.venueCity && { address: fixture.venueCity }),
      },
    }),
    eventStatus: isCompleted
      ? "https://schema.org/EventCompleted"
      : "https://schema.org/EventScheduled",
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: leagueName, item: `${SITE_URL}/league/${leagueId}` },
      { "@type": "ListItem", position: 3, name: "Fixtures", item: `${SITE_URL}/league/${leagueId}/fixtures` },
      { "@type": "ListItem", position: 4, name: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}` },
    ],
  };

  return (
    <div className="max-w-[72rem] mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Back button */}
      <Link
        href={backUrl}
        className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground no-underline hover:text-foreground transition-colors mb-4"
      >
        ← {t(locale, isCompleted ? "tab_results" : "fixtures_title")}
      </Link>

      {/* Header */}
      <div className="mb-6 pb-5 border-b border-border">
        <p className="text-[0.6875rem] font-semibold tracking-wider uppercase text-muted-foreground mb-2">
          <Link
            href={`/league/${leagueId}`}
            className="text-muted-foreground no-underline hover:text-foreground transition-colors"
          >
            {leagueName}
          </Link>
          {" / "}
          <Link
            href={backUrl}
            className="text-muted-foreground no-underline hover:text-foreground transition-colors"
          >
            {t(locale, "fixtures_title")}
          </Link>
          {" / "}
          {t(locale, isCompleted ? "result_detail" : "match_detail")}
        </p>

        {/* Match header */}
        <div className="flex items-center gap-4 mt-2">
          {/* Home team */}
          <Link
            href={`/team/${fixture.homeTeam.id}?league=${leagueId}`}
            className="flex items-center gap-2.5 flex-1 min-w-0 no-underline"
          >
            {fixture.homeTeam.logo && (
              <img
                src={fixture.homeTeam.logo}
                alt=""
                className={cn(
                  "w-10 h-10 object-contain shrink-0 transition-opacity",
                  isCompleted && awayWon ? "opacity-40" : "",
                )}
              />
            )}
            <div className="min-w-0">
              <h1
                className={cn(
                  "text-2xl font-semibold m-0 overflow-hidden text-ellipsis whitespace-nowrap",
                  isCompleted && awayWon
                    ? "text-muted-foreground"
                    : "text-foreground",
                )}
              >
                {fixture.homeTeam.name}
              </h1>
              {rankMap[fixture.homeTeam.id] && (
                <span className="text-xs text-muted-foreground font-mono">
                  #{rankMap[fixture.homeTeam.id]}
                </span>
              )}
            </div>
          </Link>

          {/* Score / vs */}
          {isCompleted ? (
            <div className="flex flex-col items-center shrink-0">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold font-mono text-foreground">
                  {homeGoals}
                </span>
                <span className="text-xl text-muted-foreground font-light">
                  —
                </span>
                <span className="text-4xl font-bold font-mono text-foreground">
                  {awayGoals}
                </span>
              </div>
              <span className="text-[0.6875rem] font-semibold text-muted-foreground tracking-widest uppercase">
                {statusLabel}
              </span>
            </div>
          ) : (
            <div className="text-base font-bold text-muted-foreground shrink-0 tracking-widest">
              vs
            </div>
          )}

          {/* Away team */}
          <Link
            href={`/team/${fixture.awayTeam.id}?league=${leagueId}`}
            className="flex items-center justify-end gap-2.5 flex-1 min-w-0 no-underline"
          >
            <div className="min-w-0 text-right">
              <h1
                className={cn(
                  "text-2xl font-semibold m-0 overflow-hidden text-ellipsis whitespace-nowrap",
                  isCompleted && homeWon
                    ? "text-muted-foreground"
                    : "text-foreground",
                )}
              >
                {fixture.awayTeam.name}
              </h1>
              {rankMap[fixture.awayTeam.id] && (
                <span className="text-xs text-muted-foreground font-mono">
                  #{rankMap[fixture.awayTeam.id]}
                </span>
              )}
            </div>
            {fixture.awayTeam.logo && (
              <img
                src={fixture.awayTeam.logo}
                alt=""
                className={cn(
                  "w-10 h-10 object-contain shrink-0 transition-opacity",
                  isCompleted && homeWon ? "opacity-40" : "",
                )}
              />
            )}
          </Link>
        </div>

        {/* Match meta */}
        <div className="flex items-center gap-4 mt-2.5 flex-wrap">
          <span className="text-xs text-primary font-semibold">
            {formatRoundLabel(fixture.round, locale)}
          </span>
          <span className="text-xs text-foreground/70 font-mono">
            <ClientMatchDateTime dateStr={fixture.date} locale={locale} />
          </span>
          {fixture.venueName && (
            <span className="text-xs text-muted-foreground">
              {fixture.venueName}
              {fixture.venueCity ? `, ${fixture.venueCity}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* ── COMPLETED: Result view ─────────────────────────────────────────── */}
      {isCompleted && (
        <>
          <div className="mb-6">
            <SectionHeader label={t(locale, "match_events")} />
            {fixture.events.length > 0 ? (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <CompactTimeline
                  events={fixture.events}
                  homeTeamId={fixture.homeTeam.id}
                />
                <details>
                  <summary className="cursor-pointer list-none flex items-center gap-1 px-4 py-2 border-t border-border text-[0.6875rem] text-muted-foreground select-none hover:bg-accent/50 transition-colors">
                    ▾ {t(locale, "events_show_all")}
                  </summary>
                  <MatchEvents
                    events={fixture.events}
                    homeTeamId={fixture.homeTeam.id}
                    locale={locale}
                  />
                </details>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg px-4 py-8 text-center text-sm text-muted-foreground">
                {t(locale, "no_match_events")}
              </div>
            )}
          </div>

          <div className="mb-6">
            <SectionHeader label={t(locale, "actual_lineups")} />
            {homeActualLineup || awayActualLineup ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {homeActualLineup ? (
                  <ActualLineupColumn
                    lineup={homeActualLineup}
                    events={fixture.events}
                    locale={locale}
                  />
                ) : (
                  <div className="bg-card border border-border rounded-lg px-4 py-8 text-center text-sm text-muted-foreground">
                    {t(locale, "no_lineups")}
                  </div>
                )}
                {awayActualLineup ? (
                  <ActualLineupColumn
                    lineup={awayActualLineup}
                    events={fixture.events}
                    locale={locale}
                  />
                ) : (
                  <div className="bg-card border border-border rounded-lg px-4 py-8 text-center text-sm text-muted-foreground">
                    {t(locale, "no_lineups")}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg px-4 py-8 text-center text-sm text-muted-foreground">
                {t(locale, "no_lineups")}
              </div>
            )}
          </div>

          <div className="mb-6">
            <SectionHeader label={t(locale, "statistics")} />
            <Statistics
              stats={fixture.statistics}
              homeTeamId={fixture.homeTeam.id}
              locale={locale}
            />
          </div>
        </>
      )}

      {/* ── UPCOMING: Injury + Predicted lineup view ───────────────────────── */}
      {!isCompleted && (
        <>
          <div className="mb-4">
            <SectionHeader label={t(locale, "injury_comparison")} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InjuryColumn impact={homeImpact} locale={locale} />
              <InjuryColumn impact={awayImpact} locale={locale} />
            </div>
            <div className="flex justify-center mt-4">
              <Link
                href={`/matchup?home=${fixture.homeTeam.id}&away=${fixture.awayTeam.id}&season=${CURRENT_SEASON}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent/50 transition-colors"
              >
                View Full Matchup Analysis →
              </Link>
            </div>
          </div>

          <div>
            <SectionHeader label={t(locale, "predicted_lineups")} tooltip={t(locale, "tooltip_predicted_lineup")} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PredictedLineupColumn lineup={homeLineup} locale={locale} />
              <PredictedLineupColumn lineup={awayLineup} locale={locale} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
