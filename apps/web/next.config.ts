import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // 再設定トークンを開発時の URL ログにも残さない。
  logging: { incomingRequests: { ignore: [/\/reset-password(?:\?|$)/] } },
  outputFileTracingIncludes: {
    '/terms': ['../../docs/legal/terms.md'],
    '/privacy': ['../../docs/legal/privacy.md'],
  },
  // ワークスペースのパッケージはビルドせず TS のソースを export しているため、Next.js 側でトランスパイルする。
  transpilePackages: ['@repo/contract', '@repo/domain'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
