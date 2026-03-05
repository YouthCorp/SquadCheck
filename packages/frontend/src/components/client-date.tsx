'use client';

import { useState, useEffect } from 'react';
import { formatMatchDate, formatMatchDateTime } from '@/lib/format';

/** 경기 목록용 날짜: 브라우저 로컬 타임존으로 렌더링 */
export function ClientMatchDate({ dateStr, locale }: { dateStr: string; locale: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return <span suppressHydrationWarning>{mounted ? formatMatchDate(dateStr, locale) : ''}</span>;
}

/** 경기 상세용 날짜+시간: 브라우저 로컬 타임존으로 렌더링 */
export function ClientMatchDateTime({ dateStr, locale }: { dateStr: string; locale: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return <span suppressHydrationWarning>{mounted ? formatMatchDateTime(dateStr, locale) : ''}</span>;
}
