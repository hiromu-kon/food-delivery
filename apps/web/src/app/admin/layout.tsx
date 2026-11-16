export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}
