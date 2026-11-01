'use client';

import { UtensilsCrossedIcon } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

import { cn } from '@/lib/cn';

function FoodPhoto({
  photoUrl,
  alt,
  className,
  sizes = '96px',
  iconClassName,
}: {
  photoUrl?: string | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  iconClassName?: string;
}) {
  const [failedUrl, setFailedUrl] = React.useState<string>();
  return (
    <div
      className={cn(
        'bg-disabled relative flex items-center justify-center overflow-hidden rounded-md',
        className,
      )}
    >
      {photoUrl && failedUrl !== photoUrl ? (
        // 写真の配信元が決まるまでは Next.js の画像プロキシを使わず、指定された URL から読み込む
        <Image
          src={photoUrl}
          alt={alt}
          fill
          sizes={sizes}
          unoptimized
          className="object-cover"
          onError={() => setFailedUrl(photoUrl)}
        />
      ) : (
        <UtensilsCrossedIcon className={cn('text-disabled size-6', iconClassName)} aria-hidden />
      )}
    </div>
  );
}

export { FoodPhoto };
