'use client';

import { formatMatchDate, formatMatchDateTime } from '@/lib/format';

/** 경기 목록용 날짜: 브라우저 로컬 타임존으로 렌더링 */
export function ClientMatchDate({ dateStr, locale }: { dateStr: string; locale: string }) {
  return <span suppressHydrationWarning>{formatMatchDate(dateStr, locale)}</span>;
}

/** 경기 상세용 날짜+시간: 브라우저 로컬 타임존으로 렌더링 */
export function ClientMatchDateTime({ dateStr, locale }: { dateStr: string; locale: string }) {
  return <span suppressHydrationWarning>{formatMatchDateTime(dateStr, locale)}</span>;
}
