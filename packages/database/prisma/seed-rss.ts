import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RSS_SOURCES = [
  {
    name: 'BBC Sport Football',
    url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
    language: 'en',
    reliability: 0.85,
  },
  {
    name: 'Sky Sports Football',
    url: 'https://www.skysports.com/rss/12040',
    language: 'en',
    reliability: 0.80,
  },
  {
    name: 'Guardian Football',
    url: 'https://www.theguardian.com/football/rss',
    language: 'en',
    reliability: 0.78,
  },
  {
    name: 'ESPN FC Soccer',
    url: 'https://www.espn.com/espn/rss/soccer/news',
    language: 'en',
    reliability: 0.75,
  },
  {
    name: 'The Athletic Football',
    url: 'https://theathletic.com/rss/football/',
    language: 'en',
    reliability: 0.90,
  },
];

async function main() {
  console.log('Seeding RSS feed sources...');

  for (const source of RSS_SOURCES) {
    const result = await prisma.rssFeedSource.upsert({
      where: { url: source.url },
      create: source,
      update: {
        name: source.name,
        language: source.language,
        reliability: source.reliability,
        active: true,
      },
    });
    console.log(`  ✓ ${result.name} (id=${result.id})`);
  }

  console.log(`\nSeeded ${RSS_SOURCES.length} RSS sources.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
