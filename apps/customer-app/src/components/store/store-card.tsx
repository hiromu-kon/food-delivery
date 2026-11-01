import { formatDistance, formatYen } from '@repo/domain';
import { cn } from '@repo/native-ui/cn';
import { Tag } from '@repo/native-ui/tag';
import { Text } from '@repo/native-ui/text';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { FoodPhoto } from './food-photo';

type StoreCardProps = Omit<React.ComponentProps<typeof Pressable>, 'children'> & {
  name: string;
  photoUrl?: string;
  paused?: boolean;
  deliveryFee: number;
  minimumOrderAmount: number;
  distanceMeters: number;
};

// 停止中でもメニューは見られる。注文できるかの判定は API と注文画面で扱う
function StoreCard({
  name,
  photoUrl,
  paused = false,
  deliveryFee,
  minimumOrderAmount,
  distanceMeters,
  className,
  ...props
}: StoreCardProps) {
  return (
    <Pressable role="button" className={cn('gap-3 active:opacity-80', className)} {...props}>
      <FoodPhoto
        photoUrl={photoUrl}
        label={`${name}の料理`}
        className={cn('h-45 w-full', paused && 'opacity-50')}
        iconClassName="size-9"
      />
      <View className="flex-row flex-wrap items-center gap-2">
        <Text variant="body-l" className={cn('shrink', paused && 'text-secondary')}>
          {name}
        </Text>
        {paused && <Tag>受付停止中</Tag>}
      </View>
      <View className="flex-row flex-wrap gap-x-4 gap-y-2">
        {[
          ['配達料', formatYen(deliveryFee)],
          ['最低注文', formatYen(minimumOrderAmount)],
          ['距離', formatDistance(distanceMeters)],
        ].map(([label, value]) => (
          <View key={label} className="flex-row items-center gap-1">
            <Text variant="body-s" className="text-secondary">
              {label}
            </Text>
            <Text variant="label-m" className={paused ? 'text-secondary' : ''}>
              {value}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

export { StoreCard };
