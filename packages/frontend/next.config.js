/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.api-sports.io' },
      { protocol: 'https', hostname: 'media-*.api-sports.io' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.squadcheck.xyz' }],
        destination: 'https://squadcheck.xyz/:path*',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    // Vercel Edge는 rewrite를 함수 호출 전에 적용하므로 afterFiles도 함수보다 먼저 실행됨.
    // 해결책: auth 경로 self-rewrite를 프록시 규칙보다 먼저 두어
    // /api/auth/* 가 첫 번째 규칙에 매칭되면 두 번째 프록시 규칙은 실행되지 않음.
    return {
      afterFiles: [
        {
          source: '/api/auth/:path*',
          destination: '/api/auth/:path*',
        },
        {
          source: '/api/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
