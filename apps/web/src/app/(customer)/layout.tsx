import { LegalLinks } from '@/features/auth/auth-shell';

export default function CustomerLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="border-t">
        <div className="mx-auto max-w-300 px-4 py-6 sm:px-8">
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}
