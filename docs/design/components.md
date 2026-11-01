# コンポーネント

MVP の画面に必要な部品だけを作る。見た目・状態・使い分け（使う場面、よい例とよくない例）は Penpot の「03 コンポーネント」ページが正本。ここには、実装するときに必要な対応と注意だけを書く。名前は Penpot と実装で同じにする。

## 部品の一覧

| 区分           | 名前                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| 操作           | `Button` `IconButton` `QuantityStepper` `AddButton`                                                  |
| 入力           | `TextField` `Select` `Toggle` `Checkbox`                                                             |
| 表示           | `StoreNoren` `StoreCard` `MenuItem` `StatusLabel` `Tag` `CountBadge` `OrderSteps` `ListItem` `Table` |
| お知らせ       | `NoticeBanner` `Toast` `Spinner` `EmptyState`                                                        |
| 移動           | `AppHeader` `TabBar` `SideNav` `TopBar` `Tabs` `CartBar`                                             |
| 重ねて出すもの | `Dialog` `BottomSheet`                                                                               |

## shadcn/ui との対応

実装は shadcn/ui（アプリは React Native Reusables）を土台にする（[docs/architecture.md](../architecture.md)）。Web の部品は shadcn の CLI が置く `apps/web/src/components/ui/` に置く。名前が同じもの（`Select` `Checkbox` `Tabs` など）はそのまま使い、shadcn にない部品（`StoreNoren` `MenuItem` `OrderSteps` など）は独自に作る。名前や種類が shadcn と違うものは、次のように対応させる。

アプリ共通の部品は `packages/native-ui/src/components/` に置き、`@repo/native-ui/status-label` のように読み込む。表示・お知らせ・移動の部品は、注文者アプリの開発用画面 `/dev/display-components` で操作できる。

アプリの確認ダイアログは React Native の `Modal` を使い、背後の操作と読み上げを遮断する。開閉と処理中の状態は呼び出し側が管理し、実行ボタンを押しても自動では閉じない。処理が成功したときに閉じることで、失敗時に確認内容を残せる。画面内の `Tabs` は選択値と内容を受け取り、選択した内容だけを表示する。

アプリの通知は、両アプリの layout に置いた `ToastProvider` と `useToast()` の `show`・`dismiss` で表示・消去する。通知は最新の 1 件に置き換え、既定で 4 秒後に消す。Android の操作時間の設定を反映し、ホームインジケーターを避けて表示する。`AppHeader` と `TabBar` のセーフエリアは画面側で確保する。

注文者アプリ専用の部品は `apps/customer-app/src/components/` の `store/`・`cart/`・`order/`・`sheet/` に置く。開発用画面 `/dev/customer-components` で各状態と操作を確認できる。写真なし・画像読み込み失敗時は、灰色の面と料理アイコンにする。受付停止中の店舗もメニューは見られるが、商品追加は呼び出し側で無効にする。

`QuantityStepper` の数量変更先は `packages/domain` の `getCartQuantityControls` から受け取る。数量 1 からの削除は `onRemove`、増減は `onQuantityChange` で呼び出し側に通知する。`CartBar` の点数と小計は呼び出し側の値を表示し、0 点のときは表示しない。`OrderSteps` はキャンセル時に進行の線を出さず、キャンセルのラベルを出す。

`BottomSheet` は開閉状態を呼び出し側が管理する。閉じるボタン・背面タップ・端末の戻る操作・ハンドルの下方向のドラッグで閉じ、長い内容は中でスクロールする。セーフエリアと入力時のキーボードの余白は部品内で確保する。

Web の注文者向け部品は、共通部品と同じ `apps/web/src/components/ui/` に置く。開発用画面 `/dev/customer-components` で状態と操作を確認できる。数量・金額・距離・注文進行はアプリと同じ `packages/domain` の関数を使う。写真なし・読み込み失敗時は灰色の面と料理アイコンを表示し、写真の配信元が決まるまでは `next/image` を `unoptimized` で使う。

Web の Drawer は既存の Radix Dialog を土台にし、閉じる操作・背景操作の遮断・フォーカスの閉じ込め・トリガーへのフォーカス復帰を任せる。ハンドルはドラッグでもキーボードでも操作できる。元に戻せない操作の確認には、外側を押しても閉じない AlertDialog を使う。

注文者 Web は幅 768px 以上で PC 用の上部メニューを置く方針にする。`CustomerHeader` を `apps/web/src/components/customer/` に置き、ブランド名と「お店を探す」「注文履歴」「アカウント」を並べる。現在地は太字・藍色・下線で示し、内容の幅は最大 1200px にそろえる。確認画面で見た目を確認し、業務画面への組み込みと実際の遷移先の設定は該当機能を実装するときに行う。768px 未満では各画面のヘッダーと移動の部品を使う。

| Penpot       | 実装                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| Button       | Button。種類は Penpot の名前にした（shadcn の `default` `outline` `destructive` は使わない）               |
| IconButton   | 独自（shadcn は Button の大きさの 1 つ）                                                                   |
| TextField    | 独自。shadcn の Input と Label を組み合わせる                                                              |
| Toggle       | Switch。shadcn には押したままになるボタンの Toggle が別にあり、名前がぶつかるため                          |
| Dialog       | AlertDialog。確認だけに使い、外側を押しても閉じないため                                                    |
| NoticeBanner | 独自。shadcn の Alert は `role="alert"` で読み上げを割り込ませるが、画面にとどまる説明には合わないため     |
| Table        | Table。列の組み立ては TanStack Table の DataTable で行う（shadcn の Data Table と同じ考え方）              |
| Toast        | Sonner                                                                                                     |
| BottomSheet  | Drawer（Web）・Bottom Sheet（アプリ）                                                                      |
| SideNav      | 独自。shadcn の Sidebar は開閉やスマートフォンでの引き出しまで持つが、パソコン向けの固定の列だけでよいため |

## 実装の注意

| 名前              | 注意                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `IconButton`      | 文字がないので、読み上げ用の名前を必ず付ける（Web は `aria-label`、アプリは `accessibilityLabel`） |
| `QuantityStepper` | 数量の範囲は 1〜20（R-03）。1 のときの「−」は、数量を減らす代わりにカートから外す                  |
| `Toggle`          | 切り替えた時点で API に送る。保存ボタンで確定する選択は `Checkbox` にする                          |
| `StatusLabel`     | 表示する状態は [order-status.md](../specs/order-status.md) の状態と 1 対 1 で対応させる            |
| `Spinner`         | 1 秒未満で終わる処理では出さない                                                                   |
