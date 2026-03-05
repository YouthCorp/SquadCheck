-- CreateTable
CREATE TABLE "rss_feed_sources" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "reliability" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_fetched" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rss_feed_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_signals" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "source_id" INTEGER NOT NULL,
    "article_url" TEXT NOT NULL,
    "article_title" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "signal_stage" TEXT NOT NULL,
    "recovery_score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "classified_by" TEXT NOT NULL,
    "extracted_snippet" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_availability" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "fixture_id" INTEGER NOT NULL,
    "official_status" TEXT NOT NULL DEFAULT 'injured',
    "recovery_signal_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "predicted_availability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence_level" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latest_signal_stage" TEXT,
    "last_signal_at" TIMESTAMP(3),
    "signal_count" INTEGER NOT NULL DEFAULT 0,
    "expired" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rss_feed_sources_url_key" ON "rss_feed_sources"("url");

-- CreateIndex
CREATE INDEX "recovery_signals_player_id_created_at_idx" ON "recovery_signals"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "recovery_signals_team_id_created_at_idx" ON "recovery_signals"("team_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_signals_player_id_article_url_key" ON "recovery_signals"("player_id", "article_url");

-- CreateIndex
CREATE INDEX "player_availability_team_id_expired_idx" ON "player_availability"("team_id", "expired");

-- CreateIndex
CREATE INDEX "player_availability_fixture_id_idx" ON "player_availability"("fixture_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_availability_player_id_fixture_id_key" ON "player_availability"("player_id", "fixture_id");

-- AddForeignKey
ALTER TABLE "recovery_signals" ADD CONSTRAINT "recovery_signals_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_signals" ADD CONSTRAINT "recovery_signals_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_signals" ADD CONSTRAINT "recovery_signals_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "rss_feed_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_availability" ADD CONSTRAINT "player_availability_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_availability" ADD CONSTRAINT "player_availability_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
