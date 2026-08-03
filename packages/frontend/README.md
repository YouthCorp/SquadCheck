# @squadcheck/frontend

Next.js 14 기반 사용자 웹 애플리케이션입니다. App Router 페이지, UI 컴포넌트, SEO 메타데이터·sitemap·Open Graph 이미지, NextAuth 기반 인증 UX를 담당합니다.

일반 도메인 데이터는 `src/lib/api.ts`를 통해 Express API에서 조회합니다. 인증에 필요한 NextAuth 경로만 Prisma Adapter를 사용합니다.

```bash
npm run dev -w packages/frontend
npm run build -w packages/frontend
```
