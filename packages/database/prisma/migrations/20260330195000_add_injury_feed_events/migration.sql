CREATE TABLE "injury_feed_events" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "league_api_id" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_time" TIMESTAMP(3) NOT NULL,
    "injury_status_id" INTEGER,
    "availability_fixture_id" INTEGER,
    "recovery_signal_id" INTEGER,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "injury_feed_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "injury_feed_events_dedupe_key_key"
    ON "injury_feed_events"("dedupe_key");

CREATE INDEX "injury_feed_events_season_event_time_idx"
    ON "injury_feed_events"("season", "event_time");

CREATE INDEX "injury_feed_events_league_api_id_season_event_time_idx"
    ON "injury_feed_events"("league_api_id", "season", "event_time");

CREATE INDEX "injury_feed_events_event_type_event_time_idx"
    ON "injury_feed_events"("event_type", "event_time");

CREATE INDEX "injury_feed_events_player_id_event_time_idx"
    ON "injury_feed_events"("player_id", "event_time");

CREATE INDEX "injury_feed_events_team_id_event_time_idx"
    ON "injury_feed_events"("team_id", "event_time");

ALTER TABLE "injury_feed_events"
    ADD CONSTRAINT "injury_feed_events_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "players"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "injury_feed_events"
    ADD CONSTRAINT "injury_feed_events_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "teams"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
