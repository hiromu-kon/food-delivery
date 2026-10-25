import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
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
