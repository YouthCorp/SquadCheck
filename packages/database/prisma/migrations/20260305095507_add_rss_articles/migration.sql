-- CreateTable
CREATE TABLE "rss_articles" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "url_hash" TEXT NOT NULL,
    "guid" TEXT,
    "title" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "rss_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rss_articles_url_hash_key" ON "rss_articles"("url_hash");

-- CreateIndex
CREATE INDEX "rss_articles_source_first_seen_at_idx" ON "rss_articles"("source", "first_seen_at");
