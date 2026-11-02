import Link from 'next/link';
import type { ReactNode } from 'react';

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-lg px-5 py-8 sm:py-14">
      <header className="mb-8 space-y-3">
        <h1 className="text-heading-l font-bold">{title}</h1>
        {description && <p className="text-body-m text-secondary">{description}</p>}
      </header>
      {children}
    </main>
  );
}

export function LegalLinks() {
  return (
    <nav aria-label="規約" className="text-body-s text-secondary flex flex-wrap gap-x-6 gap-y-3">
      <Link href="/terms" className="underline underline-offset-4">
        利用規約
      </Link>
      <Link href="/privacy" className="underline underline-offset-4">
        プライバシーポリシー
      </Link>
    </nav>
  );
}
