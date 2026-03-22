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
    return {
      // beforeFiles: NextAuth 경로는 Next.js가 처리 — Express API로 넘기지 않음
      beforeFiles: [
        {
          source: '/api/auth/:path*',
          destination: '/api/auth/:path*',
        },
      ],
      afterFiles: [
        {
          source: '/api/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/:path*`,
        },
      ],
      fallback: [],
    };
  },
};

module.exports = nextConfig;
