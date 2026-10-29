'use client';

import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

// Penpot の Toast は文字の幅に合わせて中央に出るため、Sonner の決まった幅と左右の位置を上書きする。
// 600px 未満は Sonner が画面の幅いっぱいに並べる作りのため、そのままにする
// Toast の地は Penpot で本文の色のトークンを使っているため、背景のクラスではなく文字色の変数を参照する
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-center"
      icons={{
        success: <CircleCheckIcon className="size-4.5" />,
        error: <CircleAlertIcon className="size-4.5" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'text-body-m text-on-brand shadow-overlay flex items-center gap-2 rounded-sm px-4 py-3 min-[600px]:right-auto! min-[600px]:left-1/2! min-[600px]:w-max! min-[600px]:max-w-[calc(100vw-32px)] min-[600px]:-translate-x-1/2',
          default: 'bg-(--text-color-primary)',
          success: 'bg-(--text-color-primary)',
          error: 'bg-danger',
          icon: 'flex size-4.5 shrink-0 items-center justify-center',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
