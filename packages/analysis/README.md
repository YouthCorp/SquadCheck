# @squadcheck/analysis

선수 가중치, 부상 영향, 팀 전력 손실, 예상 라인업, 성과 변화와 결과 영향을 계산하는 도메인 분석 패키지입니다.

`*Pure` 함수는 입력 데이터만으로 계산해 단위 테스트할 수 있습니다. facade는 Prisma 읽기와 순수 계산을 결합해 API와 ingestion에서 재사용합니다. DB 쓰기와 HTTP·외부 API 호출은 담당하지 않습니다.

```bash
npm run build -w packages/analysis
npm run test -w packages/analysis
```
