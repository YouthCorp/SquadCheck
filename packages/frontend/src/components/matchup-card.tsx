import { PowerLossGauge } from "@/components/power-loss-gauge";
import { TeamLogo } from "@/components/team-logo";
import { cn } from "@/lib/utils";
import type { InjuryImpact } from "@/lib/types";
import type { Locale } from "@/lib/i18n";

interface TeamSideProps {
  impact: InjuryImpact | null;
  align: "left" | "right";
  locale: Locale;
}

function TeamSide({ impact, align, locale }: TeamSideProps) {
  if (!impact) {
    return (
      <div
        className={cn(
          "flex flex-col gap-4 p-6",
          align === "right" && "items-end text-right",
        )}
      >
        <div className="text-sm text-muted-foreground">Data unavailable</div>
      </div>
    );
  }

  const highImpact = impact.injuredPlayers.filter(
    (p) => p.severity === "critical" || p.severity === "high",
  );
  const others = impact.injuredPlayers.filter(
    (p) => p.severity === "moderate" || p.severity === "low",
  );
  const totalOut = impact.injuredPlayers.length;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 p-6",
        align === "right" && "items-end text-right",
      )}
    >
      {/* Team header */}
      <div
        className={cn(
          "flex items-center gap-3",
          align === "right" && "flex-row-reverse",
        )}
      >
        <TeamLogo logo={impact.team.logo} size="lg" />
        <span className="text-base font-semibold text-foreground">
          {impact.team.name}
        </span>
      </div>

      {/* Power loss gauge */}
      <PowerLossGauge value={impact.powerLossPct} size="sm" locale={locale} />

      {/* Injury count */}
      <div
        className={cn(
          "text-xs text-muted-foreground",
          totalOut === 0 && "text-[var(--sc-green)]",
        )}
      >
        {totalOut === 0
          ? "No injuries"
          : `${totalOut} player${totalOut !== 1 ? "s" : ""} out`}
      </div>

      {/* High-impact injuries */}
      {highImpact.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {highImpact.slice(0, 3).map((p) => (
            <div
              key={p.player.id}
              className={cn(
                "flex items-center gap-2",
                align === "right" && "flex-row-reverse",
              )}
            >
              <span
                className={cn(
                  "inline-block w-1.5 h-1.5 rounded-full shrink-0",
                  p.severity === "critical"
                    ? "bg-[var(--sc-red)]"
                    : "bg-[var(--sc-orange)]",
                )}
              />
              <span className="text-xs text-foreground truncate max-w-[160px]">
                {p.player.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Other injuries (compact count) */}
      {others.length > 0 && (
        <div className="text-xs text-muted-foreground">
          +{others.length} more
        </div>
      )}
    </div>
  );
}

interface MatchupCardProps {
  homeImpact: InjuryImpact | null;
  awayImpact: InjuryImpact | null;
  locale: Locale;
}

export function MatchupCard({ homeImpact, awayImpact, locale }: MatchupCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr]">
        <TeamSide impact={homeImpact} align="left" locale={locale} />

        {/* VS divider */}
        <div className="hidden md:flex items-center justify-center px-4 border-x border-border">
          <span className="text-xl font-light text-muted-foreground/40 tracking-widest">
            VS
          </span>
        </div>
        <div className="md:hidden border-t border-border" />

        <TeamSide impact={awayImpact} align="right" locale={locale} />
      </div>
    </div>
  );
}
