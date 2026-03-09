'use client';

import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FixtureTabSwitcherProps {
  isResults: boolean;
  baseUrl: string;
  upcomingLabel: string;
  resultsLabel: string;
}

export function FixtureTabSwitcher({ isResults, baseUrl, upcomingLabel, resultsLabel }: FixtureTabSwitcherProps) {
  const router = useRouter();
  return (
    <Tabs
      value={isResults ? 'results' : 'upcoming'}
      onValueChange={(value) => {
        if (!value) return;
        router.push(value === 'results' ? `${baseUrl}?tab=results` : baseUrl);
      }}
      className="mb-6"
    >
      <TabsList
        variant="line"
        className="w-full rounded-none border-b border-border bg-transparent gap-0 p-0 h-auto justify-start"
      >
        <TabsTrigger value="upcoming" className="px-5 py-2.5 text-sm rounded-none">
          {upcomingLabel}
        </TabsTrigger>
        <TabsTrigger value="results" className="px-5 py-2.5 text-sm rounded-none">
          {resultsLabel}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
