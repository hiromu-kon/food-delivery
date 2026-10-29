# デザイントークン

値の正本は [packages/design-tokens/theme.css](../../packages/design-tokens/theme.css)。Tailwind CSS v4 の `@theme` で書き、Web（`apps/web`）とアプリ（`apps/customer-app`・`apps/courier-app`、Uniwind）の両方が読み込む。Penpot の「02 トークン」はデザインを作るときの見本で、値を変えるときはコードを先に変えてから Penpot を合わせる。

ここには、名前とクラスの対応、用途、値を決めた理由を書く。値そのものは書かない。

## 構成

色は 2 層に分ける。

| 層             | 役割                                     | 名前の例                                            |
| -------------- | ---------------------------------------- | --------------------------------------------------- |
| プリミティブ   | 色の値そのものに名前を付けたパレット     | `--palette-indigo-700`                              |
| セマンティック | 用途に名前を付け、プリミティブを参照する | `color.text.secondary`（クラスは `text-secondary`） |

画面やコンポーネントは**セマンティックだけを使う**。用途ごとの色を一か所で変えられるようにし、「この灰色は文字用か線用か」を迷わないようにするため。

この決まりはコードで守る。`theme.css` は Tailwind の既定の色・文字の大きさ・角丸・影を消しているので、`bg-red-500` や `text-2xl` のようなクラスは効かない。プリミティブもクラスにならない。

## 色

セマンティックの `color.<種類>.<名前>` は、`<種類>-<名前>` のクラスになる。

| トークン                     | クラス                 | 用途                                           |
| ---------------------------- | ---------------------- | ---------------------------------------------- |
| `color.bg.base`              | `bg-base`              | 画面の背景                                     |
| `color.bg.subtle`            | `bg-subtle`            | 区切った領域、入力欄の無効時                   |
| `color.bg.brand`             | `bg-brand`             | のれん、主なボタン、カートのバー               |
| `color.bg.brand-hover`       | `bg-brand-hover`       | 主なボタンのホバー                             |
| `color.bg.brand-subtle`      | `bg-brand-subtle`      | 選択中の項目、調理中・準備完了のラベル         |
| `color.bg.disabled`          | `bg-disabled`          | 無効なボタン                                   |
| `color.bg.accent`            | `bg-accent`            | カートの点数、受付中の印                       |
| `color.bg.danger`            | `bg-danger`            | 危険な操作のボタン（確認のダイアログの中だけ） |
| `color.bg.danger-hover`      | `bg-danger-hover`      | 危険な操作のボタンのホバー                     |
| `color.bg.danger-subtle`     | `bg-danger-subtle`     | エラーのお知らせ                               |
| `color.bg.success-subtle`    | `bg-success-subtle`    | 完了のお知らせ、配達完了のラベル               |
| `color.bg.warning-subtle`    | `bg-warning-subtle`    | 注意のお知らせ、受付待ちのラベル               |
| `color.bg.scrim`             | `bg-scrim`             | ダイアログ・シートの後ろの幕                   |
| `color.text.primary`         | `text-primary`         | 本文・見出し                                   |
| `color.text.secondary`       | `text-secondary`       | 補足、ラベル                                   |
| `color.text.disabled`        | `text-disabled`        | 無効な文字                                     |
| `color.text.on-brand`        | `text-on-brand`        | 藍の上の文字                                   |
| `color.text.on-brand-subtle` | `text-on-brand-subtle` | のれんの上の補足                               |
| `color.text.brand`           | `text-brand`           | 選択中のタブ、文字だけのボタン                 |
| `color.text.danger`          | `text-danger`          | エラーの文字（白・`danger-subtle` の上）       |
| `color.text.success`         | `text-success`         | 完了の文字（白・`success-subtle` の上）        |
| `color.text.warning`         | `text-warning`         | 受付待ち                                       |
| `color.border.default`       | `border-default`       | 区切り線、カードの枠                           |
| `color.border.strong`        | `border-strong`        | 入力欄の枠                                     |
| `color.border.focus`         | `border-focus`         | キーボード操作での選択中                       |
| `color.border.danger`        | `border-danger`        | エラーの入力欄                                 |

枠線の色を枠線以外に使うときは、`outline-(--border-color-focus)`（キーボード操作での選択中の枠）や `bg-(--border-color-strong)`（Toggle のオフの地）のように変数を参照する。Tailwind のアウトラインやリングの色は `--color-*` から作られ、ここでは消しているため。

文字と背景の組み合わせは、本文で 4.5:1 以上のコントラスト比にする。主な組み合わせの値は次のとおり（無効な文字は対象外）。色を変えたら、この表も測り直す。

| 文字 / 背景                          | 比     |
| ------------------------------------ | ------ |
| `text.primary` / `bg.base`           | 16.2:1 |
| `text.secondary` / `bg.base`         | 5.0:1  |
| `text.secondary` / `bg.subtle`       | 4.7:1  |
| `text.on-brand` / `bg.brand`         | 11.3:1 |
| `text.on-brand-subtle` / `bg.brand`  | 6.7:1  |
| `text.primary` / `bg.accent`         | 8.9:1  |
| `text.warning` / `bg.warning-subtle` | 5.7:1  |
| `text.success` / `bg.success-subtle` | 7.2:1  |
| `text.danger` / `bg.danger-subtle`   | 6.7:1  |
| `text.brand` / `bg.brand-subtle`     | 10.0:1 |

## 文字

大きさ・行の高さ・太さを 1 つのクラスにまとめている。

| クラス           | 用途               |
| ---------------- | ------------------ |
| `text-display`   | のれんの店名       |
| `text-heading-l` | 画面の見出し       |
| `text-heading-m` | 区切りの見出し     |
| `text-body-l`    | 商品名、主な本文   |
| `text-body-m`    | 本文               |
| `text-body-s`    | 補足、説明文       |
| `text-label-l`   | ボタン（大）、金額 |
| `text-label-m`   | ボタン（中）、タブ |
| `text-label-s`   | 状態のラベル、タグ |

書体は `font-sans`（Zen Kaku Gothic New）と `font-display`（Zen Old Mincho、のれんの店名だけ）。Web とアプリで読み込み方が違うため、`theme.css` ではなく各アプリの CSS で決める。

## 余白・角丸・影

| クラス                   | 用途                                                 |
| ------------------------ | ---------------------------------------------------- |
| `p-*` `m-*` `gap-*` など | 余白。1 段階 4px。1・2・3・4・5・6・8・10 だけを使う |
| `rounded-xs`             | のれんの上端、タグ                                   |
| `rounded-sm`             | 入力欄、お知らせ                                     |
| `rounded-md`             | ボタン、写真                                         |
| `rounded-lg`             | カートのバー、下から出るシート、ダイアログ           |
| `rounded-full`           | 丸いボタン、チップ、点数                             |
| `shadow-raised`          | 画面の上に浮くバー                                   |
| `shadow-overlay`         | ダイアログ、シート                                   |

影は藍を混ぜた色にし、灰色の影を全体に付けない。浮いているものにだけ使う。

## アイコン

[Lucide](https://lucide.dev/)（ISC ライセンス）を使う。線の太さは 2、大きさは 20 か 24。アイコンだけのボタンには、読み上げ用の名前を付ける。
