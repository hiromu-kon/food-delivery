# 注文者アプリのメニュー（F-04 / S-C05）

店舗検索のカードから `/stores/[storeId]/menu` を開き、既存の署名付き Bearer と型付き `GET /stores/:storeId/menu` を使う。住所選択は店舗検索Controllerに保持し、戻ったときも明示した選択を優先する。受付停止店舗のカードも開ける。

APIの店舗名・説明・住所・写真・最低注文金額・受付状態を表示する。配達料は既存domain定数を表示する。カテゴリタブも各カテゴリ内の商品もAPIの配列順を保持し、カテゴリの説明・任意写真、商品の説明・税込価格・任意写真を表示する。最初のカテゴリを初期選択にし、カテゴリ切替で内容を表示する。空メニューと空カテゴリは別の案内を出す。売り切れ商品は残し、価格・「売り切れ」ラベル・薄い商品名と写真で示す。商品追加とカート操作は [cart-app.md](cart-app.md) を参照する。注文作成・決済は行わない。

読込開始・route変更・blur・認証再確認・認証失効・unmountで表示データを消去し、世代が古い成功・失敗応答を捨てる。route変更直後の描画でも店舗IDを照合する。通信失敗・404は画面に案内と再試行を出す。401/403は既存SessionControllerで失効し、ログインへ戻る。戻るボタンは履歴があれば戻り、直接開いた場合は店舗一覧へ移る。ScreenShellのsafe area・スクロール・キーボード回避と既存の下部タブを使う。

Penpot S-C05 (`b5f6bdf2-dac1-8004-8008-d825d1f5751f`) の実JSONでは背景 `color.bg.base`、店舗写真236px、暖簾124px（`color.bg.brand` / `color.text.on-brand`）、カテゴリ48px（gap `space.6`）、左右 `space.4`、商品行gap/上下 `space.4`、写真96px・`radius.md`、説明body-s、価格label-lを確認した。コードの既存token行高を保持し、長文で伸長する。nativeの戻る操作をAppHeaderに置き、APIの住所・カテゴリ説明を追加するため、固定座標の複製はしない。追加ボタンとCartBarはF-05で有効化する。

検証は専用PostgreSQL15440、API18802、Metro8121、Web URL3117と専用iOS Simulatorで、明示した合成ユーザー・店舗・カテゴリ・商品のみ使う。画像fixtureはdata URIとし外部配信元へアクセスしない。Androidはexportで確認する。fixture・ログ・スクリーンショット・操作再現手順は `/tmp/food-delivery-wave5/app` に保存する。
