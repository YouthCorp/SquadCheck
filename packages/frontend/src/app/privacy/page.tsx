import type { Metadata } from 'next';
import { getLocale } from '@/lib/locale';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'SquadCheck Privacy Policy — how we handle analytics and your data.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  const locale = getLocale();
  const isKo = locale === 'ko';

  return (
    <div className="max-w-[52rem] mx-auto px-0 py-2">
      <h1 className="text-2xl font-light text-foreground mb-1">
        {isKo ? '개인정보 처리방침' : 'Privacy Policy'}
      </h1>
      <p className="text-xs text-muted-foreground mb-8">
        {isKo ? '최종 수정일: 2026년 3월' : 'Last updated: March 2026'}
      </p>

      <div className="space-y-8 text-sm text-foreground/80 leading-relaxed">

        {/* 1 */}
        <section>
          <h2 className="text-base font-medium text-foreground mb-2">
            {isKo ? '1. 수집하는 정보' : '1. Information We Collect'}
          </h2>
          <p className="mb-3">
            {isKo
              ? 'SquadCheck는 회원가입이나 로그인 기능을 제공하지 않으며, 개인 식별 정보(이름, 이메일, 주소 등)를 직접 수집하지 않습니다.'
              : 'SquadCheck does not offer accounts or logins, and we do not directly collect personally identifiable information such as your name, email address, or location.'}
          </p>
          <p>
            {isKo
              ? '다만, 서비스 개선을 위해 Google Analytics 4(GA4)를 통해 익명화된 방문 통계를 수집합니다. 여기에는 다음이 포함됩니다:'
              : 'We use Google Analytics 4 (GA4) to collect anonymised usage statistics for service improvement. This includes:'}
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5 text-muted-foreground">
            {isKo ? (
              <>
                <li>페이지 방문 수 및 체류 시간</li>
                <li>유입 경로(검색 엔진, 소셜 미디어 등)</li>
                <li>사용 기기 유형, 브라우저, 국가(도시 단위 미수집)</li>
                <li>클릭·스크롤 등 페이지 내 행동 이벤트</li>
              </>
            ) : (
              <>
                <li>Page views and session duration</li>
                <li>Referral source (search engines, social media, etc.)</li>
                <li>Device type, browser, and country (city-level data is not collected)</li>
                <li>On-page interaction events (clicks, scrolls)</li>
              </>
            )}
          </ul>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-base font-medium text-foreground mb-2">
            {isKo ? '2. 쿠키' : '2. Cookies'}
          </h2>
          <p className="mb-2">
            {isKo
              ? 'SquadCheck는 Google Analytics 운영에 필요한 쿠키만 사용합니다. 해당 쿠키는 다음과 같습니다:'
              : 'SquadCheck only uses cookies required to operate Google Analytics:'}
          </p>
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-xs text-muted-foreground">
              <thead className="bg-muted/40 text-foreground/70">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{isKo ? '쿠키명' : 'Cookie'}</th>
                  <th className="px-3 py-2 text-left font-medium">{isKo ? '목적' : 'Purpose'}</th>
                  <th className="px-3 py-2 text-left font-medium">{isKo ? '만료' : 'Expiry'}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 font-mono">_ga</td>
                  <td className="px-3 py-2">{isKo ? '방문자 구분 (GA4)' : 'Visitor distinction (GA4)'}</td>
                  <td className="px-3 py-2">{isKo ? '2년' : '2 years'}</td>
                </tr>
                <tr className="border-t border-border bg-muted/10">
                  <td className="px-3 py-2 font-mono">_ga_*</td>
                  <td className="px-3 py-2">{isKo ? '세션 유지 (GA4)' : 'Session persistence (GA4)'}</td>
                  <td className="px-3 py-2">{isKo ? '2년' : '2 years'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-muted-foreground">
            {isKo
              ? '브라우저 설정에서 쿠키를 차단하거나 삭제할 수 있으나, 일부 기능이 정상적으로 동작하지 않을 수 있습니다.'
              : 'You can block or delete cookies in your browser settings, though some features may not function correctly as a result.'}
          </p>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-base font-medium text-foreground mb-2">
            {isKo ? '3. 정보의 이용 및 공유' : '3. Use and Sharing of Data'}
          </h2>
          <p className="mb-2">
            {isKo
              ? '수집된 분석 데이터는 서비스 개선 목적으로만 사용됩니다. SquadCheck는 수집한 데이터를 제3자에게 판매하거나 마케팅 목적으로 공유하지 않습니다.'
              : 'Analytics data is used solely for service improvement. SquadCheck does not sell collected data or share it with third parties for marketing purposes.'}
          </p>
          <p>
            {isKo
              ? 'Google Analytics는 Google의 개인정보 처리방침에 따라 수집된 데이터를 처리합니다. 자세한 내용은 '
              : 'Google Analytics processes collected data in accordance with Google\'s Privacy Policy. For more information, see '}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Google Privacy Policy
            </a>
            {isKo ? '를 참고하세요.' : '.'}
          </p>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-base font-medium text-foreground mb-2">
            {isKo ? '4. 데이터 보존' : '4. Data Retention'}
          </h2>
          <p>
            {isKo
              ? 'Google Analytics의 익명 데이터는 최대 14개월간 보존됩니다. SquadCheck 자체 서버에는 사용자의 개인 데이터가 저장되지 않습니다.'
              : 'Anonymised Google Analytics data is retained for up to 14 months. SquadCheck\'s own servers do not store any personal user data.'}
          </p>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-base font-medium text-foreground mb-2">
            {isKo ? '5. 방침 변경' : '5. Changes to This Policy'}
          </h2>
          <p>
            {isKo
              ? '본 방침은 사전 고지 없이 변경될 수 있습니다. 변경 사항은 본 페이지에 게시되며, 최종 수정일이 업데이트됩니다.'
              : 'This Policy may be updated at any time without prior notice. Changes will be posted on this page with an updated "Last updated" date.'}
          </p>
        </section>

      </div>
    </div>
  );
}
