// 店舗向けの認証・権限の検査はページごとではなくこの layout に置く（ページ追加時の検査漏れを防ぐ）。
export default function StoreLayout({ children }: LayoutProps<'/store'>) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}
