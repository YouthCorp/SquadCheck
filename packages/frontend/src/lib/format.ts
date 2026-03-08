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

/** "Xm ago" / "Xh ago" / "Xd ago" 형식의 상대 시간. */
export function timeAgo(d: string, locale?: string): string {
  const ko = locale === 'ko';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return ko ? '방금 전' : 'just now';
  if (mins < 60) return ko ? `${mins}분 전` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return ko ? `${hrs}시간 전` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return ko ? `${days}일 전` : `${days}d ago`;
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

/**
 * 컵/리그 라운드 정렬용 고유 번호 반환.
 * League Stage/Regular Season → 작은 숫자, 녹아웃 라운드 → 큰 고유 번호.
 */
export function parseRoundNumberForSort(round: string | null): number {
  if (!round) return 9999;
  const r = round.toLowerCase().trim();

  // Regular Season: "Regular Season - 27" → 27
  const rs = r.match(/regular season\s*-\s*(\d+)/);
  if (rs) return parseInt(rs[1]);

  // League Stage: "League Stage - 1" → 100+N
  const ls = r.match(/league stage\s*-\s*(\d+)/);
  if (ls) return 100 + parseInt(ls[1]);

  // Named knockout rounds (fixed progression)
  if (r === 'play-offs' || r === 'playoff round') return 200;
  if (r === 'round of 128' || r === '1/128-finals') return 300;
  if (r === 'round of 64' || r === '1/64-finals') return 301;
  if (r === 'round of 32' || r === '1/32-finals') return 302;
  if (r === 'round of 16' || r === '1/16-finals') return 303;
  if (r.includes('quarter-final')) return 304;
  if (r.includes('semi-final')) return 305;
  if (r === 'final') return 306;

  // Preliminary rounds (before qualifying)
  if (r.includes('extra preliminary')) return -20;
  if (r.startsWith('preliminary round')) return -10;

  // Qualifying rounds: extract leading number → 1, 2, 3…
  if (r.includes('qualifying')) {
    const qm = r.match(/(\d+)/);
    if (qm) return parseInt(qm[1]);
  }

  // Numbered rounds: "1st Round", "2nd Round" → 10+N (offset past qualifying)
  const nr = r.match(/^(\d+)(?:st|nd|rd|th)?\s+round\b/);
  if (nr) return 10 + parseInt(nr[1]);

  // Generic fallback
  const m = r.match(/(\d+)/);
  return m ? parseInt(m[1]) : 9999;
}

/** 라운드 문자열을 표시용 레이블로 변환. 컵대회 인식 포함. */
export function formatRoundLabel(round: string | null, locale: string): string {
  if (!round) return '—';
  const ko = locale === 'ko';
  const r = round.trim();

  // Regular Season → "Matchweek N" / "N라운드"
  const rs = r.match(/Regular Season\s*-\s*(\d+)/i);
  if (rs) return ko ? `${rs[1]}라운드` : `Matchweek ${rs[1]}`;

  // League Stage → "League Phase N" / "리그 페이즈 N"
  const ls = r.match(/League Stage\s*-\s*(\d+)/i);
  if (ls) return ko ? `리그 페이즈 ${ls[1]}` : `League Phase ${ls[1]}`;

  const lower = r.toLowerCase();
  if (lower === 'play-offs' || lower === 'playoff round') return ko ? '플레이오프' : 'Play-offs';
  if (lower === 'round of 128' || lower === '1/128-finals') return ko ? '128강' : 'Round of 128';
  if (lower === 'round of 64' || lower === '1/64-finals') return ko ? '64강' : 'Round of 64';
  if (lower === 'round of 32' || lower === '1/32-finals') return ko ? '32강' : 'Round of 32';
  if (lower === 'round of 16' || lower === '1/16-finals') return ko ? '16강' : 'Round of 16';
  if (lower.includes('quarter-final')) return ko ? '8강' : 'Quarter-finals';
  if (lower.includes('semi-final')) return ko ? '4강' : 'Semi-finals';
  if (lower === 'final') return ko ? '결승' : 'Final';

  // Numbered rounds → "Round N" / "N라운드"
  const nr = r.match(/^(\d+)(?:st|nd|rd|th)?\s+round\b/i);
  if (nr) return ko ? `${nr[1]}라운드` : `Round ${nr[1]}`;

  // Qualifying rounds
  if (lower.includes('qualifying')) {
    const qm = r.match(/(\d+)/);
    if (qm) return ko ? `예선 ${qm[1]}라운드` : `Qualifying Round ${qm[1]}`;
    return ko ? '예선전' : 'Qualifying';
  }
  if (lower.includes('extra preliminary')) return ko ? '예비 예선' : 'Extra Preliminary';
  if (lower.includes('preliminary')) return ko ? '예선 예비' : 'Preliminary';

  return r;
}

/** 페이지 하단 라운드 pill용 축약 레이블. */
export function formatRoundPill(round: string | null): string {
  if (!round) return '?';
  const r = round.trim().toLowerCase();

  const rs = r.match(/regular season\s*-\s*(\d+)/);
  if (rs) return rs[1];

  const ls = r.match(/league stage\s*-\s*(\d+)/);
  if (ls) return `L${ls[1]}`;

  if (r === 'play-offs' || r === 'playoff round') return 'PO';
  if (r === 'round of 128' || r === '1/128-finals') return 'R128';
  if (r === 'round of 64' || r === '1/64-finals') return 'R64';
  if (r === 'round of 32' || r === '1/32-finals') return 'R32';
  if (r === 'round of 16' || r === '1/16-finals') return 'R16';
  if (r.includes('quarter-final')) return 'QF';
  if (r.includes('semi-final')) return 'SF';
  if (r === 'final') return 'F';

  if (r.includes('qualifying')) {
    const qm = r.match(/(\d+)/);
    return qm ? `Q${qm[1]}` : 'QR';
  }
  if (r.includes('extra preliminary')) return 'EP';
  if (r.startsWith('preliminary')) return 'P';

  const nr = r.match(/^(\d+)/);
  if (nr) return `R${nr[1]}`;

  return round.slice(0, 3).toUpperCase();
}

/** "Regular Season - 27" → "27R". player page 전용. */
export function fmtRound(r: string | null): string {
  if (!r) return '';
  const m = r.match(/Regular Season - (\d+)/);
  return m ? `${m[1]}R` : r;
}

/** 해당 라운드가 녹아웃 방식(양팀 대결 타이)인지 여부. */
export function isKnockoutRound(round: string | null): boolean {
  if (!round) return false;
  const r = round.toLowerCase().trim();
  return !r.startsWith('regular season') && !r.startsWith('league stage');
}
