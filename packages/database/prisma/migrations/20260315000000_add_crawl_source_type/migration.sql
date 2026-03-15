-- AlterTable: add source_type to rss_feed_sources
-- Distinguishes RSS feeds ("rss") from web-crawl sources ("crawl").
-- Default 'rss' ensures existing rows are unaffected.
ALTER TABLE "rss_feed_sources" ADD COLUMN "source_type" VARCHAR(20) NOT NULL DEFAULT 'rss';
