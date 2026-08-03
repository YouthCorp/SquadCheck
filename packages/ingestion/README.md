# @squadcheck/ingestion

API-Football과 RSS/웹 소스에서 데이터를 수집해 PostgreSQL에 적재하는 배치 패키지입니다. 수집기, cron scheduler, API quota 보호, 기사 중복 제거, 회복 신호 추출, 부상 상태 물리화를 담당합니다.

외부 API 요청은 token-bucket rate limit과 재시도를 거칩니다. 동기화는 upsert를 중심으로 수행하며, 사용자 HTTP 응답을 직접 만들지 않습니다.

```bash
npm run seed -w packages/ingestion
npm run sync -w packages/ingestion
```
