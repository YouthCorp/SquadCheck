'use client';

import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LeaderboardSortTabsProps {
  sortBy: string;
  leagueFilter: number | null;
  countLabel: string;
  powerLabel: string;
}

export function LeaderboardSortTabs({ sortBy, leagueFilter, countLabel, powerLabel }: LeaderboardSortTabsProps) {
  const router = useRouter();
  return (
    <Tabs
      value={sortBy}
      onValueChange={(value) => {
        if (!value) return;
        router.push(`/leaderboard?sort=${value}${leagueFilter ? `&league=${leagueFilter}` : ''}`);
      }}
    >
      <TabsList>
        <TabsTrigger value="count">{countLabel}</TabsTrigger>
        <TabsTrigger value="power">{powerLabel}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
