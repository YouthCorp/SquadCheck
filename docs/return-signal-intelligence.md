# Pre-Match Return Signal Intelligence Layer

## 배경 및 목표

### 현재 문제

SquadCheck의 부상자 처리는 **사후 반응형**입니다.

```
선수 공식 라인업 등장
        ↓
  6시간 동기화 완료
        ↓
   부상자 명단 제거
```

현실에서는 훈련 복귀 보도, 기자 회견, 구단 발표 등이 경기 **12~48시간 전**에 이미 존재합니다. 현재 MVP는 이 신호를 전혀 반영하지 못합니다.

### 개선 목표

| 항목 | 현재 | 목표 |
|------|------|------|
| 부상자 상태 | binary (injured / not injured) | 확률 기반 (0~1 가용성 점수) |
| 신호 감지 시점 | 공식 라인업 발표 이후 | 경기 전 12~48시간 |
| 데이터 소스 | Football API 단일 | Football API (canonical) + 외부 신호 레이어 |
| 라인업 예측 | 공식 부상자 제외 | 복귀 확률 반영 |

---

## 아키텍처 개요

```
RSS Feeds (BBC, Sky, Guardian, ESPN, The Athletic)
        │
        ▼
┌────────────────────────────────────────────────────┐
│        RecoverySignalCollector                     │
│        packages/ingestion/src/collectors/          │
│                                                    │
│  RSS Fetch ──► Entity Match ──► NLP Pass 1 (키워드) │
│                                        │           │
│                              신뢰도 0.3~0.8         │
│                                        ▼           │
│                              NLP Pass 2 (Claude)   │
│                                        │           │
│                                        ▼           │
│                  Signal 저장 ──► Availability 집계  │
└──────────────────────┬─────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
     DB (3 신규)    Analysis     Frontend
      테이블        (라인업/      (뱃지,
                  부상 영향)     툴팁)
```

**핵심 원칙**: Football API 부상 데이터는 canonical layer. 외부 신호는 절대 덮어쓰지 않고 **확률 레이어**로만 추가.

---

## DB 스키마 변경

### 신규 테이블 3개 (기존 테이블 컬럼 변경 없음)

#### `rss_feed_sources`
```prisma
model RssFeedSource {
  id          Int       @id @default(autoincrement())
  name        String    // "BBC Sport Football"
  url         String    @unique
  language    String    @default("en")
  reliability Float     @default(0.5) // 0~1 소스 신뢰도 가중치
  active      Boolean   @default(true)
  lastFetched DateTime? @map("last_fetched")

  signals   RecoverySignal[]
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("rss_feed_sources")
}
```

#### `recovery_signals`
```prisma
model RecoverySignal {
  id              Int      @id @default(autoincrement())
  playerId        Int      @map("player_id")
  teamId          Int      @map("team_id")
  sourceId        Int      @map("source_id")

  articleUrl      String   @map("article_url")
  articleTitle    String   @map("article_title")
  publishedAt     DateTime @map("published_at")

  // NLP 분류 결과
  signalStage     String   @map("signal_stage")
  // partial_training | full_training | available | expected_to_start
  recoveryScore   Float    @map("recovery_score") // 0~1
  confidence      Float    // 0~1, NLP 분류 확신도
  classifiedBy    String   @map("classified_by") // "keyword" | "claude"

  extractedSnippet String? @map("extracted_snippet") @db.Text // 디버깅용

  player  Player        @relation(fields: [playerId], references: [id])
  team    Team          @relation(fields: [teamId], references: [id])
  source  RssFeedSource @relation(fields: [sourceId], references: [id])

  createdAt DateTime @default(now()) @map("created_at")

  @@unique([playerId, articleUrl]) // 중복 신호 방지
  @@index([playerId, createdAt])
  @@index([teamId, createdAt])
  @@map("recovery_signals")
}
```

#### `player_availability`

> **설계 결정: 경기(fixture) 단위 가용성**
>
> 단일 row(선수당 1행) 방식은 경기 맥락을 잃습니다. 예: "Match A 전 가용성 70%"와
> "Match B 전 가용성 40% (재부상 보도)" 구분이 불가능합니다.
>
> 따라서 `(playerId, fixtureId)` 복합 키로 **경기 단위** 가용성을 관리합니다.
> - 신호 수집 시 해당 팀의 **다음 예정 경기**를 자동 조회하여 fixtureId 바인딩
> - 경기 완료 후 해당 행은 historical 데이터로 남음 (예측 정확도 측정에 활용)
> - `expired` 필드로 경기 지나간 행을 표시 → 분석 쿼리 시 제외

```prisma
model PlayerAvailability {
  id         Int @id @default(autoincrement())
  playerId   Int @map("player_id")
  teamId     Int @map("team_id")
  fixtureId  Int @map("fixture_id") // 이 가용성이 적용되는 대상 경기

  // Football API 기반 공식 상태 (canonical)
  officialStatus       String @default("injured") @map("official_status")
  // "injured" | "doubtful" | "available"

  // 신호 기반 집계
  recoverySignalScore  Float  @default(0) @map("recovery_signal_score")
  predictedAvailability Float @default(0) @map("predicted_availability") // 최종 점수
  confidenceLevel      Float  @default(0) @map("confidence_level")

  latestSignalStage String?   @map("latest_signal_stage")
  lastSignalAt      DateTime? @map("last_signal_at")
  signalCount       Int       @default(0) @map("signal_count")
  expired           Boolean   @default(false) // 경기 완료 후 true로 전환

  player  Player  @relation(fields: [playerId], references: [id])
  fixture Fixture @relation(fields: [fixtureId], references: [id])

  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([playerId, fixtureId]) // 선수 × 경기 단위 유일
  @@index([teamId, expired])
  @@index([fixtureId])
  @@map("player_availability")
}
```

**라이프사이클:**
```
1. 신호 수집 시 → 해당 팀의 다음 미완료 경기(status != FT/AET/PEN) 조회
2. PlayerAvailability upsert (playerId + fixtureId)
3. 경기 완료 → expired = true (6시간 sync 시 일괄 처리)
4. expired = true 행은 accuracy 측정용으로 보존
   (실제 출전 여부와 predictedAvailability 비교)
```

#### 기존 모델 수정 (relation 필드만 추가, DB 컬럼 변경 없음)
```prisma
// Player 모델에 추가:
recoverySignals RecoverySignal[]
availability    PlayerAvailability?

// Team 모델에 추가:
recoverySignals RecoverySignal[]
```

---

## 데이터 흐름 시퀀스

### Phase A: 신호 수집 (2시간 주기)

```
Cron: '0 1,3,5,7,9,11,13,15,17,19,21,23 * * *'
(홀수 시간대 — 기존 0,6,12,18 동기화와 겹치지 않음)

1. active RSS 소스 로드
2. rss-parser로 각 피드 fetch
3. source.lastFetched 이후 신규 기사만 필터
4. 기사별:
   a. EntityMatcher — 선수명 + 팀명 동시 출현 확인
   b. 현재 부상자인지 확인 (부상자 아니면 skip)
   c. NLP Pass 1 — 키워드/정규식 분류
   d. 분류 결과에 따른 분기 (아래 "Claude 호출 조건" 참조)
   e. RecoverySignal upsert (playerId + articleUrl unique)
   f. 해당 팀의 다음 미완료 경기 조회 → PlayerAvailability upsert
```

### NLP 신호 분류 기준

| Stage | 키워드 예시 | recovery_score |
|-------|-----------|---------------|
| `partial_training` | "light training", "individual session", "jogging on pitch" | 0.3 |
| `full_training` | "full training session", "trained with squad", "back in team training" | 0.55 |
| `available` | "fit to play", "available for selection", "in contention", "passed fitness test" | 0.75 |
| `expected_to_start` | "expected to start", "will start", "set to lead the line" | 0.90 |

**부정 표현 우선 처리**: "NOT fit", "ruled out", "unlikely to feature", "still sidelined" → skip

### Claude 호출 조건 (정밀 정의)

키워드 Pass 1은 각 기사에 대해 `{ stage, score, confidence }` 또는 `null`을 반환합니다.
Claude Pass 2는 **아래 조건 중 하나**를 만족할 때만 호출됩니다:

| 조건 | 설명 | 예시 |
|------|------|------|
| **패턴 충돌** | 긍정 + 부정 패턴 동시 매칭 | "returned to training but **unlikely** to play" |
| **약한 매칭** | 키워드 매칭됐으나 confidence < `CONFIDENT_THRESHOLD`(0.8) | "squad session" (full_training과 유사하나 정확한 패턴 아님) |
| **엔티티만 매칭** | 부상 선수명+팀명 확인됐으나 키워드 매칭 없음 | "Manager discusses Son's progress ahead of weekend" |
| **다단계 혼합** | 여러 stage 패턴이 동시 매칭 | "back in light training and could be available" |

**Claude를 호출하지 않는 경우:**

| 조건 | 설명 |
|------|------|
| 키워드 confidence >= 0.8, 단일 stage 매칭 | 명확한 분류 완료 |
| 부정 표현 단독 매칭 | 기사 자체를 skip |
| 엔티티 매칭 실패 | 기사가 관련 없음 |
| 사이클 내 Claude 호출 횟수 >= `MAX_CALLS_PER_CYCLE` | 비용 제어 — 키워드 결과 또는 skip |

```typescript
// 의사 코드
function shouldCallClaude(keywordResult: KeywordResult | null, entityMatch: EntityMatch): boolean {
  if (!entityMatch.matched) return false;
  if (claudeCallsThisCycle >= SIGNAL_CONFIG.claude.MAX_CALLS_PER_CYCLE) return false;

  if (keywordResult === null) return true;                          // 엔티티만 매칭
  if (keywordResult.hasConflict) return true;                       // 긍정+부정 충돌
  if (keywordResult.matchedStages.length > 1) return true;          // 다단계 혼합
  if (keywordResult.confidence < SIGNAL_CONFIG.keyword.CONFIDENT_THRESHOLD) return true; // 약한 매칭

  return false;
}
```

### 설정 상수 (signal-config.ts)

> **하드코딩 금지 원칙**: 모든 임계값과 가중치는 `signal-config.ts`에 명명된 상수로 정의.
> 튜닝 시 단일 파일만 수정. 향후 DB 기반 동적 설정으로 전환 가능.

```typescript
// packages/ingestion/src/nlp/signal-config.ts

export const SIGNAL_CONFIG = {
  // ── 키워드 분류 임계값 ──
  keyword: {
    CONFIDENT_THRESHOLD: 0.8,    // 이상이면 키워드 결과 확정
    AMBIGUOUS_LOWER: 0.3,        // 미만이면 신호 무시
    // 0.3 ~ 0.8 구간 → Claude API로 전달
  },

  // ── Claude 호출 제어 ──
  claude: {
    MAX_CALLS_PER_CYCLE: 50,
    TIMEOUT_MS: 10_000,
    MODEL: 'claude-haiku-4-5-20251001',
  },

  // ── 신호 집계 ──
  aggregation: {
    SIGNAL_WINDOW_DAYS: 7,       // 이 기간 내 신호만 집계
    RECENCY_HALF_LIFE_DAYS: 3.5, // 지수 감쇠 반감기
  },

  // ── 공식 상태별 가용성 변환 ──
  // predictedAvailability = BASE + recoverySignalScore × SIGNAL_WEIGHT
  availability: {
    injured:  { BASE: 0.00, SIGNAL_WEIGHT: 0.80 },
    doubtful: { BASE: 0.30, SIGNAL_WEIGHT: 0.50 },
    available:{ BASE: 1.00, SIGNAL_WEIGHT: 0.00 }, // API 확인 시 무조건 1.0
  },

  // ── 라인업 통합 임계값 ──
  lineup: {
    AVAILABILITY_THRESHOLD: 0.7,   // 이상이면 available pool로 이동
    CONFIDENCE_THRESHOLD: 0.5,     // 최소 신뢰도
  },

  // ── 신호 단계별 기본 recovery_score ──
  stageScores: {
    partial_training: 0.30,
    full_training: 0.55,
    available: 0.75,
    expected_to_start: 0.90,
  },
} as const;
```

### PlayerAvailability 집계 공식

```
recoverySignalScore = Σ (signal.recoveryScore × recencyWeight × source.reliability × signal.confidence)
                    / Σ (recencyWeight × source.reliability × signal.confidence)

recencyWeight = exp(-age_in_days / RECENCY_HALF_LIFE_DAYS)

predictedAvailability:
  config = SIGNAL_CONFIG.availability[official_status]
  result = config.BASE + recoverySignalScore × config.SIGNAL_WEIGHT
```

### Phase B: 분석 레이어 통합

> **설계 결정: 라인업 통합 로직 별도 함수 분리**
>
> 기존 `computePredictedLineup()`은 이미 700+ 줄의 함수입니다.
> 복귀 신호 로직을 인라인으로 추가하면 복잡도가 더 높아집니다.
>
> **`applyRecoverySignals()`을 별도 함수로 분리**합니다:
> - 단일 책임: 부상자 목록에서 신호 기반 복귀 선수 분류
> - 테스트 가능: injuredIds를 입력받아 조정된 결과 반환
> - feature flag 없이도 함수 호출 여부로 제어 가능

**신규 파일: `packages/analysis/src/recovery-signal-integration.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { SIGNAL_CONFIG } from '@squadcheck/ingestion/src/nlp/signal-config';

interface RecoverySignalResult {
  /** 신호 반영 후 최종 부상자 ID 집합 */
  adjustedInjuredIds: Set<number>;
  /** 신호 기반 복귀 → available pool로 이동한 선수 정보 */
  signalRecovered: Map<number, {
    predictedAvailability: number;
    latestSignalStage: string;
    lastSignalAt: Date;
    confidenceLevel: number;
    fixtureId: number;
  }>;
}

/**
 * 부상자 목록에 복귀 신호를 반영하여 조정된 결과를 반환.
 * 원본 injuredIds를 변경하지 않음 (immutable).
 *
 * @param prisma - DB client
 * @param injuredIds - 기존 로직으로 판별된 부상자 ID 집합
 * @param teamId - 대상 팀
 * @param upcomingFixtureId - 다음 예정 경기 (fixture 맥락)
 */
export async function applyRecoverySignals(
  prisma: PrismaClient,
  injuredIds: Set<number>,
  teamId: number,
  upcomingFixtureId: number | null,
): Promise<RecoverySignalResult> {
  const adjustedInjuredIds = new Set(injuredIds);
  const signalRecovered = new Map();

  if (!upcomingFixtureId || injuredIds.size === 0) {
    return { adjustedInjuredIds, signalRecovered };
  }

  const { AVAILABILITY_THRESHOLD, CONFIDENCE_THRESHOLD } = SIGNAL_CONFIG.lineup;

  const availabilities = await prisma.playerAvailability.findMany({
    where: {
      playerId: { in: [...injuredIds] },
      fixtureId: upcomingFixtureId,
      expired: false,
      predictedAvailability: { gte: AVAILABILITY_THRESHOLD },
      confidenceLevel: { gte: CONFIDENCE_THRESHOLD },
    },
  });

  for (const a of availabilities) {
    adjustedInjuredIds.delete(a.playerId);
    signalRecovered.set(a.playerId, {
      predictedAvailability: a.predictedAvailability,
      latestSignalStage: a.latestSignalStage,
      lastSignalAt: a.lastSignalAt,
      confidenceLevel: a.confidenceLevel,
      fixtureId: a.fixtureId,
    });
  }

  return { adjustedInjuredIds, signalRecovered };
}
```

**`predicted-lineup.ts` 호출부 (line 543 이후)**:

```typescript
const injuredIds = new Set(latestInjuryByPlayer.keys());

// 복귀 신호 반영 (별도 함수)
const { adjustedInjuredIds, signalRecovered } = await applyRecoverySignals(
  prisma,
  injuredIds,
  teamId,
  upcomingFixtureId, // 현재 예측 대상 경기
);

// 이후 로직에서 adjustedInjuredIds 사용
// signalRecovered 선수는 starters 배열에 signalRecovered: true 표시
```

### Phase C: API 동기화 연동

기존 6시간 Football API 동기화 완료 후:
- 선수가 부상자 목록에서 제거 → `official_status = "available"`, score = 1.0
- 여전히 부상자 → 신호 유지 (API canonical, 신호는 보조)

---

## 신규 파일 목록

### packages/ingestion/src/

```
collectors/
  recovery-signal.collector.ts    ← 메인 수집기
nlp/
  signal-config.ts                 ← 모든 임계값/가중치 상수 정의
  keyword-patterns.ts              ← 키워드/regex 사전
  entity-matcher.ts                ← 선수/팀명 매칭
  claude-classifier.ts             ← Claude API 2차 분류
aggregators/
  availability-aggregator.ts       ← PlayerAvailability 집계 (경기 단위)
```

### packages/analysis/src/

```
recovery-signal-integration.ts    ← applyRecoverySignals() 함수 (라인업 통합 로직)
```

### packages/database/prisma/

```
schema.prisma                      ← 3개 모델 추가
seed-rss.ts                        ← RSS 소스 초기 시드
```

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `packages/database/prisma/schema.prisma` | 3개 신규 모델, Player/Team relation 추가 |
| `packages/ingestion/src/orchestrator.ts` | `signalCollection()` 메서드 추가 |
| `packages/ingestion/src/scheduler.ts` | 신호 수집 cron 추가 (홀수 시간대) |
| `packages/analysis/src/predicted-lineup.ts` | line 543 이후 `applyRecoverySignals()` 호출 추가 |
| `packages/analysis/src/team-power-loss.ts` | EnrichedInjuredPlayer에 recoverySignal 필드 추가 |
| `packages/api/src/routes/analysis.ts` | 기존 endpoint에 availability 데이터 포함, 신규 endpoint 추가 |
| `packages/frontend/src/lib/types.ts` | InjuredPlayer, UnavailablePlayer, PredictedPlayer 타입 확장 |
| `packages/frontend/src/components/injured-player-card.tsx` | 가용성 뱃지(🟢🟡🔴) + 신호 툴팁 |
| `packages/frontend/src/components/pitch-lineup.tsx` | 신호 복귀 선수 점선 테두리 표시 |
| `packages/frontend/src/app/league/[leagueId]/fixtures/[fixtureId]/page.tsx` | 가용성 데이터 전달 |
| `packages/analysis/src/recovery-signal-integration.ts` | 신규: `applyRecoverySignals()` 함수 |
| `packages/ingestion/src/nlp/signal-config.ts` | 신규: 모든 임계값/가중치 상수 정의 |
| `.env` | `RECOVERY_SIGNALS_ENABLED`, `ANTHROPIC_API_KEY` |

---

## npm 의존성 추가

```json
// packages/ingestion/package.json
"rss-parser": "^3.13.0",
"@anthropic-ai/sdk": "^0.36.0"
```

---

## 단계적 롤아웃

### Phase 1 — 수집 기반 (Week 1~2)
기존 시스템 영향 없이 신호 수집·저장만.

- Prisma 스키마 마이그레이션
- RecoverySignalCollector, keyword-patterns, entity-matcher
- Orchestrator + Scheduler 수정
- RSS 소스 시드

**검증**: `SELECT COUNT(*) FROM recovery_signals WHERE created_at > NOW() - INTERVAL '1 day'`

### Phase 2 — NLP 강화 (Week 2~3)
Claude API 통합으로 분류 정확도 향상.

- claude-classifier.ts
- 부정 표현 처리 강화
- 비용 제어: `SIGNAL_CLAUDE_MAX_CALLS=50`

### Phase 3 — 분석 통합 (Week 3~4)
예측 라인업 및 부상 영향 분석에 가용성 반영.

- availability-aggregator.ts
- predicted-lineup.ts 수정
- team-power-loss.ts 수정
- Feature flag: `RECOVERY_SIGNALS_ENABLED=true`

### Phase 4 — API + Frontend (Week 4~5)
사용자 인터페이스에 신호 데이터 표시.

- API 신규 endpoint + 기존 endpoint 확장
- Frontend 컴포넌트 수정
- 가용성 뱃지 및 툴팁 UI

---

## 리스크 분석

| 리스크 | 가능성 | 영향 | 대응 |
|--------|--------|------|------|
| 오매칭 (잘못된 선수에 신호 연결) | 중 | 높음 | 팀+선수 동시 출현 필수, 이름 ≥4자, 동명이인 skip |
| 부정 표현 오분류 ("NOT fit"→긍정) | 중 | 중 | 부정 regex 우선 처리, Claude 2차 검증 |
| RSS 피드 형식 변경 | 중 | 낮음 | 소스별 에러 처리, N회 실패 시 active=false |
| Claude API 비용 초과 | 낮음 | 중 | 사이클당 50회 하드캡 |
| 기존 시스템 호환성 | 낮음 | 높음 | 기존 테이블 무변경, feature flag 제어 |
| 허위 복귀 보도 | 중 | 중 | confidence ≥ 0.5 + 다중 소스 교차 가중 |

---

## 성능 및 비용

| 항목 | 수치 |
|------|------|
| RSS 수집 / cycle | ~1MB, <10초 |
| Entity matching | 메모리 Map, O(1) |
| DB 쓰기 / cycle | ~10~50 행 |
| Claude 비용 | ~50 calls × 12 cycles/day × ~600 tokens = **~$0.15/day (~$4.50/month)** |
| DB 성장률 | ~10MB/month |

---

## 엣지 케이스

1. **동명이인** ("Jesus"): 팀 동시 출현 필수, 다수 매칭 시 skip
2. **다국어 기사**: 언어별 키워드 사전, Claude는 다국어 지원
3. **이적 선수**: 현재 부상 테이블 기준 매칭 (해당 팀 부상자만)
4. **중복 기사**: unique(playerId, articleUrl), 다중 소스 = 신뢰도 증가 (의도적)
5. **부상 미등록 선수**: injuredIds에 없으면 무시
6. **경기 후 기사**: publishedAt < 다음 경기 시각 필터링
7. **부정문 인용**: "NOT ready" — 부정 키워드 우선, Claude 2차 검증

---

## 마이그레이션 전략

**Zero-downtime, 순수 추가형:**

1. Prisma 마이그레이션 → 3개 신규 테이블 (기존 테이블 무변경)
2. RSS 소스 초기 시드
   ```sql
   INSERT INTO rss_feed_sources (name, url, language, reliability) VALUES
   ('BBC Sport Football', 'https://feeds.bbci.co.uk/sport/football/rss.xml', 'en', 0.85),
   ('Sky Sports Football', 'https://www.skysports.com/rss/12040', 'en', 0.80),
   ('Guardian Football', 'https://www.theguardian.com/football/rss', 'en', 0.75),
   ('ESPN FC', 'https://www.espn.com/espn/rss/soccer/news', 'en', 0.75),
   ('The Athletic Football', 'https://theathletic.com/rss/football/', 'en', 0.90);
   ```
3. 신호 수집기는 독립 스케줄로 실행 (기존 sync 영향 없음)
4. `RECOVERY_SIGNALS_ENABLED=false`로 시작 → 검증 후 `true`로 전환
5. Frontend: availability 데이터 없으면 기존 UI 그대로 (graceful)

---

## 테스트 전략

### 단위 테스트
- 키워드 패턴: stage별 긍정/부정 케이스, 부정 표현, 다국어
- Entity Matcher: 정확 매칭, 부분 매칭, 동명이인, 악센트 문자
- Availability 집계: 0개/단일/다중 신호, 7일 감쇠, official_status 게이팅
- 라인업 통합: availability > 0.7 → available 이동, < 0.7 → 부상 유지

### 통합 테스트
- RSS mock → 신호 저장 → Availability 계산 → 라인업 반영 전체 파이프라인
- 기존 API endpoint 역호환성 (신규 필드는 optional)
- 신호 수집 후 해당 팀 캐시 무효화 확인

### 수동 테스트
```bash
# 토트넘(id=11) 부상 선수에 복귀 신호 수동 삽입 후 확인
docker exec squadcheck-db-1 psql -U squadcheck -d squadcheck -c "
INSERT INTO recovery_signals (player_id, team_id, source_id, article_url, article_title, published_at, signal_stage, recovery_score, confidence, classified_by)
VALUES (<playerId>, 11, 1, 'https://test.com/article1', 'Test Return', NOW(), 'full_training', 0.8, 0.9, 'keyword');
"
# → curl http://localhost:4000/api/analysis/predicted-lineup/11?season=2025
# → frontend fixture detail 페이지 확인
```

---

## 성공 판단 지표 (Metrics)

| 지표 | 목표 | 측정 방법 |
|------|------|-----------|
| 신호→복귀 예측 정확도 | >70% | availability > 0.7인 선수의 다음 경기 출전율 |
| 오탐률 | <15% | "available/expected_to_start" 분류 후 미출전 비율 |
| Entity 매칭 정밀도 | >95% | 100건 랜덤 샘플 수동 검증 |
| 키워드 vs Claude 비율 | 80:20 | classified_by 컬럼 집계 |
| 일일 수집 신호 수 | 20~100건 | recovery_signals 일별 카운트 |
| 수집 사이클 소요 시간 | <60초 | 로그 타이밍 |
| Claude API 월 비용 | <$10 | Anthropic 대시보드 |
| 데이터 선행 시간 | 12~48시간 | 첫 신호 ~ API 공식 확인 시간 차이 평균 |
| 라인업 예측 정확도 향상 | +5~10% | 신호 있는 경기 vs 없는 경기 비교 |
