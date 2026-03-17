-- CreateTable
CREATE TABLE "player_injury_status" (
    "id"           SERIAL NOT NULL,
    "player_id"    INTEGER NOT NULL,
    "team_id"      INTEGER NOT NULL,
    "league_api_id" INTEGER NOT NULL,
    "season"       INTEGER NOT NULL,
    "reason"       TEXT,
    "type"         TEXT,
    "fixture_id"   INTEGER,
    "injured_since" TIMESTAMP(3),
    "is_active"    BOOLEAN NOT NULL DEFAULT true,
    "resolved_at"  TIMESTAMP(3),
    "updated_at"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_injury_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_injury_status_player_id_team_id_season_key"
    ON "player_injury_status"("player_id", "team_id", "season");

-- CreateIndex
CREATE INDEX "player_injury_status_team_id_season_is_active_idx"
    ON "player_injury_status"("team_id", "season", "is_active");

-- CreateIndex
CREATE INDEX "player_injury_status_league_api_id_season_is_active_injured_since_idx"
    ON "player_injury_status"("league_api_id", "season", "is_active", "injured_since");

-- AddForeignKey
ALTER TABLE "player_injury_status" ADD CONSTRAINT "player_injury_status_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_injury_status" ADD CONSTRAINT "player_injury_status_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_injury_status" ADD CONSTRAINT "player_injury_status_fixture_id_fkey"
    FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
