# Frontend Refactoring Plan: 공유 모듈 추출

## 목적

팀 페이지(`team/[teamId]/page.tsx`)와 fixture 상세 페이지(`league/[leagueId]/fixtures/[fixtureId]/page.tsx`)에서 부상 선수 카드, 상수, 헬퍼 함수, TypeScript 인터페이스가 거의 동일하게 중복 정의되어 있음. 한쪽을 수정하면 다른 쪽도 수동으로 동기화해야 하는 유지보수 문제가 반복 발생. 공유 모듈로 추출하여 해결.

---

## 신규 파일 4개

### 1. `src/lib/constants.ts`

아래 상수들을 이 파일에 정의하고, 기존 페이지에서는 삭제 후 import로 대체.

```typescript
import type { TranslationKey } from './i18n';

export const SEV_TAG: Record<string, string> = {
  critical: 'sc-tag--red',
  high: 'sc-tag--orange',
  moderate: 'sc-tag--yellow',
  low: 'sc-tag--gray',
};

export const SEV_KEY: Record<string, TranslationKey> = {
  critical: 'severity_critical',
  high: 'severity_high',
  moderate: 'severity_moderate',
  low: 'severity_low',
};

export const ROLE_KEY: Record<string, TranslationKey> = {
  regular_starter: 'role_starter',
  rotation: 'role_rotation',
  bench: 'role_bench',
};

export const CTX_KEY: Record<string, TranslationKey> = {
  mid_season_loss: 'ctx_mid_season_loss',
  extended_absence: 'ctx_extended_absence',
  recent_injury: 'ctx_recent_injury',
  early_season_loss: 'ctx_early_season_loss',
  pre_season_absence: 'ctx_pre_season_absence',
};

export const LEAGUE_NAMES: Record<number, string> = {
  39: 'Premier League',
  140: 'La Liga',
  135: 'Serie A',
  78: 'Bundesliga',
  61: 'Ligue 1',
};

export const POS_GROUP_ORDER: Array<'GK' | 'DEF' | 'MID' | 'FWD'> = ['GK', 'DEF', 'MID', 'FWD'];
export const POS_GROUP_LABEL: Record<string, string> = { GK: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD' };
```

**주의**: 기존 코드에서 `SEV_KEY`, `ROLE_KEY`, `CTX_KEY`의 value 타입이 `Parameters<typeof t>[1]`로 되어있음. 이것은 `TranslationKey`와 동일하므로 `TranslationKey`로 통일.

**삭제 대상**:
- `team/[teamId]/page.tsx` line 31: `SEV_TAG`, lines 37-47: `CTX_KEY`, `ROLE_KEY`, `SEV_KEY`
- `fixtures/[fixtureId]/page.tsx` lines 103-124: `SEV_TAG`, `SEV_KEY`, `ROLE_KEY`, `CTX_KEY`, `LEAGUE_NAMES`, lines 567-568: `POS_GROUP_ORDER`, `POS_GROUP_LABEL`
- `fixtures/page.tsx` lines 23-25: `LEAGUE_NAMES`
- `league/[leagueId]/page.tsx` lines 13-15: `LEAGUE_NAMES`

---

### 2. `src/lib/types.ts`

공유 TypeScript 인터페이스. 각 페이지 고유 인터페이스는 해당 페이지에 남김.

```typescript
// Team — superset of all versions. founded/venueName/venueCapacity는 team page에서만 사용하므로 optional.
export interface Team {
  id: number;
  name: string;
  logo: string | null;
  country: string | null;
  founded?: number | null;
  venueName?: string | null;
  venueCapacity?: number | null;
}

export interface InjuredPlayer {
  player: { id: number; name: string; photo: string | null; position: string | null };
  injury: { type: string; reason: string; date: string };
  injuryContext: { type: string; timingMultiplier: number; description: string };
  starterProfile: {
    starterCount: number;
    substituteCount: number;
    totalTeamFixtures: number;
    starterFrequency: number;
    role: string;
    lastStartFixtureDate: string | null;
  };
  performanceDelta: { winRateDelta: number; avgGoalsDelta: number; avgConcededDelta: number } | null;
  hasSignificantSample: boolean;
  winRateBoost: number;
  compositeImpactScore: number;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  weight: number;
  weightPct: number;
  positionGroup: string;
  dataSource: string;
  stats?: { goals: number | null; assists: number | null; minutes: number | null; appearances: number | null };
}

export interface InjuryImpact {
  team: Team;
  season: number;
  totalWeight: number;
  injuredWeight: number;
  powerLossPct: number;
  compositeImpactTotal: number;
  totalInjuries: number;
  uniquePlayers: number;
  severitySummary: { critical: number; high: number; moderate: number; low: number };
  injuredPlayers: InjuredPlayer[];
}

export interface Fixture {
  id: number;
  date: string;
  round: string | null;
  status: string;
  venueName: string | null;
  venueCity: string | null;
  homeTeam: Team;
  awayTeam: Team;
}

export interface PredictedPlayer {
  playerId: number;
  playerName: string;
  photo: string | null;
  position: string | null;
  positionGroup: 'GK' | 'DEF' | 'MID' | 'FWD';
  weight: number;
  starterFrequency: number;
  compositeScore: number;
  role: 'regular_starter' | 'rotation' | 'bench';
  recentReturn: boolean;
}

export interface UnavailablePlayer {
  playerId: number;
  playerName: string;
  photo: string | null;
  position: string | null;
  positionGroup: 'GK' | 'DEF' | 'MID' | 'FWD';
  weight: number;
  injuryReason: string;
  wouldHaveStarted: boolean;
}

export interface PredictedLineup {
  teamId: number;
  teamName: string;
  teamLogo: string | null;
  season: number;
  formation: string;
  formationSource: 'historical' | 'default';
  positionSlots: { GK: number; DEF: number; MID: number; FWD: number };
  starters: PredictedPlayer[];
  unavailable: UnavailablePlayer[];
}
```

**삭제 대상**:
- `team/[teamId]/page.tsx` lines 6-25: `Team`, `InjuredPlayer`, `InjuryImpact` (단, `PlayerEntry`는 유지)
- `fixtures/[fixtureId]/page.tsx` lines 8-99: 모든 인터페이스 (`Team`, `Fixture`, `PredictedPlayer`, `UnavailablePlayer`, `PredictedLineup`, `InjuredPlayer`, `InjuryImpact`)
- `fixtures/page.tsx` lines 6-21: `Team`, `Fixture`

**페이지에 남기는 고유 인터페이스**:
- `team/[teamId]/page.tsx`: `PlayerEntry`
- `league/[leagueId]/page.tsx`: `StandingEntry`, `Standing`
- `player/[playerId]/page.tsx`: `Player`, `Injury`, `Appearance`, `InjuryEpisode`

---

### 3. `src/lib/format.ts`

공유 포맷/헬퍼 함수.

```typescript
/** 징계 사유 여부 확인. 3개 파일에서 중복됨 (player page에서는 checkDisciplinary라는 이름). */
export function isDisciplinaryReason(reason: string): boolean {
  const r = reason.toLowerCase().trim();
  return r.includes('red card') || r === 'suspended' || r === 'suspension' || r === 'yellow cards' || r === 'yellow card';
}

/** "28 Feb 2026" 형식. 3개 파일에서 중복됨. */
export function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** 며칠 전인지 계산. 2개 파일에서 중복됨. */
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

/** 정렬용 변형. 숫자 없으면 999 반환 (fixtures list에서 사용). */
export function parseRoundNumberForSort(round: string | null): number {
  return parseRoundNumber(round) ?? 999;
}

/** "Regular Season - 27" → "Matchweek 27" (en) / "27라운드" (ko). 2개 파일에서 중복됨. */
export function formatRoundLabel(round: string | null, locale: string): string {
  if (!round) return '—';
  const m = round.match(/(\d+)$/);
  if (m) return locale === 'ko' ? `${m[1]}라운드` : `Matchweek ${m[1]}`;
  return round;
}

/** "Regular Season - 27" → "27R". player page 전용이지만 format.ts에 통합. */
export function fmtRound(r: string | null): string {
  if (!r) return '';
  const m = r.match(/Regular Season - (\d+)/);
  return m ? `${m[1]}R` : r;
}
```

**삭제 대상**:
- `team/[teamId]/page.tsx` lines 33-35: `isDisciplinaryReason`, line 49: `daysAgo`, line 50: `fmtDate`
- `fixtures/[fixtureId]/page.tsx` lines 126-156: `daysAgo`, `fmtDate`, `isDisciplinaryReason`, `formatMatchDateTime`, `formatRoundLabel`, `parseRoundNumber`
- `fixtures/page.tsx` lines 27-49: `parseRoundNumber`, `formatMatchDate`, `formatRoundLabel`
- `player/[playerId]/page.tsx` lines 40-50: `fmtDate`, `fmtRound`, `checkDisciplinary`

**주의**: `fixtures/page.tsx`의 `parseRoundNumber`는 999를 반환하는 반면, `fixtures/[fixtureId]/page.tsx`의 것은 null을 반환함. 따라서:
- `fixtures/page.tsx`에서 `parseRoundNumber(...)` 호출 → `parseRoundNumberForSort(...)` 으로 교체
- `player/[playerId]/page.tsx`에서 `checkDisciplinary(...)` 호출 → `isDisciplinaryReason(...)` 으로 교체

---

### 4. `src/components/injured-player-card.tsx`

부상 선수 카드 서버 컴포넌트. team page와 fixture detail page 모두에서 사용.

#### Props 설계

```typescript
import Link from 'next/link';
import { t, tPos, tInjury, type Locale } from '@/lib/i18n';
import { SEV_TAG, SEV_KEY, ROLE_KEY, CTX_KEY } from '@/lib/constants';
import { isDisciplinaryReason, fmtDate, daysAgo } from '@/lib/format';
import type { InjuredPlayer } from '@/lib/types';

interface InjuredPlayerCardProps {
  ip: InjuredPlayer;
  locale: Locale;
  variant: 'team' | 'fixture';     // 페이지별 레이아웃 차이
  severity: 'high' | 'other';      // high = critical/high, other = moderate/low
  playerLinkSuffix?: string;        // team page: "?team=11&league=39", fixture: 없음
}
```

#### variant × severity 별 스타일 차이표

반드시 아래 값들을 정확히 유지해야 픽셀 수준의 시각적 일치가 보장됨.

| 속성 | team + high | fixture + high | team + other | fixture + other |
|------|-------------|---------------|-------------|----------------|
| **container padding** | `0.875rem 1rem` | `0.75rem 1rem` | `0.625rem 1rem` | `0.625rem 1rem` |
| **container layout** | `flex row, align-center, justify-between` | vertical (no flex row) | `flex row, align-center, justify-between` | `flex row, align-center, gap 0.5rem` |
| **photo 크기** | `2.25rem` | `1.75rem` | `1.75rem` | `1.5rem` |
| **photo-text gap** | `0.75rem` | `0.625rem` | `0.625rem` | (container gap) |
| **name font-size** | `0.875rem` | `0.8125rem` | `0.875rem` | `0.8125rem` |
| **name font-weight** | `600` | `600` | `500` | `500` |
| **tag gap** | `0.5rem` | `0.375rem` | `0.5rem` | `0.375rem` |
| **role 태그 표시** | O | O | X | X |
| **info line font-size** | `0.75rem` | `0.6875rem` | `0.75rem` | `0.6875rem` |
| **stats font-size** | `0.6875rem` | `0.625rem` | `0.625rem` | `0.5625rem` |
| **stats gap** | `0.875rem` | `0.75rem` | `0.625rem` | `0.5rem` |
| **stats labels** | `Start`/`Sub`/Goals/Assists/`min` | `Start`/`Sub`/Goals/Assists (no min) | `S`/`Sub`/Goals/Assists (no min) | `Start`/`Sub`/Goals/Assists (no min) |

#### 레이아웃 구조 차이 (중요!)

**team + high**: 좌측에 photo+info+stats, 우측에 별도 `<div>` 패널 (context label + winRateBoost)
```
[ photo | name+tags / pos·reason·date·daysAgo / stats ]  [ context / winRate ]
```

**fixture + high**: 세로 스택. photo+name 행 → info 행 → stats 행 → context+winRate 행 (photo indent)
```
[ photo  name+tags ]
[ pos·reason·date·daysAgo ]
[ stats ]
[ context · winRate ]  ← paddingLeft: photo있으면 2.375rem
```

**team + other**: 좌측에 photo+name+tags+info+stats, 우측에 별도 `<div>` 패널 (injury reason + date)
```
[ photo | name+tags / pos·role / stats ]  [ injuryReason / date ]
```
- info line: `{position} · {role}` (reason/date는 우측 패널)
- 우측 패널: injury reason (0.75rem, text-secondary) + date or "Out all season" (0.6875rem, text-helper)

**fixture + other**: 단일 행 (flex row). 우측 패널 없음.
```
[ photo | name+tags / pos·reason·date_or_out_all_season / stats ]
```
- info line: `{position} · {reason} · {date or 'Out all season'}` (reason+date가 info line에 포함)
- `flexWrap: 'wrap'` on tag row

#### 공통 렌더링 로직 (모든 variant에서 동일)

1. **triggerDate 계산**: `ip.starterProfile.lastStartFixtureDate ?? ip.injury.date`
2. **disciplinary 체크**: `isDisciplinaryReason(ip.injury.reason)`
3. **isLongTerm 체크** (other만): `ip.injuryContext.type === 'pre_season_absence' || ip.injuryContext.type === 'extended_absence'`
4. **severity 태그**: `<span className={sc-tag ${SEV_TAG[ip.severity]}}>{t(locale, SEV_KEY[ip.severity])}</span>`
5. **disciplinary 태그**: `{disciplinary && <span className="sc-tag sc-tag--orange">{locale === 'ko' ? '출전 정지' : 'Suspended'}</span>}`
6. **role 태그** (high만): `<span className="sc-tag sc-tag--blue">{t(locale, ROLE_KEY[ip.starterProfile.role])}</span>`
7. **long-term 태그** (other만): `{isLongTerm && !disciplinary && <span className="sc-tag sc-tag--gray">...</span>}`
8. **new 태그** (other만): `{triggerDays <= 7 && !disciplinary && !isLongTerm && <span className="sc-tag sc-tag--blue">{t(locale, 'new_badge')}</span>}`
9. **stats 행**: starterCount, substituteCount, goals (if not null), assists (if not null), minutes (team+high only)

#### 구현 권장 방식

variant/severity에 따른 스타일 값을 객체로 미리 계산하고, JSX는 하나의 구조로 작성하되 조건부 렌더링으로 차이를 처리:

```typescript
export function InjuredPlayerCard({ ip, locale, variant, severity, playerLinkSuffix = '' }: InjuredPlayerCardProps) {
  const isTeam = variant === 'team';
  const isHigh = severity === 'high';

  // 스타일 값 계산
  const photoSize = isTeam ? (isHigh ? '2.25rem' : '1.75rem') : (isHigh ? '1.75rem' : '1.5rem');
  const nameFontSize = isTeam ? '0.875rem' : '0.8125rem';
  const nameFontWeight = isHigh ? 600 : 500;
  const statsFontSize = isTeam ? (isHigh ? '0.6875rem' : '0.625rem') : (isHigh ? '0.625rem' : '0.5625rem');
  // ... etc

  const disciplinary = isDisciplinaryReason(ip.injury.reason);
  const triggerDate = ip.starterProfile.lastStartFixtureDate ?? ip.injury.date;
  const triggerDays = daysAgo(triggerDate);
  const isLongTerm = !isHigh && (ip.injuryContext.type === 'pre_season_absence' || ip.injuryContext.type === 'extended_absence');

  // team variant: flex row with right panel
  // fixture variant: vertical stack (high) or single flex row (other)

  // ... 조건부 JSX
}
```

---

## 수정 대상 파일 5개

### 5. `src/app/team/[teamId]/page.tsx` (현재 354줄)

**삭제**:
- lines 6-25: `Team`, `InjuredPlayer`, `InjuryImpact` 인터페이스
- line 31: `SEV_TAG`
- lines 33-36: `isDisciplinaryReason`
- lines 37-47: `CTX_KEY`, `ROLE_KEY`, `SEV_KEY`
- lines 49-50: `daysAgo`, `fmtDate`

**추가** (파일 상단 import):
```typescript
import type { Team, InjuredPlayer, InjuryImpact } from '@/lib/types';
import { SEV_TAG, SEV_KEY, CTX_KEY } from '@/lib/constants';
import { isDisciplinaryReason, fmtDate, daysAgo } from '@/lib/format';
import { InjuredPlayerCard } from '@/components/injured-player-card';
```

**변경**: `highImpact.map(...)` 블록 (lines 163-229) 교체:
```typescript
{highImpact.map((ip) => (
  <InjuredPlayerCard
    key={ip.player.id}
    ip={ip}
    locale={locale}
    variant="team"
    severity="high"
    playerLinkSuffix={`?team=${teamId}${backLeagueId ? `&league=${backLeagueId}` : ''}`}
  />
))}
```

**변경**: `otherInjured.map(...)` 블록 (lines 241-298) 교체:
```typescript
{otherInjured.map((ip) => (
  <InjuredPlayerCard
    key={ip.player.id}
    ip={ip}
    locale={locale}
    variant="team"
    severity="other"
    playerLinkSuffix={`?team=${teamId}${backLeagueId ? `&league=${backLeagueId}` : ''}`}
  />
))}
```

**참고**: `SEV_TAG`, `SEV_KEY`, `CTX_KEY`는 카드 컴포넌트가 내부적으로 import하므로, team page 본문에서 이 상수들을 직접 사용하는 곳이 없다면 import 불필요. 확인 후 정리.

---

### 6. `src/app/league/[leagueId]/fixtures/[fixtureId]/page.tsx` (현재 1098줄)

**삭제**:
- lines 8-99: 모든 인터페이스
- lines 103-124: `SEV_TAG`, `SEV_KEY`, `ROLE_KEY`, `CTX_KEY`, `LEAGUE_NAMES`
- lines 126-156: `daysAgo`, `fmtDate`, `isDisciplinaryReason`, `formatMatchDateTime`, `formatRoundLabel`, `parseRoundNumber`
- lines 567-568: `POS_GROUP_ORDER`, `POS_GROUP_LABEL`

**추가** (파일 상단 import):
```typescript
import type { Team, Fixture, InjuredPlayer, InjuryImpact, PredictedPlayer, UnavailablePlayer, PredictedLineup } from '@/lib/types';
import { SEV_TAG, SEV_KEY, ROLE_KEY, CTX_KEY, LEAGUE_NAMES, POS_GROUP_ORDER, POS_GROUP_LABEL } from '@/lib/constants';
import { isDisciplinaryReason, fmtDate, daysAgo, formatMatchDateTime, formatRoundLabel, parseRoundNumber } from '@/lib/format';
import { InjuredPlayerCard } from '@/components/injured-player-card';
```

**변경**: `InjuryColumn` 내 `highImpact.map(...)` (lines 315-433) 교체:
```typescript
{highImpact.map((ip) => (
  <InjuredPlayerCard
    key={ip.player.id}
    ip={ip}
    locale={locale}
    variant="fixture"
    severity="high"
  />
))}
```

**변경**: `InjuryColumn` 내 `otherInjured.map(...)` (lines 458-556) 교체:
```typescript
{otherInjured.map((ip) => (
  <InjuredPlayerCard
    key={ip.player.id}
    ip={ip}
    locale={locale}
    variant="fixture"
    severity="other"
  />
))}
```

**참고**: `InjuryColumn`의 나머지 (team header, power loss stats, no injuries fallback, section headers) 그대로 유지. `LineupColumn`도 그대로 유지.

---

### 7. `src/app/league/[leagueId]/fixtures/page.tsx` (현재 428줄)

**삭제**:
- lines 6-21: `Team`, `Fixture` 인터페이스
- lines 23-25: `LEAGUE_NAMES`
- lines 27-49: `parseRoundNumber`, `formatMatchDate`, `formatRoundLabel`

**추가**:
```typescript
import type { Team, Fixture } from '@/lib/types';
import { LEAGUE_NAMES } from '@/lib/constants';
import { parseRoundNumberForSort, formatMatchDate, formatRoundLabel } from '@/lib/format';
```

**변경**: 파일 내 `parseRoundNumber(...)` 호출을 `parseRoundNumberForSort(...)`로 전부 교체.
(기존이 `number` 반환 (999 fallback)이므로 `parseRoundNumberForSort`와 동일)

---

### 8. `src/app/league/[leagueId]/page.tsx` (현재 145줄)

**삭제**: lines 13-15: `LEAGUE_NAMES`

**추가**:
```typescript
import { LEAGUE_NAMES } from '@/lib/constants';
```

---

### 9. `src/app/player/[playerId]/page.tsx` (현재 305줄)

**삭제**: lines 40-50: `fmtDate`, `fmtRound`, `checkDisciplinary`

**추가**:
```typescript
import { isDisciplinaryReason, fmtDate, fmtRound } from '@/lib/format';
```

**변경**: 파일 내 `checkDisciplinary(...)` 호출을 `isDisciplinaryReason(...)`으로 전부 교체.

---

## 실행 순서 및 검증

### Step 1: `lib/constants.ts` + `lib/types.ts` + `lib/format.ts` 생성
3개 파일 동시 생성 (서로 의존관계 없음, constants만 i18n.ts의 TranslationKey import)

### Step 2: 각 페이지에서 로컬 정의 삭제 + import 전환
순서: league page → fixtures page → player page → team page → fixture detail page
(단순한 것부터 복잡한 것 순)

### Step 3: 검증
```bash
npx -w packages/frontend tsc --noEmit
```
타입 에러 0이면 통과.

### Step 4: `components/injured-player-card.tsx` 생성

### Step 5: team page, fixture detail page에서 카드 렌더링을 컴포넌트로 교체

### Step 6: 최종 검증
```bash
npm run build -w packages/frontend
```
빌드 성공 + 브라우저에서 아래 페이지 시각적 확인:
- `/team/11?league=39` (Tottenham team page)
- 아무 fixture detail page
- `/league/39` (standings)
- `/league/39/fixtures` (fixtures list)
- 아무 player page

---

## 추출하지 않는 항목 (과도한 추상화 방지)

| 항목 | 이유 |
|------|------|
| Stat overview tiles | team page(4열 grid)와 fixture(2열 grid)의 구조/메트릭이 다름 |
| Squad table / Standings table | 컬럼 구성이 완전히 다름 |
| `buildEpisodes()` | player page 전용 |
| `LineupColumn` | fixture detail 전용 |
| `backLinkStyle` | 단순 CSS 객체 1개, import 오버헤드 대비 이점 없음 |

---

## 예상 결과

- **신규 파일**: 4개 (~230줄)
- **수정 파일**: 5개
- **순 코드 감소**: ~460줄 삭제, ~230줄 추가 = **순감소 ~230줄**
- **중복 제거**: 19개 항목 (상수 7, 함수 9, 인터페이스 7, 컴포넌트 2) → 전부 단일 소스
- **기능 변경**: 없음 (픽셀 수준 동일 보장)
