export type Locale = "en" | "ko";

const translations = {
  en: {
    // nav
    nav_leagues: "Leagues",
    nav_european_cups: "European Cups",
    nav_domestic_cups: "Domestic Cups",
    nav_tools: "Tools",
    nav_leaderboard: "Injury Leaderboard",
    nav_watchlist: "My Watchlist",
    nav_data: "Data: API-Football Pro",
    nav_standings: "Standings",
    nav_fixtures: "Fixtures",
    cup_knockout_notice: "Knockout competition — no standings table.",
    cup_view_fixtures: "View Fixtures →",

    // common
    season: "Season",
    league: "League",
    app: "App",
    min: "Min",
    rating: "Rating",
    goals: "G",
    assists: "A",
    yellow_cards: "YC",
    red_cards: "RC",
    player: "Player",
    position: "Pos",
    founded: "Founded",
    back: "Back",

    // positions
    pos_goalkeeper: "Goalkeeper",
    pos_defender: "Defender",
    pos_midfielder: "Midfielder",
    pos_attacker: "Attacker",
    pos_forward: "Forward",

    // league page
    no_standings:
      "No standings data available for this league. Run the seed first.",
    played: "P",
    wins: "W",
    draws: "D",
    losses: "L",
    goals_for: "GF",
    goals_against: "GA",
    goal_diff: "GD",
    points: "Pts",
    team: "Team",
    form: "Form",

    // team page
    injury_status: "Injury Status",
    key_absences: "Key Injuries",
    other_injuries: "Injuries",
    squad: "Squad",
    players_out: "Players Out",
    key_players: "Key Players",
    moderate: "Moderate",
    low_impact: "Low Impact",
    severity_critical: "Critical",
    severity_high: "High",
    severity_moderate: "Moderate",
    severity_low: "Low",
    role_starter: "Starter",
    role_rotation: "Rotation",
    role_bench: "Bench",
    ctx_mid_season_loss: "Mid-season loss",
    ctx_extended_absence: "Extended absence",
    ctx_recent_injury: "Recent",
    ctx_early_season_loss: "Early-season loss",
    ctx_pre_season_absence: "Out all season",
    days_ago: "{n}d ago",
    win_rate_positive: "Win rate +{n}% with",
    win_rate_negative: "Win rate {n}% with",
    new_badge: "New",

    // player page
    season_stats: "Season Stats",
    injury_history: "Absence History",
    issue_singular: "issue",
    issue_plural: "issues",
    status_out: "Out",
    status_suspended: "Suspended",
    status_doubtful: "Doubtful",
    match_missed_singular: "match missed",
    match_missed_plural: "matches missed",
    ongoing: "ongoing",
    injured_before_season: "Injured before season start",
    player_not_found: "Player not found",
    disciplinary_in_match: "Issued in",
    injury_in_match: "Injured in",

    // fixtures page
    fixtures_title: "Fixtures",
    tab_upcoming: "Upcoming",
    tab_results: "Results",
    no_fixtures: "No upcoming fixtures available.",
    no_results: "No results available for this season.",
    match_detail: "Match Detail",
    match_venue: "Venue",
    injury_comparison: "Injury Comparison",
    power_loss: "Power Loss",
    no_injuries: "No current injuries",
    predicted_lineups: "Predicted Lineups",
    coming_soon: "Coming Soon",
    round_prefix: "Round",
    lineup_formation: "Formation",
    lineup_starters: "Starting XI",
    lineup_unavailable: "Unavailable",
    lineup_no_data: "Not enough data to predict lineup",
    lineup_recently_returned: "Returned",
    lineup_would_start: "Would start if fit",
    lineup_default_formation: "Default formation",

    // result detail page
    result_detail: "Match Result",
    statistics: "Statistics",
    match_events: "Match Events",
    actual_lineups: "Lineups",
    stat_possession: "Possession",
    stat_shots: "Total Shots",
    stat_on_target: "On Target",
    stat_corners: "Corners",
    stat_fouls: "Fouls",
    stat_offsides: "Offsides",
    stat_saves: "Saves",
    stat_xg: "xG",
    stat_passes: "Passes",
    stat_pass_pct: "Pass Accuracy",
    coach: "Coach",
    bench: "Bench",
    no_match_events: "No event data available.",
    no_lineups: "No lineup data available.",
    no_statistics: "No statistics available.",
    event_goal: "Goal",
    event_sub: "Sub",
    event_yellow: "Yellow Card",
    event_red: "Red Card",
    events_show_all: "All Events",

    // live updates section
    live_updates: "Live Updates",
    recent_injuries: "Recent Injuries",
    recovery_signals: "Recovery Signals",
    no_recent_injuries: "No recent injuries",
    no_recovery_signals: "No recovery signals",
    signal_partial_training: "Partial Training",
    signal_full_training: "Full Training",
    signal_available: "Available",
    signal_expected_to_start: "Expected to Start",
    return_probability: "{n}% return",

    // home
    home_hero_title: "Live Football Intelligence",
    upcoming_fixtures: "Upcoming Fixtures",
    standings_preview: "Standings",
    injury_watch: "Injury Watch",
    view_all_fixtures: "View all fixtures →",
    view_full_standings: "Full standings →",
    view_team: "View team →",
    power_loss_pct: "{n}% power loss",
    home_subtitle:
      "Analyze how injuries impact team performance across Europe's top leagues. Select a league to get started.",
    how_it_works: "How It Works",
    step1_title: "1. Player Weights",
    step1_desc:
      "Each player's contribution is scored based on minutes played, rating, and goal involvement.",
    step2_title: "2. Injury Tracking",
    step2_desc:
      "Real-time injury data maps which players are unavailable for upcoming matches.",
    step3_title: "3. Power Loss",
    step3_desc:
      "Team power loss percentage shows how much a squad is weakened by current absences.",

    // outcome impact
    outcome_impact: "Injury Outcome Impact",
    outcome_xg: "xG / Match",
    outcome_xga: "xGA / Match",
    outcome_win_rate: "Win Rate",
    outcome_baseline: "Full strength",
    outcome_depleted: "Current",
    outcome_with: "With:",
    outcome_without: "Without:",
    outcome_matches: "{n} matches",
    outcome_no_data: "No data",
    outcome_injured_starters: "{n} injured starters",
    outcome_confidence_high: "High confidence",
    outcome_confidence_medium: "Medium confidence",
    outcome_confidence_low: "Low confidence",

    // countries
    country_england: "England",
    country_spain: "Spain",
    country_italy: "Italy",
    country_germany: "Germany",
    country_france: "France",

    // tooltips
    tooltip_power_loss:
      "Estimated % of squad strength lost to injuries. Calculated from each missing player's minutes, rating, and position impact. ≥25% = Critical.",
    tooltip_severity:
      "Impact rating based on the player's weighted contribution: minutes played, average rating, and position importance. Critical > High > Moderate > Low.",
    tooltip_role:
      "How often the player starts. Starter: regular first XI. Rotation: plays frequently but not always. Bench: squad depth.",
    tooltip_recovery_signal:
      "AI-analyzed news & RSS signal estimating return probability. ≥70% = likely returning soon. 40–69% = in recovery but uncertain.",
    tooltip_xg:
      "Expected Goals (xG): a statistical measure of shot quality. Estimates how many goals a team should score per match based on historical shot data.",
    tooltip_xga:
      "Expected Goals Against (xGA): estimated goals a team should concede per match. Lower is better for defense.",
    tooltip_confidence:
      "Reliability of the outcome prediction. High: large sample of matches. Medium: moderate data. Low: limited matches — treat with caution.",
    tooltip_win_rate:
      "Difference in team win rate in matches with vs. without this player. Positive = team wins more when this player plays.",
    tooltip_rating:
      "Average match performance score (1–10 scale) from API-Football. ≥7.0 = good (green), 6.5–6.99 = average (yellow).",
    tooltip_form:
      "Results of the team's last 5 league matches. W = Win, D = Draw, L = Loss.",
    tooltip_predicted_lineup:
      "Lineup predicted from the manager's historical formation preferences and each player's deployment history. Players with a recovery signal may be shown.",
    tooltip_cl_zone:
      "Champions League: Top 4 teams qualify for Europe's premier club competition.",
    tooltip_uel_zone:
      "Europa League: 5th place qualifies for UEFA's second-tier European competition.",
    tooltip_uecl_zone:
      "Conference League: 6th place qualifies for UEFA's third-tier European competition.",
    tooltip_relegation_zone:
      "Relegation: Bottom 3 teams are relegated to the division below.",
    tooltip_cl_qual_zone:
      "Champions League Qualifying: This place earns a path into the Champions League qualifying rounds.",
    zone_label_cl: "Champions League",
    zone_label_cl_qual: "CL Qualifying",
    zone_label_uel: "Europa League",
    zone_label_uecl: "Conference League",
    zone_label_relegation: "Relegation",
  },
  ko: {
    // nav
    nav_leagues: "리그",
    nav_european_cups: "유럽 컵대회",
    nav_domestic_cups: "국내 컵대회",
    nav_tools: "도구",
    nav_leaderboard: "부상 리더보드",
    nav_watchlist: "내 관심 목록",
    nav_data: "데이터: API-Football Pro",
    nav_standings: "순위표",
    nav_fixtures: "일정",
    cup_knockout_notice: "녹아웃 방식 대회 — 순위표가 없습니다.",
    cup_view_fixtures: "경기 일정 보기 →",

    // common
    season: "시즌",
    league: "리그",
    app: "출전",
    min: "출전시간",
    rating: "평점",
    goals: "골",
    assists: "도움",
    yellow_cards: "경고",
    red_cards: "퇴장",
    player: "선수",
    position: "포지션",
    founded: "창단",
    back: "뒤로",

    // positions
    pos_goalkeeper: "골키퍼",
    pos_defender: "수비수",
    pos_midfielder: "미드필더",
    pos_attacker: "공격수",
    pos_forward: "공격수",

    // league page
    no_standings: "이 리그의 순위 데이터가 없습니다. 데이터를 먼저 시딩하세요.",
    played: "경기",
    wins: "승",
    draws: "무",
    losses: "패",
    goals_for: "득점",
    goals_against: "실점",
    goal_diff: "득실차",
    points: "승점",
    team: "팀",
    form: "최근폼",

    // team page
    injury_status: "부상 현황",
    key_absences: "주요 부상자",
    other_injuries: "부상자",
    squad: "스쿼드",
    players_out: "결장 선수",
    key_players: "핵심 선수",
    moderate: "보통",
    low_impact: "낮음",
    severity_critical: "심각",
    severity_high: "높음",
    severity_moderate: "보통",
    severity_low: "낮음",
    role_starter: "주전",
    role_rotation: "로테이션",
    role_bench: "후보",
    ctx_mid_season_loss: "시즌 중 이탈",
    ctx_extended_absence: "장기 결장",
    ctx_recent_injury: "최근 부상",
    ctx_early_season_loss: "시즌 초 이탈",
    ctx_pre_season_absence: "시즌 전체 결장",
    days_ago: "{n}일 전",
    win_rate_positive: "출전 시 승률 +{n}%",
    win_rate_negative: "출전 시 승률 {n}%",
    new_badge: "신규",

    // player page
    season_stats: "시즌 스탯",
    injury_history: "결장 이력",
    issue_singular: "건",
    issue_plural: "건",
    status_out: "부상 결장",
    status_suspended: "출전 정지",
    status_doubtful: "출전 의문",
    match_missed_singular: "경기 결장",
    match_missed_plural: "경기 결장",
    ongoing: "진행 중",
    injured_before_season: "시즌 시작 전 부상",
    player_not_found: "선수를 찾을 수 없습니다",
    disciplinary_in_match: "정지 발생 경기",
    injury_in_match: "부상 경기",

    // fixtures page
    fixtures_title: "경기 일정",
    tab_upcoming: "예정 경기",
    tab_results: "경기 결과",
    no_fixtures: "예정된 경기가 없습니다.",
    no_results: "이번 시즌 완료된 경기가 없습니다.",
    match_detail: "경기 상세",
    match_venue: "경기장",
    injury_comparison: "부상 비교",
    power_loss: "전력 손실",
    no_injuries: "현재 부상 선수 없음",
    predicted_lineups: "예상 라인업",
    coming_soon: "준비 중",
    round_prefix: "라운드",
    lineup_formation: "포메이션",
    lineup_starters: "선발 XI",
    lineup_unavailable: "출전 불가",
    lineup_no_data: "라인업 예측을 위한 데이터가 부족합니다",
    lineup_recently_returned: "복귀",
    lineup_would_start: "건강 시 선발",
    lineup_default_formation: "기본 포메이션",

    // result detail page
    result_detail: "경기 결과",
    statistics: "통계",
    match_events: "경기 이벤트",
    actual_lineups: "라인업",
    stat_possession: "볼 점유율",
    stat_shots: "총 슈팅",
    stat_on_target: "유효슈팅",
    stat_corners: "코너킥",
    stat_fouls: "파울",
    stat_offsides: "오프사이드",
    stat_saves: "선방",
    stat_xg: "xG",
    stat_passes: "패스",
    stat_pass_pct: "패스 성공률",
    coach: "감독",
    bench: "벤치",
    no_match_events: "이벤트 데이터가 없습니다.",
    no_lineups: "라인업 데이터가 없습니다.",
    no_statistics: "통계 데이터가 없습니다.",
    event_goal: "득점",
    event_sub: "교체",
    event_yellow: "경고",
    event_red: "퇴장",
    events_show_all: "전체 이벤트 보기",

    // live updates section
    live_updates: "실시간 업데이트",
    recent_injuries: "최근 부상 소식",
    recovery_signals: "복귀 신호",
    no_recent_injuries: "최근 부상 소식 없음",
    no_recovery_signals: "복귀 신호 없음",
    signal_partial_training: "부분 훈련",
    signal_full_training: "전체 훈련",
    signal_available: "복귀 가능",
    signal_expected_to_start: "선발 예상",
    return_probability: "복귀 확률 {n}%",

    // home
    home_hero_title: "실시간 축구 분석",
    upcoming_fixtures: "예정 경기",
    standings_preview: "순위 미리보기",
    injury_watch: "부상 모니터",
    view_all_fixtures: "전체 경기 보기 →",
    view_full_standings: "전체 순위 보기 →",
    view_team: "팀 분석 →",
    power_loss_pct: "전력 {n}% 손실",
    home_subtitle:
      "유럽 주요 리그의 부상이 팀 성적에 미치는 영향을 분석합니다. 리그를 선택해 시작하세요.",
    how_it_works: "분석 방법",
    step1_title: "1. 선수 가중치",
    step1_desc:
      "출전 시간, 평점, 골 관여도를 기반으로 각 선수의 기여도를 산출합니다.",
    step2_title: "2. 부상 추적",
    step2_desc:
      "실시간 부상 데이터를 통해 다음 경기에 출전 불가능한 선수를 파악합니다.",
    step3_title: "3. 전력 손실",
    step3_desc: "현재 결장 선수들로 인한 팀의 전력 손실 비율을 산출합니다.",

    // outcome impact
    outcome_impact: "부상 결과 영향",
    outcome_xg: "경기당 xG",
    outcome_xga: "경기당 xGA",
    outcome_win_rate: "승률",
    outcome_baseline: "풀 전력",
    outcome_depleted: "현재",
    outcome_with: "출전시:",
    outcome_without: "결장시:",
    outcome_matches: "{n}경기",
    outcome_no_data: "데이터 없음",
    outcome_injured_starters: "{n}명 주전 부상",
    outcome_confidence_high: "신뢰도 높음",
    outcome_confidence_medium: "신뢰도 보통",
    outcome_confidence_low: "신뢰도 낮음",

    // countries
    country_england: "잉글랜드",
    country_spain: "스페인",
    country_italy: "이탈리아",
    country_germany: "독일",
    country_france: "프랑스",

    // tooltips
    tooltip_power_loss:
      "부상 선수들의 출전 시간·평점·포지션 중요도를 합산한 전력 손실 비율. 25% 이상이면 Critical(심각) 수준.",
    tooltip_severity:
      "선수의 가중 기여도(출전 시간·평점·포지션 중요도)에 따른 영향 등급. Critical > High > Moderate > Low.",
    tooltip_role:
      "선발 빈도 기준 분류. Starter: 정규 선발. Rotation: 자주 선발되지만 고정은 아님. Bench: 스쿼드 깊이.",
    tooltip_recovery_signal:
      "AI가 뉴스·RSS를 분석해 산출한 복귀 확률. ≥70% = 곧 복귀 가능성 높음. 40~69% = 회복 중이나 불확실.",
    tooltip_xg:
      "기대 골(xG): 슈팅 품질을 수치화한 지표. 과거 데이터 기반으로 경기당 득점 기댓값을 추정합니다.",
    tooltip_xga:
      "기대 실점(xGA): 경기당 실점 기댓값. 수치가 낮을수록 수비가 탄탄함을 의미합니다.",
    tooltip_confidence:
      "결과 예측의 신뢰도. High: 충분한 샘플. Medium: 적당한 데이터. Low: 경기 수 적음 — 참고용으로만 활용하세요.",
    tooltip_win_rate:
      "해당 선수 출전 시 vs. 결장 시 팀 승률 차이. 양수 = 이 선수가 뛸 때 팀이 더 많이 이김.",
    tooltip_rating:
      "경기당 평균 퍼포먼스 점수(1~10점). ≥7.0 = 우수(초록), 6.5~6.99 = 평균(노란).",
    tooltip_form: "최근 5경기 리그 결과. W = 승, D = 무, L = 패.",
    tooltip_predicted_lineup:
      "감독의 포메이션 선호도와 선수별 배치 이력을 기반으로 예측한 라인업. 복귀 신호가 있는 부상 선수가 포함될 수 있습니다.",
    tooltip_cl_zone:
      "챔피언스리그: 상위 4팀이 UEFA 최고 수준의 클럽 대회에 출전합니다.",
    tooltip_uel_zone: "유로파리그: 5위 팀이 UEFA 2부 유럽 대회에 출전합니다.",
    tooltip_uecl_zone:
      "컨퍼런스리그: 6위 팀이 UEFA 3부 유럽 대회에 출전합니다.",
    tooltip_relegation_zone: "강등: 하위 3팀이 하부 리그로 강등됩니다.",
    tooltip_cl_qual_zone:
      "챔피언스리그 예선: 이 순위는 챔피언스리그 예선 진출권을 획득합니다.",
    zone_label_cl: "챔피언스리그",
    zone_label_cl_qual: "챔피언스리그 예선",
    zone_label_uel: "유로파리그",
    zone_label_uecl: "컨퍼런스리그",
    zone_label_relegation: "강등",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const val: string =
    (translations[locale] as Record<string, string>)[key] ??
    (translations.en as Record<string, string>)[key] ??
    key;
  if (!vars) return val;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(`{${k}}`, String(v)),
    val,
  );
}

/** Translate a position string (e.g. "Midfielder") to the current locale */
export function tPos(locale: Locale, pos: string | null | undefined): string {
  if (!pos) return "—";
  const key = pos.toLowerCase();
  const map: Record<string, TranslationKey> = {
    goalkeeper: "pos_goalkeeper",
    defender: "pos_defender",
    midfielder: "pos_midfielder",
    attacker: "pos_attacker",
    forward: "pos_forward",
  };
  const tk = map[key];
  return tk ? t(locale, tk) : pos;
}

/** Translate a raw injury reason string (from API-Football) to the current locale */
export function tInjury(
  locale: Locale,
  reason: string | null | undefined,
): string {
  if (!reason) return "—";
  if (locale !== "ko") return reason;

  const r = reason.toLowerCase().trim();

  // ── Administrative / non-injury ──────────────────────────────────────────
  if (r === "suspended" || r === "suspension") return "출전 정지";
  if (r.includes("red card")) return "퇴장";
  if (r === "yellow cards" || r === "yellow card") return "경고 누적";
  if (r === "international duty" || r === "national selection")
    return "국가대표 소집";
  if (r === "coach's decision" || r === "coach decision") return "감독 결정";
  if (r === "loan agreement" || r === "loan") return "임대";
  if (r === "inactive") return "비활성";
  if (r === "personal reasons" || r === "personal reason") return "개인 사정";
  if (r === "lacking match fitness" || r === "fitness") return "체력 문제";
  if (r === "rest") return "휴식";
  if (r === "other") return "기타";
  if (r === "not in the squad") return "명단 제외";
  if (r === "missing fixture") return "결장";

  // ── Medical (non-body-part) ───────────────────────────────────────────────
  if (r === "injury" || r === "injured" || r === "injured doubtful")
    return "부상";
  if (r === "unknown" || r === "unknown injury") return "미상";
  if (r === "illness" || r === "sick") return "질병";
  if (r === "flu" || r === "influenza") return "독감";
  if (r === "concussion") return "뇌진탕";
  if (r.includes("covid") || r === "coronavirus") return "코로나19";
  if (r === "health problems" || r === "health problem") return "건강 문제";
  if (r === "heart problems" || r === "heart problem") return "심장 문제";
  if (r === "surgery") return "수술";
  if (r === "hernia") return "탈장";
  if (r === "wound") return "찰과상";
  if (r === "contusion" || r === "knock") return "타박상";
  if (r === "muscular problems" || r === "muscular problem") return "근육 문제";

  // ── Body-part keyword matching (specific → generic) ───────────────────────
  if (
    r.includes("acl") ||
    r.includes("anterior cruciate") ||
    r.includes("cruciate")
  )
    return "십자인대 부상";
  if (r.includes("achilles")) return "아킬레스건 부상";
  if (r.includes("adductor")) return "내전근 부상";
  if (r.includes("hamstring")) return "햄스트링 부상";
  if (r.includes("knee")) return "무릎 부상";
  if (r.includes("calf")) return "종아리 부상";
  if (r.includes("ankle")) return "발목 부상";
  if (r.includes("thigh") || r.includes("quadricep") || r.includes("quad"))
    return "허벅지 부상";
  if (r.includes("groin")) return "사타구니 부상";
  if (r.includes("hip")) return "고관절 부상";
  if (r.includes("shoulder")) return "어깨 부상";
  if (r.includes("collarbone") || r.includes("clavicle")) return "빗장뼈 부상";
  if (r.includes("chest")) return "가슴 부상";
  if (r.includes("rib")) return "갈비뼈 부상";
  if (r.includes("back") || r.includes("spine") || r.includes("lumbar"))
    return "허리 부상";
  if (r.includes("abdominal") || r.includes("abdomen")) return "복부 부상";
  if (r.includes("pelvis") || r.includes("pelvic")) return "골반 부상";
  if (r.includes("head")) return "두부 부상";
  if (r.includes("jaw") || r.includes("face")) return "안면 부상";
  if (r.includes("nose")) return "코 부상";
  if (r.includes("eye")) return "눈 부상";
  if (r.includes("heel")) return "뒤꿈치 부상";
  if (r.includes("foot") || r.includes("toe") || r.includes("feet"))
    return "발 부상";
  if (r.includes("wrist") || r.includes("wirst")) return "손목 부상";
  if (r.includes("finger")) return "손가락 부상";
  if (r.includes("hand")) return "손 부상";
  if (r.includes("elbow") || r.includes("arm")) return "팔 부상";
  if (r.includes("leg")) return "다리 부상";
  if (
    r.includes("torn") ||
    r.includes("muscle fiber") ||
    r.includes("muscle fibre")
  )
    return "근육 파열";
  if (r.includes("muscular") || r.includes("muscle bruise")) return "근육 문제";
  if (r.includes("muscle")) return "근육 부상";
  if (r.includes("fracture") || r.includes("fractured") || r.includes("broken"))
    return "골절";
  if (r.includes("ligament")) return "인대 부상";
  if (
    r.includes("achilles") ||
    r.includes("tendon") ||
    r.includes("tendinitis") ||
    r.includes("tendinopathy")
  )
    return "힘줄 부상";
  if (r.includes("strain")) return "근육 염좌";
  if (r.includes("sprain")) return "염좌";

  return reason;
}
