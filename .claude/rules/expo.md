---
paths:
  - 'apps/customer-app/**'
  - 'apps/courier-app/**'
---

# Expo アプリ

- `customer-app` と `courier-app` は同じ構成にそろえる。片方に足した設定はもう片方にも足す。
- Expo の SDK を上げるときは `pnpm --filter @repo/customer-app exec expo install --fix` の結果を `pnpm-workspace.yaml` の catalog に反映し、両アプリで `npx expo-doctor` を通す。
