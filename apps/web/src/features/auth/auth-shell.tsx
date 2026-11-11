import Link from 'next/link';
import { ChevronLeftIcon } from 'lucide-react';
import { iconButtonVariants } from '@/components/ui/icon-button';
import type { ReactNode } from 'react';

export function AuthShell({
  title,
  description,
  children,
  login = false,
  backHref,
}: {
  title: string;
  login?: boolean;
  backHref?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-lg md:py-8">
      {login ? (
        <header className="space-y-2 px-6 pt-12 pb-8">
          <h1 className="text-display text-brand font-display">{title}</h1>
          {description && <p className="text-body-m text-secondary">{description}</p>}
        </header>
      ) : (
        <header className="relative flex h-14 items-center justify-center border-b px-4 md:border-0">
          {backHref && (
            <Link
              href={backHref}
              className={iconButtonVariants({ className: 'absolute left-2' })}
              aria-label="戻る"
            >
              <ChevronLeftIcon />
            </Link>
          )}
          <h1 className="text-heading-m">{title}</h1>
        </header>
      )}
      <div className={login ? 'px-6 pb-8' : 'space-y-4 px-4 py-4'}>
        {!login && description && <p className="text-body-m text-secondary">{description}</p>}
        {children}
      </div>
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
