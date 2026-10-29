import type { Metadata } from 'next';
import { Zen_Kaku_Gothic_New, Zen_Old_Mincho } from 'next/font/google';

import { Toaster } from '@/components/ui/sonner';

import './globals.css';

// 日本語の字形は unicode-range で分割配信されるため、subsets で絞れない。preload を切って必要な分だけ読ませる。
const zenKakuGothicNew = Zen_Kaku_Gothic_New({
  weight: ['400', '500', '700'],
  preload: false,
  display: 'swap',
  variable: '--font-zen-kaku-gothic-new',
});

const zenOldMincho = Zen_Old_Mincho({
  weight: ['700'],
  preload: false,
  display: 'swap',
  variable: '--font-zen-old-mincho',
});

export const metadata: Metadata = {
  title: 'Food Delivery',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="ja"
      className={`${zenKakuGothicNew.variable} ${zenOldMincho.variable} h-full antialiased`}
    >
      <body className="bg-base text-body-m text-primary flex min-h-full flex-col font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
