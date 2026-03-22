import { PitchLineup } from "@/components/pitch-lineup";
import { ShareButton } from "@/components/share-button";
import { t, type Locale } from "@/lib/i18n";
import { CURRENT_SEASON, SITE_URL } from "@/lib/constants";
import type { PredictedLineup } from "@/lib/types";

export function PredictedLineupColumn({
  lineup,
  locale,
}: {
  lineup: PredictedLineup | null;
  locale: Locale;
}) {
  if (!lineup) {
    return (
      <div className="bg-card border border-border rounded-lg px-4 py-8 text-center text-sm text-muted-foreground">
        {t(locale, "lineup_no_data")}
      </div>
    );
  }

  const shareUrl = `${SITE_URL}/share/lineup/${lineup.teamId}?season=${CURRENT_SEASON}&utm_source=share&utm_medium=social`;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
        {lineup.teamLogo && (
          <img
            src={lineup.teamLogo}
            alt=""
            className="w-7 h-7 object-contain shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">
            {lineup.teamName}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[0.6875rem] text-muted-foreground">
              {t(locale, "lineup_formation")}: {lineup.formation}
            </span>
            {lineup.formationSource === "default" && (
              <span className="text-[0.625rem] text-muted-foreground/60">
                ({t(locale, "lineup_default_formation")})
              </span>
            )}
          </div>
        </div>
        <ShareButton url={shareUrl} />
      </div>
      <div className="p-2">
        <PitchLineup lineup={lineup} />
      </div>
    </div>
  );
}
