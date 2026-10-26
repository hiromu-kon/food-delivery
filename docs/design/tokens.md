# デザイントークン

値の正本は Penpot の「02 トークン」ページと、ファイルのトークン（Tokens タブ）。実装でコードに移したあとは、コード（Tailwind のテーマと React Native のテーマ）を正本にする。

## 構成

色は 2 層に分ける。

| 層             | 役割                                     | 名前の例                 |
| -------------- | ---------------------------------------- | ------------------------ |
| プリミティブ   | 色の値そのものに名前を付けたパレット     | `indigo.700`, `gray.600` |
| セマンティック | 用途に名前を付け、プリミティブを参照する | `color.text.secondary`   |

画面やコンポーネントは**セマンティックだけを使う**。用途ごとの色を一か所で変えられるようにし、「この灰色は文字用か線用か」を迷わないようにするため。

## 色

### プリミティブ

| 名前         | 50      | 100     | 200     | 300     | 400     | 500     | 600     | 700     | 800     | 900     |
| ------------ | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- |
| indigo（藍） | #EEF2F8 | #DCE4F0 | #B9C8DF | #8FA6C8 | #5F7DA8 | #3A5A88 | #2A4A74 | #1F3B63 | #172D4C | #0F1F36 |
| gray（鼠）   | #F6F7F9 | #EDEFF2 | #E2E5EA | #C9CED6 | #A3AAB5 | #7D8592 | #66707C | #4A525D | #2F353D | #1D2126 |

| 名前           | 100     | 300     | 500     | 700     |
| -------------- | ------- | ------- | ------- | ------- |
| yellow（提灯） | #FDF1C7 | #F8D25A | #F2B705 | #7A5A00 |
| red（朱）      | #FBECEA | —       | #C93A2B | #9B2A1E |
| green（若竹）  | #E8F4EC | —       | #2E7D4F | #1F5A38 |

`white` は #FFFFFF。

### セマンティック

| 名前                         | 参照       | 用途                                           |
| ---------------------------- | ---------- | ---------------------------------------------- |
| `color.bg.base`              | white      | 画面の背景                                     |
| `color.bg.subtle`            | gray.50    | 区切った領域、入力欄の無効時                   |
| `color.bg.brand`             | indigo.700 | のれん、主なボタン、カートのバー               |
| `color.bg.brand-hover`       | indigo.800 | 主なボタンのホバー                             |
| `color.bg.brand-subtle`      | indigo.50  | 選択中の項目、調理中・準備完了のラベル         |
| `color.bg.disabled`          | gray.100   | 無効なボタン                                   |
| `color.bg.accent`            | yellow.500 | カートの点数、受付中の印                       |
| `color.bg.danger`            | red.500    | 危険な操作のボタン（確認のダイアログの中だけ） |
| `color.bg.danger-hover`      | red.700    | 危険な操作のボタンのホバー                     |
| `color.bg.danger-subtle`     | red.100    | エラーのお知らせ                               |
| `color.bg.success-subtle`    | green.100  | 完了のお知らせ、配達完了のラベル               |
| `color.bg.warning-subtle`    | yellow.100 | 注意のお知らせ、受付待ちのラベル               |
| `color.text.primary`         | gray.900   | 本文・見出し                                   |
| `color.text.secondary`       | gray.600   | 補足、ラベル                                   |
| `color.text.disabled`        | gray.400   | 無効な文字                                     |
| `color.text.on-brand`        | white      | 藍の上の文字                                   |
| `color.text.on-brand-subtle` | indigo.200 | のれんの上の補足                               |
| `color.text.brand`           | indigo.700 | 選択中のタブ、文字だけのボタン                 |
| `color.text.danger`          | red.700    | エラーの文字（白・`danger-subtle` の上）       |
| `color.text.success`         | green.700  | 完了の文字（白・`success-subtle` の上）        |
| `color.text.warning`         | yellow.700 | 受付待ち                                       |
| `color.border.default`       | gray.200   | 区切り線、カードの枠                           |
| `color.border.strong`        | gray.300   | 入力欄の枠                                     |
| `color.border.focus`         | indigo.500 | キーボード操作での選択中                       |
| `color.border.danger`        | red.500    | エラーの入力欄                                 |

文字と背景の組み合わせは、本文で 4.5:1 以上のコントラスト比にする。主な組み合わせの値は次のとおり（無効な文字は対象外）。

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

| 名前        | 書体                | 大きさ | 太さ | 行の高さ | 用途               |
| ----------- | ------------------- | ------ | ---- | -------- | ------------------ |
| `display`   | Zen Old Mincho      | 30     | 700  | 1.3      | のれんの店名       |
| `heading.l` | Zen Kaku Gothic New | 22     | 700  | 1.4      | 画面の見出し       |
| `heading.m` | Zen Kaku Gothic New | 18     | 700  | 1.4      | 区切りの見出し     |
| `body.l`    | Zen Kaku Gothic New | 16     | 500  | 1.6      | 商品名、主な本文   |
| `body.m`    | Zen Kaku Gothic New | 14     | 400  | 1.6      | 本文               |
| `body.s`    | Zen Kaku Gothic New | 12     | 400  | 1.6      | 補足、説明文       |
| `label.l`   | Zen Kaku Gothic New | 16     | 700  | 1.2      | ボタン（大）、金額 |
| `label.m`   | Zen Kaku Gothic New | 14     | 700  | 1.2      | ボタン（中）、タブ |
| `label.s`   | Zen Kaku Gothic New | 11     | 700  | 1.2      | 状態のラベル、タグ |

## 余白・角丸・影

| 名前                  | 値                                       | 用途                                       |
| --------------------- | ---------------------------------------- | ------------------------------------------ |
| `space.1`〜`space.10` | 4 の倍数（4, 8, 12, 16, 20, 24, 32, 40） | 余白は必ずこの段階から選ぶ                 |
| `radius.xs`           | 4                                        | のれんの上端、タグ                         |
| `radius.sm`           | 8                                        | 入力欄、お知らせ                           |
| `radius.md`           | 12                                       | ボタン、写真                               |
| `radius.lg`           | 16                                       | カートのバー、下から出るシート、ダイアログ |
| `radius.full`         | 999                                      | 丸いボタン、チップ、点数                   |
| `shadow.raised`       | 0 6px 16px rgba(15,31,54,0.18)           | 画面の上に浮くバー                         |
| `shadow.overlay`      | 0 12px 32px rgba(15,31,54,0.24)          | ダイアログ、シート                         |

影は藍を混ぜた色にし、灰色の影を全体に付けない。浮いているものにだけ使う。

## アイコン

[Lucide](https://lucide.dev/)（ISC ライセンス）を使う。線の太さは 2、大きさは 20 か 24。アイコンだけのボタンには、読み上げ用の名前を付ける。
