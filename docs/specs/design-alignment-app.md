# 注文者アプリのデザイン整合

対象は実装済みの認証（S-C01〜03）、店舗検索（S-C04）、住所管理（S-C10）、アカウント（S-C11）と既存native部品。Penpotの注文者ページを画面構成の根拠とし、文字・色・行高などのtoken値はコードを正とする。長文のための固定高clipや、本文行高の縮小は行わない。

## 画面構成

- ログインはAppHeaderを置かず、左右24px、明朝boldのブランド30px、「近くのお店の料理を、お届けします」、フォーム、区切り、「はじめての方」、登録CTAを表示する。確認メール再送とその送信結果・エラーは補助領域に残す。
- 他画面は56pxを最小高とするAppHeaderと左右16px・上16pxの本文を使う。本文のブランドと重複見出しを置かない。signupと再設定はgap16、accountはgap20、住所cardsはgap12、店舗一覧はgap24。safe area、戻る操作、下部tabs、スクロールとキーボード回避を維持する。
- signupは氏名・メール・電話の利用目的をhelperで案内する。利用規約とプライバシーポリシーのリンクを並べ、単一checkboxの操作で既存の`termsAccepted`と`privacyAccepted`の両方を更新する。確認メール送信後の画面と再送を維持する。
- 店舗ホームは64pxを最小高とする住所バーから既存BottomSheetを開く。住所行の選択を既存Controllerへ渡し、末尾の追加CTAから既存住所管理へ遷移する。「配達できるお店」はheading-l（22px）、件数は同列gap8。メニュー未実装の案内は店舗cardsの後に置く。
- 住所一覧は住所と建物をbody-mにまとめ、配達メモをbody-sで表示する。変更・削除は44px以上の押下領域を持つ文字リンク、末尾の追加CTAは全幅secondaryとし、再読み込みはheader右のicon操作に置く。削除確認は既存danger dialogを使う。
- accountは56px avatar、氏名heading-m、メール・電話body-sのcompact profile、icon付きListItem（住所・規約・privacy・logout）、登録変更・退会の問い合わせ案内を表示する。ブラウザ起動失敗とメール未確認状態の案内を保持する。

## 共通部品と既存動作

MenuItemは写真URLがない場合に写真欄を省略し、追加ボタンを行末へ置く。URLがある画像の読込失敗時には既存の灰面とiconを残す。StoreCardの写真fallbackは従来通り。

OrderStepsはbarの縦領域16px、同じ中心線に各circleと接続線を揃え、gap8でラベルを置く。ラベルは最小20pxの領域で中央揃えし、label-sとbody-sの異なる行高でも見た目の中心を揃える。現在circleの外径24pxとコードのラベル行高を保持するため、Penpot見本の全高38pxには固定しない。Select popupはcontrolから8px離す。BottomSheetはhandleの可視位置とheadingの間隔を整え、閉じるXと40px操作領域、ドラッグ、scrim、キーボード回避、環境のsafe area、modalとaccessibility escapeを維持する。headingは長文で伸長できる。

SessionController・SecureStore・transport・住所/店舗Controllerの責務は変えない。認証/role判定、二重送信防止、失敗時の値保持、旧応答無効化、住所編集・削除後のfocus再取得、認証失効時の表示破棄は既存仕様通り。

## 今回扱わないモデルと機能

住所のlabelや既定状態は現在のDB/APIに存在しない。「自宅」「職場」「いつも使う」は表示せず、先頭住所を既定と表現しない。F04以降の注文業務、API/DB/contract、共有tokenの変更は含めない。

検証画像・UIシナリオ・fixtureと実行ログはrepo外に記録する。UI検証は専用Simulator、Metro8117、実createApp/API18797と専用PostgreSQL15434を使い、外部測位サービスのみDIする。課金APIや実地図は呼び出さない。Androidはexportの確認範囲とし、端末操作・VoiceOver全体の確認とは区別する。
