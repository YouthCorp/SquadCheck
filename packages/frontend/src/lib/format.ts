/** 징계 사유 여부 확인 (red card, suspended, yellow cards 등). */
export function isDisciplinaryReason(reason: string): boolean {
  const r = reason.toLowerCase().trim();
  return r.includes('red card') || r === 'suspended' || r === 'suspension' || r === 'yellow cards' || r === 'yellow card';
}

/** "28 Feb 2026" 형식 날짜 포맷. */
export function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** 며칠 전인지 계산. */
export function daysAgo(d: string): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

/** 경기 상세 페이지용 전체 날짜+시간. "Friday, 28 February 2026 · 20:00" */
export function formatMatchDateTime(dateStr: string, locale: string): string {
  const d = new Date(dateStr);
  const datePart = d.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timePart = d.toLocaleTimeString(locale === 'ko' ? 'ko-KR' : 'en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return `${datePart} · ${timePart}`;
}

/** 경기 목록 페이지용 축약 날짜+시간. "Fri, 28 Feb · 20:00" */
export function formatMatchDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-GB', {
    weekday: 'short', month: 'short', day: 'numeric',
  }) + ' · ' + d.toLocaleTimeString(locale === 'ko' ? 'ko-KR' : 'en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/** 라운드 문자열에서 숫자 추출. "Regular Season - 27" → 27. 없으면 null. */
export function parseRoundNumber(round: string | null): number | null {
  if (!round) return null;
  const m = round.match(/(\d+)$/);
  return m ? parseInt(m[1]) : null;
}

/** 정렬용 변형. 숫자 없으면 999 반환 (fixtures list 정렬에 사용). */
export function parseRoundNumberForSort(round: string | null): number {
  return parseRoundNumber(round) ?? 999;
}

/** "Regular Season - 27" → "Matchweek 27" (en) / "27라운드" (ko). */
export function formatRoundLabel(round: string | null, locale: string): string {
  if (!round) return '—';
  const m = round.match(/(\d+)$/);
  if (m) return locale === 'ko' ? `${m[1]}라운드` : `Matchweek ${m[1]}`;
  return round;
}

/** "Regular Season - 27" → "27R". player page 전용. */
export function fmtRound(r: string | null): string {
  if (!r) return '';
  const m = r.match(/Regular Season - (\d+)/);
  return m ? `${m[1]}R` : r;
}
