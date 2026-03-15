import type { Metadata } from 'next';
import { getLocale } from '@/lib/locale';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'SquadCheck Terms of Service — data accuracy disclaimer and usage terms.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  const locale = getLocale();
  const isKo = locale === 'ko';

  return (
    <div className="max-w-[52rem] mx-auto px-0 py-2">
      <h1 className="text-2xl font-light text-foreground mb-1">
        {isKo ? '이용약관' : 'Terms of Service'}
      </h1>
      <p className="text-xs text-muted-foreground mb-8">
        {isKo ? '최종 수정일: 2026년 3월' : 'Last updated: March 2026'}
      </p>

      <div className="space-y-8 text-sm text-foreground/80 leading-relaxed">

        {/* 1 */}
        <section>
          <h2 className="text-base font-medium text-foreground mb-2">
            {isKo ? '1. 서비스 개요' : '1. About SquadCheck'}
          </h2>
          <p>
            {isKo
              ? 'SquadCheck(이하 "서비스")는 유럽 주요 축구 리그의 부상 현황, 팀 전력 분석, 예상 라인업 등 통계 정보를 제공하는 무료 정보 서비스입니다. 본 서비스는 스포츠 데이터 제공업체인 API-Football의 데이터를 기반으로 운영됩니다.'
              : 'SquadCheck ("the Service") is a free informational tool that aggregates football injury data, team power-loss estimates, and predicted lineups for major European leagues. Data is sourced from API-Football, a third-party sports data provider.'}
          </p>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-base font-medium text-foreground mb-2">
            {isKo ? '2. 데이터 정확성 면책 조항' : '2. Data Accuracy Disclaimer'}
          </h2>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 mb-3">
            <p className="text-amber-400/90 font-medium text-[0.8125rem]">
              {isKo
                ? '본 서비스에서 제공하는 모든 정보(부상 여부, 출전 가능 여부, 예상 라인업 등)는 참고용이며, 실제 상황과 다를 수 있습니다. 중요한 결정을 내리기 전에 반드시 공식 채널(클럽 공식 발표, 공식 경기 기록 등)을 통해 별도로 확인하시기 바랍니다.'
                : 'All information provided by this Service — including injury status, player availability, and predicted lineups — is for informational reference only and may be inaccurate, incomplete, or outdated. Always verify against official sources (club announcements, official match records) before making any decisions.'}
            </p>
          </div>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            {isKo ? (
              <>
                <li>부상 정보는 외부 데이터 소스 기반으로, 실시간 정보가 아닐 수 있습니다.</li>
                <li>예상 라인업은 과거 데이터를 기반으로 한 알고리즘 예측이며, 실제 선발과 다를 수 있습니다.</li>
                <li>복귀 신호(Recovery Signal)는 뉴스·공식 사이트 등을 통해 수집한 정보로, 정확성을 보장하지 않습니다.</li>
                <li>경기 결과나 통계에 오류가 포함될 수 있습니다.</li>
              </>
            ) : (
              <>
                <li>Injury data is sourced from third-party providers and may not reflect real-time conditions.</li>
                <li>Predicted lineups are algorithmic estimates based on historical data and do not guarantee actual team selection.</li>
                <li>Recovery signals are collected from news and official club sources and accuracy cannot be guaranteed.</li>
                <li>Match results and statistics may contain errors.</li>
              </>
            )}
          </ul>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-base font-medium text-foreground mb-2">
            {isKo ? '3. 이용 제한' : '3. Acceptable Use'}
          </h2>
          <p className="mb-2">
            {isKo
              ? '본 서비스는 개인적·비상업적 정보 탐색 목적으로만 이용할 수 있습니다. 다음 목적의 이용은 금지됩니다:'
              : 'The Service is provided for personal, non-commercial informational use only. The following uses are prohibited:'}
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            {isKo ? (
              <>
                <li>스포츠 베팅·도박 등 금전적 이익을 목적으로 한 이용</li>
                <li>데이터 크롤링, 대량 수집 또는 재배포</li>
                <li>서비스 운영을 방해하거나 서버에 과도한 부하를 주는 행위</li>
              </>
            ) : (
              <>
                <li>Sports betting, gambling, or any other financial gain based on data from this Service</li>
                <li>Automated scraping, bulk harvesting, or redistribution of data</li>
                <li>Any action that disrupts or places excessive load on the Service</li>
              </>
            )}
          </ul>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-base font-medium text-foreground mb-2">
            {isKo ? '4. 책임 제한' : '4. Limitation of Liability'}
          </h2>
          <p>
            {isKo
              ? 'SquadCheck는 본 서비스에서 제공하는 정보의 이용으로 인해 발생하는 직·간접적 손해(금전적 손실, 베팅 손실, 의사결정 오류 등)에 대해 어떠한 법적 책임도 지지 않습니다. 서비스는 "있는 그대로(as-is)" 제공되며, 가용성이나 무결성을 보장하지 않습니다.'
              : 'SquadCheck is not liable for any direct or indirect damages arising from the use of this Service, including but not limited to financial losses, betting losses, or decisions made based on inaccurate data. The Service is provided "as-is" without any warranty of availability or accuracy.'}
          </p>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-base font-medium text-foreground mb-2">
            {isKo ? '5. 제3자 데이터' : '5. Third-Party Data'}
          </h2>
          <p>
            {isKo
              ? '본 서비스는 API-Football(RapidAPI)에서 제공하는 데이터를 사용합니다. 해당 데이터의 정확성, 완전성, 적시성에 대해 SquadCheck는 책임을 지지 않습니다. 선수 사진 및 팀 로고 등 미디어 자산은 각 원저작권자에게 귀속됩니다.'
              : 'The Service uses data provided by API-Football (RapidAPI). SquadCheck makes no representations as to the accuracy, completeness, or timeliness of this third-party data. Player photos and team logos remain the property of their respective copyright holders.'}
          </p>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-base font-medium text-foreground mb-2">
            {isKo ? '6. 약관 변경' : '6. Changes to These Terms'}
          </h2>
          <p>
            {isKo
              ? '본 약관은 사전 고지 없이 변경될 수 있습니다. 변경 후 서비스를 계속 이용하면 변경된 약관에 동의한 것으로 간주됩니다.'
              : 'These Terms may be updated at any time without prior notice. Continued use of the Service after changes constitutes acceptance of the revised Terms.'}
          </p>
        </section>

      </div>
    </div>
  );
}
