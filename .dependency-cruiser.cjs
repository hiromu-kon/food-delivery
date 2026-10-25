/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-must-be-pure',
      comment:
        'packages/domain は入力を受けて結果を返す純関数だけを置く。DB・HTTP・UI に依存させない',
      severity: 'error',
      from: { path: '^packages/domain/' },
      to: {
        path: [
          '^(packages/(db|contract)/|apps/)',
          '(^|/)node_modules/(postgres|drizzle-orm|hono|react|react-native|next)/',
        ],
      },
    },
    {
      name: 'db-has-no-deps',
      severity: 'error',
      from: { path: '^packages/db/' },
      to: { path: '^(packages/(domain|contract)/|apps/)' },
    },
    {
      name: 'contract-imports-domain-types-only',
      severity: 'error',
      from: { path: '^packages/contract/' },
      to: { path: '^(packages/db/|apps/)' },
    },
    {
      name: 'clients-cannot-touch-db',
      comment:
        'Node 専用のモジュールがクライアントのバンドルに混ざるのを防ぐ。DB には API 経由でのみ触る',
      severity: 'error',
      from: { path: '^apps/(web|customer-app|courier-app)/' },
      to: { path: '^packages/db/' },
    },
    {
      name: 'apps-are-isolated',
      comment: 'apps 同士は import しない。apps/api の AppType の型 import だけを例外にする',
      severity: 'error',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/(?!$1/)', pathNot: '^apps/api/src/app-type\\.ts$' },
    },
    {
      name: 'app-type-is-type-only',
      comment:
        'クライアントが API の実装を実行時に取り込まないよう、AppType は import type だけを許す',
      severity: 'error',
      from: { path: '^apps/(web|customer-app|courier-app)/' },
      to: { path: '^apps/api/src/app-type\\.ts$', dependencyTypesNot: ['type-only'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // node_modules 内のパッケージも dist/ を持つため、各 app / package 直下の生成物だけを除外する。
    exclude: { path: '^(apps|packages)/[^/]+/(\\.next|\\.expo|dist|\\.turbo)/' },
    // import type を依存として数え、type-only かどうかで判定できるようにする。
    tsPreCompilationDeps: true,
    // `@/*` は app ごとに指す先が違うため、scripts/depcruise.sh が app を 1 つずつ DEPCRUISE_APP で指定して実行する。
    // options.tsConfig で各 app の tsconfig を渡す方法では `@/*` が解決されなかったため、webpack 形式の alias で指定する。
    ...(process.env.DEPCRUISE_APP && {
      webpackConfig: { fileName: 'scripts/depcruise-alias.cjs' },
    }),
    // ワークスペースのパッケージは package.json の exports で TS のソースを指しているため、exports を解決に使う。
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
    },
  },
};
