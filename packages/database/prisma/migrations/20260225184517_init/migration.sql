-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PAUSED');

-- CreateTable
CREATE TABLE "leagues" (
    "id" SERIAL NOT NULL,
    "api_football_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "country_code" TEXT,
    "logo" TEXT,
    "flag" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" SERIAL NOT NULL,
    "league_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "current" BOOLEAN NOT NULL DEFAULT false,
    "cov_fixture_events" BOOLEAN NOT NULL DEFAULT false,
    "cov_fixture_lineups" BOOLEAN NOT NULL DEFAULT false,
    "cov_fixture_stats" BOOLEAN NOT NULL DEFAULT false,
    "cov_fixture_player_stats" BOOLEAN NOT NULL DEFAULT false,
    "cov_standings" BOOLEAN NOT NULL DEFAULT false,
    "cov_players" BOOLEAN NOT NULL DEFAULT false,
    "cov_injuries" BOOLEAN NOT NULL DEFAULT false,
    "cov_predictions" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" SERIAL NOT NULL,
    "api_football_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "country" TEXT,
    "founded" INTEGER,
    "logo" TEXT,
    "venue_name" TEXT,
    "venue_city" TEXT,
    "venue_capacity" INTEGER,
    "venue_image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" SERIAL NOT NULL,
    "api_football_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "nationality" TEXT,
    "birth_date" TIMESTAMP(3),
    "height" TEXT,
    "weight" TEXT,
    "photo" TEXT,
    "position" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixtures" (
    "id" SERIAL NOT NULL,
    "api_football_id" INTEGER NOT NULL,
    "league_id" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "round" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "referee" TEXT,
    "status" TEXT NOT NULL,
    "status_long" TEXT,
    "elapsed" INTEGER,
    "home_team_id" INTEGER NOT NULL,
    "away_team_id" INTEGER NOT NULL,
    "goals_home" INTEGER,
    "goals_away" INTEGER,
    "goals_ht_home" INTEGER,
    "goals_ht_away" INTEGER,
    "venue_name" TEXT,
    "venue_city" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixture_statistics" (
    "id" SERIAL NOT NULL,
    "fixture_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "shots_on_goal" INTEGER,
    "shots_off_goal" INTEGER,
    "total_shots" INTEGER,
    "blocked_shots" INTEGER,
    "shots_inside_box" INTEGER,
    "shots_outside_box" INTEGER,
    "fouls" INTEGER,
    "corner_kicks" INTEGER,
    "offsides" INTEGER,
    "possession" DOUBLE PRECISION,
    "yellow_cards" INTEGER,
    "red_cards" INTEGER,
    "goalkeeper_saves" INTEGER,
    "total_passes" INTEGER,
    "passes_accurate" INTEGER,
    "pass_percent" DOUBLE PRECISION,
    "expected_goals" DOUBLE PRECISION,
    "goals_prevented" DOUBLE PRECISION,

    CONSTRAINT "fixture_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixture_lineups" (
    "id" SERIAL NOT NULL,
    "fixture_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "formation" TEXT,
    "coach_id" INTEGER,
    "coach_name" TEXT,

    CONSTRAINT "fixture_lineups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixture_lineup_players" (
    "id" SERIAL NOT NULL,
    "lineup_id" INTEGER NOT NULL,
    "player_id" INTEGER NOT NULL,
    "player_name" TEXT NOT NULL,
    "number" INTEGER,
    "position" TEXT,
    "grid" TEXT,
    "is_starting" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "fixture_lineup_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixture_events" (
    "id" SERIAL NOT NULL,
    "fixture_id" INTEGER NOT NULL,
    "team_id" INTEGER,
    "player_id" INTEGER,
    "assist_id" INTEGER,
    "type" TEXT NOT NULL,
    "detail" TEXT,
    "comments" TEXT,
    "time_elapsed" INTEGER NOT NULL,
    "time_extra" INTEGER,

    CONSTRAINT "fixture_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixture_player_stats" (
    "id" SERIAL NOT NULL,
    "fixture_id" INTEGER NOT NULL,
    "player_id" INTEGER NOT NULL,
    "team_id" INTEGER,
    "minutes" INTEGER,
    "position" TEXT,
    "rating" DOUBLE PRECISION,
    "captain" BOOLEAN NOT NULL DEFAULT false,
    "substitute" BOOLEAN NOT NULL DEFAULT false,
    "shots_total" INTEGER,
    "shots_on" INTEGER,
    "goals_total" INTEGER,
    "goals_conceded" INTEGER,
    "assists" INTEGER,
    "saves" INTEGER,
    "passes_total" INTEGER,
    "passes_key" INTEGER,
    "passes_accuracy" INTEGER,
    "tackles_total" INTEGER,
    "tackles_blocks" INTEGER,
    "interceptions" INTEGER,
    "duels_total" INTEGER,
    "duels_won" INTEGER,
    "dribbles_attempts" INTEGER,
    "dribbles_success" INTEGER,
    "dribbles_past" INTEGER,
    "fouls_drawn" INTEGER,
    "fouls_committed" INTEGER,
    "yellow_cards" INTEGER,
    "red_cards" INTEGER,

    CONSTRAINT "fixture_player_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standings" (
    "id" SERIAL NOT NULL,
    "league_id" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standing_entries" (
    "id" SERIAL NOT NULL,
    "standing_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "season_id" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "goals_diff" INTEGER NOT NULL,
    "form" TEXT,
    "description" TEXT,
    "played" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "draws" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "goals_for" INTEGER NOT NULL,
    "goals_against" INTEGER NOT NULL,
    "home_played" INTEGER NOT NULL,
    "home_wins" INTEGER NOT NULL,
    "home_draws" INTEGER NOT NULL,
    "home_losses" INTEGER NOT NULL,
    "home_goals_for" INTEGER NOT NULL,
    "home_goals_against" INTEGER NOT NULL,
    "away_played" INTEGER NOT NULL,
    "away_wins" INTEGER NOT NULL,
    "away_draws" INTEGER NOT NULL,
    "away_losses" INTEGER NOT NULL,
    "away_goals_for" INTEGER NOT NULL,
    "away_goals_against" INTEGER NOT NULL,

    CONSTRAINT "standing_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "injuries" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "league_id" INTEGER NOT NULL,
    "fixture_id" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "fixture_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "injuries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_season_stats" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "season_id" INTEGER NOT NULL,
    "league_api_id" INTEGER NOT NULL,
    "appearances" INTEGER,
    "lineups" INTEGER,
    "minutes" INTEGER,
    "position" TEXT,
    "rating" DOUBLE PRECISION,
    "goals_total" INTEGER,
    "assists" INTEGER,
    "shots_total" INTEGER,
    "shots_on" INTEGER,
    "passes_total" INTEGER,
    "passes_key" INTEGER,
    "passes_accuracy" INTEGER,
    "tackles_total" INTEGER,
    "tackles_blocks" INTEGER,
    "interceptions" INTEGER,
    "duels_total" INTEGER,
    "duels_won" INTEGER,
    "dribbles_attempts" INTEGER,
    "dribbles_success" INTEGER,
    "fouls_drawn" INTEGER,
    "fouls_committed" INTEGER,
    "yellow_cards" INTEGER,
    "red_cards" INTEGER,
    "penalty_scored" INTEGER,
    "penalty_missed" INTEGER,

    CONSTRAINT "player_season_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_season_stats" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "season_id" INTEGER NOT NULL,
    "avg_possession" DOUBLE PRECISION,
    "avg_xg" DOUBLE PRECISION,
    "avg_xg_against" DOUBLE PRECISION,
    "avg_shots" DOUBLE PRECISION,
    "avg_shots_on_target" DOUBLE PRECISION,
    "avg_passes" DOUBLE PRECISION,
    "avg_pass_accuracy" DOUBLE PRECISION,
    "total_goals" INTEGER,
    "total_conceded" INTEGER,
    "clean_sheets" INTEGER,

    CONSTRAINT "team_season_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_jobs" (
    "id" SERIAL NOT NULL,
    "job_type" TEXT NOT NULL,
    "league_api_id" INTEGER,
    "season" INTEGER,
    "endpoint" TEXT,
    "status" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "processed_items" INTEGER NOT NULL DEFAULT 0,
    "failed_items" INTEGER NOT NULL DEFAULT 0,
    "api_calls_used" INTEGER NOT NULL DEFAULT 0,
    "last_processed_id" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingestion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leagues_api_football_id_key" ON "leagues"("api_football_id");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_league_id_year_key" ON "seasons"("league_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "teams_api_football_id_key" ON "teams"("api_football_id");

-- CreateIndex
CREATE UNIQUE INDEX "players_api_football_id_key" ON "players"("api_football_id");

-- CreateIndex
CREATE UNIQUE INDEX "fixtures_api_football_id_key" ON "fixtures"("api_football_id");

-- CreateIndex
CREATE INDEX "fixtures_league_id_season_idx" ON "fixtures"("league_id", "season");

-- CreateIndex
CREATE INDEX "fixtures_home_team_id_idx" ON "fixtures"("home_team_id");

-- CreateIndex
CREATE INDEX "fixtures_away_team_id_idx" ON "fixtures"("away_team_id");

-- CreateIndex
CREATE INDEX "fixtures_date_idx" ON "fixtures"("date");

-- CreateIndex
CREATE INDEX "fixtures_season_status_idx" ON "fixtures"("season", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fixture_statistics_fixture_id_team_id_key" ON "fixture_statistics"("fixture_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "fixture_lineups_fixture_id_team_id_key" ON "fixture_lineups"("fixture_id", "team_id");

-- CreateIndex
CREATE INDEX "fixture_lineup_players_lineup_id_idx" ON "fixture_lineup_players"("lineup_id");

-- CreateIndex
CREATE INDEX "fixture_lineup_players_player_id_idx" ON "fixture_lineup_players"("player_id");

-- CreateIndex
CREATE INDEX "fixture_events_fixture_id_idx" ON "fixture_events"("fixture_id");

-- CreateIndex
CREATE INDEX "fixture_events_player_id_idx" ON "fixture_events"("player_id");

-- CreateIndex
CREATE INDEX "fixture_events_type_idx" ON "fixture_events"("type");

-- CreateIndex
CREATE INDEX "fixture_player_stats_player_id_idx" ON "fixture_player_stats"("player_id");

-- CreateIndex
CREATE INDEX "fixture_player_stats_fixture_id_idx" ON "fixture_player_stats"("fixture_id");

-- CreateIndex
CREATE UNIQUE INDEX "fixture_player_stats_fixture_id_player_id_key" ON "fixture_player_stats"("fixture_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "standings_league_id_season_key" ON "standings"("league_id", "season");

-- CreateIndex
CREATE INDEX "standing_entries_team_id_idx" ON "standing_entries"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "standing_entries_standing_id_team_id_key" ON "standing_entries"("standing_id", "team_id");

-- CreateIndex
CREATE INDEX "injuries_team_id_season_idx" ON "injuries"("team_id", "season");

-- CreateIndex
CREATE INDEX "injuries_player_id_season_idx" ON "injuries"("player_id", "season");

-- CreateIndex
CREATE INDEX "injuries_fixture_id_idx" ON "injuries"("fixture_id");

-- CreateIndex
CREATE INDEX "injuries_reason_idx" ON "injuries"("reason");

-- CreateIndex
CREATE INDEX "injuries_fixture_date_idx" ON "injuries"("fixture_date");

-- CreateIndex
CREATE UNIQUE INDEX "injuries_player_id_fixture_id_key" ON "injuries"("player_id", "fixture_id");

-- CreateIndex
CREATE INDEX "player_season_stats_team_id_season_id_idx" ON "player_season_stats"("team_id", "season_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_season_stats_player_id_season_id_league_api_id_key" ON "player_season_stats"("player_id", "season_id", "league_api_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_season_stats_team_id_season_id_key" ON "team_season_stats"("team_id", "season_id");

-- CreateIndex
CREATE INDEX "ingestion_jobs_status_idx" ON "ingestion_jobs"("status");

-- CreateIndex
CREATE INDEX "ingestion_jobs_job_type_league_api_id_season_idx" ON "ingestion_jobs"("job_type", "league_api_id", "season");

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_statistics" ADD CONSTRAINT "fixture_statistics_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_statistics" ADD CONSTRAINT "fixture_statistics_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_lineups" ADD CONSTRAINT "fixture_lineups_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_lineups" ADD CONSTRAINT "fixture_lineups_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_lineup_players" ADD CONSTRAINT "fixture_lineup_players_lineup_id_fkey" FOREIGN KEY ("lineup_id") REFERENCES "fixture_lineups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_lineup_players" ADD CONSTRAINT "fixture_lineup_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_events" ADD CONSTRAINT "fixture_events_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_events" ADD CONSTRAINT "fixture_events_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_events" ADD CONSTRAINT "fixture_events_assist_id_fkey" FOREIGN KEY ("assist_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_player_stats" ADD CONSTRAINT "fixture_player_stats_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_player_stats" ADD CONSTRAINT "fixture_player_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standings" ADD CONSTRAINT "standings_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standing_entries" ADD CONSTRAINT "standing_entries_standing_id_fkey" FOREIGN KEY ("standing_id") REFERENCES "standings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standing_entries" ADD CONSTRAINT "standing_entries_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standing_entries" ADD CONSTRAINT "standing_entries_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_stats" ADD CONSTRAINT "player_season_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_stats" ADD CONSTRAINT "player_season_stats_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_stats" ADD CONSTRAINT "team_season_stats_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_stats" ADD CONSTRAINT "team_season_stats_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
