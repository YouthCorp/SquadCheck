import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import type {
  InjuryFeedFiltersResponse,
  InjuryFeedItem,
  InjuryFeedResponse,
} from '@/lib/types';
import { CURRENT_SEASON, LEAGUE_NAMES, SITE_URL } from '@/lib/constants';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TeamLogo } from '@/components/team-logo';
import { cn } from '@/lib/utils';

type SearchParams = {
  tab?: string;
  status?: string;
  page?: string;
  league?: string;
};

const TAB_LABELS = {
  injuries: { en: 'New Injuries', ko: '신규 부상' },
  recovery: { en: 'Recovery & Returns', ko: '복귀 신호 / 복귀 완료' },
} as const;

const STATUS_LABELS = {
  all: { en: 'All', ko: '전체' },
  active_only: { en: 'New injuries', ko: '신규 부상' },
  returned_only: { en: 'Returned', ko: '복귀 완료' },
  signal: { en: 'Signals', ko: '복귀 신호' },
  returned: { en: 'Returned', ko: '복귀 완료' },
} as const;

function normalizeTab(tab?: string): 'injuries' | 'recovery' {
  return tab === 'recovery' ? 'recovery' : 'injuries';
}

function normalizeStatus(
  tab: 'injuries' | 'recovery',
  status?: string,
): 'all' | 'active_only' | 'returned_only' | 'signal' | 'returned' {
  const allowed = tab === 'injuries'
    ? ['all', 'active_only', 'returned_only']
    : ['all', 'signal', 'returned'];
  return allowed.includes(status ?? '') ? (status as any) : 'all';
}

function buildQuery(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '' || value === 'all') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const tab = normalizeTab(searchParams.tab);
  const status = normalizeStatus(tab, searchParams.status);
  const league = searchParams.league ? parseInt(searchParams.league, 10) : null;
  const leagueLabel = league ? (LEAGUE_NAMES[league] ?? `League ${league}`) : 'Top European leagues';
  const titleBase = tab === 'recovery'
    ? `${leagueLabel} Recovery Signals & Return Updates`
    : `${leagueLabel} Injury News & Return History`;
  const description = tab === 'recovery'
    ? `Track football recovery signals, return updates, injury return history, and expected availability across ${leagueLabel}.`
    : `Track football injury news, new absences, fitness updates, and injury history across ${leagueLabel}.`;

  const canonical = `/injuries${buildQuery({ tab, status, league })}`;

  return {
    title: titleBase,
    description,
    keywords: [
      'football injury news',
      'football return update',
      'injury history',
      'fitness update',
      'expected return',
      'recovery signal',
      'player availability',
      'Premier League injury news',
      'La Liga injury news',
      'Serie A injury news',
      'Bundesliga injury news',
      'Ligue 1 injury news',
    ],
    alternates: { canonical },
    openGraph: {
      title: `${titleBase} | SquadCheck`,
      description,
      url: `${SITE_URL}${canonical}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${titleBase} | SquadCheck`,
      description,
    },
  };
}

function feedBadge(item: InjuryFeedItem) {
  switch (item.eventType) {
    case 'new_injury':
      return { label: 'New injury', variant: 'critical' as const };
    case 'recovery_signal_started':
      return { label: 'Recovery signal', variant: 'moderate' as const };
    case 'recovery_signal_upgraded':
      return { label: 'Signal upgraded', variant: 'success' as const };
    case 'returned_to_squad':
      return { label: 'Returned', variant: 'info' as const };
    default:
      return { label: item.eventType, variant: 'low' as const };
  }
}

function stageLabel(stage: string | null): string {
  if (!stage) return 'Signal update';
  return stage.replace(/_/g, ' ');
}

function formatTime(dateStr: string, locale: 'ko' | 'en'): string {
  return new Date(dateStr).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EmptyState({ locale }: { locale: 'ko' | 'en' }) {
  return (
    <Card className="p-10 text-center text-sm text-muted-foreground items-center justify-center">
      {locale === 'ko' ? '조건에 맞는 이벤트가 없습니다.' : 'No events match these filters.'}
    </Card>
  );
}

function FeedCard({ item, locale }: { item: InjuryFeedItem; locale: 'ko' | 'en' }) {
  const badge = feedBadge(item);
  const leagueLabel = LEAGUE_NAMES[item.leagueApiFootballId] ?? `League ${item.leagueApiFootballId}`;
  const eventTime = formatTime(item.eventTime, locale);
  const returnedAt = item.returnStatus.returnedAt ? formatTime(item.returnStatus.returnedAt, locale) : null;

  return (
    <Card className="p-4 gap-3">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-muted overflow-hidden border border-border shrink-0">
          {item.player.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.player.photo} alt={item.player.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground font-semibold">
              {item.player.name.slice(0, 1)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/player/${item.player.id}`} className="text-sm font-semibold text-foreground no-underline hover:underline">
              {item.player.name}
            </Link>
            {item.player.position && (
              <span className="text-[0.6875rem] text-muted-foreground">{item.player.position}</span>
            )}
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
            <Link href={`/team/${item.team.id}${item.leagueApiFootballId ? `?league=${item.leagueApiFootballId}` : ''}`} className="no-underline hover:underline text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <TeamLogo logo={item.team.logo} size="xs" />
                {item.team.name}
              </span>
            </Link>
            <span>·</span>
            <span>{leagueLabel}</span>
            <span>·</span>
            <span>{eventTime}</span>
          </div>

          <div className="mt-2 text-sm text-foreground/85">
            {item.eventType === 'returned_to_squad' ? (
              <span>{locale === 'ko' ? '복귀 완료' : 'Returned to squad'}{returnedAt ? ` · ${returnedAt}` : ''}</span>
            ) : item.recovery ? (
              <span>
                {stageLabel(item.recovery.latestSignalStage)}
                {' · '}
                {Math.round(item.recovery.predictedAvailability * 100)}% availability
                {' · '}
                {Math.round(item.recovery.confidenceLevel * 100)}% confidence
              </span>
            ) : item.injury ? (
              <span>
                {item.injury.reason ?? item.injury.type ?? item.summary}
                {item.injury.type && item.injury.reason && item.injury.type !== item.injury.reason ? ` · ${item.injury.type}` : ''}
              </span>
            ) : (
              <span>{item.summary}</span>
            )}
          </div>

          {item.article?.url && (
            <div className="mt-2">
              <a
                href={item.article.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary no-underline hover:underline"
              >
                {item.article.title ?? (locale === 'ko' ? '관련 기사 보기' : 'Open source article')}
                {item.article.sourceName ? ` · ${item.article.sourceName}` : ''}
              </a>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default async function InjuriesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const locale = getLocale();
  const tab = normalizeTab(searchParams.tab);
  const status = normalizeStatus(tab, searchParams.status);
  const page = searchParams.page ? Math.max(1, parseInt(searchParams.page, 10) || 1) : 1;
  const league = searchParams.league ? parseInt(searchParams.league, 10) : null;

  const [feed, filters] = await Promise.all([
    fetchApi<InjuryFeedResponse>(
      `/api/injuries/feed${buildQuery({
        tab,
        status,
        page,
        league,
        season: CURRENT_SEASON,
      })}`,
    ).catch(() => ({
      items: [],
      pagination: { page: 1, limit: 30, total: 0, totalPages: 0 },
      appliedFilters: { tab, status: 'all', season: CURRENT_SEASON, league: null, teamId: null },
    })),
    fetchApi<InjuryFeedFiltersResponse>('/api/injuries/feed/filters', 300).catch(() => ({ leagues: [] })),
  ]);

  const pageTitle = tab === 'recovery'
    ? (locale === 'ko' ? '복귀 신호 및 복귀 업데이트' : 'Recovery Signals and Return Updates')
    : (locale === 'ko' ? '신규 부상 및 복귀 히스토리' : 'Injury News and Return History');
  const introText = tab === 'recovery'
    ? (locale === 'ko'
      ? '축구 복귀 신호, 복귀 업데이트, 예상 출전 가능성 변화를 한곳에서 추적합니다.'
      : 'Track football recovery signals, return updates, and expected availability changes in one place.')
    : (locale === 'ko'
      ? '축구 신규 부상, 결장 이슈, 복귀 히스토리를 주요 리그별로 확인할 수 있습니다.'
      : 'Track football injury news, absences, and return history across major leagues.');

  const statusOptions = tab === 'injuries'
    ? [
        { value: 'all', label: locale === 'ko' ? '??' : 'All' },
        { value: 'active_only', label: locale === 'ko' ? '?? ??' : 'New injuries' },
        { value: 'returned_only', label: locale === 'ko' ? '?? ??' : 'Returned' },
      ]
    : [
        { value: 'all', label: locale === 'ko' ? '??' : 'All' },
        { value: 'signal', label: locale === 'ko' ? '?? ??' : 'Signals' },
        { value: 'returned', label: locale === 'ko' ? '?? ??' : 'Returned' },
      ];

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: pageTitle,
    description: introText,
    url: `${SITE_URL}/injuries${buildQuery({ tab, status, league })}`,
    about: [
      'football injuries',
      'injury history',
      'recovery signals',
      'return updates',
      'player availability',
    ],
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'SquadCheck', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Injury Intelligence', item: `${SITE_URL}/injuries` },
      ],
    },
  };

  return (
    <div className="max-w-[72rem] mx-auto px-4 py-6 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />

      <div className="pb-4 border-b border-border">
        <h1 className="text-3xl font-light text-foreground m-0">
          Injury Intelligence
        </h1>
        <p className="text-sm text-muted-foreground mt-2 mb-1">
          {introText}
        </p>
        <p className="text-xs text-muted-foreground/80 m-0">
          {locale === 'ko'
            ? '홈 패널은 현재 상태를 보여주고, 이 페이지는 injury news, recovery signals, return history를 히스토리로 보존합니다.'
            : 'The home panel shows current state, while this page preserves injury news, recovery signals, and return history as searchable history.'}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4">
        <h2 className="text-sm font-semibold text-foreground m-0">
          {pageTitle}
        </h2>
        <p className="text-sm text-muted-foreground mt-2 mb-0 leading-6">
          {locale === 'ko'
            ? '팀 페이지와 선수 페이지로 바로 이어지도록 구성해 injury update, fitness update, expected return 같은 검색 의도까지 함께 커버합니다.'
            : 'This page links directly to team pages and player pages so it can satisfy injury update, fitness update, and expected return search intent.'}
        </p>
        <div className="flex flex-wrap gap-3 mt-3 text-xs">
          <Link href="/leaderboard" className="text-primary no-underline hover:underline">
            {locale === 'ko' ? '시즌 부상 리더보드 보기' : 'View season injury leaderboard'}
          </Link>
          <Link href="/" className="text-primary no-underline hover:underline">
            {locale === 'ko' ? '홈 실시간 패널 보기' : 'View home live panels'}
          </Link>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['injuries', 'recovery'] as const).map((tabValue) => (
          <Link
            key={tabValue}
            href={`/injuries${buildQuery({ tab: tabValue, status: 'all', league })}`}
            className={cn(
              'px-3 py-1.5 rounded border text-sm no-underline transition-colors',
              tab === tabValue
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            {TAB_LABELS[tabValue][locale]}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statusOptions.map((option) => (
          <Link
            key={option.value}
            href={`/injuries${buildQuery({ tab, status: option.value, league })}`}
            className={cn(
              'px-2.5 py-1 rounded border text-xs no-underline transition-colors',
              status === option.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/injuries${buildQuery({ tab, status, page: 1 })}`}
          className={cn(
            'px-2.5 py-1 rounded border text-xs no-underline transition-colors',
            !league
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent',
          )}
        >
          {locale === 'ko' ? '전체 리그' : 'All leagues'}
        </Link>
        {filters.leagues.map((entry) => (
          <Link
            key={entry.apiFootballId}
            href={`/injuries${buildQuery({ tab, status, league: entry.apiFootballId, page: 1 })}`}
            className={cn(
              'px-2.5 py-1 rounded border text-xs no-underline transition-colors',
              league === entry.apiFootballId
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            {LEAGUE_NAMES[entry.apiFootballId] ?? entry.name}
          </Link>
        ))}
      </div>

      <div className="text-xs text-muted-foreground">
        {locale === 'ko'
          ? `현재 탭: ${TAB_LABELS[tab][locale]} · 상태: ${STATUS_LABELS[status][locale]}`
          : `Current tab: ${TAB_LABELS[tab][locale]} · Status: ${STATUS_LABELS[status][locale]}`}
      </div>

      {feed.items.length === 0 ? (
        <EmptyState locale={locale} />
      ) : (
        <div className="space-y-3">
          {feed.items.map((item) => (
            <FeedCard key={`${item.eventType}-${item.id}`} item={item} locale={locale} />
          ))}
        </div>
      )}

      {feed.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <Link
            href={`/injuries${buildQuery({ tab, status, league, page: Math.max(1, page - 1) })}`}
            className={cn(
              'px-3 py-1.5 rounded border text-sm no-underline transition-colors',
              page <= 1
                ? 'pointer-events-none border-border text-muted-foreground/40'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            {locale === 'ko' ? '이전' : 'Previous'}
          </Link>
          <span className="text-xs text-muted-foreground">
            {page} / {feed.pagination.totalPages}
          </span>
          <Link
            href={`/injuries${buildQuery({ tab, status, league, page: Math.min(feed.pagination.totalPages, page + 1) })}`}
            className={cn(
              'px-3 py-1.5 rounded border text-sm no-underline transition-colors',
              page >= feed.pagination.totalPages
                ? 'pointer-events-none border-border text-muted-foreground/40'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            {locale === 'ko' ? '다음' : 'Next'}
          </Link>
        </div>
      )}
    </div>
  );
}
