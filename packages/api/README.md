# @squadcheck/api

Express 기반 HTTP API입니다. 라우팅, 파라미터 해석, 인증·권한 확인, rate limit, TTL 캐시, 분석 결과의 응답 조합을 담당합니다.

`@squadcheck/analysis`와 PostgreSQL을 읽어 응답하지만, 외부 스포츠 데이터 수집은 수행하지 않습니다. 분석·부상·watchlist 경로의 계약 테스트가 포함되어 있습니다.

```bash
npm run dev -w packages/api
npm run test -w packages/api
```
