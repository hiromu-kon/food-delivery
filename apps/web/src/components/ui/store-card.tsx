import { formatDistance, formatYen } from '@repo/domain';
import Link from 'next/link';

import { FoodPhoto } from '@/components/ui/food-photo';
import { Tag } from '@/components/ui/tag';
import { cn } from '@/lib/cn';

type StoreCardProps = {
  href?: string;
  name: string;
  photoUrl?: string;
  paused?: boolean;
  deliveryFee: number;
  minimumOrderAmount: number;
  distanceMeters: number;
  className?: string;
};

function StoreCard({
  href,
  name,
  photoUrl,
  paused = false,
  deliveryFee,
  minimumOrderAmount,
  distanceMeters,
  className,
}: StoreCardProps) {
  const Container = href ? Link : 'article';
  return (
    <Container
      href={href!}
      data-slot="store-card"
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-md outline-none',
        href &&
          'hover:opacity-80 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-(--border-color-focus)',
        className,
      )}
    >
      <FoodPhoto
        photoUrl={photoUrl}
        alt={`${name}の料理`}
        sizes="(max-width: 767px) 100vw, 340px"
        className={cn('h-45 w-full', paused && 'opacity-50')}
        iconClassName="size-9"
      />
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={cn('text-body-l min-w-0 break-words', paused && 'text-secondary')}>
          {name}
        </h3>
        {paused && <Tag>受付停止中</Tag>}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {[
          ['配達料', formatYen(deliveryFee)],
          ['最低注文', formatYen(minimumOrderAmount)],
          ['距離', formatDistance(distanceMeters)],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center gap-1">
            <span className="text-body-s text-secondary">{label}</span>
            <span className={cn('text-label-m', paused && 'text-secondary')}>{value}</span>
          </div>
        ))}
      </div>
    </Container>
  );
}

export { StoreCard };
