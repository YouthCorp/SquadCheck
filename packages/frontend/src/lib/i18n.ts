export type Locale = 'en' | 'ko';

const translations = {
  en: {
    // nav
    nav_leagues: 'Leagues',
    nav_tools: 'Tools',
    nav_matchup: 'Matchup Analysis',
    nav_data: 'Data: API-Football Pro',
    nav_standings: 'Standings',
    nav_fixtures: 'Fixtures',

    // common
    season: 'Season',
    league: 'League',
    app: 'App',
    min: 'Min',
    rating: 'Rating',
    goals: 'G',
    assists: 'A',
    yellow_cards: 'YC',
    red_cards: 'RC',
    player: 'Player',
    position: 'Pos',
    founded: 'Founded',
    back: 'Back',

    // positions
    pos_goalkeeper: 'Goalkeeper',
    pos_defender: 'Defender',
    pos_midfielder: 'Midfielder',
    pos_attacker: 'Attacker',
    pos_forward: 'Forward',

    // league page
    no_standings: 'No standings data available for this league. Run the seed first.',
    played: 'P',
    wins: 'W',
    draws: 'D',
    losses: 'L',
    goals_for: 'GF',
    goals_against: 'GA',
    goal_diff: 'GD',
    points: 'Pts',
    team: 'Team',
    form: 'Form',

    // team page
    injury_status: 'Injury Status',
    key_absences: 'Key Injuries',
    other_injuries: 'Injuries',
    squad: 'Squad',
    players_out: 'Players Out',
    key_players: 'Key Players',
    moderate: 'Moderate',
    low_impact: 'Low Impact',
    severity_critical: 'Critical',
    severity_high: 'High',
    severity_moderate: 'Moderate',
    severity_low: 'Low',
    role_starter: 'Starter',
    role_rotation: 'Rotation',
    role_bench: 'Bench',
    ctx_mid_season_loss: 'Mid-season loss',
    ctx_extended_absence: 'Extended absence',
    ctx_recent_injury: 'Recent',
    ctx_early_season_loss: 'Early-season loss',
    ctx_pre_season_absence: 'Out all season',
    days_ago: '{n}d ago',
    win_rate_positive: 'Win rate +{n}% with',
    win_rate_negative: 'Win rate {n}% with',
    new_badge: 'New',

    // player page
    season_stats: 'Season Stats',
    injury_history: 'Absence History',
    issue_singular: 'issue',
    issue_plural: 'issues',
    status_out: 'Out',
    status_suspended: 'Suspended',
    status_doubtful: 'Doubtful',
    match_missed_singular: 'match missed',
    match_missed_plural: 'matches missed',
    ongoing: 'ongoing',
    injured_before_season: 'Injured before season start',
    player_not_found: 'Player not found',
    disciplinary_in_match: 'Issued in',
    injury_in_match: 'Injured in',

    // fixtures page
    fixtures_title: 'Fixtures',
    no_fixtures: 'No upcoming fixtures available.',
    match_detail: 'Match Detail',
    match_venue: 'Venue',
    injury_comparison: 'Injury Comparison',
    power_loss: 'Power Loss',
    no_injuries: 'No current injuries',
    predicted_lineups: 'Predicted Lineups',
    coming_soon: 'Coming Soon',
    round_prefix: 'Round',
    lineup_formation: 'Formation',
    lineup_starters: 'Starting XI',
    lineup_unavailable: 'Unavailable',
    lineup_no_data: 'Not enough data to predict lineup',
    lineup_recently_returned: 'Returned',
    lineup_would_start: 'Would start if fit',
    lineup_default_formation: 'Default formation',

    // home
    home_subtitle: "Analyze how injuries impact team performance across Europe's top leagues. Select a league to get started.",
    how_it_works: 'How It Works',
    step1_title: '1. Player Weights',
    step1_desc: "Each player's contribution is scored based on minutes played, rating, and goal involvement.",
    step2_title: '2. Injury Tracking',
    step2_desc: 'Real-time injury data maps which players are unavailable for upcoming matches.',
    step3_title: '3. Power Loss',
    step3_desc: 'Team power loss percentage shows how much a squad is weakened by current absences.',

    // countries
    country_england: 'England',
    country_spain: 'Spain',
    country_italy: 'Italy',
    country_germany: 'Germany',
    country_france: 'France',
  },
  ko: {
    // nav
    nav_leagues: '리그',
    nav_tools: '도구',
    nav_matchup: '매치업 분석',
    nav_data: '데이터: API-Football Pro',
    nav_standings: '순위표',
    nav_fixtures: '일정',

    // common
    season: '시즌',
    league: '리그',
    app: '출전',
    min: '출전시간',
    rating: '평점',
    goals: '골',
    assists: '도움',
    yellow_cards: '경고',
    red_cards: '퇴장',
    player: '선수',
    position: '포지션',
    founded: '창단',
    back: '뒤로',

    // positions
    pos_goalkeeper: '골키퍼',
    pos_defender: '수비수',
    pos_midfielder: '미드필더',
    pos_attacker: '공격수',
    pos_forward: '공격수',

    // league page
    no_standings: '이 리그의 순위 데이터가 없습니다. 데이터를 먼저 시딩하세요.',
    played: '경기',
    wins: '승',
    draws: '무',
    losses: '패',
    goals_for: '득점',
    goals_against: '실점',
    goal_diff: '득실차',
    points: '승점',
    team: '팀',
    form: '최근폼',

    // team page
    injury_status: '부상 현황',
    key_absences: '주요 부상자',
    other_injuries: '부상자',
    squad: '스쿼드',
    players_out: '결장 선수',
    key_players: '핵심 선수',
    moderate: '보통',
    low_impact: '낮음',
    severity_critical: '심각',
    severity_high: '높음',
    severity_moderate: '보통',
    severity_low: '낮음',
    role_starter: '주전',
    role_rotation: '로테이션',
    role_bench: '후보',
    ctx_mid_season_loss: '시즌 중 이탈',
    ctx_extended_absence: '장기 결장',
    ctx_recent_injury: '최근 부상',
    ctx_early_season_loss: '시즌 초 이탈',
    ctx_pre_season_absence: '시즌 전체 결장',
    days_ago: '{n}일 전',
    win_rate_positive: '출전 시 승률 +{n}%',
    win_rate_negative: '출전 시 승률 {n}%',
    new_badge: '신규',

    // player page
    season_stats: '시즌 스탯',
    injury_history: '결장 이력',
    issue_singular: '건',
    issue_plural: '건',
    status_out: '부상 결장',
    status_suspended: '출전 정지',
    status_doubtful: '출전 의문',
    match_missed_singular: '경기 결장',
    match_missed_plural: '경기 결장',
    ongoing: '진행 중',
    injured_before_season: '시즌 시작 전 부상',
    player_not_found: '선수를 찾을 수 없습니다',
    disciplinary_in_match: '정지 발생 경기',
    injury_in_match: '부상 경기',

    // fixtures page
    fixtures_title: '경기 일정',
    no_fixtures: '예정된 경기가 없습니다.',
    match_detail: '경기 상세',
    match_venue: '경기장',
    injury_comparison: '부상 비교',
    power_loss: '전력 손실',
    no_injuries: '현재 부상 선수 없음',
    predicted_lineups: '예상 라인업',
    coming_soon: '준비 중',
    round_prefix: '라운드',
    lineup_formation: '포메이션',
    lineup_starters: '선발 XI',
    lineup_unavailable: '출전 불가',
    lineup_no_data: '라인업 예측을 위한 데이터가 부족합니다',
    lineup_recently_returned: '복귀',
    lineup_would_start: '건강 시 선발',
    lineup_default_formation: '기본 포메이션',

    // home
    home_subtitle: '유럽 주요 리그의 부상이 팀 성적에 미치는 영향을 분석합니다. 리그를 선택해 시작하세요.',
    how_it_works: '분석 방법',
    step1_title: '1. 선수 가중치',
    step1_desc: '출전 시간, 평점, 골 관여도를 기반으로 각 선수의 기여도를 산출합니다.',
    step2_title: '2. 부상 추적',
    step2_desc: '실시간 부상 데이터를 통해 다음 경기에 출전 불가능한 선수를 파악합니다.',
    step3_title: '3. 전력 손실',
    step3_desc: '현재 결장 선수들로 인한 팀의 전력 손실 비율을 산출합니다.',

    // countries
    country_england: '잉글랜드',
    country_spain: '스페인',
    country_italy: '이탈리아',
    country_germany: '독일',
    country_france: '프랑스',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(locale: Locale, key: TranslationKey, vars?: Record<string, string | number>): string {
  const val: string = (translations[locale] as Record<string, string>)[key] ?? (translations.en as Record<string, string>)[key] ?? key;
  if (!vars) return val;
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), val);
}

/** Translate a position string (e.g. "Midfielder") to the current locale */
export function tPos(locale: Locale, pos: string | null | undefined): string {
  if (!pos) return '—';
  const key = pos.toLowerCase();
  const map: Record<string, TranslationKey> = {
    goalkeeper: 'pos_goalkeeper',
    defender: 'pos_defender',
    midfielder: 'pos_midfielder',
    attacker: 'pos_attacker',
    forward: 'pos_forward',
  };
  const tk = map[key];
  return tk ? t(locale, tk) : pos;
}

/** Translate a raw injury reason string (from API-Football) to the current locale */
export function tInjury(locale: Locale, reason: string | null | undefined): string {
  if (!reason) return '—';
  if (locale !== 'ko') return reason;

  const r = reason.toLowerCase().trim();

  // ── Administrative / non-injury ──────────────────────────────────────────
  if (r === 'suspended' || r === 'suspension') return '출전 정지';
  if (r.includes('red card')) return '퇴장';
  if (r === 'yellow cards' || r === 'yellow card') return '경고 누적';
  if (r === 'international duty' || r === 'national selection') return '국가대표 소집';
  if (r === "coach's decision" || r === 'coach decision') return '감독 결정';
  if (r === 'loan agreement' || r === 'loan') return '임대';
  if (r === 'inactive') return '비활성';
  if (r === 'personal reasons' || r === 'personal reason') return '개인 사정';
  if (r === 'lacking match fitness' || r === 'fitness') return '체력 문제';
  if (r === 'rest') return '휴식';
  if (r === 'other') return '기타';
  if (r === 'not in the squad') return '명단 제외';
  if (r === 'missing fixture') return '결장';

  // ── Medical (non-body-part) ───────────────────────────────────────────────
  if (r === 'injury' || r === 'injured' || r === 'injured doubtful') return '부상';
  if (r === 'unknown' || r === 'unknown injury') return '미상';
  if (r === 'illness' || r === 'sick') return '질병';
  if (r === 'flu' || r === 'influenza') return '독감';
  if (r === 'concussion') return '뇌진탕';
  if (r.includes('covid') || r === 'coronavirus') return '코로나19';
  if (r === 'health problems' || r === 'health problem') return '건강 문제';
  if (r === 'heart problems' || r === 'heart problem') return '심장 문제';
  if (r === 'surgery') return '수술';
  if (r === 'hernia') return '탈장';
  if (r === 'wound') return '찰과상';
  if (r === 'contusion' || r === 'knock') return '타박상';
  if (r === 'muscular problems' || r === 'muscular problem') return '근육 문제';

  // ── Body-part keyword matching (specific → generic) ───────────────────────
  if (r.includes('acl') || r.includes('anterior cruciate') || r.includes('cruciate')) return '십자인대 부상';
  if (r.includes('achilles')) return '아킬레스건 부상';
  if (r.includes('adductor')) return '내전근 부상';
  if (r.includes('hamstring')) return '햄스트링 부상';
  if (r.includes('knee')) return '무릎 부상';
  if (r.includes('calf')) return '종아리 부상';
  if (r.includes('ankle')) return '발목 부상';
  if (r.includes('thigh') || r.includes('quadricep') || r.includes('quad')) return '허벅지 부상';
  if (r.includes('groin')) return '사타구니 부상';
  if (r.includes('hip')) return '고관절 부상';
  if (r.includes('shoulder')) return '어깨 부상';
  if (r.includes('collarbone') || r.includes('clavicle')) return '빗장뼈 부상';
  if (r.includes('chest')) return '가슴 부상';
  if (r.includes('rib')) return '갈비뼈 부상';
  if (r.includes('back') || r.includes('spine') || r.includes('lumbar')) return '허리 부상';
  if (r.includes('abdominal') || r.includes('abdomen')) return '복부 부상';
  if (r.includes('pelvis') || r.includes('pelvic')) return '골반 부상';
  if (r.includes('head')) return '두부 부상';
  if (r.includes('jaw') || r.includes('face')) return '안면 부상';
  if (r.includes('nose')) return '코 부상';
  if (r.includes('eye')) return '눈 부상';
  if (r.includes('heel')) return '뒤꿈치 부상';
  if (r.includes('foot') || r.includes('toe') || r.includes('feet')) return '발 부상';
  if (r.includes('wrist') || r.includes('wirst')) return '손목 부상';
  if (r.includes('finger')) return '손가락 부상';
  if (r.includes('hand')) return '손 부상';
  if (r.includes('elbow') || r.includes('arm')) return '팔 부상';
  if (r.includes('leg')) return '다리 부상';
  if (r.includes('torn') || r.includes('muscle fiber') || r.includes('muscle fibre')) return '근육 파열';
  if (r.includes('muscular') || r.includes('muscle bruise')) return '근육 문제';
  if (r.includes('muscle')) return '근육 부상';
  if (r.includes('fracture') || r.includes('fractured') || r.includes('broken')) return '골절';
  if (r.includes('ligament')) return '인대 부상';
  if (r.includes('achilles') || r.includes('tendon') || r.includes('tendinitis') || r.includes('tendinopathy')) return '힘줄 부상';
  if (r.includes('strain')) return '근육 염좌';
  if (r.includes('sprain')) return '염좌';

  return reason;
}
