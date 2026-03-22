/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.api-sports.io' },
      { protocol: 'https', hostname: 'media-*.api-sports.io' },
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
    // afterFiles: Next.js가 App Router 라우트 핸들러를 먼저 확인한 뒤,
    // 매칭되는 핸들러가 없을 때만 proxy 적용됨.
    // → /api/auth/* 는 NextAuth 라우트 핸들러가 먼저 처리하므로 Railway로 안 넘어감.
    return {
      afterFiles: [
        {
          source: '/api/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
