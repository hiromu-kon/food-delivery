import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node24',
  platform: 'node',
  // ワークスペースのパッケージは TS のソースを export しているため、ビルド時に取り込まないと node で実行できない。
  noExternal: [/^@repo\//],
});
