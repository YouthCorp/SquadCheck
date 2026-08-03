# @squadcheck/database

PostgreSQL용 Prisma schema, migration, 공통 DB export를 제공하는 패키지입니다. 리그·시즌·팀·선수·경기·통계·부상·RSS 기사·가용성·사용자 관련 저장 계약의 단일 기준점입니다.

비즈니스 계산이나 HTTP 요청 처리는 이 패키지의 책임이 아닙니다.

```bash
npm run generate -w packages/database
npm run migrate -w packages/database
```
