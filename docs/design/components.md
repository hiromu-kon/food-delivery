# コンポーネント

MVP の画面に必要な部品だけを作る。見た目・状態・使い分け（使う場面、よい例とよくない例）は Penpot の「03 コンポーネント」ページが正本。ここには、実装するときに必要な対応と注意だけを書く。名前は Penpot と実装で同じにする。

## 部品の一覧

| 区分           | 名前                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| 操作           | `Button` `IconButton` `QuantityStepper` `AddButton`                                                  |
| 入力           | `TextField` `Select` `Toggle` `Checkbox`                                                             |
| 表示           | `StoreNoren` `StoreCard` `MenuItem` `StatusLabel` `Tag` `CountBadge` `OrderSteps` `ListItem` `Table` |
| お知らせ       | `NoticeBanner` `Toast` `Spinner` `EmptyState`                                                        |
| 移動           | `AppHeader` `TabBar` `SideNav` `Tabs` `CartBar`                                                      |
| 重ねて出すもの | `Dialog` `BottomSheet`                                                                               |

## shadcn/ui との対応

実装は shadcn/ui（アプリは React Native Reusables）を土台にする（[docs/architecture.md](../architecture.md)）。名前や種類が shadcn と違うものは、次のように対応させる。名前が同じもの（`Select` `Checkbox` `Tabs` `Dialog` など）はそのまま使い、shadcn にない部品（`StoreNoren` `MenuItem` `OrderSteps` など）は独自に作る。

| Penpot           | shadcn/ui                             |
| ---------------- | ------------------------------------- |
| Button primary   | Button `default`                      |
| Button secondary | Button `outline`                      |
| Button ghost     | Button `ghost`                        |
| Button danger    | Button `destructive`                  |
| Toggle           | Switch                                |
| NoticeBanner     | Alert                                 |
| Toast            | Sonner                                |
| BottomSheet      | Drawer（Web）・Bottom Sheet（アプリ） |
| SideNav          | Sidebar                               |

## 実装の注意

| 名前              | 注意                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `IconButton`      | 文字がないので、読み上げ用の名前を必ず付ける（Web は `aria-label`、アプリは `accessibilityLabel`） |
| `QuantityStepper` | 数量の範囲は 1〜20（R-03）。1 のときの「−」は、数量を減らす代わりにカートから外す                  |
| `Toggle`          | 切り替えた時点で API に送る。保存ボタンで確定する選択は `Checkbox` にする                          |
| `StatusLabel`     | 表示する状態は [order-status.md](../specs/order-status.md) の状態と 1 対 1 で対応させる            |
| `Spinner`         | 1 秒未満で終わる処理では出さない                                                                   |
